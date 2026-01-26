// src/services/users.ts
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { auth, db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import { captureException } from "../lib/monitoring";

export type UserRoles = {
  admin?: boolean;
  [key: string]: boolean | undefined;
};

export type UserProfile = {
  uid: string;
  displayName: string | null;
  isPro: boolean;
  isAdmin: boolean;
  roles?: UserRoles;
  proStatus?: string | null;
  proStatusUpdatedAt?: any;
  plan?: string | null;
  stripeCustomerId?: string | null;
};

const DEFAULT_USER_PROFILE: Omit<UserProfile, "uid"> = {
  displayName: null,
  isPro: false,
  isAdmin: false,
  proStatus: null,
  plan: null,
  stripeCustomerId: null,
};

// Écoute le profil utilisateur dans Firestore
export function listenUserProfile(
  uid: string,
  callback: (profile: UserProfile) => void
) {
  const ref = doc(db, "users", uid);

  return onSnapshot(
    ref,
    async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        const rawRoles = data.roles;
        const roles: UserRoles | undefined =
          typeof rawRoles === "object" && rawRoles !== null ? rawRoles : undefined;
        const profile: UserProfile = {
          uid,
          displayName: data.displayName ?? DEFAULT_USER_PROFILE.displayName,
          isPro: !!data.isPro,
          isAdmin: !!data.isAdmin,
          roles,
          proStatus: data.proStatus ?? DEFAULT_USER_PROFILE.proStatus,
          proStatusUpdatedAt: data.proStatusUpdatedAt ?? null,
          plan: typeof data.plan === "string" ? data.plan : null,
          stripeCustomerId:
            typeof data.stripeCustomerId === "string" ? data.stripeCustomerId : null,
        };
        callback(profile);
      } else {
        // Si le doc n'existe pas, on le crée avec isPro = false par défaut
        const profile: UserProfile = {
          uid,
          ...DEFAULT_USER_PROFILE,
        };
        ensureWritesAllowed();
        try {
          await setDoc(
            ref,
            {
              ...DEFAULT_USER_PROFILE,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e: any) {
          if (e?.code === "permission-denied") {
            if (import.meta.env.DEV) {
              console.warn(`[listenUserProfile] setDoc permission-denied: uid=${uid}`);
            }
          } else {
            captureException(e);
          }
          // Continue with callback even if write failed
        }
        callback(profile);
      }
    },
    (error) => {
      // 🔒 PERMISSION-DENIED GUARD — Investisseur-grade error handling
      // Distinguish between:
      // 1) Expected: Boot race condition (Auth not ready) or Guest user
      // 2) Unexpected: Security bug (user reading wrong doc, broken rules, etc.)
      
      if (error.code === "permission-denied") {
        const currentUid = auth.currentUser?.uid;
        const isExpectedBoot = !currentUid || currentUid !== uid;
        
        if (isExpectedBoot) {
          // ✅ Expected: Auth not initialized yet OR guest user
          console.warn(
            `[ACCESS] ⚠️ listenUserProfile blocked (expected during boot/guest)`,
            {
              uid,
              currentUid: currentUid || "none",
              code: error.code,
              context: "Auth initialization race condition or guest user",
            }
          );
          
          // Safe fallback: return default profile
          callback({
            uid,
            ...DEFAULT_USER_PROFILE,
          });
          return;
        }
        
        // ❌ Unexpected: User is authenticated but permission-denied
        // This indicates a security bug (wrong uid, broken rules, data path error)
        console.error(
          `[ACCESS] ❌ listenUserProfile permission-denied UNEXPECTED (security bug)`,
          {
            uid,
            currentUid,
            code: error.code,
            message: error.message,
            context: "User authenticated but cannot read own profile — check Firestore Rules or data path",
          }
        );
        
        // Capture to monitoring (this is a real bug, not expected behavior)
        captureException(error);
        
        // Safe fallback (prevent app crash)
        callback({
          uid,
          ...DEFAULT_USER_PROFILE,
        });
        return;
      }
      
      // Other unexpected error (network, invalid path, etc.)
      console.error(
        `[ACCESS] ❌ listenUserProfile unexpected error`,
        {
          uid,
          code: error.code,
          message: error.message,
        }
      );
      
      // Capture to monitoring
      captureException(error);
      
      // Safe fallback
      callback({
        uid,
        ...DEFAULT_USER_PROFILE,
      });
    }
  );
}

const ADMINSYMBOLS = new Set(["yes", "true", "1"]);

function normalizeAdminValue(value: unknown): string | boolean | number | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim().toLowerCase();
  return null;
}

function isTruthyAdminValue(value: unknown): boolean {
  const normalized = normalizeAdminValue(value);
  if (normalized === true) return true;
  if (typeof normalized === "number") {
    return normalized === 1;
  }
  if (typeof normalized === "string") {
    return ADMINSYMBOLS.has(normalized);
  }
  return false;
}

// Helper used across the app to determine admin access.
// To grant admin rights manually, set users/{uid}.roles.admin = true/\"yes\" (or keep the legacy isAdmin flag).
export function isUserAdmin(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  if (isTruthyAdminValue(profile.roles?.admin)) return true;
  if (isTruthyAdminValue(profile.isAdmin)) return true;
  return false;
}

export function isUserSuperAdmin(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  return isTruthyAdminValue(profile.roles?.superAdmin);
}
