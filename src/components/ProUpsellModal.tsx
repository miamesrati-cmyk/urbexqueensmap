import { useState } from "react";
import useInteractionPulse from "../hooks/useInteractionPulse";
import { startProCheckout } from "../services/stripe";
import { useToast } from "../contexts/useToast";

type ProUpsellModalProps = {
  open: boolean;
  onClose: () => void;
  onContinueFree?: () => void;
};

const PRO_UPSELL_FEATURES = [
  {
    icon: "👻",
    title: "Ghost Maps (hotspots)",
    detail: "Révèle les points paranormaux sans éclat commercial.",
  },
  {
    icon: "🧭",
    title: "Pathfinder (itinéraires)",
    detail: "Trace des runs précis, combine filtres et trajectoires fiables.",
  },
  {
    icon: "✨",
    title: "Spots légendaires (détails)",
    detail: "Histoires complètes, archives secrètes et coordonnées verrouillées.",
  },
];

export default function ProUpsellModal({
  open,
  onClose,
  onContinueFree,
}: ProUpsellModalProps) {
  const [loading, setLoading] = useState(false);
  const [ctaPulseActive, triggerCtaPulse] = useInteractionPulse(360);
  const toast = useToast();
  const handleContinue = () => {
    if (onContinueFree) {
      onContinueFree();
    } else {
      onClose();
    }
  };

  if (!open) return null;

  const handleGoPro = async () => {
    triggerCtaPulse();
    setLoading(true);
    try {
      const url = await startProCheckout({ priceId: "pro_monthly" });
      window.location.href = url;
    } catch (err) {
      console.error("Erreur go PRO:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d’ouvrir le paiement pour l’instant.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pro-modal-backdrop" onClick={onClose}>
      <div className="pro-modal uq-modal-anim" onClick={(e) => e.stopPropagation()}>
        {loading && (
          <div className="pro-loading-overlay">
            <div className="uq-skeleton uq-skeleton-circle" />
            <div className="map-loading-text">Connexion Stripe sécurisée…</div>
          </div>
        )}

        <header className="pro-modal-header">
          <h2>Débloquer PRO</h2>
          <button className="pro-modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <p className="pro-modal-tagline">
          Accède à la carte premium et à toutes les archives secrètes de l’urbex.
        </p>

        <ul className="pro-modal-bullet-list">
          {PRO_UPSELL_FEATURES.map((feature) => (
            <li key={feature.title}>
              <span aria-hidden="true">{feature.icon}</span>
              <div>
                <strong>{feature.title}</strong>
                <p>{feature.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="pro-modal-actions">
          <button
            className={`pro-modal-cta${ctaPulseActive ? " is-pulsing" : ""}`}
            onClick={handleGoPro}
            disabled={loading}
          >
            {loading ? "Redirection..." : "Devenir PRO"}
          </button>
          <button
            type="button"
            className="pro-modal-secondary"
            onClick={handleContinue}
          >
            Continuer en gratuit
          </button>
        </div>
      </div>
    </div>
  );
}
