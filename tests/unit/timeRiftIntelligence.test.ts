/**
 * TIME RIFT V4 - Archive Intelligence Tests
 * 
 * Tests unitaires pour validation des helpers isolés.
 * Run: npm test timeRiftIntelligence.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  getSpotYear,
  getEraBucket,
  bucketLabel,
  filterSpotsByBucket,
  countSpotsByBucket,
  spotsToGeoJSON,
  isIntelligenceModeEnabled,
  type EraBucket,
} from "../../src/utils/timeRiftIntelligence";
import type { Place } from "../../src/services/places";

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════

const mockSpot = (overrides: Partial<Place> = {}): Place => ({
  id: "test-id",
  title: "Test Spot",
  lat: 45.5017,
  lng: -73.5673,
  createdAt: new Date("2020-01-01").getTime(),
  isPublic: true,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════
// TESTS: getSpotYear
// ═══════════════════════════════════════════════════════════════

describe("getSpotYear", () => {
  it("retourne yearAbandoned si présent (priorité 1)", () => {
    const spot = mockSpot({ yearAbandoned: 1995 } as any);
    expect(getSpotYear(spot)).toBe(1995);
  });

  it("retourne yearLastSeen si yearAbandoned absent (priorité 2)", () => {
    const spot = mockSpot({ yearLastSeen: 2010 } as any);
    expect(getSpotYear(spot)).toBe(2010);
  });

  it("retourne createdAt.year si yearAbandoned/yearLastSeen absents (priorité 3)", () => {
    const spot = mockSpot({ createdAt: new Date("2015-06-15").getTime() });
    expect(getSpotYear(spot)).toBe(2015);
  });

  it("retourne null si aucune date exploitable", () => {
    const spot = mockSpot({ createdAt: 0 });
    expect(getSpotYear(spot)).toBeNull();
  });

  it("préfère yearAbandoned même si yearLastSeen présent", () => {
    const spot = mockSpot({
      yearAbandoned: 1990,
      yearLastSeen: 2000,
    } as any);
    expect(getSpotYear(spot)).toBe(1990); // yearAbandoned prioritaire
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: getEraBucket
// ═══════════════════════════════════════════════════════════════

describe("getEraBucket", () => {
  it("retourne null si year null", () => {
    expect(getEraBucket(null)).toBeNull();
  });

  it("classifie correctement pre_1980", () => {
    expect(getEraBucket(1975)).toBe("pre_1980");
    expect(getEraBucket(1950)).toBe("pre_1980");
    expect(getEraBucket(1979)).toBe("pre_1980");
  });

  it("classifie correctement 1980_1999", () => {
    expect(getEraBucket(1980)).toBe("1980_1999");
    expect(getEraBucket(1990)).toBe("1980_1999");
    expect(getEraBucket(1999)).toBe("1980_1999");
  });

  it("classifie correctement 2000_2009", () => {
    expect(getEraBucket(2000)).toBe("2000_2009");
    expect(getEraBucket(2005)).toBe("2000_2009");
    expect(getEraBucket(2009)).toBe("2000_2009");
  });

  it("classifie correctement 2010_2015", () => {
    expect(getEraBucket(2010)).toBe("2010_2015");
    expect(getEraBucket(2012)).toBe("2010_2015");
    expect(getEraBucket(2015)).toBe("2010_2015");
  });

  it("classifie correctement 2016_2020", () => {
    expect(getEraBucket(2016)).toBe("2016_2020");
    expect(getEraBucket(2018)).toBe("2016_2020");
    expect(getEraBucket(2020)).toBe("2016_2020");
  });

  it("classifie correctement 2021_plus", () => {
    expect(getEraBucket(2021)).toBe("2021_plus");
    expect(getEraBucket(2023)).toBe("2021_plus");
    expect(getEraBucket(2025)).toBe("2021_plus");
  });

  it("gère les années limites correctement", () => {
    expect(getEraBucket(1979)).toBe("pre_1980");
    expect(getEraBucket(1980)).toBe("1980_1999");
    expect(getEraBucket(1999)).toBe("1980_1999");
    expect(getEraBucket(2000)).toBe("2000_2009");
    expect(getEraBucket(2015)).toBe("2010_2015");
    expect(getEraBucket(2016)).toBe("2016_2020");
    expect(getEraBucket(2020)).toBe("2016_2020");
    expect(getEraBucket(2021)).toBe("2021_plus");
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: bucketLabel
// ═══════════════════════════════════════════════════════════════

describe("bucketLabel", () => {
  it("retourne les labels français corrects", () => {
    expect(bucketLabel("all")).toBe("Toutes les ères");
    expect(bucketLabel("pre_1980")).toBe("Avant 1980");
    expect(bucketLabel("1980_1999")).toBe("1980-1999");
    expect(bucketLabel("2000_2009")).toBe("2000-2009");
    expect(bucketLabel("2010_2015")).toBe("2010-2015");
    expect(bucketLabel("2016_2020")).toBe("2016-2020");
    expect(bucketLabel("2021_plus")).toBe("2021+");
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: filterSpotsByBucket
// ═══════════════════════════════════════════════════════════════

describe("filterSpotsByBucket", () => {
  const spots: Place[] = [
    mockSpot({ id: "spot1", yearAbandoned: 1975 } as any), // pre_1980
    mockSpot({ id: "spot2", yearAbandoned: 1990 } as any), // 1980_1999
    mockSpot({ id: "spot3", yearAbandoned: 2005 } as any), // 2000_2009
    mockSpot({ id: "spot4", yearAbandoned: 2012 } as any), // 2010_2015
    mockSpot({ id: "spot5", yearAbandoned: 2018 } as any), // 2016_2020
    mockSpot({ id: "spot6", yearAbandoned: 2022 } as any), // 2021_plus
    mockSpot({ id: "spot7", createdAt: 0 }), // pas de date (excluded)
  ];

  it('retourne tous les spots si bucket="all"', () => {
    const filtered = filterSpotsByBucket(spots, "all");
    expect(filtered.length).toBe(7);
  });

  it("filtre correctement par pre_1980", () => {
    const filtered = filterSpotsByBucket(spots, "pre_1980");
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("spot1");
  });

  it("filtre correctement par 1980_1999", () => {
    const filtered = filterSpotsByBucket(spots, "1980_1999");
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("spot2");
  });

  it("filtre correctement par 2000_2009", () => {
    const filtered = filterSpotsByBucket(spots, "2000_2009");
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("spot3");
  });

  it("filtre correctement par 2010_2015", () => {
    const filtered = filterSpotsByBucket(spots, "2010_2015");
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("spot4");
  });

  it("filtre correctement par 2016_2020", () => {
    const filtered = filterSpotsByBucket(spots, "2016_2020");
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("spot5");
  });

  it("filtre correctement par 2021_plus", () => {
    const filtered = filterSpotsByBucket(spots, "2021_plus");
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("spot6");
  });

  it("exclut les spots sans date (sauf si all)", () => {
    const filtered = filterSpotsByBucket(spots, "pre_1980");
    expect(filtered.every((s: Place) => s.id !== "spot7")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: countSpotsByBucket
// ═══════════════════════════════════════════════════════════════

describe("countSpotsByBucket", () => {
  const spots: Place[] = [
    mockSpot({ yearAbandoned: 1975 } as any), // pre_1980
    mockSpot({ yearAbandoned: 1976 } as any), // pre_1980
    mockSpot({ yearAbandoned: 1990 } as any), // 1980_1999
    mockSpot({ yearAbandoned: 2005 } as any), // 2000_2009
    mockSpot({ createdAt: 0 }), // pas de date
  ];

  it("compte correctement les spots par ère", () => {
    const counts = countSpotsByBucket(spots);
    expect(counts.all).toBe(5);
    expect(counts.pre_1980).toBe(2);
    expect(counts["1980_1999"]).toBe(1);
    expect(counts["2000_2009"]).toBe(1);
    expect(counts["2010_2015"]).toBe(0);
    expect(counts["2016_2020"]).toBe(0);
    expect(counts["2021_plus"]).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: spotsToGeoJSON
// ═══════════════════════════════════════════════════════════════

describe("spotsToGeoJSON", () => {
  const spots: Place[] = [
    mockSpot({ id: "spot1", title: "Spot 1", lat: 45.5, lng: -73.5, yearAbandoned: 1990 } as any),
    mockSpot({ id: "spot2", title: "Spot 2", lat: 46.0, lng: -74.0, yearAbandoned: 2010 } as any),
  ];

  it("génère un GeoJSON FeatureCollection valide", () => {
    const geojson = spotsToGeoJSON(spots);
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features.length).toBe(2);
  });

  it("contient les coordonnées correctes", () => {
    const geojson = spotsToGeoJSON(spots);
    const feat0 = geojson.features[0];
    const feat1 = geojson.features[1];
    expect(feat0.geometry.type).toBe("Point");
    expect(feat1.geometry.type).toBe("Point");
    // @ts-expect-error - GeoJSON type narrowing
    expect(feat0.geometry.coordinates).toEqual([-73.5, 45.5]);
    // @ts-expect-error - GeoJSON type narrowing
    expect(feat1.geometry.coordinates).toEqual([-74.0, 46.0]);
  });

  it("contient les properties attendues", () => {
    const geojson = spotsToGeoJSON(spots);
    const props0 = geojson.features[0].properties!;
    expect(props0.id).toBe("spot1");
    expect(props0.title).toBe("Spot 1");
    expect(props0.year).toBe(1990);
    expect(props0.bucket).toBe("1980_1999");
  });

  it("gère les spots sans date", () => {
    const spotsWithNull = [mockSpot({ createdAt: 0 })];
    const geojson = spotsToGeoJSON(spotsWithNull);
    const props0 = geojson.features[0].properties!;
    expect(props0.year).toBeNull();
    expect(props0.bucket).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// TESTS: Feature Flag
// ═══════════════════════════════════════════════════════════════

describe("isIntelligenceModeEnabled", () => {
  it("retourne false par défaut (feature flag OFF)", () => {
    // Dans tests, VITE_TIME_RIFT_INTELLIGENCE_ENABLED n'est pas défini
    expect(isIntelligenceModeEnabled()).toBe(false);
  });
});
