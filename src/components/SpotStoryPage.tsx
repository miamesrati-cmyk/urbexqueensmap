import { useEffect, useMemo, useRef, useState } from "react";
import { listenPlace, type Place, updatePlaceHistory } from "../services/places";
import {
  listenSpotPhotos,
  addSpotPhotoDoc,
  type SpotPhoto,
} from "../services/spotPhotos";
import { uploadSpotImage } from "../services/storage";
import { awardXpForEvent } from "../services/gamification";
import SpotEnigmas from "./SpotEnigmas";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { shareLink } from "../utils/share";
import ProUnlockPanel from "./ProUnlockPanel";
import { PageContainer, SectionCard } from "../components/layouts/PageLayout";
import CommentsSection from "./CommentsSection";
import { useAuthUI } from "../contexts/useAuthUI";
import { sanitizeHtml } from "../lib/sanitizeHtml";

type Props = {
  spotId: string;
  onBack?: () => void;
};

const STORY_PRO_FEATURES = [
  {
    icon: "📜",
    title: "Histoires détaillées",
    detail: "Récits exclusifs, archives et légendes complètes de chaque spot.",
  },
  {
    icon: "👻",
    title: "Ghost Maps (PRO)",
    detail: "Cartes paranormales illuminées, zones secrètes et repères luminescents.",
  },
  {
    icon: "🧭",
    title: "Pathfinder (PRO)",
    detail: "Planifie ton parcours, trace tes runs et garde une vue d’ensemble premium.",
  },
];

