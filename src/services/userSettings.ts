import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
export type { UserSettings } from "../types/UserSettings";
import type { UserSettings } from "../types/UserSettings";

export const SETTINGS_KEY = "urbexqueens_settings_v1";
export const SETTINGS_EVENT = "urbex-settings-updated";

const DEFAULT_SETTINGS: UserSettings = {
  profilePublic: true,
  showDonePublic: false,
  showFavoritesPublic: false,
  allowMessages: true,
  stealthMode: false,

  mapShowGhost: true,
  mapShowLegend: true,
  mapShowDone: true,
  autoCenterOnUser: false,
  lowLightMap: false,

  notifyNewSpotsNearMe: false,
  notifyNewSpotsNearby: false,
  notifyMessages: false,
  notifyComments: false,
  notifyDangerousSpots: true,
  notifyLoginAlerts: true,
  notifyNewsEmail: false,

  lastDataDownloadAt: null,
};

export function getDefaultSettings(): UserSettings {
  return { ...DEFAULT_SETTINGS };
}

export function loadSettingsFromLocal(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    merged.notifyNewSpotsNearby =
      merged.notifyNewSpotsNearby ?? merged.notifyNewSpotsNearMe ?? false;
    merged.notifyNewSpotsNearMe = merged.notifyNewSpotsNearby;
    return merged;
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettingsToLocal(settings: UserSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(
      new CustomEvent<UserSettings>(SETTINGS_EVENT, { detail: settings })
    );
  } catch (err) {
    console.error("Impossible de sauvegarder les paramètres localement", err);
  }
}

export async function loadSettingsFromFirestore(
  uid: string,
  options: { persistLocal?: boolean } = {}
): Promise<UserSettings> {
  const ref = doc(db, "userSettings", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return getDefaultSettings();

  const data = snap.data() as Partial<UserSettings>;
  const merged = { ...DEFAULT_SETTINGS, ...data };
  // Harmonise legacy/new keys
  merged.notifyNewSpotsNearby =
    merged.notifyNewSpotsNearby ?? merged.notifyNewSpotsNearMe ?? false;
  merged.notifyNewSpotsNearMe = merged.notifyNewSpotsNearby;
  if (options.persistLocal !== false) {
    saveSettingsToLocal(merged);
  }
  return merged;
}

export async function saveSettingsToFirestore(uid: string, settings: UserSettings) {
  ensureWritesAllowed();
  const ref = doc(db, "userSettings", uid);
  await setDoc(ref, settings, { merge: true });
  saveSettingsToLocal(settings);
}
