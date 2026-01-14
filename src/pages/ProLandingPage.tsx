import { useCallback, useEffect, useState } from "react";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import useInteractionPulse from "../hooks/useInteractionPulse";
import { useAuthUI } from "../contexts/useAuthUI";
import { useToast } from "../contexts/useToast";
import { startProCheckout } from "../services/stripe";
import { trackTimeRiftPaywallView } from "../utils/conversionTracking";
import "./ProLandingPage.css";

type ProLandingPageProps = {
  nightVisionActive?: boolean;
  onToggleNightVision?: () => void;
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
    detail: "Un accès rapide à l’équipe UrbexQueens quand tu as besoin d’aide sur ton plan PRO.",
  },
  {
    icon: "🛡️",
    title: "Badges & profil premium",
    detail:
      "Fais rayonner ton profil avec des badges premium, des couleurs exclusives et un halo PRO.",
  },
];

export default function ProLandingPage({ 
  nightVisionActive = false, 
  onToggleNightVision 
}: ProLandingPageProps = {}) {
  const { user, isPro } = useCurrentUserRole();
  const { requireAuth } = useAuthUI();
  const [loading, setLoading] = useState(false);
  const [ctaPulseActive, triggerCtaPulse] = useInteractionPulse(360);
  const toast = useToast();

  // 📊 CONVERSION TRACKING: Track /pro page view with source (idempotent)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src"); // null if not present
    if (src) {
      // Only track if coming from a campaign (e.g., ?src=history)
      trackTimeRiftPaywallView(src, user?.uid || null);
      // Note: trackTimeRiftPaywallView has built-in guards:
      // - sessionStorage prevents double-counting (StrictMode safe)
      // - Filters out "direct" traffic (no ?src= param)
    }
  }, [user?.uid]);

  const handleGoPro = useCallback(async () => {
    console.info("[analytics] pro_cta_click", { location: "pro-page" });
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
  }, [isPro, requireAuth, user, triggerCtaPulse]);

  return (
    <div className="pro-landing-page">
      <header className="pro-landing-hero">
        <span className="pro-landing-kicker">Club élite UrbexQueens</span>
        <h1>UrbexQueens PRO</h1>
        <p className="pro-landing-description">
          Une carte premium, des badges lumineux et des outils nocturnes pour celles qui
          explorent au-delà des barrières.
        </p>
        <div className="pro-landing-hero-actions">
          <button
            type="button"
            className={`pro-landing-cta${ctaPulseActive ? " is-pulsing" : ""}`}
            onClick={handleGoPro}
            disabled={loading || isPro}
          >
            {isPro ? "Tu es PRO ✅" : loading ? "Préparation..." : "Débloquer PRO"}
          </button>
          <div className="pro-landing-price">
            12,99 $ / mois · annulable à tout moment
          </div>
        </div>
        <div className="pro-landing-hero-tags">
          <span>Night Vision</span>
          <span>Satellite</span>
          <span>Ghost Maps</span>
        </div>
      </header>

      <section className="pro-landing-benefits">
        <div className="pro-landing-benefits-head">
          <h2>Des outils taillés pour les PRO</h2>
          <p>
            Cartes premium, couches rares, récits exclusifs et progression gamifiée. Tout est pensé
            pour des runs sûrs, stylés et ultra clairs.
          </p>
        </div>
        <div className="pro-landing-benefits-grid">
          {BENEFITS.map((benefit) => (
            <article key={benefit.title} className="pro-landing-benefit-card">
              <div className="pro-landing-benefit-icon">{benefit.icon}</div>
              <div>
                <h3>{benefit.title}</h3>
                <p>{benefit.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {isPro && onToggleNightVision && (
        <section className="pro-landing-settings">
          <div className="pro-landing-settings-head">
            <h2>Paramètres PRO</h2>
            <p>Options exclusives réservées aux membres PRO</p>
          </div>
          <div className="pro-landing-settings-card">
            <div className="pro-setting-item">
              <div className="pro-setting-info">
                <span className="pro-setting-icon">🌒</span>
                <div>
                  <h3 className="pro-setting-title">Night Vision</h3>
                  <p className="pro-setting-desc">
                    Active le mode vision nocturne pour une navigation optimisée dans l'obscurité
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={`pro-toggle-button ${nightVisionActive ? "is-active" : ""}`}
                onClick={onToggleNightVision}
                aria-label="Activer/désactiver Night Vision"
              >
                <span className="pro-toggle-track">
                  <span className="pro-toggle-thumb" />
                </span>
                <span className="pro-toggle-label">
                  {nightVisionActive ? "Activé" : "Désactivé"}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="pro-landing-extra">
        <div className="pro-landing-extra-card">
          <h3>Premium glass & violet glow</h3>
          <p>
            Des fonds texturés, des halos violets et des lueurs nocturnes pour une navigation
            fidèle à l’esprit UrbexQueens.
          </p>
        </div>
        <div className="pro-landing-extra-card">
          <h3>Tarification claire</h3>
          <p>Annulation en un clic, support prioritaire et facturation via Stripe.</p>
        </div>
        <div className="pro-landing-extra-card">
          <h3>CTA Stripe</h3>
          <p>
            Clique pour lancer Stripe Checkout. Si tu n’es pas connecté·e, le login te ramène ici
            une fois identifié·e.
          </p>
        </div>
      </section>
    </div>
  );
}
