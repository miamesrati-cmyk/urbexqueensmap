import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";

type ProReturnStatus = "success" | "cancel";

type Props = {
  status: ProReturnStatus;
  sessionId?: string;
};

export default function ProReturnPage({ status, sessionId }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(status === "success");

  useEffect(() => {
    if (status !== "success") {
      setIsRefreshing(false);
      return;
    }

    let cancelled = false;
    auth.currentUser?.getIdToken(true).finally(() => {
      if (!cancelled) {
        setIsRefreshing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status === "success" && !isRefreshing && typeof window !== "undefined") {
      const timer = window.setTimeout(() => {
        window.location.replace("/pro");
      }, 2300);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [status, isRefreshing]);

  const headline =
    status === "success" ? "Merci ! Ton PRO a été activé." : "Paiement annulé";
  const description =
    status === "success"
      ? isRefreshing
        ? "Synchronisation de ton abonnement PRO en cours…"
        : "Tu es PRO ! Redirection vers la page PRO…"
      : "Ton paiement a été annulé. Tu peux réessayer quand tu veux.";

  return (
    <main
      className="pro-return-page"
      style={{
        minHeight: "60vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
      }}
    >
      <section
        style={{
          maxWidth: 480,
          textAlign: "center",
          background: "rgba(0,0,0,0.7)",
          borderRadius: 16,
          padding: "2rem",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <h1>{headline}</h1>
        <p style={{ marginTop: "1rem", fontSize: "1.1rem" }}>{description}</p>
        {sessionId && (
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.85rem",
              color: "#ccc",
            }}
          >
            Session Stripe : {sessionId}
          </p>
        )}
        {status === "success" && isRefreshing && (
          <p className="map-loading-text" style={{ marginTop: "1.5rem" }}>
            Synchronisation PRO…
          </p>
        )}
      </section>
    </main>
  );
}
