// src/components/AuthModal.tsx
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { ensureUserSearchFields } from "../services/userProfiles";

type Mode = "login" | "signup";
type View = "auth" | "reset";

type AuthModalProps = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  reason?: string;
};

export default function AuthModal({
  open,
  mode: initialMode,
  onClose,
  reason,
}: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [view, setView] = useState<View>("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [displayReason, setDisplayReason] = useState<string | undefined>(reason);

  useEffect(() => {
    setMode(initialMode);
    setView("auth");
    setError(null);
    setInfo(null);
  }, [initialMode]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setDisplayName("");
      setError(null);
      setInfo(null);
      setLoading(false);
      setView("auth");
    }
  }, [open]);

  useEffect(() => {
    setDisplayReason(reason);
  }, [reason]);

  const titleIdRef = useRef<string | null>(null);
  if (titleIdRef.current === null) {
    const baseId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10);
    titleIdRef.current = `auth-modal-title-${baseId}`;
  }
  const titleId = titleIdRef.current;

  if (!open || typeof document === "undefined") return null;

  const isSignup = mode === "signup";
  const headerTitle =
    view === "reset"
      ? "Réinitialiser le mot de passe"
      : isSignup
      ? "Inscription"
      : "Se connecter";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (view !== "auth") return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (displayName.trim()) {
          await updateProfile(cred.user, {
            displayName: displayName.trim(),
          });
        }
        await ensureUserSearchFields(cred.user.uid, displayName.trim());
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = "Une erreur est survenue.";
      if (err.code === "auth/email-already-in-use") msg = "Cet e-mail est déjà utilisé.";
      if (err.code === "auth/invalid-email") msg = "Adresse e-mail invalide.";
      if (err.code === "auth/wrong-password") msg = "Mot de passe incorrect.";
      if (err.code === "auth/user-not-found") msg = "Aucun compte avec cet e-mail.";
      if (err.code === "auth/operation-not-allowed") {
        msg = "La connexion par e-mail/mot de passe n'est pas activée dans Firebase.";
      }
      if (err.code === "auth/invalid-credential") {
        msg = "Email ou mot de passe incorrect.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Un e-mail de réinitialisation a été envoyé si ce compte existe.");
    } catch (err: any) {
      console.error(err);
      let msg = "Impossible d'envoyer l'e-mail de réinitialisation.";
      if (err.code === "auth/invalid-email") msg = "Adresse e-mail invalide.";
      if (err.code === "auth/user-not-found") {
        msg = "Aucun compte trouvé avec cet e-mail.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureUserSearchFields(cred.user.uid, cred.user.displayName);
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Connexion Google annulée.");
      } else {
        setError("Impossible de se connecter avec Google pour le moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode("login");
    setView("auth");
    setError(null);
    setInfo(null);
    setDisplayReason(reason);
  };

  const switchToSignup = () => {
    setMode("signup");
    setView("auth");
    setError(null);
    setInfo(null);
    setDisplayReason(undefined);
  };

  const modalContent = (
      <div className="auth-modal-backdrop" onClick={onClose}>
      <div
        className="auth-modal"
        data-testid="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="auth-modal-header">
          <h2 id={titleId}>{headerTitle}</h2>
          <button
            className="auth-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
          {displayReason && displayReason !== headerTitle && (
            <p className="auth-modal-reason">{displayReason}</p>
          )}
        </div>

        <div className="auth-tabs">
            <button
              data-testid="auth-switch-login"
              className={`auth-tab ${
                mode === "login" && view === "auth" ? "auth-tab-active" : ""
              }`}
              type="button"
              onClick={switchToLogin}
            >
              Connexion
            </button>
            <button
              data-testid="auth-switch-signup"
              className={`auth-tab ${
                mode === "signup" && view === "auth" ? "auth-tab-active" : ""
              }`}
              type="button"
              onClick={switchToSignup}
            >
              Inscription
            </button>
            </div>

        {view === "auth" && (
          <>
            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <span className="auth-google-logo">G</span>
              Continuer avec Google
            </button>
            <div className="auth-separator">
              <span>ou</span>
            </div>
          </>
        )}

        {view === "auth" ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-display-name">Nom d’utilisateur</label>
              <input
                id="auth-display-name"
                name="displayName"
                type="text"
                data-testid="auth-username"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Ton pseudo (ex: UrbexQueen)"
              />
            </div>
            )}
            <div className="auth-field">
              <label htmlFor="auth-email">courriel</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                data-testid="auth-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ton.email@example.com"
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Mot de passe</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                data-testid="auth-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Min. 6 caractères"
                required
              />
            </div>
            {error && <p className="auth-error-msg">{error}</p>}
            {info && <p className="auth-info-msg">{info}</p>}
            <button
              data-testid="auth-submit"
              className="auth-submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? "Patiente..." : isSignup ? "Créer mon compte" : "Se connecter"}
            </button>

            {!isSignup && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setView("reset");
                  setError(null);
                  setInfo(null);
                }}
              >
                Mot de passe oublié ?
              </button>
            )}
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleReset}>
          <div className="auth-field">
            <label htmlFor="auth-reset-email">Courriel</label>
            <input
              id="auth-reset-email"
              name="resetEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ton.email@example.com"
              required
            />
          </div>
            {error && <p className="auth-error-msg">{error}</p>}
            {info && <p className="auth-info-msg">{info}</p>}
            <button className="auth-submit-btn" type="submit" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer le lien de réinitialisation"}
            </button>
            <button
              type="button"
              className="auth-link"
              onClick={() => {
                setView("auth");
                setError(null);
                setInfo(null);
              }}
            >
              ← Retour à la connexion
            </button>
          </form>
        )}

        <p className="auth-hint">
          En créant un compte, tu pourras sauvegarder des spots, marquer ceux que tu as visités et personnaliser ta carte UrbexQueens.
        </p>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
