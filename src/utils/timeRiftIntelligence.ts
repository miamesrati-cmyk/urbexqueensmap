/**
 * TIME RIFT V4 - Archive Intelligence
 * 
 * Helpers isolés pour filtrage des spots par ère historique.
 * ZERO dépendance UI, ZERO Mapbox, ZERO state global.
 * 
 * Architecture:
 * - getSpotYear: Extraction de l'année d'abandon (yearAbandoned > yearLastSeen > createdAt)
 * - getEraBucket: Classification par période historique fixe
 * - bucketLabel: Labels UI pour chaque ère
 * - filterSpotsByBucket: Filtrage des spots par ère
 * 
 * Feature flag: VITE_TIME_RIFT_INTELLIGENCE_ENABLED (OFF par défaut)
 */

import type { Place } from "../services/places";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type EraBucket = 
  | "all"           // Tous les spots (mode par défaut, Free tier)
  | "pre_1980"      // < 1980: Patrimoine ancien
  | "1980_1999"     // 1980-1999: Ère industrielle tardive
  | "2000_2009"     // 2000-2009: Millénaire pré-crise
  | "2010_2015"     // 2010-2015: Déclin post-2008
  | "2016_2020"     // 2016-2020: Ère moderne pré-COVID
  | "2021_plus";    // 2021+: Récent & post-pandémie

// ═══════════════════════════════════════════════════════════════
// FEATURE FLAG
// ═══════════════════════════════════════════════════════════════

/**
 * Feature flag: Archive Intelligence activée ?
 * OFF par défaut pour ship v3.0 sans risque.
 */
export const isIntelligenceModeEnabled = (): boolean => {
  return import.meta.env.VITE_TIME_RIFT_INTELLIGENCE_ENABLED === "true";
};

// ═══════════════════════════════════════════════════════════════
// HELPERS: Year Extraction
// ═══════════════════════════════════════════════════════════════

/**
 * Extrait l'année d'abandon/fermeture d'un spot.
 * 
 * Hiérarchie (ordre de priorité):
 * 1. yearAbandoned (si présent, le plus fiable)
 * 2. yearLastSeen (fallback)
 * 3. createdAt.year (dernier recours: année d'ajout à la DB)
 * 4. null (spot sans date historique)
 * 
 * @param spot - Place à analyser
 * @returns Année (number) ou null si indéterminable
 */
