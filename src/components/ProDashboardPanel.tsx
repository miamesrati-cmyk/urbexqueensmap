import { useState } from "react";
import "./ProDashboardPanel.css";

interface Mission {
  id: string;
  title: string;
  description: string;
  xp: number;
  icon: string;
  progress: number;
  total: number;
  completed: boolean;
}

interface ProDashboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  onUnlockPro: () => void;
  nightVisionActive?: boolean;
  onToggleNightVision?: () => void;
}

const DAILY_MISSIONS: Mission[] = [
  {
    id: "daily-explore",
    title: "Explorer 3 spots",
    description: "Visite 3 nouveaux lieux aujourd'hui",
    xp: 25,
    icon: "📍",
    progress: 1,
    total: 3,
    completed: false,
  },
  {
    id: "daily-share",
    title: "Partage 1 spot",
    description: "Ajoute un spot à la communauté",
    xp: 30,
    icon: "✨",
    progress: 0,
    total: 1,
    completed: false,
  },
];

const WEEKLY_MISSIONS: Mission[] = [
  {
    id: "weekly-night",
    title: "Sessions nocturnes",
    description: "Utilise Night Vision 5 fois",
    xp: 100,
    icon: "🌙",
    progress: 2,
    total: 5,
    completed: false,
  },
  {
    id: "weekly-epic",
    title: "Chasseuse EPIC",
    description: "Découvre 3 spots EPIC",
    xp: 150,
    icon: "👑",
    progress: 1,
    total: 3,
    completed: false,
  },
];

