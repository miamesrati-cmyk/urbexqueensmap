import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  listenUserProfile,
  type UserProfile,
} from "../services/users";

export type ProSource = "firestore" | "claims";

type ProStatusContextValue = {
  user: User | null;
  profile: UserProfile | null;
  profileReady: boolean;
  authReady: boolean;
  isPro: boolean;
  proLoading: boolean;
  proSource: ProSource;
  proStatus: string;
};

const ProStatusContext = createContext<ProStatusContextValue | null>(null);

export function ProStatusProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [lastKnownPro, setLastKnownPro] = useState(false);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (nextUser) => {
      setAuthReady(true);
      setUser(nextUser);
      setProfile(null);
      setProfileReady(false);
      if (!nextUser) {
        setLastKnownPro(false);
        profileUnsub?.();
        profileUnsub = null;
        return;
      }

      profileUnsub?.();
      profileUnsub = listenUserProfile(nextUser.uid, (nextProfile) => {
        setProfile(nextProfile);
        setProfileReady(true);
        setLastKnownPro(nextProfile.isPro);
      });
    });

    return () => {
      authUnsub();
      profileUnsub?.();
    };
  }, []);

  const proLoading = Boolean(user && !profileReady);
  const isPro = profileReady ? Boolean(profile?.isPro) : lastKnownPro;
  const proSource: ProSource = user && profileReady ? "firestore" : "claims";
  const proStatus = profile?.proStatus ?? "unknown";

  const prevSnapshotRef = useRef({
    isPro,
    proStatus,
    proSource,
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const prev = prevSnapshotRef.current;
    const next = { isPro, proSource, proStatus };
    if (
      prev.isPro !== next.isPro ||
      prev.proStatus !== next.proStatus ||
      prev.proSource !== next.proSource
    ) {
      const reason = user
        ? profileReady
          ? "firestore"
          : "claims"
        : "signed-out";
      console.log("[UQ][PRO] change", {
        prev,
        next,
        source: proSource,
        reason,
        ts: new Date().toISOString(),
      });
      prevSnapshotRef.current = next;
    }
  }, [isPro, proStatus, proSource, profileReady, user]);

  const value = useMemo<ProStatusContextValue>(
    () => ({
      user,
      profile,
      profileReady,
      authReady,
      isPro,
      proLoading,
      proSource,
      proStatus,
    }),
    [user, profile, profileReady, authReady, isPro, proLoading, proSource, proStatus]
  );

  return (
    <ProStatusContext.Provider value={value}>
      {children}
    </ProStatusContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProStatus() {
  const context = useContext(ProStatusContext);
  if (!context) {
    throw new Error("useProStatus must be used within ProStatusProvider");
  }
  return context;
}
