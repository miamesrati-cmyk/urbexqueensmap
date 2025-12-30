import { httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  DocumentSnapshot,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, functions } from "../lib/firebase";
import { v4 as uuid } from "uuid";
import { z } from "zod";

const mapStyleValueSchema = z.enum(["default", "night", "satellite"]);
export type MapStyleValue = z.infer<typeof mapStyleValueSchema>;

export const uiConfigSchema = z
  .object({
    mapStyle: mapStyleValueSchema.default("default"),
    showLegend: z.boolean().default(true),
    showHostToggle: z.boolean().default(true),
    showProPanel: z.boolean().default(true),
    accentColor: z.string().max(32).optional(),
    headerText: z.string().max(150).optional(),
    layoutSpacing: z.number().min(0).max(64).optional(),
  })
  .passthrough();

export type UiConfig = z.infer<typeof uiConfigSchema>;

const overlayDevicesSchema = z.enum(["mobile", "tablet", "desktop"]);
export type OverlayDevice = z.infer<typeof overlayDevicesSchema>;

const overlaySlotsSchema = z.enum([
  "top",
  "left",
  "right",
  "bottomRight",
  "floating",
]);
export type OverlaySlot = z.infer<typeof overlaySlotsSchema>;

const overlayVisibilitySchema = z
  .object({
    roles: z.array(z.string().min(1)).optional(),
    devices: z.array(overlayDevicesSchema).optional(),
    minWidth: z.number().min(0).optional(),
    maxWidth: z.number().min(0).optional(),
    minZoom: z.number().min(0).optional(),
    maxZoom: z.number().min(0).optional(),
    mapStyles: z.array(mapStyleValueSchema).optional(),
  })
  .passthrough();

export type OverlayVisibility = z.infer<typeof overlayVisibilitySchema>;

export const overlayComponentSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(100),
    slot: overlaySlotsSchema,
    order: z.number().int().nonnegative(),
    content: z.string().max(256).optional(),
    visibility: overlayVisibilitySchema.optional(),
  })
  .passthrough();

export type OverlayComponent = z.infer<typeof overlayComponentSchema>;
const overlayComponentsSchema = z.array(overlayComponentSchema);

export type AdminMeta = {
  author: string | null;
  timestamp: number;
  note?: string;
  parentVersionId?: string;
  publishedAt?: number;
};

export type ThemeVersion = {
  id: string;
  status: "draft" | "published";
  tokens: Record<string, unknown>;
  meta: AdminMeta;
};

export type UiConfigVersion = {
  id: string;
  status: "draft" | "published";
  config: UiConfig;
  meta: AdminMeta;
};

export type OverlayVersion = {
  id: string;
  status: "draft" | "published";
  components: OverlayComponent[];
  meta: AdminMeta;
};

export type AdminContextPointer = {
  publishedVersionId?: string;
  draftVersionId?: string;
};

export type DeviceType = OverlayDevice;

export const DEFAULT_UI_CONFIG: UiConfig = {
  mapStyle: "default",
  showLegend: true,
  showHostToggle: true,
  showProPanel: true,
  accentColor: "#ff5fa2",
  headerText: "URBEXQUEENS MAP",
  layoutSpacing: 16,
};

export const DEFAULT_OVERLAY_COMPONENTS: OverlayComponent[] = [
  {
    id: "legend-inline",
    label: "Légende",
    slot: "left",
    order: 0,
    content: "Pins, filtres et statuts visibles",
  },
  {
    id: "cta-banner",
    label: "Carte PRO",
    slot: "bottomRight",
    order: 0,
    content: "Débloque la carte PRO",
    visibility: {
      roles: ["member"],
      devices: ["desktop", "tablet"],
    },
  },
  {
    id: "floating-hint",
    label: "Hint",
    slot: "floating",
    order: 0,
    content: "Balade au premier spot dispo",
  },
];

export const DEFAULT_OVERLAY_VERSION: OverlayVersion = {
  id: "default-overlay",
  status: "published",
  components: DEFAULT_OVERLAY_COMPONENTS,
  meta: {
    author: "system",
    timestamp: Date.now(),
  },
};

const publishThemeCallable = httpsCallable(functions, "publishThemeVersion");
const publishUiConfigCallable = httpsCallable(functions, "publishUiConfigVersion");
const rollbackUiConfigCallable = httpsCallable(functions, "rollbackUiConfigVersion");
const publishOverlayCallable = httpsCallable(functions, "publishOverlayVersion");
const rollbackOverlayCallable = httpsCallable(functions, "rollbackOverlayVersion");

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function parseStatus(value: unknown): "draft" | "published" {
  return value === "published" ? "published" : "draft";
}

