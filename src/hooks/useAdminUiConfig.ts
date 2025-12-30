import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  updateDoc,
} from "firebase/firestore";
import { db, appCheck } from "../lib/firebase";
import { useCurrentUserRole } from "./useCurrentUserRole";
import type { AdminUiConfig } from "../../shared/adminUiConfig";
import {
  DEFAULT_ADMIN_UI_CONFIG,
  ADMIN_UI_CONFIG_SCHEMA_VERSION,
  ADMIN_UI_OVERLAY_LEFT_POSITIONS,
  ADMIN_UI_OVERLAY_RIGHT_POSITIONS,
  ADMIN_UI_OVERLAY_DEVICE_SCOPES,
  ADMIN_UI_THEME_PRESETS,
} from "../../shared/adminUiConfig";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Array<unknown>
      ? T[K]
      : DeepPartial<T[K]>
    : T[K];
};

export type AdminUiConfigPatch = DeepPartial<AdminUiConfig>;

export type AdminUiConfigMetadata = {
  version: number;
  schemaVersion: number;
  updatedAt: Date | null;
  updatedBy: string | null;
  configLocked: boolean;
  publishedAt: Date | null;
  publishedBy: string | null;
};

const DEFAULT_METADATA: AdminUiConfigMetadata = {
  version: DEFAULT_ADMIN_UI_CONFIG.version,
  schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
  updatedAt: null,
  updatedBy: null,
  configLocked: false,
  publishedAt: null,
  publishedBy: null,
};

const REQUIRED_SECTIONS: Array<keyof AdminUiConfig> = [
  "modules",
  "mapUi",
  "ui",
  "overlay",
  "theme",
  "flags",
  "maintenance",
];

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      return value.toDate();
    }
    if ("toMillis" in value && typeof value.toMillis === "function") {
      return new Date(value.toMillis());
    }
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  return null;
}

function mergeSection<T extends object>(defaults: T, raw?: Partial<T>): T {
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  return {
    ...defaults,
    ...(raw as Partial<T>),
  };
}

