import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuid } from "uuid";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";
import {
  DEFAULT_OVERLAY_VERSION,
  listenOverlayContext,
  listenOverlayVersions,
  publishOverlayVersion,
  rollbackOverlayVersion,
  createOverlayVersion,
  updateOverlayVersion,
  type DeviceType,
  type OverlayComponent,
  type OverlaySlot,
  type OverlayVersion,
  type OverlayDevice,
  type MapStyleValue,
} from "../../services/adminConfigs";
import OverlayRenderer from "../../components/OverlayRenderer";
import {
  DEFAULT_ADMIN_UI_CONFIG,
  useAdminUiConfig,
  ADMIN_UI_OVERLAY_LEFT_POSITIONS,
  ADMIN_UI_OVERLAY_RIGHT_POSITIONS,
  ADMIN_UI_OVERLAY_DEVICE_SCOPES,
} from "../../hooks/useAdminUiConfig";
import type { AdminUiConfig } from "../../hooks/useAdminUiConfig";

const OVERLAY_ID = "map-overlays";
const STYLE_OPTIONS: MapStyleValue[] = ["default", "night", "satellite"];
const DEVICE_OPTIONS: DeviceType[] = ["desktop", "tablet", "mobile"];

const slotOptions: OverlaySlot[] = [
  "top",
  "left",
  "right",
  "bottomRight",
  "floating",
];

