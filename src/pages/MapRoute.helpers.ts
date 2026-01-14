// Helper functions for MapRoute component
// eslint-disable-next-line react-refresh/only-export-components
import type { Place, SpotTier } from "../services/places";

export function getSpotTier(place: Place): SpotTier {
  if (place.tier === "EPIC") return "EPIC";
  if (place.tier === "GHOST") return "GHOST";
  if (place.isLegend) return "EPIC";
  if (place.isGhost) return "GHOST";
  return "STANDARD";
}

export function isEpicSpot(place: Place) {
  return getSpotTier(place) === "EPIC";
}

export function formatDistanceKm(coordsA: [number, number], coordsB: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coordsB[1] - coordsA[1]);
  const dLon = toRad(coordsB[0] - coordsA[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coordsA[1])) *
      Math.cos(toRad(coordsB[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatRiskLevel(value?: string) {
  if (!value) return "Moyen";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAccess(value?: string) {
  if (!value) return "Moyen";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatTimestampLabel(value?: number) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-CA", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatDistanceLabel(value: number | null) {
  if (!value) return "—";
  return `${value.toFixed(1)} km`;
}

export function getPlaceCoordinates(place: Place): [number, number] | null {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return [lng, lat];
}

export function placeToFeature(
  place: Place,
  userPlacesMap?: Record<string, { done?: boolean; saved?: boolean } | undefined>,
  _isPro?: boolean // Kept for API compatibility but not used (done spots filtered out)
): any {
  const coordinates = getPlaceCoordinates(place);
  if (!coordinates) {
    return null;
  }
  
  // Get user interaction state
  const userState = userPlacesMap?.[place.id];
  const tier = getSpotTier(place);
  
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates,
    },
    properties: {
      id: place.id,
      title: place.title ?? place.name ?? "",
      isEpic: isEpicSpot(place),
      isGhost: !!place.isGhost,
      tier,
      // Only "saved" is used for visual markers (done spots are filtered from map)
      saved: userState?.saved || false,
      done: userState?.done || false,
    },
  };
}