function mergeConfig(raw?: DocumentData | null): AdminUiConfig {
  const payload = raw ?? {};
  const mapUi = payload.mapUi as Partial<AdminUiConfig["mapUi"]> | undefined;
  const ui = payload.ui as Partial<AdminUiConfig["ui"]> | undefined;
  const overlay = payload.overlay as Partial<AdminUiConfig["overlay"]> | undefined;
  const theme = payload.theme as Partial<AdminUiConfig["theme"]> | undefined;

  return {
    version:
      typeof payload.version === "number"
        ? payload.version
        : DEFAULT_ADMIN_UI_CONFIG.version,
    updatedAt:
      payload.updatedAt instanceof Date || payload.updatedAt == null
        ? (payload.updatedAt ?? null)
        : payload.updatedAt,
    updatedBy:
      typeof payload.updatedBy === "string"
        ? payload.updatedBy
        : DEFAULT_ADMIN_UI_CONFIG.updatedBy,
    maintenance: mergeSection(DEFAULT_ADMIN_UI_CONFIG.maintenance, payload.maintenance),
    flags: mergeSection(DEFAULT_ADMIN_UI_CONFIG.flags, payload.flags),
    modules: mergeSection(DEFAULT_ADMIN_UI_CONFIG.modules, payload.modules),
    mapUi: mergeSection(DEFAULT_ADMIN_UI_CONFIG.mapUi, mapUi),
    ui: (() => {
      const normalizedUi = mergeSection(DEFAULT_ADMIN_UI_CONFIG.ui, ui);
      const headerHeightValue =
        typeof ui?.headerHeight === "number"
          ? ui.headerHeight
          : typeof ui?.topbarHeight === "number"
          ? ui.topbarHeight
          : normalizedUi.headerHeight;
      const topbarHeightValue =
        typeof ui?.topbarHeight === "number"
          ? ui.topbarHeight
          : typeof ui?.headerHeight === "number"
          ? ui.headerHeight
          : normalizedUi.topbarHeight;
      return {
        ...normalizedUi,
        headerHeight: headerHeightValue,
        topbarHeight: topbarHeightValue,
      };
    })(),
    overlay: {
      left: {
        enabled:
          typeof overlay?.left?.enabled === "boolean"
            ? overlay.left.enabled
            : DEFAULT_ADMIN_UI_CONFIG.overlay.left.enabled,
        position:
          typeof overlay?.left?.position === "string" &&
          ADMIN_UI_OVERLAY_LEFT_POSITIONS.includes(
            overlay.left.position as AdminUiConfig["overlay"]["left"]["position"]
          )
            ? (overlay.left.position as AdminUiConfig["overlay"]["left"]["position"])
            : DEFAULT_ADMIN_UI_CONFIG.overlay.left.position,
        device:
          typeof overlay?.left?.device === "string" &&
          ADMIN_UI_OVERLAY_DEVICE_SCOPES.includes(
            overlay.left.device as AdminUiConfig["overlay"]["left"]["device"]
          )
            ? (overlay.left.device as AdminUiConfig["overlay"]["left"]["device"])
            : DEFAULT_ADMIN_UI_CONFIG.overlay.left.device,
      },
      right: {
        enabled:
          typeof overlay?.right?.enabled === "boolean"
            ? overlay.right.enabled
            : DEFAULT_ADMIN_UI_CONFIG.overlay.right.enabled,
        position:
          typeof overlay?.right?.position === "string" &&
          ADMIN_UI_OVERLAY_RIGHT_POSITIONS.includes(
            overlay.right.position as AdminUiConfig["overlay"]["right"]["position"]
          )
            ? (overlay.right.position as AdminUiConfig["overlay"]["right"]["position"])
            : DEFAULT_ADMIN_UI_CONFIG.overlay.right.position,
        device:
          typeof overlay?.right?.device === "string" &&
          ADMIN_UI_OVERLAY_DEVICE_SCOPES.includes(
            overlay.right.device as AdminUiConfig["overlay"]["right"]["device"]
          )
            ? (overlay.right.device as AdminUiConfig["overlay"]["right"]["device"])
            : DEFAULT_ADMIN_UI_CONFIG.overlay.right.device,
      },
    },
    theme: {
      preset:
        typeof theme?.preset === "string" &&
        ADMIN_UI_THEME_PRESETS.includes(theme.preset as AdminUiConfig["theme"]["preset"])
          ? (theme.preset as AdminUiConfig["theme"]["preset"])
          : DEFAULT_ADMIN_UI_CONFIG.theme.preset,
    },
  };
}

function parseMetadata(raw?: DocumentData | null): AdminUiConfigMetadata {
  const payload = raw ?? {};
  const version =
    typeof payload.version === "number" ? payload.version : DEFAULT_METADATA.version;
  const schemaVersion =
    typeof payload.schemaVersion === "number"
      ? payload.schemaVersion
      : ADMIN_UI_CONFIG_SCHEMA_VERSION;
  return {
    version,
    schemaVersion,
    updatedAt: toDate(payload.updatedAt),
    updatedBy:
      typeof payload.updatedBy === "string" ? payload.updatedBy : DEFAULT_METADATA.updatedBy,
    configLocked:
      typeof payload.configLocked === "boolean"
        ? payload.configLocked
        : DEFAULT_METADATA.configLocked,
    publishedAt: toDate(payload.publishedAt),
    publishedBy:
      typeof payload.publishedBy === "string"
        ? payload.publishedBy
        : DEFAULT_METADATA.publishedBy,
  };
}

function hasInvalidPatch(patch: Record<string, unknown>): string | null {
  for (const key of REQUIRED_SECTIONS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const value = patch[key];
      if (value === null || value === undefined) {
        return `La section "${key}" ne peut pas être supprimée.`;
      }
    }
  }
  return null;
}

function mergePatches(
  previous: Record<string, unknown> | null,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(previous ?? {}) };
  Object.entries(patch).forEach(([key, value]) => {
    const previousValue = next[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      previousValue &&
      typeof previousValue === "object" &&
      !Array.isArray(previousValue)
    ) {
      next[key] = mergePatches(
        previousValue as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      next[key] = value;
    }
  });
  return next;
}