export default function OverlayStudioPage() {
  const { user } = useCurrentUserRole();
  const [versions, setVersions] = useState<OverlayVersion[]>([]);
  const [contextPointer, setContextPointer] = useState<{
    draftVersionId?: string;
    publishedVersionId?: string;
  } | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [components, setComponents] = useState<OverlayComponent[]>(
    DEFAULT_OVERLAY_VERSION.components
  );
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null
  );
  const [previewRole, setPreviewRole] = useState("guest");
  const [previewDevice, setPreviewDevice] = useState<DeviceType>("desktop");
  const [previewWidth, setPreviewWidth] = useState(1024);
  const [previewZoom, setPreviewZoom] = useState(12);
  const [previewStyle, setPreviewStyle] = useState<MapStyleValue>("default");
  const [note, setNote] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = listenOverlayVersions(
      OVERLAY_ID,
      setVersions,
      (error) => console.error("[UQ][OVERLAY]", error)
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = listenOverlayContext(
      OVERLAY_ID,
      setContextPointer,
      (error) => console.error("[UQ][OVERLAY]", error)
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersionId(null);
      return;
    }
    if (
      selectedVersionId &&
      versions.some((item) => item.id === selectedVersionId)
    ) {
      return;
    }
    setSelectedVersionId(versions[0].id);
  }, [versions, selectedVersionId]);

  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  useEffect(() => {
    if (!selectedVersion) return;
    setComponents(selectedVersion.components);
    setNote(selectedVersion.meta.note ?? "");
  }, [selectedVersion]);

  const draftVersion = versions.find((v) => v.status === "draft") ?? null;
  const publishedVersion = versions.find((v) => v.status === "published");

  const sensors = useSensors(useSensor(PointerSensor));

  const slotGroups = useMemo(() => {
    return slotOptions.reduce<Record<OverlaySlot, OverlayComponent[]>>(
      (acc, slot) => {
        acc[slot] = components
          .filter((item) => item.slot === slot)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return acc;
      },
      {
        top: [],
        left: [],
        right: [],
        bottomRight: [],
        floating: [],
      }
    );
  }, [components]);

  const selectedComponent = useMemo(() => {
    if (!selectedComponentId) return components[0] ?? null;
    return components.find((item) => item.id === selectedComponentId) ?? null;
  }, [components, selectedComponentId]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      if (active.id === over.id) return;
      const activeComponent = components.find(
        (item) => item.id === active.id
      );
      const overComponent = components.find((item) => item.id === over.id);
      if (!activeComponent || !overComponent) return;
      let next = [...components];
      if (activeComponent.slot === overComponent.slot) {
        const slotItems = slotGroups[activeComponent.slot];
        const activeIndex = slotItems.findIndex(
          (item) => item.id === activeComponent.id
        );
        const overIndex = slotItems.findIndex(
          (item) => item.id === overComponent.id
        );
        const reordered = arrayMove(slotItems, activeIndex, overIndex);
        next = components.map((item) => {
          const updated = reordered.find((value) => value.id === item.id);
          return updated
            ? { ...item, order: reordered.indexOf(updated) }
            : item;
        });
      } else {
        next = components.map((item) =>
          item.id === activeComponent.id
            ? {
                ...item,
                slot: overComponent.slot,
                order: slotGroups[overComponent.slot].length,
              }
            : item
        );
      }
      setComponents(normalizeOrders(next));
    },
    [components, slotGroups]
  );

  const handleEditComponent = (value: Partial<OverlayComponent>) => {
    if (!selectedComponent) return;
    setComponents((prev) =>
      normalizeOrders(
        prev.map((item) =>
          item.id === selectedComponent.id ? { ...item, ...value } : item
        )
      )
    );
  };

  async function handleSaveDraft() {
    const targetVersion = draftVersion ?? selectedVersion;
    if (!targetVersion) return;
    setIsSaving(true);
    try {
      await updateOverlayVersion(OVERLAY_ID, targetVersion.id, components, {
        author: user?.displayName ?? user?.uid ?? null,
        note,
      });
      setStatusMessage("Brouillon enregistré.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Erreur lors de l’enregistrement.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddComponent() {
    const newComponent: OverlayComponent = {
      id: uuid(),
      label: "Nouveau composant",
      slot: "floating",
      order: slotGroups.floating.length,
      content: "",
    };
    setComponents((prev) => normalizeOrders([...prev, newComponent]));
    setSelectedComponentId(newComponent.id);
  }

  async function handleCreateDraft() {
    const baseItems = publishedVersion?.components ?? DEFAULT_OVERLAY_VERSION.components;
    try {
      const versionId = await createOverlayVersion(OVERLAY_ID, baseItems, {
        author: user?.displayName ?? user?.uid ?? null,
        parentVersionId: publishedVersion?.id,
      });
      setSelectedVersionId(versionId);
      setStatusMessage("Brouillon créé.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Impossible de créer le brouillon.");
    }
  }

  async function handlePublish() {
    const targetVersion = draftVersion ?? selectedVersion;
    if (!targetVersion || targetVersion.status !== "draft") return;
    try {
      await publishOverlayVersion(OVERLAY_ID, targetVersion.id, note);
      setStatusMessage("Version publiée.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Publication échouée.");
    }
  }

  async function handleRollback() {
    if (!publishedVersion) return;
    try {
      await rollbackOverlayVersion(OVERLAY_ID, publishedVersion.id);
      setStatusMessage("Rollback effectué.");
    } catch (err) {
      console.error(err);
      setStatusMessage("Rollback impossible.");
    }
  }

  const updateVisibilityList = (
    field: "roles" | "mapStyles",
    value: string
  ) => {
    if (!selectedComponent) return;
    const normalized =
      typeof value === "string"
        ? value
            .split(",")
            .map((entry: string) => entry.trim())
            .filter(Boolean)
        : value;
    setComponents((prev) =>
      prev.map((item) =>
        item.id === selectedComponent.id
          ? {
              ...item,
              visibility: {
                ...(item.visibility ?? {}),
                [field]: normalized,
              },
            }
          : item
      )
    );
  };

  const toggleVisibilityDevice = (device: OverlayDevice, checked: boolean) => {
    if (!selectedComponent) return;
    setComponents((prev) =>
      prev.map((item) => {
        if (item.id !== selectedComponent.id) return item;
        const existing: OverlayDevice[] = item.visibility?.devices ?? [];
        const nextDevices = checked
          ? Array.from(new Set([...existing, device]))
          : existing.filter((entry) => entry !== device);
        return {
          ...item,
          visibility: {
            ...(item.visibility ?? {}),
            devices: nextDevices,
          },
        };
      })
    );
  };

  const toggleVisibilityStyle = (style: MapStyleValue, checked: boolean) => {
    if (!selectedComponent) return;
    setComponents((prev) =>
      prev.map((item) => {
        if (item.id !== selectedComponent.id) return item;
        const existing = item.visibility?.mapStyles ?? [];
        const nextStyles = checked
          ? Array.from(new Set([...existing, style]))
          : existing.filter((entry) => entry !== style);
        return {
          ...item,
          visibility: {
            ...(item.visibility ?? {}),
            mapStyles: nextStyles,
          },
        };
      })
    );
  };

  return (
    <div className="admin-overlay-grid">
      <section className="admin-panel">
        <header>
          <h2>Overlay Studio</h2>
          <p>Positionnez et configurez les composants d’interface.</p>
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
            </button>
          ))}
        </div>
        <div className="admin-version-actions">
          {!draftVersion && (
            <button type="button" className="urbex-btn" onClick={handleCreateDraft}>
              Créer un brouillon
            </button>
          )}
          <button
            type="button"
            className="urbex-btn urbex-btn-primary"
            onClick={handlePublish}
            disabled={!draftVersion}
          >
            Publier
          </button>
          <button
            type="button"
            className="urbex-btn urbex-btn-secondary"
            onClick={handleRollback}
            disabled={!publishedVersion}
          >
            Rollback
          </button>
        </div>
        {contextPointer && (
          <p className="admin-status">
            Publication: {contextPointer.publishedVersionId ?? "—"} • Brouillon:{" "}
            {contextPointer.draftVersionId ?? "—"}
          </p>
        )}
        <div className="admin-actions">
          <button
            type="button"
            className="urbex-btn"
            onClick={handleAddComponent}
          >
            + Ajouter un composant
          </button>
        </div>
      </section>

      <OverlayStudioQuickConfig />

      <section className="admin-panel overlay-editor-panel">
        <header>
          <h2>Prévisualisation</h2>
          <p>Simulez un rôle, un appareil ou un zoom.</p>
        </header>
        <div className="admin-preview-controls">
          <label>
            Rôle
            <select
              value={previewRole}
              onChange={(event) => setPreviewRole(event.target.value)}
            >
              <option value="guest">guest</option>
              <option value="member">member</option>
              <option value="pro">pro</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label>
            Appareil
            <select
              value={previewDevice}
              onChange={(event) =>
                setPreviewDevice(event.target.value as DeviceType)
              }
            >
              {DEVICE_OPTIONS.map((device) => (
                <option key={device} value={device}>
                  {device}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-preview-controls">
          <label>
            Largeur
            <input
              type="range"
              min={320}
              max={1600}
              value={previewWidth}
              onChange={(event) => setPreviewWidth(Number(event.target.value))}
            />
            <span>{previewWidth}px</span>
          </label>
          <label>
            Zoom
            <input
              type="range"
              min={0}
              max={20}
              value={previewZoom}
              onChange={(event) => setPreviewZoom(Number(event.target.value))}
            />
            <span>{previewZoom}</span>
          </label>
          <label>
            Style
            <select
              value={previewStyle}
              onChange={(event) =>
                setPreviewStyle(event.target.value as MapStyleValue)
              }
            >
              {STYLE_OPTIONS.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overlay-preview">
          <OverlayRenderer
            components={components}
            role={previewRole}
            device={previewDevice}
            viewportWidth={previewWidth}
            mapZoom={previewZoom}
            mapStyle={previewStyle}
            preview
          />
        </div>
      </section>

      <section className="admin-panel overlay-editor-panel">
        <header>
          <h2>Éditeur de composants</h2>
          <p>Glissez, ordonnez et personnalisez les règles de visibilité.</p>
        </header>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="overlay-editor-slots">
            {slotOptions.map((slot) => (
              <SortableContext
                key={slot}
                items={slotGroups[slot].map((item) => item.id)}
                strategy={rectSortingStrategy}
              >
                <div className="overlay-slot-panel">
                  <h3>{slot}</h3>
                  {slotGroups[slot].map((component) => (
                    <SortableComponent
                      key={component.id}
                      component={component}
                      onSelect={() => setSelectedComponentId(component.id)}
                      isActive={component.id === selectedComponent?.id}
                    />
                  ))}
                </div>
              </SortableContext>
            ))}
          </div>
        </DndContext>

        {selectedComponent && (
          <div className="admin-field-grid">
            <div className="admin-field">
              <label>Label</label>
              <input
                type="text"
                value={selectedComponent.label}
                onChange={(event) =>
                  handleEditComponent({ label: event.target.value })
                }
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <label>Slot</label>
              <select
                value={selectedComponent.slot}
                onChange={(event) =>
                  handleEditComponent({
                    slot: event.target.value as OverlaySlot,
                  })
                }
                className="admin-input"
              >
                {slotOptions.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label>Contenu</label>
              <textarea
                rows={3}
                value={selectedComponent.content ?? ""}
                onChange={(event) =>
                  handleEditComponent({ content: event.target.value })
                }
                className="admin-textarea"
              />
            </div>
            <div className="admin-field">
              <label>Rôles (séparés par des virgules)</label>
              <input
                type="text"
                className="admin-input"
                value={(selectedComponent.visibility?.roles ?? []).join(", ")}
                onChange={(event) =>
                  updateVisibilityList("roles", event.target.value)
                }
              />
            </div>
            <div className="admin-field">
              <label>Appareils</label>
              <div className="admin-checkbox-grid">
                {DEVICE_OPTIONS.map((device) => (
                  <label key={device}>
                    <input
                      type="checkbox"
                      checked={
                        selectedComponent.visibility?.devices?.includes(device) ??
                        false
                      }
                      onChange={(event) =>
                        toggleVisibilityDevice(device, event.target.checked)
                      }
                    />
                    {device}
                  </label>
                ))}
              </div>
            </div>
            <div className="admin-field">
              <label>Largeur min / max</label>
              <div className="admin-grid">
                <input
                  type="number"
                  className="admin-input"
                  placeholder="min"
                  value={selectedComponent.visibility?.minWidth ?? ""}
                  onChange={(event) =>
                    handleEditComponent({
                      visibility: {
                        ...(selectedComponent.visibility ?? {}),
                        minWidth: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      },
                    })
                  }
                />
                <input
                  type="number"
                  className="admin-input"
                  placeholder="max"
                  value={selectedComponent.visibility?.maxWidth ?? ""}
                  onChange={(event) =>
                    handleEditComponent({
                      visibility: {
                        ...(selectedComponent.visibility ?? {}),
                        maxWidth: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="admin-field">
              <label>Zoom min / max</label>
              <div className="admin-grid">
                <input
                  type="number"
                  className="admin-input"
                  placeholder="min"
                  value={selectedComponent.visibility?.minZoom ?? ""}
                  onChange={(event) =>
                    handleEditComponent({
                      visibility: {
                        ...(selectedComponent.visibility ?? {}),
                        minZoom: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      },
                    })
                  }
                />
                <input
                  type="number"
                  className="admin-input"
                  placeholder="max"
                  value={selectedComponent.visibility?.maxZoom ?? ""}
                  onChange={(event) =>
                    handleEditComponent({
                      visibility: {
                        ...(selectedComponent.visibility ?? {}),
                        maxZoom: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="admin-field">
              <label>Map Styles</label>
              <div className="admin-checkbox-grid">
                {STYLE_OPTIONS.map((style) => (
                  <label key={style}>
                    <input
                      type="checkbox"
                      checked={
                        selectedComponent.visibility?.mapStyles?.includes(style) ??
                        false
                      }
                      onChange={(event) =>
                        toggleVisibilityStyle(style, event.target.checked)
                      }
                    />
                    {style}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

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
            disabled={isSaving}
          >
            {isSaving ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
          {statusMessage && <p className="admin-status">{statusMessage}</p>}
        </div>
      </section>
    </div>
  );
}

type OverlaySideKey = "left" | "right";

const OVERLAY_SIDE_CONFIG: ReadonlyArray<{
  key: OverlaySideKey;
  title: string;
  description: string;
  positions: readonly string[];
}> = [
  {
    key: "left",
    title: "Overlay gauche",
    description: "Cartes et contrôles alignés à gauche de la map.",
    positions: ADMIN_UI_OVERLAY_LEFT_POSITIONS,
  },
  {
    key: "right",
    title: "Overlay droit",
    description: "Messages et actions alignés à droite de la carte.",
    positions: ADMIN_UI_OVERLAY_RIGHT_POSITIONS,
  },
];

const OVERLAY_DEVICE_LABELS: Record<string, string> = {
  all: "Tous les appareils",
  desktop: "Desktop",
  mobile: "Mobile",
};

function formatPositionLabel(position: string) {
  return position
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function OverlayStudioQuickConfig() {
  const { config, loading, savePatch } = useAdminUiConfig();
  const overlay = config?.overlay ?? DEFAULT_ADMIN_UI_CONFIG.overlay;

  const handleSideUpdate = (
    side: OverlaySideKey,
    payload: Partial<AdminUiConfig["overlay"][OverlaySideKey]>
  ) => {
    savePatch({
      overlay: {
        [side]: payload,
      },
    });
  };

  return (
    <section className="admin-panel overlay-editor-panel">
      <header>
        <h2>Overlay Studio • Presets</h2>
        <p>
          Active/désactive et repositionne les colonnes overlays sans toucher au
          drag & drop.
        </p>
      </header>
      <div className="admin-overlay-config-grid">
        {OVERLAY_SIDE_CONFIG.map((sideConfig) => {
          const current = overlay[sideConfig.key];
          return (
            <article className="admin-overlay-config-card" key={sideConfig.key}>
              <header>
                <strong>{sideConfig.title}</strong>
                <p>{sideConfig.description}</p>
              </header>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={current.enabled}
                  disabled={loading}
                  onChange={(event) =>
                    handleSideUpdate(sideConfig.key, {
                      enabled: event.target.checked,
                    })
                  }
                />
                <span>{current.enabled ? "Activé" : "Désactivé"}</span>
              </label>
              <label className="admin-field">
                <span>Position</span>
                <select
                  className="admin-input"
                  value={current.position}
                  disabled={loading}
                  onChange={(event) =>
                    handleSideUpdate(sideConfig.key, {
                      position: event.target
                        .value as AdminUiConfig["overlay"][OverlaySideKey]["position"],
                    })
                  }
                >
                  {sideConfig.positions.map((position) => (
                    <option key={position} value={position}>
                      {formatPositionLabel(position)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field">
                <span>Portée</span>
                <select
                  className="admin-input"
                  value={current.device}
                  disabled={loading}
                  onChange={(event) =>
                    handleSideUpdate(sideConfig.key, {
                      device: event.target
                        .value as AdminUiConfig["overlay"][OverlaySideKey]["device"],
                    })
                  }
                >
                  {ADMIN_UI_OVERLAY_DEVICE_SCOPES.map((device) => (
                    <option key={device} value={device}>
                      {OVERLAY_DEVICE_LABELS[device] ?? device}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function normalizeOrders(items: OverlayComponent[]): OverlayComponent[] {
  const normalized = items.map((item) => ({ ...item }));
  slotOptions.forEach((slot) => {
    const slotItems = normalized
      .filter((item) => item.slot === slot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    slotItems.forEach((component, index) => {
      const target = normalized.find((item) => item.id === component.id);
      if (target) {
        target.order = index;
      }
    });
  });
  return normalized;
}

type SortableComponentProps = {
  component: OverlayComponent;
  onSelect: () => void;
  isActive: boolean;
};

function SortableComponent({
  component,
  onSelect,
  isActive,
}: SortableComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: component.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`overlay-chip ${isActive ? "is-active" : ""}`}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      {component.label}
    </button>
  );
}
