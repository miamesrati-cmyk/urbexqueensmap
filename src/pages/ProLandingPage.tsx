import { useCallback, useState } from "react";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { useAuthUI } from "../contexts/useAuthUI";
import { startProCheckout } from "../services/stripe";
import "./ProLandingPage.css";

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

export default function ProLandingPage() {
  const { user, isPro } = useCurrentUserRole();
  const { requireAuth } = useAuthUI();
  const [loading, setLoading] = useState(false);

  const handleGoPro = useCallback(async () => {
    console.info("[analytics] pro_cta_click", { location: "pro-page" });
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
      alert("Impossible de lancer le paiement PRO pour le moment.");
    } finally {
      setLoading(false);
    }
  }, [isPro, requireAuth, user]);

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
            className="pro-landing-cta"
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
