// src/services/userPlaces.ts
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type UserPlaceState = {
  saved?: boolean;
  done?: boolean;
  placeId?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  ts?: number;
  lastSeenAt?: number;
};

export type UserPlacesMap = Record<string, UserPlaceState>;

/**
 * Écoute en temps réel les états "saved/done" d'un utilisateur.
 */
export function listenUserPlaces(
  userId: string,
  callback: (places: UserPlacesMap) => void
) {
  if (!userId) {
    callback({});
    return () => {};
  }

  const ref = doc(db, "userPlaces", userId);

  const unsub = onSnapshot(ref, (snap) => {
    const data = snap.data() as { places?: UserPlacesMap } | undefined;
    const places = data?.places || {};
    if (import.meta.env.DEV) {
      const traceInfo =
        typeof window !== "undefined"
          ? (window as any).__UQ_LAST_TOGGLE_TRACE__
          : undefined;
      console.info("[TOGGLE][snapshot]", {
        traceId: traceInfo?.traceId,
        placeId: traceInfo?.placeId,
        hasPlaces: !!data?.places,
        snapPlace:
          traceInfo?.placeId && places
            ? places[traceInfo.placeId]
            : undefined,
      });
    }
    callback(places);
  });

  return unsub;
}

/**
 * Mise à jour d'un spot pour un utilisateur donné.
 */
type ToggleWriteOptions = {
  traceId?: string;
};

async function updateUserPlace(
  userId: string,
  placeId: string,
  partial: Partial<UserPlaceState>,
  options?: ToggleWriteOptions
) {
  ensureWritesAllowed();
  if (!userId) return;
  const updates: Record<string, unknown> = {};
  Object.entries(partial).forEach(([key, value]) => {
    if (value === undefined) return;
    updates[`places.${placeId}.${key}`] = value;
  });
  if (Object.keys(updates).length === 0) return;

  if (import.meta.env.DEV) {
    console.info("[TOGGLE][write]", {
      traceId: options?.traceId,
      placeId,
      fields: Object.keys(partial),
      updateMap: updates,
    });
  }

  const ref = doc(db, "userPlaces", userId);
  await setDoc(ref, updates, { merge: true });
}

export function setPlaceSaved(
  userId: string,
  placeId: string,
  saved: boolean,
  traceId?: string
) {
  return updateUserPlace(userId, placeId, { saved }, { traceId });
}

export function setPlaceDone(
  userId: string,
  placeId: string,
  done: boolean,
  traceId?: string
) {
  return updateUserPlace(userId, placeId, { done }, { traceId });
}
