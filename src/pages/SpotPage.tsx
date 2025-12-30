import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { listenPlace, type Place } from "../services/places";
import { listenSpotPhotos, type SpotPhoto } from "../services/spotPhotos";
import { listenUserProfile } from "../services/users";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import ProUpsellModal from "../components/ProUpsellModal";
import ErrorBoundary from "../components/ErrorBoundary";
import { useAuthUI } from "../contexts/useAuthUI";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import "./SpotPage.css";

type Props = {
  spotId: string;
  onBack?: () => void;
};

function isPlaceProRestricted(place: Place) {
  return !!(
    place.isProOnly ?? place.proOnly ?? place.isPublic === false
  );
}

function paragraphize(text: string) {
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function plainToHtml(text: string) {
  if (!text) return "";
  return paragraphize(text)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function SpotPage({ spotId, onBack }: Props) {
  const [place, setPlace] = useState<Place | null>(null);
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProUser, setIsProUser] = useState(false);
  const [proLocked, setProLocked] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const { isAdmin } = useCurrentUserRole();

  const { requireAuth } = useAuthUI();
  const handleContinueFree = useCallback(() => {
    setShowProModal(false);
    requireAuth({
      mode: "signup",
      reason: "Créer un compte pour débloquer les missions PRO",
    });
  }, [requireAuth]);

  useEffect(() => {
    const handler = () => setShowProModal(true);
    window.addEventListener("urbex_open_pro_modal", handler);
    return () => window.removeEventListener("urbex_open_pro_modal", handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowProModal(false);
    window.addEventListener("urbex_reset_ui", handler);
    return () => window.removeEventListener("urbex_reset_ui", handler);
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = listenPlace(spotId, (p) => {
      setPlace(p);
      setLoading(false);
    });
    return () => unsub();
  }, [spotId]);

  useEffect(() => {
    const unsub = listenSpotPhotos(spotId, setPhotos);
    return () => unsub();
  }, [spotId]);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    const authUnsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        profileUnsub?.();
        profileUnsub = listenUserProfile(u.uid, (profile) => {
          setIsProUser(profile.isPro);
        });
      } else {
        setIsProUser(false);
        profileUnsub?.();
        profileUnsub = null;
      }
    });
    return () => {
      authUnsub();
      profileUnsub?.();
    };
  }, []);

  useEffect(() => {
    setProLocked(!!place && isPlaceProRestricted(place) && !isProUser);
  }, [place, isProUser]);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    window.history.back();
  }

  if (loading) {
    return (
      <div className="spot-page">
        <div className="spot-page-loading">
          <div className="uq-skeleton uq-skeleton-line" style={{ width: "80%", height: 16 }} />
          <div className="uq-skeleton uq-skeleton-line" style={{ width: "60%", height: 12 }} />
          <div className="uq-skeleton uq-skeleton-line" style={{ width: "70%", height: 12 }} />
          <p className="spot-page-loading-text">Chargement du spot...</p>
        </div>
      </div>
    );
  }

  if (!place) {
    return (
      <div className="spot-page">
        <div className="spot-page-loading">
          <p>Spot introuvable.</p>
          <button className="spot-back-btn" type="button" onClick={handleBack}>
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  const discreetPathUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking&dir_action=navigate&avoid=tolls|ferries`;

  if (proLocked) {
    return (
      <div className="spot-page">
        <div className="spot-page-pro">
          <p>Spot réservé aux exploratrices PRO.</p>
          <button
            type="button"
            className="spot-pro-lock-button"
            onClick={() => setShowProModal(true)}
          >
            Devenir PRO
          </button>
          <p className="spot-pro-lock-sub">
            Passe PRO pour débloquer les missions, les cartes Ghost et les spots secrets.
          </p>
        </div>
          <ErrorBoundary onReset={() => setShowProModal(false)}>
            <ProUpsellModal
              open={showProModal}
              onClose={() => setShowProModal(false)}
              onContinueFree={handleContinueFree}
            />
          </ErrorBoundary>
      </div>
    );
  }

  const coverPhotoUrl = photos[0]?.url;
  const shortHistoryRaw = place.historyShort?.trim() || "";
  const shortHistoryHtml = place.historyShortHtml?.trim() || "";
  const shortContentHtml = sanitizeHtml(
    shortHistoryHtml || plainToHtml(shortHistoryRaw),
    { maxLength: 6000 }
  );
  const fullHistoryRaw = place.historyFull?.trim() || "";
  const fullHistoryHtml = place.historyFullHtml?.trim() || "";
  const fullContentHtml = sanitizeHtml(
    fullHistoryHtml || plainToHtml(fullHistoryRaw),
    { maxLength: 16000 }
  );
  const previewSource =
    fullHistoryRaw || (fullHistoryHtml ? stripHtmlTags(fullHistoryHtml) : "");
  const previewParagraphs = paragraphize(previewSource).slice(0, 2);
  const hasShortContent = shortContentHtml.length > 0;
  const hasFullContent = fullContentHtml.length > 0;
  const canViewFullStory = !isPlaceProRestricted(place) || isProUser;
  const openProModal = () => setShowProModal(true);
  const openHistoryEditor = () => {
    const target = `/spot/${spotId}/edit-history`;
    window.history.pushState({}, "", target);
    window.dispatchEvent(
      new CustomEvent("urbex-nav", { detail: { path: target } })
    );
  };

  return (
    <div className="spot-page">
      <main className="spot-page-main">
        <button className="spot-back-btn" type="button" onClick={handleBack}>
          ← Carte
        </button>

        <section className="spot-hero">
          {coverPhotoUrl ? (
            <img
              src={coverPhotoUrl}
              alt={place.title}
              className="spot-hero-image"
              loading="lazy"
            />
          ) : (
            <div className="spot-hero-placeholder">Pas encore de photo</div>
          )}
        </section>

        <section className="spot-story">
          <div className="spot-story-header">
            <div>
              <div className="spot-meta">
                <span>{place.category || "Autre"}</span>
                <span>{place.access || "Accès inconnu"}</span>
                <span>
                  Risque {place.riskLevel ? place.riskLevel : "non évalué"}
                </span>
              </div>
              <h1 className="spot-page-title">{place.title}</h1>
              {place.description && (
                <p className="spot-description">{place.description}</p>
              )}
            </div>
            <div className="spot-story-actions">
              <a
                className="spot-action-btn"
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                🌍 Ouvrir dans Google Maps
              </a>
              <a
                className="spot-action-btn spot-action-btn--ghost"
                href={discreetPathUrl}
                target="_blank"
                rel="noreferrer"
              >
                🧭 Chemin discret
              </a>
            </div>
          </div>

          <article className="story-card">
            <h2>Histoire courte</h2>
            {hasShortContent ? (
              <div
                className="story-content"
                dangerouslySetInnerHTML={{ __html: shortContentHtml }}
              />
            ) : (
              <p className="story-hint">
                Pas encore de résumé disponible.
              </p>
            )}
          </article>

          <article className="story-card">
            <div className="story-card-head">
              <h2>Histoire complète</h2>
              {(isAdmin || !canViewFullStory) && (
                <div className="story-card-head-actions">
                  {isAdmin && (
                    <button
                      type="button"
                      className="story-edit-history-btn"
                      onClick={openHistoryEditor}
                    >
                      Modifier l’histoire
                    </button>
                  )}
                  {!canViewFullStory && (
                    <button
                      type="button"
                      className="story-pro-link"
                      onClick={openProModal}
                    >
                      Devenir PRO
                    </button>
                  )}
                </div>
              )}
            </div>
            {canViewFullStory ? (
              hasFullContent ? (
                <div
                  className="story-content"
                  dangerouslySetInnerHTML={{ __html: fullContentHtml }}
                />
              ) : (
                <p className="story-hint">Aucune histoire complète disponible.</p>
              )
            ) : (
              <>
                <div className="story-content">
                  {previewParagraphs.length > 0 ? (
                    previewParagraphs.map((paragraph, idx) => (
                      <p key={`preview-${idx}`}>{paragraph}</p>
                    ))
                  ) : (
                    <p className="story-hint">
                      Contenu réservé aux membres PRO.
                    </p>
                  )}
                </div>
                <div className="story-locked">
                  <p>Contenu complet réservé aux membres PRO+</p>
                  <button
                    type="button"
                    className="story-pro-cta"
                    onClick={openProModal}
                  >
                    Devenir PRO
                  </button>
                </div>
              </>
            )}
          </article>
        </section>
      </main>
      <ErrorBoundary onReset={() => setShowProModal(false)}>
        <ProUpsellModal
          open={showProModal}
          onClose={() => setShowProModal(false)}
          onContinueFree={handleContinueFree}
        />
      </ErrorBoundary>
    </div>
  );
}
