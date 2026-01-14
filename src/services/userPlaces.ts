// src/services/userPlaces.ts
import { doc, setDoc } from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import {
  evaluateAchievementsForPlaceDone,
  type PlaceDoneMetadata,
} from "./achievements";

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
    console.log("[TOGGLE][snapshot] Raw data from Firestore:", {
      exists: snap.exists(),
      data: data,
      placesKeys: Object.keys(places),
      placesCount: Object.keys(places).length,
    });
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
  if (!userId) {
    console.error("[TOGGLE][write] ERROR: no userId");
    return;
  }
  const updates: Record<string, unknown> = {};
  Object.entries(partial).forEach(([key, value]) => {
    if (value === undefined) return;
    updates[`places.${placeId}.${key}`] = value;
  });
  if (Object.keys(updates).length === 0) {
    console.error("[TOGGLE][write] ERROR: no updates to apply");
    return;
  }

  if (import.meta.env.DEV) {
    console.info("[TOGGLE][write]", {
      traceId: options?.traceId,
      placeId,
      userId,
      fields: Object.keys(partial),
      updateMap: updates,
    });
  }

  const ref = doc(db, "userPlaces", userId);
  console.log("[TOGGLE][write] About to call setDoc", {
    collection: "userPlaces",
    docId: userId,
    updates,
  });
  try {
    await setDoc(ref, updates, { merge: true });
    console.log("[TOGGLE][write] setDoc SUCCESS");
  } catch (error) {
    console.error("[TOGGLE][write] setDoc FAILED", error);
    throw error;
  }
}

export function setPlaceSaved(
  userId: string,
  placeId: string,
  saved: boolean,
  traceId?: string
) {
  return updateUserPlace(userId, placeId, { saved }, { traceId });
}

type SetPlaceDoneOptions = {
  traceId?: string;
  metadata?: PlaceDoneMetadata;
  isPro?: boolean;
};

export async function setPlaceDone(
  userId: string,
  placeId: string,
  done: boolean,
  options?: SetPlaceDoneOptions
) {
  const traceId = options?.traceId;
  await updateUserPlace(userId, placeId, { done }, { traceId });

  if (done) {
    evaluateAchievementsForPlaceDone(
      userId,
      {
        placeId,
        ...(options?.metadata ?? {}),
      },
      { isPro: options?.isPro, source: "spot_done" }
    ).catch((error) => {
      console.error("[achievements] place done evaluation failed", error);
    });
  }
}
