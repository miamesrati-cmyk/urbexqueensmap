import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
export type AdminUiConfigDocument = {
  version: number;
  schemaVersion: number;
  updatedAt: number | null;
  updatedBy: string | null;
  publishedAt: number | null;
  publishedBy: string | null;
  configLocked?: boolean;
  maintenance?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  modules?: Record<string, unknown>;
  mapUi?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  overlay?: Record<string, unknown>;
  theme?: Record<string, unknown>;
};

export type AdminUiConfigBackup = {
  schemaVersion: number;
  timestamp: number;
  draft: AdminUiConfigDocument;
  published?: AdminUiConfigDocument | null;
};

const publishCallable = httpsCallable<
  void,
  { publishedVersion: number }
>(functions, "publishAdminUiConfig");
const restoreCallable = httpsCallable<
  void,
  { restoredVersion: number }
>(functions, "restoreAdminUiConfig");
const exportCallable = httpsCallable<void, AdminUiConfigBackup>(
  functions,
  "exportAdminUiConfig"
);
const importCallable = httpsCallable<
  { backup: AdminUiConfigBackup; applyPublished?: boolean },
  { success: true }
>(functions, "importAdminUiConfig");

export async function publishAdminUiConfig(): Promise<{
  publishedVersion: number;
}> {
  const response = await publishCallable();
  return response.data;
}

export async function restoreAdminUiConfig(): Promise<{ restoredVersion: number }> {
  const response = await restoreCallable();
  return response.data;
}

export async function exportAdminUiConfig(): Promise<AdminUiConfigBackup> {
  const response = await exportCallable();
  return response.data;
}

export async function importAdminUiConfig(
  backup: AdminUiConfigBackup,
  applyPublished: boolean
): Promise<{ success: true }> {
  const response = await importCallable({
    backup,
    applyPublished,
  });
  return response.data;
}
