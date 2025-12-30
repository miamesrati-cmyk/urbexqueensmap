import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  exportAdminUiConfig,
  importAdminUiConfig,
  publishAdminUiConfig,
  restoreAdminUiConfig,
  type AdminUiConfigBackup,
} from "../../services/adminUiConfig";
import { useAdminUiConfig, useAdminUiConfigRuntime } from "../../hooks/useAdminUiConfig";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";
import { ADMIN_UI_CONFIG_SCHEMA_VERSION } from "../../../shared/adminUiConfig";

type StatusMessage = { type: "success" | "error"; text: string };

const formatDate = (value: Date | number | null | undefined) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-CA");
};

const downloadJson = (data: unknown, name: string) => {
  const payload = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(payload);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

export default function UiConfigPage() {
  const {
    metadata,
    schemaMismatch,
    flushPendingChanges,
    setConfigLocked,
  } = useAdminUiConfig();
  const { metadata: publishedMetadata } = useAdminUiConfigRuntime();
  const { isSuperAdmin } = useCurrentUserRole();
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isPublishing, setPublishing] = useState(false);
  const [isRestoring, setRestoring] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [isImporting, setImporting] = useState(false);
  const [backupPreview, setBackupPreview] = useState<AdminUiConfigBackup | null>(null);
  const [applyPublished, setApplyPublished] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editingDisabled = metadata.configLocked && !isSuperAdmin;
  const hasPublished = Boolean(publishedMetadata.publishedAt);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      await flushPendingChanges();
      const result = await publishAdminUiConfig();
      setStatusMessage({
        type: "success",
        text: `Version ${result.publishedVersion} publiée.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue.";
      setStatusMessage({
        type: "error",
        text: `Publier a échoué: ${message}`,
      });
    } finally {
      setPublishing(false);
    }
  }, [flushPendingChanges]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      await flushPendingChanges();
      const result = await restoreAdminUiConfig();
      setStatusMessage({
        type: "success",
        text: `Brouillon restauré depuis la version ${result.restoredVersion}.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue.";
      setStatusMessage({
        type: "error",
        text: `Restauration impossible: ${message}`,
      });
    } finally {
      setRestoring(false);
    }
  }, [flushPendingChanges]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const backup = await exportAdminUiConfig();
      downloadJson(
        backup,
        `urbex-ui-config-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      );
      setStatusMessage({
        type: "success",
        text: "La configuration a été exportée en JSON.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d’exporter.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setExporting(false);
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          typeof parsed.schemaVersion !== "number" ||
          typeof parsed.draft !== "object" ||
          parsed.draft === null
        ) {
          throw new Error("Structure JSON invalide.");
        }
        setBackupPreview(parsed);
        setImportError(null);
        setApplyPublished(Boolean(parsed.published));
        setStatusMessage({
          type: "success",
          text: `Backup prêt (${file.name}).`,
        });
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Lecture du fichier impossible."
        );
        setBackupPreview(null);
      }
    },
    []
  );

  const handleImport = useCallback(async () => {
    if (!backupPreview) {
      return;
    }
    setImporting(true);
    try {
      await importAdminUiConfig(backupPreview, applyPublished);
      setBackupPreview(null);
      setStatusMessage({
        type: "success",
        text: "Importation terminée.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import impossible.";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  }, [backupPreview, applyPublished]);

  const lockLabel = metadata.configLocked ? "Déverrouiller le brouillon" : "Verrouiller le brouillon";

  const publishedInfo = useMemo(() => {
    if (!hasPublished) return "Aucune version publiée.";
    return `Version ${publishedMetadata.version} · Publiée le ${formatDate(
      publishedMetadata.publishedAt
    )} · par ${publishedMetadata.publishedBy ?? "—"}`;
  }, [hasPublished, publishedMetadata]);

  return (
    <div className="admin-config-grid">
      <section className="admin-panel">
        <header>
          <h2>Flux brouillon / publication</h2>
          <p>Publiez ou restaurez sans toucher à la structure du site.</p>
        </header>
        {schemaMismatch && (
          <p className="admin-status admin-status--warning">
            Schéma attendu ({ADMIN_UI_CONFIG_SCHEMA_VERSION}) différent de la version
            actuelle ({metadata.schemaVersion}). La publication est bloquée.
          </p>
        )}
        {editingDisabled && (
          <p className="admin-status admin-status--warning">
            Brouillon verrouillé — aucune modification autorisée sauf super-admin.
          </p>
        )}
        <div className="admin-config-grid__meta">
          <div>
            <strong>Brouillon</strong>
            <p>Version {metadata.version} · Modifié le {formatDate(metadata.updatedAt)} · par {metadata.updatedBy ?? "—"}</p>
          </div>
          <div>
            <strong>Publié</strong>
            <p>{publishedInfo}</p>
          </div>
        </div>
        <div className="admin-version-actions">
          <button
            type="button"
            className="urbex-btn urbex-btn-primary"
            disabled={isPublishing || schemaMismatch}
            onClick={handlePublish}
          >
            {isPublishing ? "Publication…" : "Publier la version"}
          </button>
          <button
            type="button"
            className="urbex-btn urbex-btn-secondary"
            disabled={!hasPublished || isRestoring}
            onClick={handleRestore}
          >
            {isRestoring ? "Restauration…" : "Restaurer la version publiée"}
          </button>
        </div>
        {isSuperAdmin && (
          <div className="admin-config-lock">
            <p>
              {metadata.configLocked
                ? "Le brouillon est verrouillé pour empêcher les modifications."
                : "Le brouillon est ouvert aux modifications."}
            </p>
            <button
              type="button"
              className="urbex-btn urbex-btn-tertiary"
              onClick={() => setConfigLocked(!metadata.configLocked)}
            >
              {lockLabel}
            </button>
          </div>
        )}
      </section>

      <section className="admin-panel">
        <header>
          <h2>Export / import</h2>
          <p>Sauvegardez la configuration ou restaurez un backup complet.</p>
        </header>
        <div className="admin-version-actions">
          <button
            type="button"
            className="urbex-btn urbex-btn"
            disabled={isExporting}
            onClick={handleExport}
          >
            {isExporting ? "Exportation…" : "Exporter JSON"}
          </button>
          <button
            type="button"
            className="urbex-btn urbex-btn-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choisir un fichier
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
        {backupPreview && (
          <div className="admin-import-preview">
            <p>
              Backup : version {backupPreview.draft.version} (schema {backupPreview.schemaVersion})
            </p>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={applyPublished}
                onChange={(event) => setApplyPublished(event.target.checked)}
                disabled={!backupPreview.published}
              />
              Restaurer aussi la version publiée ({backupPreview.published ? "disponible" : "non incluse"})
            </label>
            <button
              type="button"
              className="urbex-btn urbex-btn-secondary"
              disabled={!backupPreview || isImporting}
              onClick={handleImport}
            >
              {isImporting ? "Importation…" : "Importer JSON"}
            </button>
          </div>
        )}
        {importError && (
          <p className="admin-status admin-status--error">{importError}</p>
        )}
        {statusMessage && (
          <p className={`admin-status admin-status--${statusMessage.type}`}>
            {statusMessage.text}
          </p>
        )}
      </section>
    </div>
  );
}
