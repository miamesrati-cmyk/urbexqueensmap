const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;

type GeoGateMode = "OFF" | "REGION";

function normalizeGeoGateMode(value: string | undefined): GeoGateMode {
  if (value && value.toUpperCase() === "REGION") {
    return "REGION";
  }
  return "OFF";
}

export const GEO_GATE_MODE = normalizeGeoGateMode(
  import.meta.env.VITE_GEO_GATE_MODE
);
export const IS_GEO_GATE_ACTIVE = GEO_GATE_MODE === "REGION";

export const LIMITS = { titleMax: 100, descMax: 500 } as const;

export function sanitizeText(input: string): string {
  return input
    .replace(ZERO_WIDTH_REGEX, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function validateTitle(title: string): string | null {
  const t = sanitizeText(title);
  if (!t) return "Title is required.";
  if (t.length > LIMITS.titleMax) {
    return `Title must be <= ${LIMITS.titleMax} characters.`;
  }
  return null;
}

export function validateDescription(desc: string): string | null {
  const d = sanitizeText(desc);
  if (d.length > LIMITS.descMax) {
    return `Description must be <= ${LIMITS.descMax} characters.`;
  }
  return null;
}

export function parseNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

export function validateLatLng(latRaw: unknown, lngRaw: unknown): string | null {
  const lat = parseNumber(latRaw);
  const lng = parseNumber(lngRaw);
  if (lat === null || lng === null) {
    return "Coordinates must be valid numbers.";
  }
  if (lat < -90 || lat > 90) {
    return "Latitude must be between -90 and 90.";
  }
  if (lng < -180 || lng > 180) {
    return "Longitude must be between -180 and 180.";
  }
  return null;
}
