import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listenPlace, updatePlaceHistory, type Place } from "../services/places";
import { PageContainer, SectionCard, UrbexButton } from "../components/ui/UrbexUI";
import RichTextEditor from "../components/RichTextEditor";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import Skeleton from "../components/Skeleton";

type Props = {
  spotId: string;
  onBack?: () => void;
};

type ToastState = {
  message: string;
  type: "success" | "error";
};

const AUTO_SAVE_DELAY = 1500;

function formatDateTime(value?: number | Date | null) {
  if (value == null) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deriveHistoryStatus(place?: Place | null) {
  if (!place) return { label: "Draft", variant: "pill-muted" };
  if (place.isDraft) return { label: "Draft", variant: "pill-muted" };
  if (!place.isPublic) return { label: "Pending", variant: "pill-muted" };
  const isProStory = place.historyIsPro ?? false;
  if (isProStory || place.proOnly || place.isProOnly) {
    return { label: "PRO", variant: "pill-pro" };
  }
  return { label: "Public", variant: "pill-live" };
}

export default function EditHistoryView({ spotId, onBack }: Props) {
  const { user, isAdmin, isLoading } = useCurrentUserRole();
  const [place, setPlace] = useState<Place | null>(null);
  const [shortText, setShortText] = useState("");
  const [fullHtml, setFullHtml] = useState("");
  const [historyVisibility, setHistoryVisibility] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const lastSavedRef = useRef({
    short: "",
    full: "",
    visibility: false,
  });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = listenPlace(spotId, (p) => {
      setPlace(p);
      if (!p) {
        setShortText("");
        setFullHtml("");
        setHistoryVisibility(false);
        lastSavedRef.current = { short: "", full: "", visibility: false };
        return;
      }
      const nextShort = p.historyShort || "";
      const nextFull = sanitizeHtml(p.historyFullHtml || p.historyFull || "");
      const visibility = p.historyIsPro ?? false;
      setShortText(nextShort);
      setFullHtml(nextFull);
      setHistoryVisibility(visibility);
      lastSavedRef.current = { short: nextShort, full: nextFull, visibility };
      setLastSavedAt(
        p.historyUpdatedAt
          ? new Date(p.historyUpdatedAt)
          : p.updatedAt
          ? new Date(p.updatedAt)
          : null
      );
      setStatusMessage("");
      setSaveState("idle");
    });
    return () => {
      unsub();
    };
  }, [spotId]);

  const trimmedShortText = useMemo(() => shortText.trim(), [shortText]);
  const sanitizedFullText = useMemo(() => sanitizeHtml(fullHtml), [fullHtml]);

  const isDirty =
    trimmedShortText !== lastSavedRef.current.short ||
    sanitizedFullText !== lastSavedRef.current.full ||
    historyVisibility !== lastSavedRef.current.visibility;

  const showToast = useCallback((message: string, type: ToastState["type"]) => {
    setToast({ message, type });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  }, []);

  const safeBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined") {
      window.history.back();
    }
  }, [onBack]);

  const handleSave = useCallback(
    async ({ manual = false, showToast: shouldToast = false } = {}) => {
      if (!place) return false;
      if (
        trimmedShortText === lastSavedRef.current.short &&
        sanitizedFullText === lastSavedRef.current.full &&
        historyVisibility === lastSavedRef.current.visibility
      ) {
        if (manual && shouldToast) {
          showToast("Aucun changement à enregistrer", "success");
        }
        return false;
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      setSaving(true);
      setSaveState("saving");
      setStatusMessage("Enregistrement…");
      try {
        await updatePlaceHistory(place.id, {
          historyShort: trimmedShortText || null,
          historyFullHtml: sanitizedFullText || null,
          historyIsPro: historyVisibility,
          historyUpdatedBy:
            user?.displayName || user?.email || user?.uid || "admin",
        });
        lastSavedRef.current = {
          short: trimmedShortText,
          full: sanitizedFullText,
          visibility: historyVisibility,
        };
        const now = new Date();
        setLastSavedAt(now);
        setSaveState("saved");
        setStatusMessage(
          `Brouillon enregistré à ${now.toLocaleTimeString("fr-CA", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        );
        if (manual && shouldToast) {
          showToast("Histoire enregistrée", "success");
        }
        return true;
      } catch (err) {
        console.error("Save history", err);
        setSaveState("error");
        setStatusMessage("Impossible d’enregistrer pour l’instant.");
        if (shouldToast) {
          showToast("Échec de l’enregistrement", "error");
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      historyVisibility,
      place,
      sanitizedFullText,
      showToast,
      trimmedShortText,
      user,
    ]
  );

  useEffect(() => {
    if (!isDirty || saving) {
      return;
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
      autoSaveTimerRef.current = null;
    }, AUTO_SAVE_DELAY);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [handleSave, isDirty, saving]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        handleSave({ manual: true, showToast: true });
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleVisibilityChange = (value: boolean) => {
    setHistoryVisibility(value);
    setStatusMessage("");
  };

  const handleBackRequest = () => {
    if (!isDirty) {
      safeBack();
      return;
    }
    setShowDiscardConfirm(true);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <SectionCard>
          <div className="panel-loading">
            <Skeleton className="panel-loading__line" />
            <Skeleton className="panel-loading__line" />
            <Skeleton className="panel-loading__line" />
          </div>
        </SectionCard>
      </PageContainer>
    );
  }

  if (!user || !isAdmin) {
    return (
      <PageContainer>
        <SectionCard>
          <h2>Accès restreint</h2>
          <p>Seuls les admins peuvent éditer l’histoire des lieux.</p>
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
            <UrbexButton variant="secondary" onClick={safeBack}>
              ← Retour
            </UrbexButton>
          )}
        </SectionCard>
      </PageContainer>
    );
  }

  const storyStatus = deriveHistoryStatus(place);
  const metaUpdateDate =
    lastSavedAt ||
    (place.historyUpdatedAt
      ? new Date(place.historyUpdatedAt)
      : place.updatedAt
      ? new Date(place.updatedAt)
      : null);

  const subtitle = `${place.category || "Catégorie"} · ${
    place.access || "Accès inconnu"
  } · ${place.riskLevel || "Risque ?"} `;

  const defaultHint = isDirty
    ? "Modifications détectées · ✨ Auto-save dans 1,5s"
    : "Brouillon synchronisé";
  const progressHint = statusMessage || defaultHint;

  return (
    <PageContainer className="edit-history-page">
      <SectionCard className="edit-history-card">
        <div className="edit-history-head">
          <div>
            <p className="edit-history-kicker">Modifier l’histoire du lieu</p>
            <h1>{place.title}</h1>
            <p className="edit-history-sub">{subtitle}</p>
            <div className="edit-history-meta">
              <div>
                <span className="edit-history-meta-label">Statut</span>
                <span className={`admin-pill ${storyStatus.variant}`}>
                  {storyStatus.label}
                </span>
              </div>
              <div>
                <span className="edit-history-meta-label">Visibilité</span>
                <div className="edit-history-visibility">
                  <button
                    type="button"
                    className={`edit-history-visibility-btn ${
                      !historyVisibility ? "is-active" : ""
                    }`}
                    onClick={() => handleVisibilityChange(false)}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    className={`edit-history-visibility-btn ${
                      historyVisibility ? "is-active" : ""
                    }`}
                    onClick={() => handleVisibilityChange(true)}
                  >
                    PRO
                  </button>
                </div>
              </div>
              <div>
                <span className="edit-history-meta-label">Dernière maj</span>
                <span className="edit-history-meta-date">
                  {formatDateTime(metaUpdateDate)}
                </span>
              </div>
            </div>
          </div>
          <div className="edit-history-actions">
            <UrbexButton variant="secondary" onClick={handleBackRequest}>
              Annuler / Retour
            </UrbexButton>
            <UrbexButton
              variant="secondary"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(`/spot/${spotId}`, "_blank");
                }
              }}
            >
              Aperçu
            </UrbexButton>
            <UrbexButton
              variant="primary"
              onClick={() => handleSave({ manual: true, showToast: true })}
              disabled={!isDirty || saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </UrbexButton>
          </div>
        </div>

        <div className="edit-history-form">
          <label className="edit-field">
            <span>
              Histoire courte
              <small className="edit-history-counter">
                {shortText.length}/400
              </small>
            </span>
            <textarea
              value={shortText}
              onChange={(e) => {
                setShortText(e.target.value);
                setStatusMessage("");
              }}
              rows={3}
              maxLength={400}
              placeholder="Résumé accrocheur visible en introduction"
            />
          </label>

          <label className="edit-field">
            <span>Histoire complète (riche)</span>
            <RichTextEditor
              value={fullHtml}
              onChange={(value) => {
                setFullHtml(value);
                setStatusMessage("");
              }}
              placeholder="Rédige comme sur Shopify : titres, listes, citations…"
              className="edit-history-editor"
            />
          </label>
        </div>

        <div className="edit-history-footer">
          <p
            className={`edit-history-status ${
              saveState === "error" ? "edit-history-error" : ""
            }`}
            aria-live="polite"
          >
            {statusMessage || progressHint}
          </p>
        </div>
      </SectionCard>
      {toast && (
        <div className={`edit-history-toast edit-history-toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
      {showDiscardConfirm && (
        <div className="edit-history-discard-backdrop">
          <div className="edit-history-discard-card">
            <h3>Quitter sans enregistrer ?</h3>
            <p>Les modifications non sauvegardées seront perdues.</p>
            <div className="edit-history-discard-actions">
              <UrbexButton
                variant="secondary"
                onClick={() => setShowDiscardConfirm(false)}
              >
                Rester
              </UrbexButton>
              <UrbexButton
                variant="danger"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  safeBack();
                }}
              >
                Quitter
              </UrbexButton>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
