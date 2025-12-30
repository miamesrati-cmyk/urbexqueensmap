import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Place, SpotTier } from "../../services/places";

const STORAGE_KEY = "uq-add-spot-draft";
const DEFAULT_BLUR_RADIUS = 45;
const MAX_PHOTOS_FREE = 3;
const MAX_PHOTOS_PRO = 12;
const RISK_LEVELS = ["faible", "moyen", "élevé"] as const;
type RiskLevel = (typeof RISK_LEVELS)[number];
type SpotCategory =
  | "maison"
  | "usine"
  | "école"
  | "hôpital"
  | "religieux"
  | "autre";

const CATEGORY_OPTIONS: { value: SpotCategory; label: string }[] = [
  { value: "maison", label: "Maison" },
  { value: "usine", label: "Usine" },
  { value: "école", label: "École" },
  { value: "hôpital", label: "Hôpital" },
  { value: "religieux", label: "Religieux" },
  { value: "autre", label: "Autre" },
];

export type SpotFormPayload = {
  title: string;
  description: string;
  category: SpotCategory;
  riskLevel: RiskLevel;
  photos: string[];
  tier: SpotTier;
  blurRadius: number | null;
  accessNotes: string;
  storySteps: string[];
  lootTags: string[];
  access: Place["access"];
};

type Props = {
  open: boolean;
  coords: { lng: number; lat: number } | null;
  onClose: () => void;
  onSubmit: (payload: SpotFormPayload) => Promise<string>;
  isPro: boolean;
};