export default function SpotStoryPage({ spotId, onBack }: Props) {
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const { user, isPro, isAdmin } = useCurrentUserRole();
  const { requireAuth } = useAuthUI();
  const [adminNotes, setAdminNotes] = useState(place?.adminNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSuccess, setNotesSuccess] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);

  useEffect(() => {
    setNotesError(null);
  }, [adminNotes]);

  useEffect(() => {
    if (!notesSuccess) return;
    const timer = setTimeout(() => setNotesSuccess(null), 2800);
    return () => clearTimeout(timer);
  }, [notesSuccess]);
  const [proLocked, setProLocked] = useState(false);
  const shareUrl = useMemo(
    () => `${window.location.origin}/spot/${spotId}`,
    [spotId]
  );

  useEffect(() => {
    const unsubPlace = listenPlace(spotId, (p) => {
      setPlace(p);
      setLoading(false);
      if (p && !isPro && (p.proOnly || p.isPublic === false)) {
        setProLocked(true);
      } else {
        setProLocked(false);
      }
      if (p) {
        setAdminNotes(p.adminNotes ?? "");
      }
    });
    const unsubPhotos = listenSpotPhotos(spotId, setPhotos);
    return () => {
      unsubPlace();
      unsubPhotos();
    };
  }, [spotId, isPro]);

  async function handleUploadPhoto(file: File | null) {
    if (!user) {
      setPhotoError("Connecte-toi pour ajouter une photo.");
      return;
    }
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const url = await uploadSpotImage(spotId, user.uid, file);
      await addSpotPhotoDoc(spotId, { url, uploadedByUid: user.uid });
      setPhotos((prev) => [
        {
          id: `${Date.now()}`,
          url,
          uploadedByUid: user.uid,
          uploadedAt: Date.now(),
        },
        ...prev,
      ]);
      awardXpForEvent(user.uid, "upload_photo").catch(console.error);
    } catch (err: any) {
      console.error("Upload photo spot error", err);
      setPhotoError(err?.message || "Impossible d’ajouter la photo.");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
    }
  }

  async function handleAdminNotesSave() {
    if (!place) return;
    setNotesSaving(true);
    setNotesSuccess(null);
    setNotesError(null);
    try {
      await updatePlaceHistory(place.id, { adminNotes: adminNotes.trim() || null });
      setNotesSuccess("Notes admin enregistrées");
    } catch (err: any) {
      console.error("Erreur notes admin", err);
      setNotesError("Impossible d’enregistrer les notes.");
    } finally {
      setNotesSaving(false);
    }
  }

  function handleOpenHistoryEditor() {
    const target = `/spot/${spotId}/edit-history`;
    window.history.pushState({}, "", target);
    window.dispatchEvent(new CustomEvent("urbex-nav", { detail: { path: target } }));
  }

  if (loading) {
    return (
      <PageContainer>
        <SectionCard>
          <p>Chargement…</p>
        </SectionCard>
      </PageContainer>
    );
  }

  if (proLocked) {
    return (
      <PageContainer>
        <SectionCard>
          <p className="map-add-alert">Spot réservé aux membres PRO ✨</p>
          <p className="story-hint">
            Passe en PRO pour accéder aux spots privés et à leurs histoires.
          </p>
          <ProUnlockPanel
            className="story-pro-panel"
            subtitle="Ghost Maps, Pathfinder et récits complets sont visibles mais bloqués."
            features={STORY_PRO_FEATURES}
            lockedNote="Deviens Exploratrice PRO pour débloquer l’histoire complète et les cartes premium."
          />
          {onBack && (
            <button className="story-back-btn" onClick={onBack}>
              Retour
            </button>
          )}
        </SectionCard>
      </PageContainer>
    );
  }

  if (!place) {
    return (
      <PageContainer>
        <SectionCard>
          <p>Spot introuvable.</p>
          {onBack && (
            <button className="story-back-btn" onClick={onBack}>
              Retour
            </button>
          )}
        </SectionCard>
      </PageContainer>
    );
  }

  const rawHistoryHtml = place.historyFullHtml?.trim() || "";
  const historyHtml = sanitizeHtml(rawHistoryHtml, {
    maxLength: 20000,
  });
  const historyText = place.historyFull || "";
  const hasRichHistory = historyHtml.trim().length > 0;
  const secretPath = place.entrances || place.parking || "";

  const shortHistoryText = (place.historyShort || "").trim();
  const fullHistoryText = historyText.trim();
  const paragraphize = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  const shortHistoryParagraphs = paragraphize(shortHistoryText);
  const fullHistoryParagraphs = paragraphize(fullHistoryText);
  const historyPreviewParagraphs = fullHistoryParagraphs.slice(0, 2);
  const canViewFullStory = isPro || isAdmin;
  const historyPreviewAvailable = historyPreviewParagraphs.length > 0;
  const hasShortHistory = shortHistoryParagraphs.length > 0;
  const heroCoverImage =
    photos[0]?.url ??
    (Array.isArray(place.historyImages) ? place.historyImages[0] : undefined);

  const openProModal = () =>
    window.dispatchEvent(new CustomEvent("urbex_open_pro_modal"));
  const openLoginModal = () =>
    requireAuth({
      mode: "login",
      reason: "Connecte-toi pour accéder aux archives secrètes",
    });

  return (
    <PageContainer className="story-page spot-story-page">
      <SectionCard className="spot-story-hero-card">
        <div className="spot-story-hero-grid">
          <div className="spot-story-hero-media">
            {place.videoUrl ? (
              <div className="spot-story-hero-video">
                <iframe
                  src={place.videoUrl}
                  title="Vidéo du spot"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : heroCoverImage ? (
              <img
                src={heroCoverImage}
                alt={place.title}
                loading="lazy"
                className="spot-story-hero-image"
              />
            ) : (
              <div className="spot-story-hero-placeholder">
                <span>Visuel urbex manquant</span>
              </div>
            )}
          </div>
          <div className="spot-story-hero-info">
            <div>
              <p className="story-eyebrow">HISTOIRE DU LIEU</p>
              <h1 className="story-title">{place.title}</h1>
              <p className="story-sub">
                {place.description ||
                  "Adresse confidentielle, tenue secrète pour la communauté."}
              </p>
              <div className="story-badges">
                <span className="story-badge">
                  {place.category || "Catégorie inconnue"}
                </span>
                <span className={`story-badge risk-${place.riskLevel || "moyen"}`}>
                  Risque : {place.riskLevel || "moyen"}
                </span>
                <span className="story-badge">Accès {place.access || "?"}</span>
              </div>
            </div>
            <div className="spot-story-hero-actions">
              {onBack && (
                <button className="story-back-btn" onClick={onBack}>
                  ← Retour
                </button>
              )}
              <button
                className="uq-share-btn"
                type="button"
                onClick={() =>
                  shareLink(
                    shareUrl,
                    place.title || "Spot UrbexQueens",
                    "Découvre ce spot urbain sur UrbexQueens"
                  )
                }
              >
                🔗 Partager
              </button>
            </div>
            <div className="spot-story-hero-cta">
              <a
                className="story-map-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                🌍 Ouvrir dans Google Maps
              </a>
              {secretPath && (
                <button className="story-ghost-btn" type="button">
                  🧭 Chemin discret
                </button>
              )}
            </div>
            {secretPath && (
              <p className="story-secret-hint">Chemin discret : {secretPath}</p>
            )}
            {place.tags && place.tags.length > 0 && (
              <div className="story-tags">
                {place.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="story-tag">
                    {tag.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="spot-story-content">
        <SectionCard className="story-section-card spot-story-section-card">
          <div className="story-section-head">
            <span>HISTOIRE COURTE</span>
          </div>
          <div className="spot-story-text">
            {hasShortHistory ? (
              shortHistoryParagraphs.map((paragraph, index) => (
                <p key={`short-${index}`} className="spot-story-paragraph">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="story-hint">Pas encore de résumé disponible.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard className="story-section-card spot-story-section-card">
          <div className="story-section-head">
            <span>HISTOIRE COMPLÈTE</span>
            {isAdmin && (
              <button
                type="button"
                className="story-history-edit"
                onClick={handleOpenHistoryEditor}
              >
                ✏ Modifier l’histoire
              </button>
            )}
          </div>
          <div className="spot-story-full">
            {canViewFullStory ? (
              hasRichHistory ? (
                <div
                  className="spot-story-rich-body"
                  dangerouslySetInnerHTML={{ __html: historyHtml }}
                />
              ) : fullHistoryParagraphs.length > 0 ? (
                fullHistoryParagraphs.map((paragraph, index) => (
                  <p key={`full-${index}`} className="spot-story-paragraph">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="story-hint">Aucune histoire complète disponible.</p>
              )
            ) : (
              <>
                {historyPreviewAvailable ? (
                  historyPreviewParagraphs.map((paragraph, index) => (
                    <p key={`preview-${index}`} className="spot-story-paragraph">
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="story-hint">
                    Contenu réservé aux membres PRO.
                  </p>
                )}
                <div className="spot-story-pro-gate">
                  <p className="spot-story-pro-note">
                    Contenu réservé aux membres PRO+
                  </p>
                  <div className="spot-story-pro-gate-actions">
                    <button
                      type="button"
                      className="spot-story-pro-cta"
                      onClick={openProModal}
                    >
                      Devenir PRO
                    </button>
                    {!user && (
                      <button
                        type="button"
                        className="spot-story-login-cta"
                        onClick={openLoginModal}
                      >
                        Se connecter
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard className="story-section-card spot-story-gallery-card">
          <div className="story-section-head">
            <span>Galerie photo</span>
            {user && (
              <div className="spot-story-gallery-actions">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleUploadPhoto(e.target.files?.[0] || null)}
                />
                <button
                  className="story-photo-add"
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                >
                  {photoUploading ? "Upload..." : "Ajouter une photo"}
                </button>
              </div>
            )}
          </div>
          {photoError && <p className="map-add-alert">{photoError}</p>}
          {photos.length > 0 ? (
            <div className="spot-story-gallery-grid">
              {photos.map((p) => (
                <div key={p.id} className="spot-story-gallery-item">
                  <img src={p.url} alt={place.title} loading="lazy" />
                </div>
              ))}
            </div>
          ) : (
            <div className="spot-story-gallery-empty">
              Pas encore de photos
            </div>
          )}
        </SectionCard>

        {place.archives && place.archives.length > 0 && (
          <SectionCard className="story-section-card spot-story-section-card">
            <div className="story-section-head">
              <span>Archives &amp; sources</span>
            </div>
            <ul className="history-archives-list">
              {place.archives.map((url, idx) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    Source {idx + 1}
                  </a>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard className="story-section-card spot-story-section-card">
          <SpotEnigmas spotId={place.id} />
        </SectionCard>

        {isAdmin && (
          <SectionCard className="story-admin-card spot-story-section-card">
            <div className="admin-notes-header">
              <span className="admin-note-badge">Zone admin</span>
              <button
                type="button"
                className="story-photo-add"
                onClick={handleOpenHistoryEditor}
              >
                ✏ Modifier l’histoire
              </button>
            </div>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Notes internes (non visibles des utilisateurs)"
              rows={4}
            />
            <div className="admin-notes-actions">
              {notesError && <p className="comments-error">{notesError}</p>}
              {notesSuccess && (
                <p className="comments-success">{notesSuccess}</p>
              )}
              <button
                type="button"
                className="story-photo-add"
                onClick={handleAdminNotesSave}
                disabled={notesSaving}
              >
                {notesSaving ? "Enregistrement..." : "Enregistrer les notes admin"}
              </button>
            </div>
          </SectionCard>
        )}

        <SectionCard className="comments-card story-comments-slot">
          <CommentsSection placeId={place.id} />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