function attachMetadata(
  base: Record<string, unknown>,
  userId: string | null | undefined
): Record<string, unknown> {
  return {
    ...base,
    schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
    updatedBy: userId ?? null,
  };
}

export function useAdminUiConfigRuntime() {
  const publishedRef = useMemo(() => doc(db, "admin", "uiConfig_published"), []);
  const legacyRef = useMemo(() => doc(db, "admin", "uiConfig"), []);
  const [config, setConfig] = useState<AdminUiConfig>(DEFAULT_ADMIN_UI_CONFIG);
  const [metadata, setMetadata] = useState<AdminUiConfigMetadata>(DEFAULT_METADATA);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishedData, setPublishedData] = useState<DocumentData | null>(null);
  const [legacyData, setLegacyData] = useState<DocumentData | null>(null);

  useEffect(() => {
    const unsubscribePublished = onSnapshot(
      publishedRef,
      (snapshot) => {
        setPublishedData(snapshot.exists() ? snapshot.data() ?? null : null);
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("[UQ][ADMIN_UI_CONFIG_RUNTIME]", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : "Impossible de charger la configuration publiée."
        );
        setLoading(false);
      }
    );
    const unsubscribeLegacy = onSnapshot(
      legacyRef,
      (snapshot) => {
        setLegacyData(snapshot.exists() ? snapshot.data() ?? null : null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("[UQ][ADMIN_UI_CONFIG_RUNTIME]", snapshotError);
      }
    );
    return () => {
      unsubscribePublished();
      unsubscribeLegacy();
    };
  }, [legacyRef, publishedRef]);

  useEffect(() => {
    const source = publishedData ?? legacyData;
    if (!source) {
      setConfig(DEFAULT_ADMIN_UI_CONFIG);
      setMetadata(DEFAULT_METADATA);
      return;
    }
    setConfig(mergeConfig(source));
    setMetadata(parseMetadata(source));
  }, [legacyData, publishedData]);

  return {
    config,
    metadata,
    loading,
    error,
    schemaVersion: metadata.schemaVersion,
    defaults: DEFAULT_ADMIN_UI_CONFIG,
  };
}

