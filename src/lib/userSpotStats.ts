import type { Place } from "../services/places";
import type { UserPlacesMap } from "../services/userPlaces";
import { normalizeAndDedupeUserPlaces } from "./userPlaceCounts";

export type SpotListView = "done" | "favorites";

export const SPOT_LISTS_EVENT = "urbex-open-spot-lists";

export function dispatchSpotListView(view: SpotListView) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SPOT_LISTS_EVENT, { detail: { view } })
  );
}

export interface UserSpotCounts {
  totalDone: number;
  totalSaved: number;
}

export interface UserSpotCollections {
  done: Place[];
  favorites: Place[];
}

export function countUserSpotStates(
  userPlaces: UserPlacesMap
): UserSpotCounts {
  const normalized = normalizeAndDedupeUserPlaces(userPlaces).list;
  let totalDone = 0;
  let totalSaved = 0;
  normalized.forEach((entry) => {
    if (entry.done) totalDone += 1;
    if (entry.saved) totalSaved += 1;
  });
  return { totalDone, totalSaved };
}

export type NormalizedListedPlace = {
  place: Place;
  placeId: string;
  done: boolean;
  saved: boolean;
  timestamp: number;
};

export function buildUserSpotCollections(
  places: Place[],
  userPlaces: UserPlacesMap
): {
  donePlaces: NormalizedListedPlace[];
  savedPlaces: NormalizedListedPlace[];
} {
  const normalized = normalizeAndDedupeUserPlaces(userPlaces).list;
  const placeById = new Map(places.map((place) => [place.id, place]));
  const normalizedPlaces: NormalizedListedPlace[] = normalized
    .map((entry) => {
      const place = placeById.get(entry.placeId);
      if (!place) return null;
      return {
        place,
        placeId: entry.placeId,
        done: entry.done,
        saved: entry.saved,
        timestamp: entry.timestamp,
      };
    })
    .filter(Boolean) as NormalizedListedPlace[];
  const donePlaces = normalizedPlaces.filter((entry) => entry.done);
  const savedPlaces = normalizedPlaces.filter((entry) => entry.saved);
  return { donePlaces, savedPlaces };
}
