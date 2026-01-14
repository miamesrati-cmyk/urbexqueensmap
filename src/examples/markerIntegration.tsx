/**
 * 🎬 Urbex Marker V2 Integration Example
 * 
 * This file demonstrates how to integrate the Ghost Echo marker system
 * into your existing MapRoute.tsx without breaking current functionality.
 * 
 * INTEGRATION STRATEGY:
 * 1. Keep existing Mapbox layer-based markers for performance
 * 2. Optionally add custom DOM markers for featured/special spots
 * 3. Use V2 design for "add spot" draft marker
 * 4. Gradually migrate based on user feedback
 */

import { useEffect, useRef } from "react";
import type { Map, Marker, GeoJSONSource } from "mapbox-gl";
import { createUrbexMarkerV2, updateMarkerForZoom } from "../utils/mapMarkersV2";
import type { Place } from "../services/places";

// ═══════════════════════════════════════════════════════════════
// OPTION 1: Enhanced Layer-Based Markers (Recommended for Performance)
// ═══════════════════════════════════════════════════════════════

/**
 * Updates your existing Mapbox circle layer to use Ghost Echo styling
 * This is the FASTEST approach - no DOM markers, pure GL rendering
 * 
 * @param map - Mapbox GL map instance
 * @param sourceId - The source ID containing spot features
 * @param clusteringEnabled - Whether clustering is active (will filter to show only unclustered points)
 * @param haloBlur - Halo blur amount (0 = no blur for best performance, 0.5 = softer look)
 */
export function setupGhostEchoLayers(
  map: Map, 
  sourceId: string, 
  _clusteringEnabled = false,
  haloBlur = 0
) {
  // Check if layers already exist - NEVER remove/recreate if they exist
  const circleExists = map.getLayer("spots-circle");
  const iconExists = map.getLayer("spots-icon");
  
  if (circleExists && iconExists) {
    console.log("[Ghost Echo] Layers already exist, skipping setup");
    return;
  }

  // Only warn if partially initialized (shouldn't happen in normal flow)
  if (circleExists || iconExists) {
    console.warn("[Ghost Echo] Partial initialization detected, layers:", {
      circle: !!circleExists,
      icon: !!iconExists,
    });
  }

  // Main pin layer - EXPLORATION MODE (▼ default / ❤️ saved only)
  // Note: "done" spots are filtered out from map, shown in "Spots Faits" view
  // Filter is managed separately in MapRoute, always pass plain data here
  const pinIconImage = [
    "case",
    ["all", ["==", ["get", "done"], true], ["==", ["get", "tier"], "GHOST"]],
    "diamond-15",
    ["==", ["get", "done"], true],
    "home-15",
    ["==", ["get", "saved"], true],
    "heart-15",
    "marker-15",
  ];

  const pinColor = [
    "case",
    ["==", ["get", "saved"], true],
    "#ff6b9d",
    ["==", ["get", "tier"], "EPIC"],
    "#ffd35c",
    ["==", ["get", "tier"], "GHOST"],
    "#b8fdff",
    "#ffffff",
  ];

  map.addLayer({
    id: "spots-circle", // Keep same ID for click handlers compatibility
    type: "symbol",
    source: sourceId,
    layout: {
      "icon-image": pinIconImage as any,
      "icon-size": 1.1,
      "icon-anchor": "bottom",
      "icon-offset": [0, -4],
      "icon-allow-overlap": true,
    },
    paint: {
      "icon-color": pinColor as any,
      "icon-opacity": 1.0,
      "icon-halo-color": "rgba(0, 0, 0, 0.75)",
      "icon-halo-width": 1.0,
      "icon-halo-blur": haloBlur,
    },
  });

  // Architectural detail layer - SUBTLE SYMBOLS (zoom > 14 only)
  map.addLayer({
    id: "spots-icon",
    type: "symbol",
    source: sourceId,
    minzoom: 14, // Only at very close zoom (was 13: now more selective)
    layout: {
      // Small architectural hint above the pin
      "text-field": [
        "case",
        ["==", ["get", "archetype"], "factory"],
        "▮", // Industrial
        ["==", ["get", "archetype"], "church"],
        "▲", // Spire
        ["==", ["get", "archetype"], "hospital"],
        "╬", // Cross
        ["==", ["get", "archetype"], "manor"],
        "⌂", // House
        "■" // Generic
      ],
      "text-size": 11, // Small detail, not competing with main pin
      "text-allow-overlap": false, // Can hide if cluttered (not critical)
      "text-font": ["Arial Unicode MS Regular"],
      "text-offset": [0, -1.2], // Above the pin
    },
    paint: {
      "text-color": [
        "case",
        ["==", ["get", "tier"], "EPIC"],
        "#ffd35c",
        ["==", ["get", "tier"], "GHOST"],
        "#b8fdff",
        "rgba(255, 255, 255, 0.8)" // Slightly dimmed for COMMON
      ],
      "text-opacity": 0.7, // Subtle detail layer
      // ⚡ PERFORMANCE: Configurable halo blur
      "text-halo-color": "rgba(0, 0, 0, 0.6)",
      "text-halo-width": 0.6,
      "text-halo-blur": haloBlur * 0.5, // Half of main layer blur
    },
  });

  console.log("[Ghost Echo] ⚡ Performance-optimized layers created");
}

// ═══════════════════════════════════════════════════════════════
// OPTION 2: DOM Markers for Special Spots (Use Sparingly)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates DOM-based markers for featured/special locations
 * Use only for < 50 spots at a time for performance
 */
