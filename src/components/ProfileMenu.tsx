import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { listenMissions, type Mission } from "../services/missions";
import { listenUserProfile } from "../services/users";
import {
  listenUserGamification,
  type UserGamification,
} from "../services/gamification";
import {
  listenUserPlaces,
  type UserPlacesMap,
} from "../services/userPlaces";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { dispatchSpotListView } from "../lib/userSpotStats";

export default function ProfileMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isProUser, setIsProUser] = useState(false);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [userPlaces, setUserPlaces] = useState<UserPlacesMap>({});
  
  // Calculer les compteurs de spots
  const spotsDone = useMemo(() => {
    return Object.values(userPlaces).filter((place) => place.done).length;
  }, [userPlaces]);

  const spotsSaved = useMemo(() => {
    return Object.values(userPlaces).filter((place) => place.saved).length;
  }, [userPlaces]);

  const profileActiveMission = useMemo(() => {
    if (missions.length === 0) return null;
    const now = Date.now();
    const available = missions
      .filter((mission) => !mission.expiresAt || mission.expiresAt > now)
      .sort(
        (a, b) =>
          (b.expiresAt ?? Number.MAX_SAFE_INTEGER) -
          (a.expiresAt ?? Number.MAX_SAFE_INTEGER)
      );
    return available[0] ?? missions[0];
  }, [missions]);

  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Suivi utilisateur
  const { isAdmin } = useCurrentUserRole();

  useEffect(() => {
    if (import.meta.env.MODE !== "production") {
      console.info("[UQ][ADMIN_MENU]", { isAdmin });
    }
  }, [isAdmin]);

  useEffect(() => {
    let authUnsub: (() => void) | null = null;
    let profileUnsub: (() => void) | null = null;
    let gamifUnsub: (() => void) | null = null;
    let placesUnsub: (() => void) | null = null;

    authUnsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      if (!u) {
        setIsProUser(false);
        setGamification(null);
        setUserPlaces({});
        profileUnsub?.();
        profileUnsub = null;
        gamifUnsub?.();
        gamifUnsub = null;
        placesUnsub?.();
        placesUnsub = null;
        return;
      }
      profileUnsub?.();
      profileUnsub = listenUserProfile(u.uid, (profile) => {
        setIsProUser(profile.isPro);
      });
      gamifUnsub?.();
      gamifUnsub = listenUserGamification(u.uid, (data) => {
        setGamification(data);
      });
      placesUnsub?.();
      placesUnsub = listenUserPlaces(u.uid, setUserPlaces);
    });

    return () => {
      authUnsub?.();
      profileUnsub?.();
      gamifUnsub?.();
      placesUnsub?.();
    };
  }, []);

  useEffect(() => {
    const unsub = listenMissions(setMissions);
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menuOpen) return;
      event.preventDefault();
      triggerRef.current?.focus();
      setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  if (!user) return null;

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      triggerRef.current?.focus();
      setMenuOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setMenuOpen((open) => !open);
    }
  };

  const displayName =
    user.displayName || (user.email ? user.email.split("@")[0] : "explorateur");
  const firstLetter = displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="urbex-profile-root">
      {/* Badge explorateur dans le header */}
      <button
        type="button"
        className="urbex-profile-trigger"
        ref={triggerRef}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        aria-controls="urbex-profile-panel"
        title="Ouvrir le menu profil"
        onClick={() => {
          setMenuOpen((o) => !o);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <div className="urbex-profile-avatar">{firstLetter}</div>

        <div className="urbex-profile-texts">
          <div className="urbex-profile-role">EXPLORATEUR</div>
          <div className="urbex-profile-username">@{displayName}</div>
        </div>
      </button>

      {/* Panneau déroulant */}
      {menuOpen && (
        <div id="urbex-profile-panel" className="urbex-profile-panel">
          <button
            type="button"
            className="urbex-profile-close"
            onClick={() => {
              setMenuOpen(false);
            }}
            aria-label="Fermer le menu"
            title="Fermer le menu"
          >
            ✕
          </button>
          {/* Vue TABLEAU DE BORD */}
          <>
              <div className="urbex-profile-panel-title">TABLEAU DE BORD</div>

              <div className="profile-menu-header">
                <div className="profile-menu-name-row">
                  <span className="profile-menu-name">
                    {user.displayName || user.email || "Explorateur"}
                  </span>
                  {isProUser && (
                    <span className="profile-menu-pro-badge">PRO ✨</span>
                  )}
                </div>
              </div>

              {gamification && (
                <div className="menu-gamif-block">
                  <div className="menu-gamif-level">
                    Niveau <span>{gamification.level}</span>
                  </div>
                  <div className="menu-gamif-xp">XP : {gamification.xp}</div>
                </div>
              )}

              {/* Compteurs de spots */}
              <div className="menu-spots-stats">
                <div className="menu-spots-stat-item">
                  <div className="menu-spots-stat-icon">✅</div>
                  <div className="menu-spots-stat-content">
                    <div className="menu-spots-stat-label">Spots faits</div>
                    <div className="menu-spots-stat-value">{spotsDone}</div>
                  </div>
                </div>
                <div className="menu-spots-stat-item">
                  <div className="menu-spots-stat-icon">💗</div>
                  <div className="menu-spots-stat-content">
                    <div className="menu-spots-stat-label">Sauvegardés</div>
                    <div className="menu-spots-stat-value">{spotsSaved}</div>
                  </div>
                </div>
              </div>

              {missions.length > 0 && (
                <div className="profile-missions">
                  <div className="profile-missions-title">MISSIONS hebdo</div>
                  <div className="profile-missions-grid">
                    {missions.map((mission) => (
                      <div
                        key={mission.id}
                        className={`profile-mission-card${
                          profileActiveMission?.id === mission.id
                            ? " is-active"
                            : ""
                        }`}
                      >
                        <div className="profile-mission-title">
                          {mission.title}
                        </div>
                        <div className="profile-mission-desc">
                          {mission.description}
                        </div>
                        <div className="profile-mission-meta">
                          <span>
                            {mission.rewardPoints
                              ? `+${mission.rewardPoints} pts`
                              : "Points secrets"}
                          </span>
                          {mission.difficulty && <span>• {mission.difficulty}</span>}
                          {mission.targetTag && (
                            <span>• Tag: {mission.targetTag}</span>
                          )}
                          {mission.expiresAt && (
                            <span>
                              • expire le{" "}
                              {new Date(mission.expiresAt).toLocaleDateString(
                                "fr-CA",
                                { day: "2-digit", month: "short" }
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="urbex-profile-section">
                <div className="urbex-profile-section-title">Mon compte</div>
                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    if (user) {
                      window.dispatchEvent(
                        new CustomEvent("urbex-nav", {
                          detail: { path: `/profile/${user.uid}` },
                        })
                      );
                      setMenuOpen(false);
                    }
                  }}
                >
                  <span>👤 Mon profil</span>
                </button>
                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("urbex-nav", {
                        detail: { path: "/settings" },
                      })
                    );
                    setMenuOpen(false);
                  }}
                >
                  <span>⚙️ Paramètres</span>
                </button>
              </div>

              <div className="urbex-profile-section">
                <div className="urbex-profile-section-title">Urbex</div>
                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("urbex-nav", {
                        detail: { path: "/feed" },
                      })
                    );
                    setMenuOpen(false);
                  }}
                >
                  <span>📰 Mon feed urbex</span>
                  <span className="urbex-profile-badge">👻</span>
                </button>
                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("urbex-open-mission"));
                    setMenuOpen(false);
                  }}
                >
                  <span>🛰 Mission</span>
                  {profileActiveMission && (
                    <span className="urbex-profile-badge">🛰</span>
                  )}
                </button>
                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    dispatchSpotListView("done");
                    setMenuOpen(false);
                  }}
                >
                  <div className="urbex-profile-spot-entry">
                    <span>✅ MES SPOTS</span>
                    <span className="urbex-profile-spot-subtitle">
                      Faits & Favoris
                    </span>
                  </div>
                </button>
              </div>

              <div className="urbex-profile-section">
                <div className="urbex-profile-section-title">Abonnement</div>
                {!isProUser && user && (
                  <button
                    type="button"
                    className="urbex-profile-item urbex-profile-pro-entry"
                onClick={() => {
                    console.info("[analytics] pro_cta_click", {
                      location: "profile-menu",
                    });
                    window.dispatchEvent(
                      new CustomEvent("urbex-nav", { detail: { path: "/pro" } })
                    );
                    setMenuOpen(false);
                  }}
                >
                    <span>✨ UrbexQueens PRO</span>
                  </button>
                )}
              </div>

            {isAdmin && (
              <button
                type="button"
                className="urbex-profile-item urbex-profile-admin"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("urbex-nav", {
                      detail: { path: "/admin" },
                    })
                  );
                  setMenuOpen(false);
                }}
              >
                <span>Admin panel</span>
              </button>
            )}

              <div className="urbex-profile-section">
                <div className="urbex-profile-section-title">Légal</div>
                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("urbex-nav", {
                        detail: { path: "/payment-policy" },
                      })
                    );
                    setMenuOpen(false);
                  }}
                >
                  <span>📄 Politique de paiement</span>
                </button>

                <button
                  type="button"
                  className="urbex-profile-item"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("urbex-nav", {
                        detail: { path: "/legal-terms" },
                      })
                    );
                    setMenuOpen(false);
                  }}
                >
                  <span>📜 Clause légale</span>
                </button>
              </div>
          </>
        </div>
      )}
    </div>
  );
}
