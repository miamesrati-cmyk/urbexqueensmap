import { useCallback, useState } from "react";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import useInteractionPulse from "../hooks/useInteractionPulse";
import { useAuthUI } from "../contexts/useAuthUI";
import { useToast } from "../contexts/useToast";
import { startProCheckout } from "../services/stripe";
import "./ProModal.css";

type ProModalProps = {
  open: boolean;
  onClose: () => void;
};

const BENEFITS = [
  {
    icon: "🌒",
    title: "Night Vision & Satellite",
    detail:
      "Switch instantly between Night Vision, Satellite and PRO map controls for flawless recon.",
  },
  {
    icon: "🛰",
    title: "Couches EPIC & GHOST",
    detail: "Dévoile les couches EPIC et GHOST triées pour les membres PRO uniquement.",
  },
  {
    icon: "✨",
    title: "Spots exclusifs & feed PRO",
    detail:
      "Découvre les lieux privés et les avant-premières du feed réservés aux exploratrices PRO.",
  },
  {
    icon: "🎮",
    title: "Mode jeu & XP",
    detail:
      "Accumule des XP, complète des missions et débloque des défis pensés pour la communauté PRO.",
  },
  {
    icon: "⚡",
    title: "Support prioritaire",
    detail: "Un accès rapide à l'équipe UrbexQueens quand tu as besoin d'aide sur ton plan PRO.",
  },
  {
    icon: "🛡️",
    title: "Badges & profil premium",
    detail:
      "Fais rayonner ton profil avec des badges premium, des couleurs exclusives et un halo PRO.",
  },
];

export default function ProModal({ open, onClose }: ProModalProps) {
  const { user, isPro } = useCurrentUserRole();
  const { requireAuth } = useAuthUI();
  const [loading, setLoading] = useState(false);
  const [ctaPulseActive, triggerCtaPulse] = useInteractionPulse(360);
  const toast = useToast();

  const handleGoPro = useCallback(async () => {
    console.info("[analytics] pro_cta_click", { location: "pro-modal" });
    triggerCtaPulse();
    if (isPro) return;
    if (!user) {
      const ok = await requireAuth({
        mode: "login",
        reason: "Connecte-toi pour débloquer PRO",
        redirectTo: "/pro",
      });
      if (!ok) {
        return;
      }
    }
    setLoading(true);
    try {
      const url = await startProCheckout();
      window.location.href = url;
    } catch (error) {
      console.error("Erreur PRO checkout", error);
      toast.error("Impossible de lancer le paiement PRO pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [isPro, requireAuth, user, triggerCtaPulse, toast]);

  if (!open) return null;

  return (
    <div className="pro-modal-overlay" onClick={onClose}>
      <div className="pro-modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="pro-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="pro-modal-content">
          <header className="pro-modal-hero">
            <span className="pro-modal-kicker">Club élite UrbexQueens</span>
            <h1>UrbexQueens PRO</h1>
            <p className="pro-modal-description">
              Une carte premium, des badges lumineux et des outils nocturnes pour celles qui
              explorent au-delà des barrières.
            </p>
            <div className="pro-modal-hero-actions">
              <button
                type="button"
                className={`pro-modal-cta${ctaPulseActive ? " is-pulsing" : ""}`}
                onClick={handleGoPro}
                disabled={loading || isPro}
              >
                {isPro ? "Tu es PRO ✅" : loading ? "Préparation..." : "Débloquer PRO"}
              </button>
              <div className="pro-modal-price">
                12,99 $ / mois · annulable à tout moment
              </div>
            </div>
            <div className="pro-modal-hero-tags">
              <span>Night Vision</span>
              <span>Satellite</span>
              <span>Ghost Maps</span>
            </div>
          </header>

          <section className="pro-modal-benefits">
            <div className="pro-modal-benefits-head">
              <h2>Des outils taillés pour les PRO</h2>
              <p>
                Cartes premium, couches rares, récits exclusifs et progression gamifiée. Tout est pensé
                pour des runs sûrs, stylés et ultra clairs.
              </p>
            </div>
            <div className="pro-modal-benefits-grid">
              {BENEFITS.map((benefit, index) => (
                <article 
                  key={benefit.title} 
                  className="pro-modal-benefit-card"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="pro-modal-benefit-icon">{benefit.icon}</div>
                  <div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