export default function CreateSpotModal({
  open,
  coords,
  onClose,
  onSubmit,
  isPro,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SpotCategory>("autre");
  const [riskIndex, setRiskIndex] = useState(1);
  const [photos, setPhotos] = useState<string[]>([""]);
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [blurRadius, setBlurRadius] = useState(DEFAULT_BLUR_RADIUS);
  const [accessNotes, setAccessNotes] = useState("");
  const [storySteps, setStorySteps] = useState<string[]>([""]);
  const [lootTags, setLootTags] = useState<string[]>([]);
  const [newLootTag, setNewLootTag] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<
    "idle" | "pending" | "success"
  >("idle");
  const [createdPlaceId, setCreatedPlaceId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const isSubmitting = submissionState === "pending";
  const maxPhotos = isPro ? MAX_PHOTOS_PRO : MAX_PHOTOS_FREE;
  const hasPhoto = photos.some((value) => value.trim().length > 0);
  const riskLevel = RISK_LEVELS[Math.max(0, Math.min(riskIndex, RISK_LEVELS.length - 1))];
  const xpReward = useMemo(
    () =>
      Math.max(
        120,
        Math.round(200 + riskIndex * 35 + lootTags.length * 15 + (ghostEnabled ? 50 : 0))
      ),
    [ghostEnabled, lootTags.length, riskIndex]
  );

  useEffect(() => {
    if (!open) {
      setFormError(null);
      setSubmissionState("idle");
      setCreatedPlaceId(null);
      setShareMessage(null);
      return;
    }
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.category) {
        setCategory(parsed.category);
      }
      if (typeof parsed.riskIndex === "number") {
        setRiskIndex(Math.min(Math.max(parsed.riskIndex, 0), RISK_LEVELS.length - 1));
      }
      if (Array.isArray(parsed.photos) && parsed.photos.length > 0) {
        const limited = parsed.photos.slice(0, maxPhotos);
        setPhotos(limited.length ? limited : [""]);
      }
      if (typeof parsed.ghostEnabled === "boolean") {
        setGhostEnabled(parsed.ghostEnabled);
      }
      if (typeof parsed.blurRadius === "number") {
        setBlurRadius(parsed.blurRadius);
      }
      if (parsed.accessNotes) {
        setAccessNotes(parsed.accessNotes);
      }
      if (Array.isArray(parsed.storySteps) && parsed.storySteps.length > 0) {
        setStorySteps(parsed.storySteps);
      }
      if (Array.isArray(parsed.lootTags) && parsed.lootTags.length > 0) {
        setLootTags(parsed.lootTags);
      }
    } catch (error) {
      console.warn("failed to restore spot draft", error);
    }
  }, [open, maxPhotos]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const payload = {
      title,
      description,
      category,
      riskIndex,
      photos,
      ghostEnabled,
      blurRadius,
      accessNotes,
      storySteps,
      lootTags,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    open,
    title,
    description,
    category,
    riskIndex,
    photos,
    ghostEnabled,
    blurRadius,
    accessNotes,
    storySteps,
    lootTags,
    maxPhotos,
  ]);

  const handleShare = async () => {
    if (!createdPlaceId || typeof window === "undefined") {
      return;
    }
    const shareUrl = `${window.location.origin}/spot/${createdPlaceId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: title || "Spot UrbexQueens",
          url: shareUrl,
        });
        setShareMessage("Partagé !");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Lien copié !");
      } else {
        setShareMessage("Lien prêt à partager !");
      }
    } catch {
      setShareMessage("Impossible de partager pour le moment.");
    }
  };

  const handlePhotoChange = (index: number, value: string) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [""];
    });
  };

  const handleAddPhoto = () => {
    if (photos.length >= maxPhotos) {
      return;
    }
    setPhotos((prev) => [...prev, ""]);
  };

  const handleStoryStepChange = (index: number, value: string) => {
    setStorySteps((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddStoryStep = () => {
    setStorySteps((prev) => [...prev, ""]);
  };

  const handleRemoveStoryStep = (index: number) => {
    setStorySteps((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleAddLootTag = () => {
    const cleaned = newLootTag.trim();
    if (!cleaned || lootTags.includes(cleaned)) {
      return;
    }
    setLootTags((prev) => [...prev, cleaned]);
    setNewLootTag("");
  };

  const handleRemoveLootTag = (tag: string) => {
    setLootTags((prev) => prev.filter((item) => item !== tag));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coords) {
      setFormError("Les coordonnées sont manquantes.");
      return;
    }
    if (!title.trim()) {
      setFormError("Ajoute un titre.");
      return;
    }
    if (!hasPhoto) {
      setFormError("Ajoute au moins une photo.");
      return;
    }
    setFormError(null);
    setSubmissionState("pending");
    try {
      const payload: SpotFormPayload = {
        title: title.trim(),
        description: description.trim(),
        category,
        riskLevel,
        photos: photos.filter((value) => value.trim().length > 0),
        tier: "STANDARD",
        blurRadius: ghostEnabled ? blurRadius : null,
        accessNotes: accessNotes.trim(),
        storySteps: isPro
          ? storySteps.filter((step) => step.trim().length > 0)
          : [],
        lootTags: isPro ? lootTags : [],
        access: "moyen",
      };
      const docId = await onSubmit(payload);
      setCreatedPlaceId(docId);
      setSubmissionState("success");
      setShareMessage(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d’ajouter le spot.";
      setFormError(message);
      setSubmissionState("idle");
    }
  };

  if (!open || !coords) return null;

  return (
    <div className="map-overlay-form">
      <div className="map-overlay-form-inner map-add-card map-create-spot-modal">
        <header className="map-create-spot-header">
          <div className="map-create-spot-stepper">
            <span className="map-create-spot-step">1 • Infos</span>
            <span className="map-create-spot-step map-create-spot-step--active">
              2 • Preuve
            </span>
            <span className="map-create-spot-step">
              3 • PRO
            </span>
          </div>
          <h3>Ajouter un spot</h3>
          <p className="map-create-spot-subtitle">
            Coordonnées : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
          <p className="map-create-spot-autosave">
            Brouillon sauvegardé automatiquement.
          </p>
        </header>
        {submissionState === "success" && (
          <div className="map-add-alert map-add-alert--success map-create-spot-success">
            <strong>Spot soumis / pending review</strong>
            <div className="map-create-spot-success-actions">
              <button
                type="button"
                className="map-add-btn map-add-btn-secondary"
                onClick={handleShare}
              >
                Partager
              </button>
              {shareMessage && (
                <span className="map-create-spot-share-msg">{shareMessage}</span>
              )}
            </div>
          </div>
        )}
        {formError && (
          <div className="map-add-alert map-add-alert--error">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="map-create-spot-form">
          <section className="map-create-spot-section">
            <label className="map-create-spot-label">
              Titre
              <input
                type="text"
                className="map-create-spot-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            <label className="map-create-spot-label">
              Catégorie
              <select
                className="map-create-spot-select"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as SpotCategory)
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="map-create-spot-label">
              Description courte
              <textarea
                className="map-create-spot-textarea"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="map-create-spot-label">
              Risque ({riskLevel})
              <input
                type="range"
                min={0}
                max={RISK_LEVELS.length - 1}
                value={riskIndex}
                onChange={(event) => setRiskIndex(Number(event.target.value))}
              />
            </label>
          </section>
          <section className="map-create-spot-section">
            <h4>Photos ({Math.min(photos.length, maxPhotos)} / {maxPhotos})</h4>
            {photos.map((value, index) => (
              <div key={`photo-${index}`} className="map-create-spot-photo-row">
                <input
                  type="url"
                  value={value}
                  className="map-create-spot-input"
                  placeholder="URL d’image"
                  onChange={(event) => handlePhotoChange(index, event.target.value)}
                />
                {photos.length > 1 && (
                  <button
                    type="button"
                    className="map-create-spot-link"
                    onClick={() => handleRemovePhoto(index)}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="map-create-spot-link"
              onClick={handleAddPhoto}
              disabled={photos.length >= maxPhotos}
            >
              Ajouter une photo
            </button>
          </section>
          {isPro && (
            <section className="map-create-spot-section map-create-spot-pro">
              <div className="map-create-spot-ghost">
                <label className="map-create-spot-toggle">
                  <input
                    type="checkbox"
                    checked={ghostEnabled}
                    onChange={(event) => setGhostEnabled(event.target.checked)}
                  />
                  Activer le mode Ghost (vidéo privée)
                </label>
                {ghostEnabled && (
                  <label className="map-create-spot-label">
                    Rayon de confidentialité : {blurRadius} m
                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={5}
                      value={blurRadius}
                      onChange={(event) =>
                        setBlurRadius(Number(event.target.value))
                      }
                    />
                  </label>
                )}
              </div>
              <label className="map-create-spot-label">
                Notes d’accès
                <textarea
                  className="map-create-spot-textarea"
                  rows={2}
                  value={accessNotes}
                  onChange={(event) => setAccessNotes(event.target.value)}
                />
              </label>
              <div className="map-create-spot-story">
                <h4>Story mode</h4>
                {storySteps.map((step, index) => (
                  <label
                    key={`step-${index}`}
                    className="map-create-spot-label map-create-spot-story-row"
                  >
                    <span>Étape {index + 1}</span>
                    <textarea
                      className="map-create-spot-textarea"
                      rows={2}
                      value={step}
                      onChange={(event) =>
                        handleStoryStepChange(index, event.target.value)
                      }
                    />
                    {storySteps.length > 1 && (
                      <button
                        type="button"
                        className="map-create-spot-link"
                        onClick={() => handleRemoveStoryStep(index)}
                      >
                        Retirer
                      </button>
                    )}
                  </label>
                ))}
                <button
                  type="button"
                  className="map-create-spot-link"
                  onClick={handleAddStoryStep}
                >
                  Ajouter une étape
                </button>
              </div>
              <div className="map-create-spot-loot">
                <h4>Loot tags</h4>
                <div className="map-create-spot-loot-chips">
                  {lootTags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      className="map-create-spot-tag"
                      onClick={() => handleRemoveLootTag(tag)}
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
                <div className="map-create-spot-loot-add">
                  <input
                    type="text"
                    value={newLootTag}
                    className="map-create-spot-input"
                    placeholder="Ajouter un tag"
                    onChange={(event) => setNewLootTag(event.target.value)}
                  />
                  <button
                    type="button"
                    className="map-create-spot-link"
                    onClick={handleAddLootTag}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
              <div className="map-create-spot-xp">
                <strong>Récompense XP</strong>
                <span>+{xpReward} XP pour ce spot</span>
              </div>
            </section>
          )}
          <div className="map-create-spot-cta">
            <button
              type="button"
              className="map-add-btn map-add-btn-secondary"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="map-add-btn map-add-btn-primary"
              disabled={!title.trim() || isSubmitting || !hasPhoto}
            >
              {isSubmitting ? "Création..." : "Créer le spot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
