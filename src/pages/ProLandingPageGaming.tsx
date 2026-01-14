import { useCallback, useState } from "react";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import useInteractionPulse from "../hooks/useInteractionPulse";
import { useAuthUI } from "../contexts/useAuthUI";
import { useToast } from "../contexts/useToast";
import { startProCheckout } from "../services/stripe";
import "../styles/pro-gaming.css";

type ProLandingPageGamingProps = {
  nightVisionActive?: boolean;
  onToggleNightVision?: () => void;
};

const BENEFITS = [
  {
    icon: "🌒",
    title: "Night Vision & Satellite",
    detail: "Switch entre modes Night, Satellite et contrôles PRO pour une recon parfaite.",
    xpBonus: "+50 XP"
  },
  {
    icon: "🛰",
    title: "Couches EPIC & GHOST",
    detail: "Dévoile les layers EPIC et GHOST exclusifs aux membres PRO.",
    xpBonus: "+100 XP"
  },
  {
    icon: "✨",
    title: "Spots exclusifs PRO",
    detail: "Accès aux lieux privés et avant-premières réservés aux exploratrices PRO.",
    xpBonus: "+75 XP"
  },
  {
    icon: "🎮",
    title: "Missions & Défis",
    detail: "Complète des missions hebdomadaires et débloque des défis pour gagner XP et rewards.",
    xpBonus: "+200 XP"
  },
  {
    icon: "⚡",
    title: "Support prioritaire",
    detail: "Assistance VIP prioritaire par l'équipe UrbexQueens 24/7.",
    xpBonus: "VIP"
  },
  {
    icon: "🛡️",
    title: "Badges & Profil Premium",
    detail: "Badges exclusifs, couleurs premium et halo PRO lumineux sur ton profil.",
    xpBonus: "PRESTIGE"
  },
];

const MISSIONS = [
  {
    id: "first-spot",
    title: "Première Exploration",
    description: "Ajoute ton premier spot urbex sur la carte",
    xp: 50,
    icon: "📍",
    difficulty: "Facile",
    completed: false
  },
  {
    id: "night-explorer",
    title: "Exploratrice Nocturne",
    description: "Utilise Night Vision pendant 10 sessions",
    xp: 100,
    icon: "🌙",
    difficulty: "Moyen",
    completed: false
  },
  {
    id: "epic-hunter",
    title: "Chasseuse EPIC",
    description: "Découvre 5 spots de tier EPIC",
    xp: 150,
    icon: "👑",
    difficulty: "Moyen",
    completed: false
  },
  {
    id: "ghost-master",
    title: "Maîtresse GHOST",
    description: "Explore tous les spots GHOST disponibles",
    xp: 200,
    icon: "💀",
    difficulty: "Difficile",
    completed: false
  },
  {
    id: "community-star",
    title: "Étoile Communautaire",
    description: "Reçois 50 likes sur tes spots partagés",
    xp: 175,
    icon: "⭐",
    difficulty: "Difficile",
    completed: false
  },
  {
    id: "streak-master",
    title: "Série Parfaite",
    description: "Connecte-toi 30 jours consécutifs",
    xp: 300,
    icon: "🔥",
    difficulty: "Expert",
    completed: false
  }
];

const ACHIEVEMENTS = [
  {
    icon: "🏆",
    title: "Urban Legend",
    description: "Atteins le niveau 50",
    unlocked: false
  },
  {
    icon: "💎",
    title: "Diamond Explorer",
    description: "Découvre 100 spots uniques",
    unlocked: false
  },
  {
    icon: "⚡",
    title: "Speed Runner",
    description: "Complète 10 missions en 1 semaine",
    unlocked: false
  },
  {
    icon: "🎯",
    title: "Perfectionniste",
    description: "Obtiens 100% sur toutes les missions",
    unlocked: false
  }
];

