import { useCallback, useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
// import { trackCheckoutSuccess } from "../utils/conversionTracking"; // TODO: Uncomment when ready
import "./ProReturnPage.css";

const POLL_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 20;
const VERIFY_DELAY_MS = 2500;
const EXTRA_ATTEMPTS_AFTER_VERIFY = Math.ceil(3000 / POLL_INTERVAL_MS);

type ProReturnStatus = "success" | "cancel";

type Props = {
  status: ProReturnStatus;
  sessionId?: string;
};

export default function ProReturnPage({ status, sessionId }: Props) {
  const { user } = useCurrentUserRole();
  const [phase, setPhase] = useState<"syncing" | "timeout" | "cancelled" | "done">(
    status === "cancel" ? "cancelled" : "syncing"
  );
  const [message, setMessage] = useState(() =>
    status === "cancel"
      ? "Paiement annulé. Tu peux retenter l’abonnement PRO."
      : "Synchronisation PRO en cours…"
  );
  const [retryKey, setRetryKey] = useState(0);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resolvedStatus, setResolvedStatus] = useState<ProReturnStatus>(() => status);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | undefined>(() => sessionId);
  const maxAttemptsRef = useRef(MAX_ATTEMPTS);
  const verifyAttemptedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const redirectToMap = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("urbex-nav", {
        detail: { path: "/" },
      })
    );
  }, []);

  const goToPro = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("urbex-nav", {
        detail: { path: "/pro" },
      })
    );
  }, []);

  const resetRetry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    attemptsRef.current = 0;
    setPhase("syncing");
    setMessage("Synchronisation PRO en cours…");
    setRetryKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let nextStatus = status;
    let nextSessionId = sessionId;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramStatus = params.get("status")?.toLowerCase();
      if (paramStatus) {
        nextStatus = paramStatus === "success" ? "success" : "cancel";
      }
      if (params.has("session_id")) {
        const sessionParam = params.get("session_id") ?? "";
        nextSessionId = sessionParam || undefined;
      }
    }
    setResolvedStatus(nextStatus);
    setResolvedSessionId(nextSessionId ?? undefined);
  }, [status, sessionId]);

  useEffect(() => {
    console.info("pro_return_view", {
      status: resolvedStatus,
      has_session_id: Boolean(resolvedSessionId),
    });
  }, [resolvedStatus, resolvedSessionId]);

  useEffect(() => {
    if (resolvedStatus === "cancel") {
      setPhase("cancelled");
      setMessage("Paiement annulé. Tu peux retenter l’abonnement PRO.");
      return;
    }

    if (!user) {
      const next = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`
      );
      window.location.href = `/connexion?next=${next}`;
      return;
    }

    let cancelled = false;
    attemptsRef.current = 0;
    setPhase("syncing");
    setMessage("Synchronisation PRO en cours…");
    maxAttemptsRef.current = MAX_ATTEMPTS;
    verifyAttemptedRef.current = false;
    startTimeRef.current = Date.now();

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const triggerVerifySession = async () => {
      if (!resolvedSessionId) {
        return;
      }
      try {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) {
          return;
        }
        const response = await fetch("/api/stripe/verify-pro-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ sessionId: resolvedSessionId }),
        });
        const payload = await response
          .json()
          .catch(() => ({ entitled: false }));
        console.info("[UQ][STRIPE_VERIFY_CLIENT]", {
          uid: user?.uid ?? null,
          sessionId: resolvedSessionId,
          status: response.status,
          entitled: payload.entitled,
          reason: payload.reason,
        });
      } catch (err) {
        console.warn("[UQ][STRIPE_VERIFY_CLIENT]", err);
      }
    };

    const pollStatus = async () => {
      if (cancelled) return;
      try {
        await auth.currentUser?.getIdToken(true);
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const isPro = snapshot.data()?.isPro ?? false;
        if (isPro) {
          if (cancelled) return;
          
          // TODO: CONVERSION TRACKING - Uncomment when ready for production metrics
          // const params = new URLSearchParams(window.location.search);
          // const src = params.get("src") || "direct";
          // trackCheckoutSuccess(
          //   "pro_monthly", // TODO: Get actual plan from snapshot.data()?.proPlan
          //   9.99,          // TODO: Get actual value
          //   src,
          //   user?.uid || null
          // );
          
          setPhase("done");
          setMessage("Ton compte PRO est synchronisé. Redirection…");
          window.setTimeout(() => redirectToMap(), 1200);
          return;
        }
      } catch (err) {
        console.error("Erreur de synchronisation PRO:", err);
        if (cancelled) {
          return;
        }
        setMessage("Impossible de synchroniser pour le moment.");
      }

      if (cancelled) return;
      attemptsRef.current += 1;
      const elapsed = Date.now() - startTimeRef.current;
      if (
        resolvedStatus === "success" &&
        resolvedSessionId &&
        !verifyAttemptedRef.current &&
        elapsed >= VERIFY_DELAY_MS
      ) {
        verifyAttemptedRef.current = true;
        maxAttemptsRef.current = Math.max(
          maxAttemptsRef.current,
          MAX_ATTEMPTS + EXTRA_ATTEMPTS_AFTER_VERIFY
        );
        setMessage("Vérification du paiement Stripe…");
        void triggerVerifySession();
      }
      if (attemptsRef.current < maxAttemptsRef.current) {
        clearTimer();
        timerRef.current = window.setTimeout(pollStatus, POLL_INTERVAL_MS);
      } else {
        setPhase("timeout");
        setMessage(
          "Nous sommes toujours en train de synchroniser ton statut PRO. Réessaie dans quelques instants."
        );
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [resolvedStatus, resolvedSessionId, user, redirectToMap, retryKey]);

  return (
    <div className="pro-return-page">
      <div className="pro-return-card">
        <div className="pro-return-icon">✨</div>
        <h1>Retour PRO</h1>
        <p className="pro-return-message">{message}</p>
        {(phase === "syncing" || phase === "done") && (
          <div
            className="pro-return-loader"
            role="status"
            aria-live="polite"
            aria-label="Synchronisation PRO en cours"
          />
        )}
        {phase === "timeout" && (
          <button
            type="button"
            className="pro-return-button"
            onClick={resetRetry}
          >
            Réessayer la synchronisation
          </button>
        )}
        {(phase === "cancelled" || phase === "timeout") && (
          <button type="button" className="pro-return-button" onClick={goToPro}>
            Retour à la page PRO
          </button>
        )}
        {resolvedSessionId && (
          <p className="pro-return-session">
            Session Stripe&nbsp;: <code>{resolvedSessionId}</code>
          </p>
        )}
      </div>
    </div>
  );
}
