// src/components/AuthBar.tsx
import { useEffect, useState } from "react";
import { type User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useLiveUserProfile } from "../hooks/useLiveUserProfiles";
import { useAuthUI } from "../contexts/useAuthUI";
import { useToast } from "../contexts/useToast";

export default function AuthBar() {
  const [user, setUser] = useState<User | null>(null);
  const profile = useLiveUserProfile(user?.uid ?? null);
  const isProUser = profile?.isPro ?? false;
  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "explorateur";
  const avatarUrl = profile?.photoURL || user?.photoURL || null;
  const toast = useToast();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de se déconnecter pour le moment.");
    }
  };

  const { requireAuth } = useAuthUI();

  const openLogin = () => {
    requireAuth({ mode: "login", reason: "Se connecter" });
  };

  const openSignup = () => {
    requireAuth({ mode: "signup", reason: "Créer un compte" });
  };

  return (
    <>
      <div className="auth-bar auth-bar-compact">
        {user ? (
          <div className="auth-chip">
            <div className="auth-chip-avatar">
              {avatarUrl ? (
                <div className="auth-avatar-wrapper">
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="auth-avatar-img"
                  />
                </div>
              ) : (
                <span>{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="auth-chip-text">
              <span className="auth-chip-label">Bonjour</span>
              <div className="auth-chip-name">
                {displayName}
                {isProUser && <span className="auth-chip-pro">PRO ✨</span>}
              </div>
            </div>
            <button className="auth-chip-logout" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="auth-chip auth-chip-guest">
            <div className="auth-chip-text">
              <span className="auth-chip-label">UrbexQueens</span>
              <div className="auth-chip-name">Connexion rapide</div>
            </div>
            <div className="auth-chip-actions">
              <button className="auth-btn-ghost" onClick={openLogin}>
                Se connecter
              </button>
              <button className="auth-btn-primary" onClick={openSignup}>
                Créer un compte
              </button>
            </div>
          </div>
        )}
      </div>

    </>
  );
}