export default function ProLandingPageGaming({ 
  nightVisionActive = false, 
  onToggleNightVision 
}: ProLandingPageGamingProps = {}) {
  const { user, isPro } = useCurrentUserRole();
  const { requireAuth } = useAuthUI();
  const [loading, setLoading] = useState(false);
  const [ctaPulseActive, triggerCtaPulse] = useInteractionPulse(360);
  const toast = useToast();

  // Mock data - remplacer par vraies stats user
  const userLevel = 12;
  const currentXP = 2450;
  const nextLevelXP = 3000;
  const xpProgress = (currentXP / nextLevelXP) * 100;

  const handleGoPro = useCallback(async () => {
    console.info("[analytics] pro_cta_click", { location: "pro-page-gaming" });
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

  return (
    <div className="pro-gaming-page">
      {/* Hero Section avec stats gaming */}
      <header className="pro-gaming-hero">
        <div className="pro-gaming-hero-bg">
          <div className="pro-gaming-particles"></div>
        </div>
        
        <div className="pro-gaming-hero-content">
          <span className="pro-gaming-kicker">
            <span className="pro-gaming-kicker-icon">⚡</span>
            CLUB ÉLITE URBEXQUEENS
          </span>
          
          <h1 className="pro-gaming-title">
            <span className="pro-gaming-title-main">URBEXQUEENS</span>
            <span className="pro-gaming-title-pro">PRO</span>
          </h1>
          
          <p className="pro-gaming-subtitle">
            Explore. Conquiers. Domine. Rejoins l'élite des exploratrices urbaines.
          </p>

          {isPro && (
            <div className="pro-gaming-stats-card">
              <div className="pro-gaming-stat">
                <div className="pro-gaming-stat-icon">🎯</div>
                <div className="pro-gaming-stat-info">
                  <span className="pro-gaming-stat-label">Niveau</span>
                  <span className="pro-gaming-stat-value">{userLevel}</span>
                </div>
              </div>
              <div className="pro-gaming-stat">
                <div className="pro-gaming-stat-icon">⚡</div>
                <div className="pro-gaming-stat-info">
                  <span className="pro-gaming-stat-label">XP Total</span>
                  <span className="pro-gaming-stat-value">{currentXP.toLocaleString()}</span>
                </div>
              </div>
              <div className="pro-gaming-stat">
                <div className="pro-gaming-stat-icon">🏆</div>
                <div className="pro-gaming-stat-info">
                  <span className="pro-gaming-stat-label">Achievements</span>
                  <span className="pro-gaming-stat-value">8/20</span>
                </div>
              </div>
            </div>
          )}

          <div className="pro-gaming-cta-section">
            <button
              type="button"
              className={`pro-gaming-cta${ctaPulseActive ? " is-pulsing" : ""}${isPro ? " is-pro" : ""}`}
              onClick={handleGoPro}
              disabled={loading || isPro}
            >
              <span className="pro-gaming-cta-bg"></span>
              <span className="pro-gaming-cta-text">
                {isPro ? "✅ TU ES PRO" : loading ? "⏳ CHARGEMENT..." : "🚀 DÉBLOQUER PRO"}
              </span>
            </button>
            
            {!isPro && (
              <div className="pro-gaming-price">
                <span className="pro-gaming-price-amount">12,99 $</span>
                <span className="pro-gaming-price-period">/ mois</span>
                <span className="pro-gaming-price-note">· Annulable à tout moment</span>
              </div>
            )}
          </div>

          <div className="pro-gaming-features-tags">
            <span className="pro-gaming-tag">🌒 NIGHT VISION</span>
            <span className="pro-gaming-tag">🛰 SATELLITE</span>
            <span className="pro-gaming-tag">👻 GHOST MAPS</span>
            <span className="pro-gaming-tag">🎮 MISSIONS</span>
          </div>
        </div>
      </header>

      {/* XP Progress Bar pour PRO members */}
      {isPro && (
        <section className="pro-gaming-progress">
          <div className="pro-gaming-progress-header">
            <span className="pro-gaming-progress-level">Niveau {userLevel}</span>
            <span className="pro-gaming-progress-xp">{currentXP} / {nextLevelXP} XP</span>
          </div>
          <div className="pro-gaming-progress-bar">
            <div 
              className="pro-gaming-progress-fill" 
              style={{ width: `${xpProgress}%` }}
            >
              <span className="pro-gaming-progress-glow"></span>
            </div>
          </div>
          <p className="pro-gaming-progress-next">
            {nextLevelXP - currentXP} XP jusqu'au niveau {userLevel + 1}
          </p>
        </section>
      )}

      {/* Benefits Grid avec XP Bonus */}
      <section className="pro-gaming-benefits">
        <div className="pro-gaming-section-header">
          <h2>
            <span className="pro-gaming-section-icon">⚡</span>
            AVANTAGES PRO
          </h2>
          <p>Outils exclusifs et bonus XP pour dominer la carte</p>
        </div>
        
        <div className="pro-gaming-benefits-grid">
          {BENEFITS.map((benefit) => (
            <article key={benefit.title} className="pro-gaming-benefit-card">
              <div className="pro-gaming-benefit-header">
                <div className="pro-gaming-benefit-icon">{benefit.icon}</div>
                <span className="pro-gaming-benefit-xp">{benefit.xpBonus}</span>
              </div>
              <h3 className="pro-gaming-benefit-title">{benefit.title}</h3>
              <p className="pro-gaming-benefit-detail">{benefit.detail}</p>
              <div className="pro-gaming-benefit-shine"></div>
            </article>
          ))}
        </div>
      </section>

      {/* Missions Section */}
      <section className="pro-gaming-missions">
        <div className="pro-gaming-section-header">
          <h2>
            <span className="pro-gaming-section-icon">🎯</span>
            MISSIONS HEBDOMADAIRES
          </h2>
          <p>Complète des missions pour gagner XP et débloquer des rewards</p>
        </div>

        <div className="pro-gaming-missions-grid">
          {MISSIONS.map((mission) => (
            <div key={mission.id} className="pro-gaming-mission-card">
              <div className="pro-gaming-mission-icon">{mission.icon}</div>
              <div className="pro-gaming-mission-content">
                <div className="pro-gaming-mission-header">
                  <h3 className="pro-gaming-mission-title">{mission.title}</h3>
                  <span className={`pro-gaming-mission-difficulty pro-gaming-mission-difficulty--${mission.difficulty.toLowerCase()}`}>
                    {mission.difficulty}
                  </span>
                </div>
                <p className="pro-gaming-mission-desc">{mission.description}</p>
                <div className="pro-gaming-mission-footer">
                  <span className="pro-gaming-mission-xp">+{mission.xp} XP</span>
                  {mission.completed ? (
                    <span className="pro-gaming-mission-status pro-gaming-mission-status--complete">
                      ✅ Complétée
                    </span>
                  ) : (
                    <span className="pro-gaming-mission-status pro-gaming-mission-status--pending">
                      En cours...
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Achievements Section */}
      <section className="pro-gaming-achievements">
        <div className="pro-gaming-section-header">
          <h2>
            <span className="pro-gaming-section-icon">🏆</span>
            ACHIEVEMENTS
          </h2>
          <p>Défis exclusifs et badges de prestige</p>
        </div>

        <div className="pro-gaming-achievements-grid">
          {ACHIEVEMENTS.map((achievement, idx) => (
            <div 
              key={idx} 
              className={`pro-gaming-achievement-card${achievement.unlocked ? " is-unlocked" : " is-locked"}`}
            >
              <div className="pro-gaming-achievement-icon">{achievement.icon}</div>
              <h3 className="pro-gaming-achievement-title">{achievement.title}</h3>
              <p className="pro-gaming-achievement-desc">{achievement.description}</p>
              {achievement.unlocked && (
                <span className="pro-gaming-achievement-badge">DÉBLOQUÉ</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Night Vision Toggle pour PRO */}
      {isPro && onToggleNightVision && (
        <section className="pro-gaming-settings">
          <div className="pro-gaming-section-header">
            <h2>
              <span className="pro-gaming-section-icon">⚙️</span>
              PARAMÈTRES PRO
            </h2>
            <p>Options exclusives membres PRO</p>
          </div>

          <div className="pro-gaming-settings-card">
            <div className="pro-gaming-setting-item">
              <div className="pro-gaming-setting-info">
                <div className="pro-gaming-setting-icon">🌒</div>
                <div>
                  <h3 className="pro-gaming-setting-title">Night Vision</h3>
                  <p className="pro-gaming-setting-desc">
                    Mode vision nocturne pour navigation optimisée dans l'obscurité
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={`pro-gaming-toggle ${nightVisionActive ? "is-active" : ""}`}
                onClick={onToggleNightVision}
                aria-label="Toggle Night Vision"
              >
                <span className="pro-gaming-toggle-track">
                  <span className="pro-gaming-toggle-thumb"></span>
                </span>
                <span className="pro-gaming-toggle-label">
                  {nightVisionActive ? "ACTIVÉ" : "DÉSACTIVÉ"}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      {!isPro && (
        <section className="pro-gaming-final-cta">
          <div className="pro-gaming-final-cta-content">
            <h2>Prête à rejoindre l'élite ?</h2>
            <p>Missions exclusives · Progression XP · Badges Premium · Support VIP</p>
            <button
              type="button"
              className="pro-gaming-cta pro-gaming-cta--large"
              onClick={handleGoPro}
              disabled={loading}
            >
              <span className="pro-gaming-cta-bg"></span>
              <span className="pro-gaming-cta-text">
                {loading ? "⏳ CHARGEMENT..." : "🚀 DÉBLOQUER PRO MAINTENANT"}
              </span>
            </button>
            <p className="pro-gaming-final-note">
              12,99 $ / mois · Annulation en 1 clic · Support 24/7
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
