import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import type { Place } from "../services/places";
import { listenUserProfile } from "../services/users";
import { awardXpForEvent } from "../services/gamification";
import {
  submitSpotSubmission,
  type SpotSubmissionSource,
} from "../services/spotSubmissions";

type Props = {
  coords: { lat: number; lng: number };
  displayMode?: "standard" | "satellite" | "night" | "legend" | "ghost";
  onDone?: () => void;
  onCancel?: () => void;
};

const CATEGORY_OPTIONS: Place["category"][] = [
  "maison",
  "usine",
  "école",
  "hôpital",
  "religieux",
  "autre",
];

const RISK_OPTIONS: Place["riskLevel"][] = ["faible", "moyen", "élevé"];
const ACCESS_OPTIONS: Place["access"][] = ["facile", "moyen", "difficile"];

export default function AddPlaceForm({
  coords,
  onDone,
  onCancel,
  displayMode = "standard",
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [category, setCategory] = useState<Place["category"]>("autre");
  const [riskLevel, setRiskLevel] = useState<Place["riskLevel"]>("moyen");
  const [access, setAccess] = useState<Place["access"]>("moyen");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProUser, setIsProUser] = useState(false);
  const [isGhost, setIsGhost] = useState(false);
  const [isLegend, setIsLegend] = useState(false);
  const [dangerIndex, setDangerIndex] = useState(0);
  const [paranormalIndex, setParanormalIndex] = useState(0);
  const [isProOnly, setIsProOnly] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    let authUnsub: (() => void) | null = null;
    let profileUnsub: (() => void) | null = null;

    authUnsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
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
      authUnsub?.();
      profileUnsub?.();
    };
  }, []);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [coords]);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setAdvancedOpen(false);
    }
  }, [isMobile]);

  const MIN_DESC_LENGTH = 20;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Titre ou description trop courts.");
      return;
    }

    const desc = description.trim();
    if (desc.length < MIN_DESC_LENGTH) {
      setError("Titre ou description trop courts.");
      return;
    }

    if (!isPublic && !isProUser) {
      setError("La visibilité privée est réservée aux membres PRO.");
      return;
    }

    setLoading(true);
    try {
      const source: SpotSubmissionSource = user
        ? isProUser
          ? "pro"
          : "member"
        : "guest";
      const shortDescription =
        desc.length > 120 ? `${desc.slice(0, 120).trim()}…` : desc;

      await submitSpotSubmission({
        source,
        createdByUserId: user?.uid,
        createdByDisplayName: user?.displayName ?? undefined,
        createdByEmail: user?.email ?? undefined,
        title: title.trim(),
        descriptionShort: shortDescription,
        descriptionFull: desc,
        category,
        riskLevel,
        access,
        coordinates: { lat: coords.lat, lng: coords.lng },
        isPublic,
        isGhost,
        isLegend,
        isProOnly,
        dangerIndex,
        paranormalIndex,
        photos: [],
        isDraft: false,
      });

      if (user) {
        awardXpForEvent(user.uid, "add_spot").catch(console.error);
      }

      setSuccess(
        user
          ? "Merci, ton spot est envoyé en attente de validation par notre équipe."
          : "Merci, ta proposition a bien été reçue ; l’équipe la validera manuellement."
      );
      setTitle("");
      setDescription("");
      setCategory("autre");
      setRiskLevel("moyen");
      setAccess("moyen");
      setIsPublic(true);
      setIsGhost(false);
      setIsLegend(false);
      setDangerIndex(0);
      setParanormalIndex(0);
      setIsProOnly(false);
      setAdvancedOpen(false);

      onDone?.();
    } catch (err: any) {
      console.error("Erreur création spot", err);
      const code = err?.code || err?.name;
      if (code === "permission-denied") {
        setError("Accès refusé (vérifie la visibilité PRO/privée).");
      } else if (code === "unavailable" || code === "network-request-failed") {
        setError("Erreur réseau, réessaie dans quelques secondes.");
      } else {
        setError("Impossible d’enregistrer ce spot pour le moment.");
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="map-add-card">
      <div className="map-add-card-header">
        <div>
          <p className="map-add-card-title">
            {user ? "Ajouter un spot" : "Proposer un spot"}
          </p>
        </div>
        <button
          type="button"
          className="map-add-close"
          onClick={onCancel}
          aria-label="Fermer le formulaire d’ajout"
        >
          ✕
        </button>
      </div>

      {!user && (
        <p className="map-add-alert">
          Tu peux proposer un spot sans créer de compte. Il sera revu par notre équipe.
        </p>
      )}

      {error && <p className="map-add-alert">{error}</p>}
      {success && <p className="map-add-success">{success}</p>}

      <form className="map-add-form" onSubmit={handleSubmit}>
        <div className="map-add-meta">
          Lat {coords.lat.toFixed(5)} · Lng {coords.lng.toFixed(5)} • Mode :{" "}
          {displayMode === "standard"
            ? "Standard"
            : displayMode === "satellite"
              ? "Satellite"
              : displayMode === "night"
                ? "Night"
                : displayMode === "legend"
                  ? "Legend"
                  : "Ghost"}
        </div>

        <label className="map-add-row" htmlFor="add-spot-title">
          <span>Nom du spot</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Manoir abandonné de Laval"
            className="map-add-input"
            id="add-spot-title"
            name="title"
            required
          />
        </label>

        <label className="map-add-row" htmlFor="add-spot-description">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (
                error?.toLowerCase().includes("description") &&
                e.target.value.trim().length >= MIN_DESC_LENGTH
              ) {
                setError(null);
              }
            }}
            placeholder="Détails, accès, danger, ambiance…"
            rows={3}
            className="map-add-textarea"
            id="add-spot-description"
            name="description"
            required
          />
        </label>

        <div className="map-add-row">
          <span>Visibilité</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label className="map-add-toggle">
              <input
                type="radio"
                name="visibility"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
              />
              <span>Public</span>
            </label>
            <label
              className="map-add-toggle"
              style={!isProUser ? { opacity: 0.5, cursor: "not-allowed" } : {}}
            >
              <input
                type="radio"
                name="visibility"
                checked={!isPublic}
                disabled={!isProUser}
                onChange={() => setIsPublic(false)}
              />
              <span>Privé (PRO seulement)</span>
            </label>
            {!isProUser && (
              <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                Disponible pour les membres PRO
              </span>
            )}
          </div>
        </div>

        {isProUser ? (
          <div className="map-add-advanced">
            <button
              type="button"
              className="map-add-advanced-toggle"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              {advancedOpen
                ? "Masquer les options avancées PRO"
                : "Afficher les options avancées PRO"}
            </button>

            {advancedOpen && (
              <div className={`map-add-advanced-body${isMobile ? " is-mobile" : ""}`}>
                <div className="map-add-grid">
                  <label className="map-add-row" htmlFor="add-spot-category">
                    <span>Catégorie</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Place["category"])}
                      className="map-add-select"
                      id="add-spot-category"
                      name="category"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="map-add-row" htmlFor="add-spot-risk">
                    <span>Niveau de risque</span>
                    <select
                      value={riskLevel}
                      onChange={(e) =>
                        setRiskLevel(e.target.value as Place["riskLevel"])
                      }
                      className="map-add-select"
                      id="add-spot-risk"
                      name="riskLevel"
                    >
                      {RISK_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="map-add-row" htmlFor="add-spot-access">
                    <span>Accès</span>
                    <select
                      value={access}
                      onChange={(e) => setAccess(e.target.value as Place["access"])}
                      className="map-add-select"
                      id="add-spot-access"
                      name="access"
                    >
                      {ACCESS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="map-add-row">
                  <span>Réservé PRO</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="map-add-toggle">
                    <input
                      id="add-spot-pro-only"
                      name="isProOnly"
                      type="checkbox"
                      checked={isProOnly}
                      onChange={(e) => setIsProOnly(e.target.checked)}
                    />
                      <span>Confidentialise ce lieu pour les membres PRO</span>
                    </label>
                  </div>
                </div>

                <div className="map-add-row">
                  <span>Spots spéciaux</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label className="map-add-toggle">
                      <input
                        id="add-spot-ghost"
                        name="isGhost"
                        type="checkbox"
                        checked={isGhost}
                        onChange={(e) => setIsGhost(e.target.checked)}
                      />
                      <span>Spot Ghost (paranormal)</span>
                    </label>
                    <label className="map-add-toggle">
                      <input
                        id="add-spot-legend"
                        name="isLegend"
                        type="checkbox"
                        checked={isLegend}
                        onChange={(e) => setIsLegend(e.target.checked)}
                      />
                      <span>Spot Légendaire</span>
                    </label>
                  </div>
                </div>

                <div className="map-add-row">
                  <span>Danger Index (0 à 10)</span>
                  <div className="map-add-range">
                    <input
                      id="add-spot-danger-index"
                      name="dangerIndex"
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={dangerIndex}
                      onChange={(e) => setDangerIndex(Number(e.target.value))}
                    />
                    <span className="map-add-range-value">{dangerIndex}</span>
                  </div>
                  <small>Évalue la dangerosité perçue du spot pour la communauté.</small>
                </div>

                <div className="map-add-row">
                  <span>Paranormal Index (0 à 10)</span>
                  <div className="map-add-range map-add-range--ghost">
                    <input
                      id="add-spot-paranormal-index"
                      name="paranormalIndex"
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={paranormalIndex}
                      onChange={(e) => setParanormalIndex(Number(e.target.value))}
                    />
                    <span className="map-add-range-value">{paranormalIndex}</span>
                  </div>
                  <small>
                    {"0 = aucun ressenti, 10 = ambiance ghost / spirit."}
                  </small>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="map-add-advanced map-add-advanced--locked">
            <p className="map-add-advanced-locked-title">Options avancées PRO</p>
            <p className="map-add-advanced-locked-copy">
              Ces réglages premium renforcent la carte et restent réservés aux membres PRO
              pour garantir la sécurité et la qualité des spots.
            </p>
          </div>
        )}

        <div className="map-add-actions">
          <button
            type="button"
            className="map-add-btn map-add-btn-ghost"
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="map-add-btn map-add-btn-primary"
            disabled={loading}
          >
            {loading
              ? "Envoi..."
              : user
                ? "Enregistrer"
                : "Envoyer la proposition"}
          </button>
        </div>
      </form>
    </div>
  );
}