function sanitizeMeta(raw?: any): AdminMeta {
  return {
    author: typeof raw?.author === "string" ? raw.author : null,
    timestamp: toMillis(raw?.timestamp) ?? Date.now(),
    note: typeof raw?.note === "string" ? raw.note : undefined,
    parentVersionId:
      typeof raw?.parentVersionId === "string" ? raw.parentVersionId : undefined,
    publishedAt: toMillis(raw?.publishedAt),
  };
}

function mapThemeVersion(
  docSnap: DocumentSnapshot<Record<string, unknown>>
): ThemeVersion {
  const data = docSnap.data() ?? {};
  const tokens =
    typeof data.tokens === "object" && data.tokens !== null
      ? (data.tokens as Record<string, unknown>)
      : {};
  return {
    id: docSnap.id,
    status: parseStatus(data.status),
    tokens,
    meta: sanitizeMeta(data.meta),
  };
}

function mapUiConfigVersion(
  docSnap: DocumentSnapshot<Record<string, unknown>>
): UiConfigVersion {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    status: parseStatus(data.status),
    config: parseUiConfig(data.config),
    meta: sanitizeMeta(data.meta),
  };
}

function mapOverlayVersion(
  docSnap: DocumentSnapshot<Record<string, unknown>>
): OverlayVersion {
  const data = docSnap.data() ?? {};
  return {
    id: docSnap.id,
    status: parseStatus(data.status),
    components: parseOverlayComponents(data.components),
    meta: sanitizeMeta(data.meta),
  };
}

export function parseUiConfig(value: unknown): UiConfig {
  const parsed = uiConfigSchema.safeParse(value ?? {});
  if (parsed.success) {
    return parsed.data;
  }
  console.warn("[UQ][UI_CONFIG] invalid config", parsed.error);
  return DEFAULT_UI_CONFIG;
}

export function parseOverlayComponents(
  value: unknown
): OverlayComponent[] {
  const parsed = overlayComponentsSchema.safeParse(value ?? []);
  if (parsed.success) {
    return parsed.data;
  }
  console.warn("[UQ][OVERLAY] invalid components", parsed.error);
  return DEFAULT_OVERLAY_COMPONENTS;
}

export function listenThemeVersions(
  themeId: string,
  callback: (items: ThemeVersion[]) => void,
  onError?: (error: unknown) => void
) {
  const q = query(
    collection(db, "adminThemes", themeId, "versions"),
    orderBy("meta.timestamp", "desc")
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapThemeVersion)),
    onError
  );
}

export function listenUiConfigVersions(
  contextId: string,
  callback: (items: UiConfigVersion[]) => void,
  onError?: (error: unknown) => void
) {
  const q = query(
    collection(db, "adminUiConfigs", contextId, "versions"),
    orderBy("meta.timestamp", "desc")
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapUiConfigVersion)),
    onError
  );
}

export function listenOverlayVersions(
  overlayId: string,
  callback: (items: OverlayVersion[]) => void,
  onError?: (error: unknown) => void
) {
  const q = query(
    collection(db, "adminOverlays", overlayId, "versions"),
    orderBy("meta.timestamp", "desc")
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(mapOverlayVersion)),
    onError
  );
}

export function listenUiConfigContext(
  contextId: string,
  callback: (pointer: AdminContextPointer | null) => void,
  onError?: (error: unknown) => void
) {
  return onSnapshot(
    doc(db, "adminUiConfigs", contextId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = snap.data() ?? {};
      callback({
        publishedVersionId:
          typeof data.publishedVersionId === "string"
            ? data.publishedVersionId
            : undefined,
        draftVersionId:
          typeof data.draftVersionId === "string"
            ? data.draftVersionId
            : undefined,
      });
    },
    onError
  );
}

export function listenOverlayContext(
  overlayId: string,
  callback: (pointer: AdminContextPointer | null) => void,
  onError?: (error: unknown) => void
) {
  return onSnapshot(
    doc(db, "adminOverlays", overlayId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = snap.data() ?? {};
      callback({
        publishedVersionId:
          typeof data.publishedVersionId === "string"
            ? data.publishedVersionId
            : undefined,
        draftVersionId:
          typeof data.draftVersionId === "string"
            ? data.draftVersionId
            : undefined,
      });
    },
    onError
  );
}

export function listenPublishedUiConfig(
  contextId: string,
  callback: (item: UiConfigVersion | null) => void,
  onError?: (error: unknown) => void
) {
  const q = query(
    collection(db, "adminUiConfigs", contextId, "versions"),
    where("status", "==", "published"),
    orderBy("meta.publishedAt", "desc"),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      callback(mapUiConfigVersion(snap.docs[0]));
    },
    onError
  );
}

export function listenPublishedOverlay(
  overlayId: string,
  callback: (item: OverlayVersion | null) => void,
  onError?: (error: unknown) => void
) {
  const q = query(
    collection(db, "adminOverlays", overlayId, "versions"),
    where("status", "==", "published"),
    orderBy("meta.publishedAt", "desc"),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      callback(mapOverlayVersion(snap.docs[0]));
    },
    onError
  );
}

