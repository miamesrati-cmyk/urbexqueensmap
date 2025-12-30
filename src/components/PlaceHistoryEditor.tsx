import { useEffect, useRef, useState } from "react";
import { updatePlaceHistory, type Place } from "../services/places";
import { uploadHistoryImage } from "../services/storage";
import RichTextEditor from "./RichTextEditor";

type Props = {
  place: Place;
  onClose?: () => void;
  onSaved?: () => void;
  className?: string;
};

export default function PlaceHistoryEditor({
  place,
  onClose,
  onSaved,
  className = "",
}: Props) {
  const [title, setTitle] = useState(place.historyTitle ?? "");
  const [shortText, setShortText] = useState(place.historyShort ?? "");
  const [fullText, setFullText] = useState(place.historyFull ?? "");
  const [fullHtml, setFullHtml] = useState(place.historyFullHtml ?? "");
  const [images, setImages] = useState<string[]>(place.historyImages ?? []);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(place.historyTitle ?? "");
    setShortText(place.historyShort ?? "");
    setFullText(place.historyFull ?? "");
    setFullHtml(place.historyFullHtml ?? "");
    setImages(place.historyImages ?? []);
  }, [
    place.id,
    place.historyTitle,
    place.historyShort,
    place.historyFull,
    place.historyFullHtml,
    place.historyImages,
  ]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 2800);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSave() {
    setSaveError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await updatePlaceHistory(place.id, {
        historyTitle: title.trim() || null,
        historyShort: shortText.trim() || null,
        historyFull: fullText.trim() || null,
        historyFullHtml: fullHtml.trim() || null,
        historyImages: images,
      });
      setSuccess("Histoire mise à jour");
      onSaved?.();
    } catch (err: any) {
      console.error("Erreur mise à jour histoire", err);
      setSaveError(err?.message || "Impossible de sauvegarder pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadHistoryImage(place.id, file);
        urls.push(url);
      }
      setImages((prev) => [...prev, ...urls]);
      setSuccess("Images ajoutées");
    } catch (err: any) {
      console.error("Erreur upload histoire", err);
      setUploadError(err?.message || "Impossible d’ajouter l’image.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((item) => item !== url));
  }

  return (
    <div className={`history-editor ${className}`}>
      <div className="history-editor-header">
        <div>
          <p className="history-editor-tag">Histoire du lieu</p>
          <h2>{place.title || place.name}</h2>
        </div>
        {onClose && (
          <button
            type="button"
            className="history-editor-close"
            onClick={onClose}
          >
            ✕
          </button>
        )}
      </div>

      <label className="history-editor-label">
        Titre de l’histoire
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre accrocheur pour la story"
        />
      </label>

      <label className="history-editor-label">
        Résumé / teaser
        <textarea
          value={shortText}
          onChange={(e) => setShortText(e.target.value)}
          rows={2}
          placeholder="Une accroche courte qui donne envie de lire plus"
        />
      </label>

      <label className="history-editor-label">
        Contenu complet
        <textarea
          value={fullText}
          onChange={(e) => setFullText(e.target.value)}
          rows={4}
          placeholder="Version texte simple (backup)"
        />
      </label>

      <label className="history-editor-label">
        Contenu riche (éditeur WYSIWYG)
        <RichTextEditor
          value={fullHtml}
          onChange={setFullHtml}
          placeholder="Ajoute du style : titres, gras, listes, citations…"
        />
      </label>

      <div className="history-images-section">
        <div className="history-images-header">
          <p>Images de l’histoire</p>
          <div className="history-images-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              className="history-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Import en cours…" : "Importer des images"}
            </button>
          </div>
        </div>
        {uploadError && (
          <p className="history-upload-error">{uploadError}</p>
        )}
        {images.length > 0 ? (
          <div className="history-images-grid">
            {images.map((url) => (
              <div key={url} className="history-image-card">
                <img src={url} alt="Aperçu de l’histoire" />
                <button
                  type="button"
                  className="history-image-remove"
                  onClick={() => removeImage(url)}
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="history-hint">
            Aucun média encore associé à cette histoire.
          </p>
        )}
      </div>

      {(saveError || success) && (
        <p className={`history-editor-status ${saveError ? "error" : "success"}`}>
          {saveError || success}
        </p>
      )}

      <div className="history-editor-actions">
        {onClose && (
          <button
            type="button"
            className="history-editor-cancel"
            onClick={onClose}
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          className="history-editor-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Mise à jour…" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}