export function useFeaturedMarkers(
  map: Map | null,
  places: Place[],
  onPlaceClick: (place: Place) => void
) {
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter for featured spots (EPIC or GHOST tier)
    const featuredSpots = places.filter(
      (p) => p.tier === "EPIC" || p.tier === "GHOST"
    );

    // Create DOM markers for featured spots only
    featuredSpots.forEach((place) => {
      const marker = createUrbexMarkerV2({
        place,
        status: "approved",
        isPro: false,
        size: 32,
        zoomLevel: map.getZoom(),
        onClick: onPlaceClick,
      });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    // Update markers on zoom
    const handleZoom = () => {
      const zoom = map.getZoom();
      markersRef.current.forEach((marker) => {
        updateMarkerForZoom(marker, zoom);
      });
    };

    map.on("zoom", handleZoom);

    return () => {
      map.off("zoom", handleZoom);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, places, onPlaceClick]);
}

// ═══════════════════════════════════════════════════════════════
// OPTION 3: Draft Marker (For "Add Spot" Flow)
// ═══════════════════════════════════════════════════════════════

/**
 * Replaces the current pink marker with Ghost Echo design
 * This is the EASIEST quick win - just one marker to replace
 */
export function useDraftMarkerV2(
  map: Map | null,
  coords: { lat: number; lng: number } | null
) {
  const markerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!map || !coords) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    // Create a "pending" style draft marker
    const draftPlace: Partial<Place> = {
      id: "draft",
      title: "Nouveau spot",
      lat: coords.lat,
      lng: coords.lng,
      category: "autre" as const,
      createdAt: Date.now(),
      isPublic: false,
    };

    const marker = createUrbexMarkerV2({
      place: draftPlace as Place,
      status: "pending", // Shows orange pulse dot
      size: 36, // Slightly larger than normal
      zoomLevel: map.getZoom(),
    });

    marker.addTo(map);
    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, coords]);

  return markerRef;
}

// ═══════════════════════════════════════════════════════════════
// INTEGRATION INTO MapRoute.tsx
// ═══════════════════════════════════════════════════════════════

/**
 * Example integration in your MapRoute component:
 * 
 * STEP 1: Import the utilities
 * ```tsx
 * import { setupGhostEchoLayers, useFeaturedMarkers, useDraftMarkerV2 } from "./examples/markerIntegration";
 * ```
 * 
 * STEP 2: Replace existing layer setup
 * In your useEffect where you create layers, replace:
 * ```tsx
 * // OLD
 * map.addLayer({
 *   id: SPOTS_UNCLUSTERED_LAYER_ID,
 *   type: "circle",
 *   source: SPOTS_SOURCE_ID,
 *   paint: { ... }
 * });
 * 
 * // NEW
 * setupGhostEchoLayers(map, SPOTS_SOURCE_ID);
 * ```
 * 
 * STEP 3: (Optional) Add featured markers
 * ```tsx
 * useFeaturedMarkers(mapInstance, places, handleSpotClick);
 * ```
 * 
 * STEP 4: Replace draft marker
 * In your draft marker useEffect, replace:
 * ```tsx
 * // OLD
 * const marker = new mapboxgl.Marker({ color: "#ff5fa2" })
 *   .setLngLat([dropCoords.lng, dropCoords.lat])
 *   .addTo(mapInstance);
 * 
 * // NEW
 * useDraftMarkerV2(mapInstance, dropCoords);
 * ```
 */

// ═══════════════════════════════════════════════════════════════
// GEOJSON FEATURE PREPARATION
// ═══════════════════════════════════════════════════════════════

/**
 * Helper to ensure your GeoJSON features have the required properties
 */
export function prepareSpotFeature(place: Place): GeoJSON.Feature {
  return {
    type: "Feature",
    id: place.id,
    geometry: {
      type: "Point",
      coordinates: [place.lng, place.lat],
    },
    properties: {
      id: place.id,
      title: place.title,
      category: place.category || "default",
      tier: place.tier || "COMMON",
      archetype: getCategoryArchetype(place.category),
      isPro: Boolean((place as any).isPro),
      status: place.isPublic ? "approved" : "pending",
    },
  };
}

function getCategoryArchetype(category?: string): string {
  if (!category) return "default";
  
  const mapping: Record<string, string> = {
    usine: "factory",
    factory: "factory",
    hopital: "hospital",
    hospital: "hospital",
    eglise: "church",
    church: "church",
    manoir: "manor",
    manor: "manor",
  };

  return mapping[category.toLowerCase()] || "default";
}

// ═══════════════════════════════════════════════════════════════
// TESTING & DEBUGGING
// ═══════════════════════════════════════════════════════════════

/**
 * Debug helper - logs marker system status
 */
export function debugMarkerSystem(map: Map, sourceId: string) {
  console.group("🎬 Ghost Echo Marker System");
  
  const source = map.getSource(sourceId) as GeoJSONSource;
  if (source) {
    console.log("✅ Source found:", sourceId);
  } else {
    console.warn("❌ Source not found:", sourceId);
  }

  const circleLayer = map.getLayer("spots-circle");
  const iconLayer = map.getLayer("spots-icon");
  
  console.log("Circle layer:", circleLayer ? "✅" : "❌");
  console.log("Icon layer:", iconLayer ? "✅" : "❌");
  console.log("Current zoom:", map.getZoom());
  
  console.groupEnd();
}
