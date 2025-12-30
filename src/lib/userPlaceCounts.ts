import type { UserPlaceState, UserPlacesMap } from "../services/userPlaces";

const TRUE_VALUES = new Set(["yes", "true", "1"]);

export interface NormalizedUserPlace {
  placeId: string;
  done: boolean;
  saved: boolean;
  timestamp: number;
  key: string;
}

interface RawUserPlaceState extends UserPlaceState {
  placeId?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
  ts?: number;
  lastSeenAt?: number;
}

export function normalizeUserPlaceFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return TRUE_VALUES.has(value.trim().toLowerCase());
  }
  return false;
}

function extractTimestamp(state: RawUserPlaceState): number {
  const candidates = [
    state.updatedAt,
    state.createdAt,
    state.ts,
    state.lastSeenAt,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "number") return candidate;
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      typeof (candidate as any).toMillis === "function"
    ) {
      return (candidate as any).toMillis();
    }
    if (typeof candidate === "string") {
      const parsed = Date.parse(candidate);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
}

export function normalizeAndDedupeUserPlaces(userPlaces?: UserPlacesMap | null) {
  const normalizedMap = new Map<string, NormalizedUserPlace>();
  const duplicateBuckets = new Map<
    string,
    Array<{ key: string; state: RawUserPlaceState; timestamp: number }>
  >();

  Object.entries(userPlaces ?? {}).forEach(([key, state]) => {
    if (!state) return;
    const placeId = state.placeId ?? key;
    if (!placeId) return;

    const timestamp = extractTimestamp(state);
    const normalizedEntry: NormalizedUserPlace = {
      placeId,
      done: normalizeUserPlaceFlag(state.done),
      saved: normalizeUserPlaceFlag(state.saved),
      timestamp,
      key,
    };

    const existing = normalizedMap.get(placeId);
    if (!existing || timestamp >= existing.timestamp) {
      normalizedMap.set(placeId, normalizedEntry);
    }

    const bucket = duplicateBuckets.get(placeId) ?? [];
    bucket.push({ key, state, timestamp });
    duplicateBuckets.set(placeId, bucket);
  });

  const normalized = Array.from(normalizedMap.values());
  const duplicateDetails = Array.from(duplicateBuckets.entries())
    .filter(([, entries]) => entries.length > 1)
    .map(([placeId, entries]) => ({ placeId, entries }));

  return {
    byPlaceId: normalizedMap,
    list: normalized,
    duplicateDetails,
  };
}

export function getNormalizedUserPlaceCounts(userPlaces?: UserPlacesMap | null) {
  const { list } = normalizeAndDedupeUserPlaces(userPlaces);
  let done = 0;
  let saved = 0;
  list.forEach((entry) => {
    if (entry.done) done += 1;
    if (entry.saved) saved += 1;
  });
  return { done, saved, keys: list.length };
}

export function logUserPlaceDuplicates(userPlaces: UserPlacesMap) {
  if (!import.meta.env.DEV) return;
  const { duplicateDetails } = normalizeAndDedupeUserPlaces(userPlaces);
  const top = duplicateDetails
    .slice()
    .sort((a, b) => b.entries.length - a.entries.length)
    .slice(0, 10)
    .map((item) => ({
      placeId: item.placeId,
      entries: item.entries.map((entry) => ({
        key: entry.key,
        state: entry.state,
        timestamp: entry.timestamp,
      })),
    }));
  if (top.length === 0) {
    console.info("[UQ][DUPLICATES] no duplicate userPlaces entries detected");
    return;
  }
  console.info("[UQ][DUPLICATES]", top);
}