export function useAdminUiConfig() {
  const { user, isAdmin, isSuperAdmin } = useCurrentUserRole();
  const [config, setConfig] = useState<AdminUiConfig>(DEFAULT_ADMIN_UI_CONFIG);
  const [metadata, setMetadata] = useState<AdminUiConfigMetadata>(DEFAULT_METADATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configDocRef = useMemo(() => doc(db, "admin", "uiConfig_draft"), []);
  const docExistsRef = useRef(false);
  const [docExists, setDocExists] = useState(false);
  const creationGuardRef = useRef(false);
  const pendingPatchRef = useRef<Record<string, unknown> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metadataRef = useRef(metadata);

  useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      configDocRef,
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        docExistsRef.current = snapshot.exists();
        setDocExists(snapshot.exists());
        setConfig(mergeConfig(data));
        setMetadata(parseMetadata(data));
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("[UQ][ADMIN_UI_CONFIG]", snapshotError);
        setError(
          snapshotError instanceof Error
            ? snapshotError.message
            : "Impossible de charger la configuration."
        );
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin || docExists || creationGuardRef.current) {
      return;
    }
    creationGuardRef.current = true;
    const draftRef = configDocRef;
    const legacyRef = doc(db, "admin", "uiConfig");

    (async () => {
      try {
        const legacySnap = await getDoc(legacyRef);
        const baseData = legacySnap.exists() ? legacySnap.data() ?? {} : null;
        const initialPayload: Record<string, unknown> = {
          ...DEFAULT_ADMIN_UI_CONFIG,
          version: DEFAULT_ADMIN_UI_CONFIG.version,
          schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
          configLocked: baseData?.configLocked ?? false,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid ?? null,
        };
        if (baseData) {
          Object.keys(baseData).forEach((key) => {
            if (typeof key === "string" && key !== "configLocked") {
              initialPayload[key] = (baseData as Record<string, unknown>)[key];
            }
          });
        }
        await setDoc(draftRef, initialPayload, { merge: true });
        docExistsRef.current = true;
        setDocExists(true);
      } catch (creationError) {
        console.error("[UQ][ADMIN_UI_CONFIG_INIT]", creationError);
      }
    })();
  }, [isAdmin, docExists, user?.uid]);

  const flushPatch = useCallback(async () => {
    const patch = pendingPatchRef.current;
    if (!patch) {
      return;
    }
    pendingPatchRef.current = null;
    const validationError = hasInvalidPatch(patch);
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = attachMetadata(patch, user?.uid);
    try {
      if (!docExistsRef.current) {
        await setDoc(
          configDocRef,
          {
            ...DEFAULT_ADMIN_UI_CONFIG,
            ...payload,
          },
          { merge: true }
        );
        docExistsRef.current = true;
        setDocExists(true);
      } else {
        if (import.meta.env.DEV) {
          console.log("[UQ][CFG] flushPatch payload", payload);
        }
        await updateDoc(configDocRef, payload);
      }
      setError(null);
    } catch (writeError) {
      if (import.meta.env.DEV) {
        console.error("[UQ][CFG] flushPatch FAILED", writeError);
        console.log("[UQ][CFG] user context", {
          uid: user?.uid ?? null,
          isAdmin,
          appCheckAvailable: Boolean(appCheck),
        });
      }
      console.error("[UQ][ADMIN_UI_CONFIG_SAVE]", writeError);
      setError(
        writeError instanceof Error
          ? writeError.message
          : "Impossible de sauvegarder la configuration."
      );
    }
  }, [isAdmin, user?.uid]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushPatch();
    }, 450);
  }, [flushPatch]);

  useEffect(
    () => () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    },
    []
  );

  const savePatch = useCallback(
    (patch: AdminUiConfigPatch) => {
      if (!isAdmin) {
        setError("Seuls les admins peuvent modifier la configuration.");
        return;
      }
      if (metadataRef.current.configLocked && !isSuperAdmin) {
        setError("La configuration est verrouillée. Seuls les super-admins peuvent écrire.");
        return;
      }
      if (!patch || Object.keys(patch).length === 0) {
        return;
      }
      const normalizedPatch = mergePatches(
        pendingPatchRef.current,
        patch as Record<string, unknown>
      );
      pendingPatchRef.current = normalizedPatch;
      scheduleFlush();
    },
    [isAdmin, isSuperAdmin, scheduleFlush]
  );

  const flushPendingChanges = useCallback(() => {
    return flushPatch();
  }, [flushPatch]);

  const setConfigLocked = useCallback(
    async (locked: boolean) => {
      if (!isSuperAdmin) {
        setError("Seuls les super-admins peuvent verrouiller la configuration.");
        return;
      }
      try {
        await updateDoc(configDocRef, {
          configLocked: locked,
          ...attachMetadata({}, user?.uid),
        });
        setError(null);
      } catch (lockError) {
        console.error("[UQ][ADMIN_UI_CONFIG_LOCK]", lockError);
        setError(
          lockError instanceof Error
            ? lockError.message
            : "Impossible de mettre à jour le verrouillage."
        );
      }
    },
    [isSuperAdmin, user?.uid]
  );

  return {
    config,
    metadata,
    loading,
    error,
    savePatch,
    flushPendingChanges,
    setConfigLocked,
    defaults: DEFAULT_ADMIN_UI_CONFIG,
    schemaVersion: metadata.schemaVersion,
    schemaMismatch: metadata.schemaVersion !== ADMIN_UI_CONFIG_SCHEMA_VERSION,
  };
}

export {
  DEFAULT_ADMIN_UI_CONFIG,
  ADMIN_UI_OVERLAY_LEFT_POSITIONS,
  ADMIN_UI_OVERLAY_RIGHT_POSITIONS,
  ADMIN_UI_OVERLAY_DEVICE_SCOPES,
  ADMIN_UI_THEME_PRESETS,
  ADMIN_UI_CONFIG_SCHEMA_VERSION,
};

export type { AdminUiConfig };