async function setDraftPointer(
  collectionName: string,
  docId: string,
  versionId: string
) {
  await setDoc(
    doc(db, collectionName, docId),
    {
      draftVersionId: versionId,
    },
    { merge: true }
  );
}

function buildMeta(
  author?: string | null,
  note?: string,
  parentVersionId?: string
): AdminMeta {
  const normalizedNote =
    typeof note === "string" && note.trim().length > 0 ? note.trim() : undefined;
  return {
    author: author ?? null,
    timestamp: Date.now(),
    note: normalizedNote,
    parentVersionId,
  };
}

export async function createThemeVersion(
  themeId: string,
  tokens: Record<string, unknown>,
  options: {
    author?: string | null;
    note?: string;
    parentVersionId?: string;
  } = {}
) {
  const versionId = uuid();
  await setDoc(doc(db, "adminThemes", themeId, "versions", versionId), {
    status: "draft",
    tokens,
    meta: buildMeta(options.author, options.note, options.parentVersionId),
  });
  await setDraftPointer("adminThemes", themeId, versionId);
  return versionId;
}

export async function updateThemeVersion(
  themeId: string,
  versionId: string,
  tokens: Record<string, unknown>,
  options: {
    author?: string | null;
    note?: string;
  } = {}
) {
  const updates: Record<string, unknown> = {
    tokens,
    "meta.timestamp": Date.now(),
  };
  if (options.author !== undefined) {
    updates["meta.author"] = options.author;
  }
  if (options.note !== undefined) {
    updates["meta.note"] =
      options.note.trim().length > 0 ? options.note.trim() : null;
  }
  await updateDoc(
    doc(db, "adminThemes", themeId, "versions", versionId),
    updates
  );
}

export async function createUiConfigVersion(
  contextId: string,
  config: UiConfig,
  options: {
    author?: string | null;
    note?: string;
    parentVersionId?: string;
  } = {}
) {
  const versionId = uuid();
  await setDoc(doc(db, "adminUiConfigs", contextId, "versions", versionId), {
    status: "draft",
    config,
    meta: buildMeta(options.author, options.note, options.parentVersionId),
  });
  await setDraftPointer("adminUiConfigs", contextId, versionId);
  return versionId;
}

export async function updateUiConfigVersion(
  contextId: string,
  versionId: string,
  config: UiConfig,
  options: {
    author?: string | null;
    note?: string;
  } = {}
) {
  const updates: Record<string, unknown> = {
    config,
    "meta.timestamp": Date.now(),
  };
  if (options.author !== undefined) {
    updates["meta.author"] = options.author;
  }
  if (options.note !== undefined) {
    updates["meta.note"] =
      options.note.trim().length > 0 ? options.note.trim() : null;
  }
  await updateDoc(
    doc(db, "adminUiConfigs", contextId, "versions", versionId),
    updates
  );
}

export async function createOverlayVersion(
  overlayId: string,
  components: OverlayComponent[],
  options: {
    author?: string | null;
    note?: string;
    parentVersionId?: string;
  } = {}
) {
  const versionId = uuid();
  await setDoc(
    doc(db, "adminOverlays", overlayId, "versions", versionId),
    {
      status: "draft",
      components,
      meta: buildMeta(options.author, options.note, options.parentVersionId),
    }
  );
  await setDraftPointer("adminOverlays", overlayId, versionId);
  return versionId;
}

export async function updateOverlayVersion(
  overlayId: string,
  versionId: string,
  components: OverlayComponent[],
  options: {
    author?: string | null;
    note?: string;
  } = {}
) {
  const updates: Record<string, unknown> = {
    components,
    "meta.timestamp": Date.now(),
  };
  if (options.author !== undefined) {
    updates["meta.author"] = options.author;
  }
  if (options.note !== undefined) {
    updates["meta.note"] =
      options.note.trim().length > 0 ? options.note.trim() : null;
  }
  await updateDoc(
    doc(db, "adminOverlays", overlayId, "versions", versionId),
    updates
  );
}

export async function publishThemeVersion(
  themeId: string,
  versionId: string,
  note?: string
) {
  await publishThemeCallable({ themeId, versionId, note });
}

export async function publishUiConfigVersion(
  contextId: string,
  versionId: string,
  note?: string
) {
  await publishUiConfigCallable({ contextId, versionId, note });
}

export async function rollbackUiConfigVersion(
  contextId: string,
  versionId: string
) {
  await rollbackUiConfigCallable({ contextId, versionId });
}

export async function publishOverlayVersion(
  overlayId: string,
  versionId: string,
  note?: string
) {
  await publishOverlayCallable({ overlayId, versionId, note });
}

export async function rollbackOverlayVersion(
  overlayId: string,
  versionId: string
) {
  await rollbackOverlayCallable({ overlayId, versionId });
}