export default function ProDashboardPanel({
  isOpen,
  onClose,
  isPro,
  onUnlockPro,
  nightVisionActive = false,
  onToggleNightVision,
}: ProDashboardPanelProps) {
  const [activeTab, setActiveTab] = useState<"missions" | "stats">("missions");

  // Mock user stats - à remplacer par vraies données
  const userLevel = 12;
  const currentXP = 2450;
  const nextLevelXP = 3000;
  const xpProgress = (currentXP / nextLevelXP) * 100;
  const totalSpots = 47;
  const epicSpots = 8;
  const ghostSpots = 3;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="pro-dashboard-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="pro-dashboard-panel">
        {/* Header */}
        <div className="pro-dashboard-header">
          <div className="pro-dashboard-header-top">
            <h2 className="pro-dashboard-title">
              <span className="pro-dashboard-title-icon">🎮</span>
              PRO Dashboard
            </h2>
            <button
              type="button"
              className="pro-dashboard-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {/* XP Bar pour PRO */}
          {isPro && (
            <div className="pro-dashboard-xp">
              <div className="pro-dashboard-xp-header">
                <span className="pro-dashboard-level">Niveau {userLevel}</span>
                <span className="pro-dashboard-xp-text">
                  {currentXP} / {nextLevelXP} XP
                </span>
              </div>
              <div className="pro-dashboard-xp-bar">
                <div
                  className="pro-dashboard-xp-fill"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <p className="pro-dashboard-xp-next">
                {nextLevelXP - currentXP} XP jusqu'au niveau {userLevel + 1}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="pro-dashboard-tabs">
          <button
            type="button"
            className={`pro-dashboard-tab ${activeTab === "missions" ? "is-active" : ""}`}
            onClick={() => setActiveTab("missions")}
          >
            🎯 Missions
          </button>
          <button
            type="button"
            className={`pro-dashboard-tab ${activeTab === "stats" ? "is-active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            📊 Stats
          </button>
        </div>

        {/* Content */}
        <div className="pro-dashboard-content">
          {activeTab === "missions" ? (
            <>
              {/* Daily Missions */}
              <div className="pro-dashboard-section">
                <h3 className="pro-dashboard-section-title">
                  <span>🌅</span> Missions Quotidiennes
                </h3>
                <div className="pro-dashboard-missions">
                  {DAILY_MISSIONS.map((mission) => (
                    <div key={mission.id} className="pro-dashboard-mission">
                      <div className="pro-dashboard-mission-icon">{mission.icon}</div>
                      <div className="pro-dashboard-mission-content">
                        <div className="pro-dashboard-mission-header">
                          <h4>{mission.title}</h4>
                          <span className="pro-dashboard-mission-xp">+{mission.xp} XP</span>
                        </div>
                        <p className="pro-dashboard-mission-desc">{mission.description}</p>
                        <div className="pro-dashboard-mission-progress">
                          <div className="pro-dashboard-mission-progress-bar">
                            <div
                              className="pro-dashboard-mission-progress-fill"
                              style={{
                                width: `${(mission.progress / mission.total) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="pro-dashboard-mission-progress-text">
                            {mission.progress}/{mission.total}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Missions */}
              <div className="pro-dashboard-section">
                <h3 className="pro-dashboard-section-title">
                  <span>🔥</span> Missions Hebdomadaires
                </h3>
                <div className="pro-dashboard-missions">
                  {WEEKLY_MISSIONS.map((mission) => (
                    <div key={mission.id} className="pro-dashboard-mission">
                      <div className="pro-dashboard-mission-icon">{mission.icon}</div>
                      <div className="pro-dashboard-mission-content">
                        <div className="pro-dashboard-mission-header">
                          <h4>{mission.title}</h4>
                          <span className="pro-dashboard-mission-xp">+{mission.xp} XP</span>
                        </div>
                        <p className="pro-dashboard-mission-desc">{mission.description}</p>
                        <div className="pro-dashboard-mission-progress">
                          <div className="pro-dashboard-mission-progress-bar">
                            <div
                              className="pro-dashboard-mission-progress-fill"
                              style={{
                                width: `${(mission.progress / mission.total) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="pro-dashboard-mission-progress-text">
                            {mission.progress}/{mission.total}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Night Vision Toggle pour PRO */}
              {isPro && onToggleNightVision && (
                <div className="pro-dashboard-section">
                  <h3 className="pro-dashboard-section-title">
                    <span>⚙️</span> Options PRO
                  </h3>
                  <div className="pro-dashboard-setting">
                    <div className="pro-dashboard-setting-info">
                      <div className="pro-dashboard-setting-icon">🌒</div>
                      <div>
                        <h4>Night Vision</h4>
                        <p>Mode vision nocturne</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`pro-dashboard-toggle ${nightVisionActive ? "is-active" : ""}`}
                      onClick={onToggleNightVision}
                    >
                      <span className="pro-dashboard-toggle-track">
                        <span className="pro-dashboard-toggle-thumb" />
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Stats Tab */
            <div className="pro-dashboard-stats">
              <div className="pro-dashboard-stat-card">
                <div className="pro-dashboard-stat-icon">📍</div>
                <div className="pro-dashboard-stat-info">
                  <span className="pro-dashboard-stat-value">{totalSpots}</span>
                  <span className="pro-dashboard-stat-label">Spots explorés</span>
                </div>
              </div>
              <div className="pro-dashboard-stat-card">
                <div className="pro-dashboard-stat-icon">👑</div>
                <div className="pro-dashboard-stat-info">
                  <span className="pro-dashboard-stat-value">{epicSpots}</span>
                  <span className="pro-dashboard-stat-label">Spots EPIC</span>
                </div>
              </div>
              <div className="pro-dashboard-stat-card">
                <div className="pro-dashboard-stat-icon">💀</div>
                <div className="pro-dashboard-stat-info">
                  <span className="pro-dashboard-stat-value">{ghostSpots}</span>
                  <span className="pro-dashboard-stat-label">Spots GHOST</span>
                </div>
              </div>
              <div className="pro-dashboard-stat-card">
                <div className="pro-dashboard-stat-icon">🏆</div>
                <div className="pro-dashboard-stat-info">
                  <span className="pro-dashboard-stat-value">{userLevel}</span>
                  <span className="pro-dashboard-stat-label">Niveau actuel</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CTA si non-PRO */}
        {!isPro && (
          <div className="pro-dashboard-cta">
            <p className="pro-dashboard-cta-text">
              <span className="pro-dashboard-cta-icon">✨</span>
              Débloque toutes les missions et gagne des XP !
            </p>
            <button
              type="button"
              className="pro-dashboard-cta-button"
              onClick={onUnlockPro}
            >
              <span className="pro-dashboard-cta-button-bg" />
              <span className="pro-dashboard-cta-button-text">👑 Débloquer PRO</span>
            </button>
            <p className="pro-dashboard-cta-price">12,99 $ / mois · Annulable à tout moment</p>
          </div>
        )}
      </div>
    </>
  );
}
