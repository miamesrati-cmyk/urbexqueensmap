import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Place, SpotTier } from "../../services/places";
import "../../styles/enhanced-spot-modal.css";

const STORAGE_KEY = "uq-add-spot-draft";
const DEFAULT_BLUR_RADIUS = 45;
const MAX_PHOTOS_GUEST = 3;
const MAX_PHOTOS_MEMBER = 5;
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
  userRole?: "admin" | "pro" | "member" | "guest";
};

export default function CreateSpotModal({
  open,
  coords,
  onClose,
  onSubmit,
  isPro,
  userRole = "guest",
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
  
  // Déterminer le nombre max de photos selon le statut
  const maxPhotos = useMemo(() => {
    if (userRole === "guest") return MAX_PHOTOS_GUEST;
    if (userRole === "member") return MAX_PHOTOS_MEMBER;
    return MAX_PHOTOS_PRO; // pro ou admin
  }, [userRole]);
  
  // Déterminer si l'utilisateur a accès aux options avancées
  const hasAdvancedAccess = userRole === "pro" || userRole === "admin" || isPro;
  const isMember = userRole === "member" || userRole === "pro" || userRole === "admin";
  const isGuest = userRole === "guest";
  
  // hasPhoto supprimé car photos désormais optionnelles
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
          : "Impossible d'ajouter le spot.";
      setFormError(message);
      setSubmissionState("idle");
    }
  };

  if (!open || !coords) return null;

  return (
    <>
      <div className="spot-modal-backdrop" onClick={onClose} />
      <div className="spot-modal-container">
        <div className="spot-modal">
          <header className="spot-modal-header">
            <h3 className="spot-modal-title">
              ✨ Ajouter un Spot Urbex
            </h3>
            <button
              type="button"
              className="spot-modal-close"
              onClick={onClose}
              aria-label="Fermer"
            >
              ×
            </button>
          </header>

          <div className="spot-modal-body">
            {submissionState === "success" && (
              <div className="spot-upsell-box" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                <strong style={{ color: 'rgba(34, 197, 94, 1)' }}>✅ Spot soumis avec succès !</strong>
                <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.85 }}>
                  Ton spot est en attente de validation par un admin.
                </p>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="spot-btn spot-btn-submit"
                    onClick={handleShare}
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    📤 Partager
                  </button>
                  {shareMessage && (
                    <span style={{ fontSize: '12px', color: 'rgba(34, 197, 94, 0.9)' }}>{shareMessage}</span>
                  )}
                </div>
              </div>
            )}
            
            {formError && (
              <div className="spot-upsell-box" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <strong style={{ color: 'rgba(239, 68, 68, 1)' }}>⚠️ {formError}</strong>
              </div>
            )}

            <form onSubmit={handleSubmit} className="spot-form" id="spot-form-id">
              {/* Section: Informations de base */}
              <div className="spot-form-section">
                <h4 className="spot-section-title">📝 Informations de base</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                  📍 Coordonnées : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </p>
                
                <div className="spot-form-field">
                  <label className="spot-form-label spot-form-label-required">
                    Titre du spot
                  </label>
                  <input
                    type="text"
                    className="spot-form-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ex: Ancienne école abandonnée..."
                    required
                  />
                </div>

                <div className="spot-form-field">
                  <label className="spot-form-label spot-form-label-required">
                    Catégorie
                  </label>
                  <select
                    className="spot-form-select"
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
                </div>

                <div className="spot-form-field">
                  <label className="spot-form-label">
                    Description courte {isGuest && <span style={{ fontSize: '11px', opacity: 0.6 }}>(optionnel pour invités)</span>}
                  </label>
                  <textarea
                    className="spot-form-textarea"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={isGuest ? "Description optionnelle..." : "Décris brièvement ce spot urbex..."}
                  />
                </div>

                <div className="spot-form-field">
                  <label className="spot-form-label">
                    Niveau de risque : <strong style={{ color: 'rgba(236, 64, 122, 1)' }}>{riskLevel}</strong>
                  </label>
                  <input
                    type="range"
                    className="spot-form-input"
                    min={0}
                    max={RISK_LEVELS.length - 1}
                    value={riskIndex}
                    onChange={(event) => setRiskIndex(Number(event.target.value))}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Section: Photos */}
              <div className="spot-form-section">
                <h4 className="spot-section-title">📸 Photos</h4>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                  {isGuest ? (
                    <>📸 Jusqu'à {maxPhotos} photos (Inscris-toi pour 5 photos !)</>
                  ) : isMember && !hasAdvancedAccess ? (
                    <>📸 Jusqu'à {maxPhotos} photos (PRO = 12 photos)</>
                  ) : (
                    <>🏆 PRO : Jusqu'à {maxPhotos} photos</>
                  )}
                </p>
                
                <div className="spot-photo-grid">
                  {photos.map((value, index) => (
                    <div key={`photo-${index}`} className="spot-photo-item">
                      {value.trim() ? (
                        <div className="spot-photo-preview">
                          <img
                            src={value.trim()}
                            alt={`Photo ${index + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.opacity = '0.3';
                            }}
                          />
                          <button
                            type="button"
                            className="spot-photo-remove"
                            onClick={() => handleRemovePhoto(index)}
                            aria-label="Supprimer"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <label className="spot-photo-input-wrapper" style={{ cursor: 'pointer' }}>
                          <input
                            type="url"
                            value={value}
                            onChange={(event) => handlePhotoChange(index, event.target.value)}
                            placeholder="URL d'image"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0,
                              cursor: 'pointer',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="spot-photo-icon">📷</span>
                          <span style={{ fontSize: '11px' }}>Coller URL</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                
                {photos.length < maxPhotos && (
                  <button
                    type="button"
                    className="spot-btn spot-btn-cancel"
                    style={{ marginTop: '12px', fontSize: '13px', width: '100%' }}
                    onClick={handleAddPhoto}
                  >
                    + Ajouter une photo
                  </button>
                )}
              </div>

              {/* Upsell Box pour Guests */}
              {isGuest && (
                <div className="spot-upsell-box" style={{ marginBottom: '20px' }}>
                  <strong style={{ color: 'rgba(255,255,255,0.95)' }}>🎁 Crée un compte gratuit !</strong>
                  <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.85 }}>
                    • 5 photos par spot (au lieu de 3)<br />
                    • Historique de tes spots<br />
                    • Notifications des validations<br />
                    • XP et achievements
                  </p>
                  <button
                    type="button"
                    className="spot-btn spot-btn-submit"
                    style={{ marginTop: '12px', fontSize: '13px', width: '100%' }}
                    onClick={() => window.location.href = '/auth'}
                  >
                    ✨ S'inscrire gratuitement
                  </button>
                </div>
              )}

              {/* Upsell Box pour Members */}
              {isMember && !hasAdvancedAccess && (
                <div className="spot-upsell-box" style={{ marginBottom: '20px' }}>
                  <strong style={{ color: 'rgba(255,255,255,0.95)' }}>🏆 Passe PRO pour plus de possibilités !</strong>
                  <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.85 }}>
                    • Jusqu'à 12 photos par spot<br />
                    • Mode Ghost (coordonnées privées)<br />
                    • Story Mode avec étapes<br />
                    • Loot Tags personnalisés<br />
                    • Bonus XP x2
                  </p>
                  <button
                    type="button"
                    className="spot-btn spot-btn-submit"
                    style={{ marginTop: '12px', fontSize: '13px', width: '100%' }}
                    onClick={() => window.location.href = '/pro'}
                  >
                    👑 Voir les plans PRO
                  </button>
                </div>
              )}

              {/* Section: Options PRO */}
              {hasAdvancedAccess && (
                <div className="spot-form-section">
                  <h4 className="spot-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>🏆 Options PRO</span>
                    <span className="spot-pro-badge">
                      ⭐ PRO
                    </span>
                  </h4>

                  {/* Ghost Mode */}
                  <div className="spot-form-field">
                    <label className="spot-form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={ghostEnabled}
                        onChange={(event) => setGhostEnabled(event.target.checked)}
                        style={{ width: 'auto', cursor: 'pointer' }}
                      />
                      👻 Mode Ghost (coordonnées privées)
                    </label>
                    {ghostEnabled && (
                      <div style={{ marginTop: '12px', paddingLeft: '24px' }}>
                        <label className="spot-form-label">
                          Rayon de confidentialité : <strong>{blurRadius} m</strong>
                        </label>
                        <input
                          type="range"
                          className="spot-form-input"
                          min={10}
                          max={200}
                          step={5}
                          value={blurRadius}
                          onChange={(event) =>
                            setBlurRadius(Number(event.target.value))
                          }
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Notes d'accès */}
                  <div className="spot-form-field">
                    <label className="spot-form-label">
                      📝 Notes d'accès
                    </label>
                    <textarea
                      className="spot-form-textarea"
                      rows={2}
                      value={accessNotes}
                      onChange={(event) => setAccessNotes(event.target.value)}
                      placeholder="Conseils pour accéder au spot..."
                    />
                  </div>

                  {/* Story Mode */}
                  <div className="spot-form-field">
                    <label className="spot-form-label">
                      📖 Story Mode (étapes)
                    </label>
                    {storySteps.map((step, index) => (
                      <div
                        key={`step-${index}`}
                        style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                            Étape {index + 1}
                          </span>
                          {storySteps.length > 1 && (
                            <button
                              type="button"
                              className="spot-btn spot-btn-cancel"
                              style={{ padding: '4px 12px', fontSize: '11px' }}
                              onClick={() => handleRemoveStoryStep(index)}
                            >
                              Retirer
                            </button>
                          )}
                        </div>
                        <textarea
                          className="spot-form-textarea"
                          rows={2}
                          value={step}
                          onChange={(event) =>
                            handleStoryStepChange(index, event.target.value)
                          }
                          placeholder={`Décris l'étape ${index + 1}...`}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="spot-btn spot-btn-cancel"
                      style={{ fontSize: '13px', width: '100%' }}
                      onClick={handleAddStoryStep}
                    >
                      + Ajouter une étape
                    </button>
                  </div>

                  {/* Loot Tags */}
                  <div className="spot-form-field">
                    <label className="spot-form-label">
                      🎁 Loot Tags
                    </label>
                    {lootTags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        {lootTags.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            className="spot-btn spot-btn-submit"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleRemoveLootTag(tag)}
                          >
                            {tag} ×
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={newLootTag}
                        className="spot-form-input"
                        placeholder="Ajouter un tag"
                        onChange={(event) => setNewLootTag(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddLootTag();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="spot-btn spot-btn-cancel"
                        onClick={handleAddLootTag}
                        style={{ flexShrink: 0 }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* XP Reward */}
                  <div className="spot-upsell-box">
                    <strong style={{ color: 'rgba(255,255,255,0.95)' }}>💰 Récompense XP</strong>
                    <p style={{ margin: '8px 0 0', fontSize: '14px' }}>
                      +{xpReward} XP pour ce spot
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>

          <footer className="spot-modal-footer">
            <button
              type="button"
              className="spot-btn spot-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              form="spot-form-id"
              className="spot-btn spot-btn-submit"
              disabled={!title.trim() || isSubmitting}
            >
              {isSubmitting ? "⏳ Création..." : "✨ Créer le spot"}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}
