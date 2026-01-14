import { geohashForLocation } from "geofire-common";

export const GEOHASH_PRECISION = 7;

export function computeGeohash(
  lat: number,
  lng: number,
  precision: number = GEOHASH_PRECISION
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return geohashForLocation([lat, lng], precision);
}