export function getSpotYear(spot: Place): number | null {
  // 1. Priorité: yearAbandoned (champ dédié historique)
  if ("yearAbandoned" in spot && typeof spot.yearAbandoned === "number") {
    return spot.yearAbandoned;
  }

  // 2. Fallback: yearLastSeen (dernière observation connue)
  if ("yearLastSeen" in spot && typeof spot.yearLastSeen === "number") {
    return spot.yearLastSeen;
  }

  // 3. PAS de fallback sur createdAt (pollue avec date d'ajout, pas date historique)
  // Si pas de yearAbandoned/yearLastSeen → le spot est "unknown era"
  // L'utilisateur devra ajouter manuellement une année estimée dans Firestore

  // 4. Pas de date historique exploitable
  return null;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS: Era Bucketing
// ═══════════════════════════════════════════════════════════════

/**
 * Classifie une année dans une ère historique.
 * 
 * Buckets fixes (design pour analyse temporelle):
 * - pre_1980: Patrimoine ancien (< 1980)
 * - 1980_1999: Ère industrielle tardive
 * - 2000_2009: Millénaire pré-crise financière
 * - 2010_2015: Déclin post-2008
 * - 2016_2020: Ère moderne pré-COVID
 * - 2021_plus: Récent & post-pandémie
 * 
 * @param year - Année à classifier (null retourne null)
 * @returns EraBucket ou null si year null
 */
export function getEraBucket(year: number | null): EraBucket | null {
  if (year === null) return null;

  if (year < 1980) return "pre_1980";
  if (year >= 1980 && year <= 1999) return "1980_1999";
  if (year >= 2000 && year <= 2009) return "2000_2009";
  if (year >= 2010 && year <= 2015) return "2010_2015";
  if (year >= 2016 && year <= 2020) return "2016_2020";
  return "2021_plus";
}

// ═══════════════════════════════════════════════════════════════
// HELPERS: UI Labels
// ═══════════════════════════════════════════════════════════════

/**
 * Labels UI pour chaque ère (affichage pills/dropdown).
 * 
 * @param bucket - Ère à labelliser
 * @returns Label français pour UI
 */
export function bucketLabel(bucket: EraBucket): string {
  switch (bucket) {
    case "all":
      return "Toutes les ères";
    case "pre_1980":
      return "Avant 1980";
    case "1980_1999":
      return "1980-1999";
    case "2000_2009":
      return "2000-2009";
    case "2010_2015":
      return "2010-2015";
    case "2016_2020":
      return "2016-2020";
    case "2021_plus":
      return "2021+";
    default:
      return "Inconnu";
  }
}

/**
 * Description longue pour tooltips/détails.
 * 
 * @param bucket - Ère à décrire
 * @returns Description contextuelle
 */
export function bucketDescription(bucket: EraBucket): string {
  switch (bucket) {
    case "all":
      return "Afficher tous les spots sans filtre temporel";
    case "pre_1980":
      return "Patrimoine ancien et bâtiments historiques";
    case "1980_1999":
      return "Ère industrielle tardive et déclin manufacturier";
    case "2000_2009":
      return "Millénaire pré-crise financière (2000-2009)";
    case "2010_2015":
      return "Période post-crise financière 2008";
    case "2016_2020":
      return "Ère moderne pré-pandémie";
    case "2021_plus":
      return "Abandons récents et post-COVID";
    default:
      return "";
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS: Filtering
// ═══════════════════════════════════════════════════════════════

/**
 * Filtre une liste de spots par ère.
 * 
 * Logique:
 * - "all": Retourne tous les spots (pas de filtre)
 * - Bucket spécifique: Retourne uniquement les spots de cette ère
 * - Spots sans date: Exclus (sauf si bucket="all")
 * 
 * @param spots - Liste complète des spots
 * @param bucket - Ère cible
 * @returns Spots filtrés
 */
export function filterSpotsByBucket(spots: Place[], bucket: EraBucket): Place[] {
  // Mode "all": pas de filtre
  if (bucket === "all") {
    return spots;
  }

  // Filtre par ère spécifique
  return spots.filter((spot) => {
    const year = getSpotYear(spot);
    if (year === null) return false; // Exclut spots sans date

    const spotBucket = getEraBucket(year);
    return spotBucket === bucket;
  });
}

/**
 * Compte le nombre de spots par ère (pour stats UI).
 * 
 * @param spots - Liste complète des spots
 * @returns Map { bucket: count }
 */
export function countSpotsByBucket(spots: Place[]): Record<EraBucket, number> {
  const counts: Record<EraBucket, number> = {
    all: spots.length,
    pre_1980: 0,
    "1980_1999": 0,
    "2000_2009": 0,
    "2010_2015": 0,
    "2016_2020": 0,
    "2021_plus": 0,
  };

  spots.forEach((spot) => {
    const year = getSpotYear(spot);
    if (year === null) return;

    const bucket = getEraBucket(year);
    if (bucket) {
      counts[bucket]++;
    }
  });

  return counts;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS: GeoJSON Conversion
// ═══════════════════════════════════════════════════════════════

/**
 * Convertit une liste de spots en GeoJSON FeatureCollection.
 * 
 * Format Mapbox-compatible pour overlay heatmap/circles.
 * 
 * @param spots - Liste de spots filtrés
 * @returns GeoJSON FeatureCollection
 */
export function spotsToGeoJSON(spots: Place[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: spots.map((spot) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [spot.lng, spot.lat],
      },
      properties: {
        id: spot.id,
        title: spot.title,
        year: getSpotYear(spot),
        bucket: getSpotYear(spot) ? getEraBucket(getSpotYear(spot)!) : null,
      },
    })),
  };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS (named exports only, tree-shakeable)
// ═══════════════════════════════════════════════════════════════

export {
  // Types réexportés pour convenience
  type Place,
};
