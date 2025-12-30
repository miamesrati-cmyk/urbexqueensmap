import { useEffect, useMemo, useState } from "react";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";
import {
  createThemeVersion,
  listenThemeVersions,
  publishThemeVersion,
  type ThemeVersion,
  updateThemeVersion,
} from "../../services/adminConfigs";
import {
  DEFAULT_ADMIN_UI_CONFIG,
  useAdminUiConfig,
} from "../../hooks/useAdminUiConfig";
import type { ThemePreset } from "../../hooks/useAdminUiConfig";

const THEME_ID = "map";

const THEME_PRESETS: Array<{
  key: ThemePreset;
  label: string;
  description: string;
  swatch: string[];
}> = [
  {
    key: "night",
    label: "Night Vision",
    description: "Default neon-black ambiance with pink glow.",
    swatch: ["#03030c", "#ff5ad3", "#7a5dff"],
  },
  {
    key: "violet",
    label: "Violet City",
    description: "Brighter violet gradient with contrast boosts.",
    swatch: ["#140722", "#d56cff", "#8f6eff"],
  },
  {
    key: "satellite",
    label: "Satellite Grid",
    description: "Green/teal data look inspired by sat imagery.",
    swatch: ["#0c1d2c", "#3ef5c9", "#73b9ff"],
  },
];

export default function ThemeEditorPage() {
  const { user } = useCurrentUserRole();
  const [versions, setVersions] = useState<ThemeVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );
  const [tokensJson, setTokensJson] = useState("");
  const [note, setNote] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = listenThemeVersions(THEME_ID, setVersions, (error) =>
      console.error("[UQ][THEME]", error)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersionId(null);
      return;
    }
    if (selectedVersionId && versions.some((v) => v.id === selectedVersionId)) {
      return;
    }
    const draft = versions.find((v) => v.status === "draft");
    setSelectedVersionId(draft?.id ?? versions[0].id);
  }, [versions, selectedVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  useEffect(() => {
    if (!selectedVersion) return;
    setTokensJson(
      JSON.stringify(selectedVersion.tokens ?? {}, null, 2) || "{}"
    );
    setNote(selectedVersion.meta.note ?? "");
  }, [selectedVersion]);

const publishedVersion = versions.find((v) => v.status === "published");
const hasDraft = versions.some((v) => v.status === "draft");

  async function handleSaveDraft() {
    if (!selectedVersion) return;
    let tokens: Record<string, unknown> = {};
    try {
      tokens = tokensJson.trim() ? JSON.parse(tokensJson) : {};
    } catch {
      setStatusMessage("JSON invalide pour les tokens.");
      return;
    }
    setIsSaving(true);
    try {
      await updateThemeVersion(THEME_ID, selectedVersion.id, tokens, {
        author: user?.displayName ?? user?.uid ?? null,
        note,
      });
      setStatusMessage("Brouillon enregistré.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Échec de l’enregistrement.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateDraft() {
    const baseTokens = publishedVersion?.tokens ?? {};
    try {
      const parentId = publishedVersion?.id;
      const newId = await createThemeVersion(THEME_ID, baseTokens, {
        author: user?.displayName ?? user?.uid ?? null,
        parentVersionId: parentId,
      });
      setSelectedVersionId(newId);
      setStatusMessage("Brouillon créé.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Impossible de créer un brouillon.");
    }
  }

  async function handlePublish() {
    if (!selectedVersion || selectedVersion.status !== "draft") return;
    try {
      await publishThemeVersion(THEME_ID, selectedVersion.id, note);
      setStatusMessage("Version publiée.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Échec de la publication.");
    }
  }

  return (
    <div className="admin-config-grid">
      <section className="admin-panel">
        <header>
          <h2>Versions du thème</h2>
          <p>Listez et sélectionnez la version à éditer.</p>
        </header>
        <div className="admin-version-list">
          {versions.map((version) => (
            <button
              key={version.id}
              type="button"
              className={`admin-version-item ${
                version.id === selectedVersionId ? "is-active" : ""
              }`}
              onClick={() => setSelectedVersionId(version.id)}
            >
              <span className="admin-version-item__title">
                {version.status === "published" ? "Publié" : "Brouillon"}
              </span>
              <span className="admin-version-item__meta">
                {version.meta.author ?? "Admin"} •{" "}
                {new Date(version.meta.timestamp).toLocaleString("fr-CA")}
              </span>
              {version.meta.note && (
                <span className="admin-version-item__note">
                  Note: {version.meta.note}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="admin-version-actions">
          {!hasDraft && (
            <button type="button" className="urbex-btn" onClick={handleCreateDraft}>
              Créer un brouillon
            </button>
          )}
          {selectedVersion?.status === "draft" && (
            <button
              type="button"
              className="urbex-btn urbex-btn-primary"
              onClick={handlePublish}
            >
              Publier la version
            </button>
          )}
        </div>
      </section>

      <AdminThemePresetsCard />

      <section className="admin-panel">
        <header>
          <h2>Éditeur de tokens</h2>
          <p>Modifiez le JSON des tokens design.</p>
        </header>
        <div className="admin-field">
          <label>JSON des tokens</label>
          <textarea
            rows={12}
            value={tokensJson}
            onChange={(event) => setTokensJson(event.target.value)}
            className="admin-textarea"
          />
        </div>
        <div className="admin-field">
          <label>Note de version</label>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="admin-input"
          />
        </div>
        <div className="admin-actions">
          <button
            type="button"
            className="urbex-btn urbex-btn-primary"
            onClick={handleSaveDraft}
            disabled={isSaving || selectedVersion?.status !== "draft"}
          >
            {isSaving ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
          {statusMessage && (
            <p className="admin-status">{statusMessage}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function AdminThemePresetsCard() {
  const { config, loading, savePatch } = useAdminUiConfig();
  const current = config?.theme.preset ?? DEFAULT_ADMIN_UI_CONFIG.theme.preset;

  const handleChange = (preset: ThemePreset) => {
    if (current === preset || loading) return;
    savePatch({ theme: { preset } });
  };

  return (
    <section className="admin-panel admin-theme-presets">
      <header>
        <h2>Presets</h2>
        <p>Basculer rapidement entre les tonalités du site sans toucher aux tokens JSON.</p>
      </header>
      <div className="admin-theme-presets-grid">
        {THEME_PRESETS.map((preset) => (
          <label
            key={preset.key}
            className={`admin-theme-preset ${current === preset.key ? "is-active" : ""}`}
          >
            <input
              type="radio"
              name="themePreset"
              value={preset.key}
              checked={current === preset.key}
              disabled={loading}
              onChange={() => handleChange(preset.key)}
            />
            <div className="admin-theme-preset__swatch">
              {preset.swatch.map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </div>
            <div className="admin-theme-preset__content">
              <strong>{preset.label}</strong>
              <p>{preset.description}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
