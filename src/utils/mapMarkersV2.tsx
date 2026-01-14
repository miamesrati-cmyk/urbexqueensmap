import { renderToString } from "react-dom/server";
import mapboxgl from "mapbox-gl";
import { UrbexMarkerV2 } from "../components/map/UrbexMarkerV2";
import type { Place } from "../services/places";

type MarkerTier = "COMMON" | "EPIC" | "GHOST";
type MarkerStatus = "pending" | "approved" | "rejected";
type BuildingArchetype = "factory" | "hospital" | "church" | "manor" | "default";

interface CreateUrbexMarkerV2Options {
  place: Place;
  status?: MarkerStatus;
  isPro?: boolean;
  size?: number;
  onClick?: (place: Place) => void;
  zoomLevel?: number;
}

/**
 * Maps place category to building archetype for visual representation
 */
function getCategoryArchetype(category?: string): BuildingArchetype {
  if (!category) return "default";
  
  const mapping: Record<string, BuildingArchetype> = {
    usine: "factory",
    factory: "factory",
    hopital: "hospital",
    hospital: "hospital",
    eglise: "church",
    church: "church",
    manoir: "manor",
    manor: "manor",
    château: "manor",
    castle: "manor",
  };

  return mapping[category.toLowerCase()] || "default";
}

/**
 * Extracts tier from place data
 * Supports both tier and rarity fields
 */
function getPlaceTier(place: Place): MarkerTier {
  // Check for explicit tier field
  if ("tier" in place && place.tier) {
    const tier = String(place.tier).toUpperCase();
    if (tier === "EPIC" || tier === "GHOST") return tier as MarkerTier;
  }

  // Check for rarity field (alternative naming)
  if ("rarity" in place && (place as any).rarity) {
    const rarity = String((place as any).rarity).toUpperCase();
    if (rarity === "EPIC" || rarity === "LEGENDARY") return "EPIC";
    if (rarity === "GHOST" || rarity === "MYTHIC") return "GHOST";
  }

  // Check risk level as fallback (higher risk = potentially rarer)
  if (place.riskLevel) {
    const risk = String(place.riskLevel).toLowerCase();
    if (risk === "extreme" || risk === "très élevé") return "EPIC";
  }

  return "COMMON";
}

/**
 * Determines zoom-based size adjustment
 */
function getZoomAdjustedSize(baseSize: number, zoomLevel: number): number {
  if (zoomLevel < 10) return baseSize * 0.8; // Distant
  if (zoomLevel > 13) return baseSize * 1.2; // Close
  return baseSize; // Normal
}

/**
 * Crée un marker Mapbox avec le design V2 "Ghost Echo"
 * 
 * @example
 * ```tsx
 * const marker = createUrbexMarkerV2({
 *   place: spotData,
 *   status: "approved",
 *   isPro: user.isPro,
 *   zoomLevel: map.getZoom(),
 *   onClick: (place) => openSpotDetails(place),
 * });
 * marker.addTo(map);
 * ```
 */
export function createUrbexMarkerV2({
  place,
  status = "approved",
  isPro = false,
  size = 32,
  onClick,
  zoomLevel = 12,
}: CreateUrbexMarkerV2Options): mapboxgl.Marker {
  const tier = getPlaceTier(place);
  const archetype = getCategoryArchetype(place.category);
  const adjustedSize = getZoomAdjustedSize(size, zoomLevel);

  // Add zoom-based class for styling
  let zoomClass = "";
  if (zoomLevel < 10) zoomClass = "urbex-marker-v2--distant";
  else if (zoomLevel > 13) zoomClass = "urbex-marker-v2--close";

  // Render React component to HTML string
  const markerElement = UrbexMarkerV2({
    tier,
    status,
    isPro,
    size: adjustedSize,
    archetype,
    className: zoomClass,
  });

  const markerHtml = renderToString(markerElement as any);

  // Create DOM element from HTML string
  const el = document.createElement("div");
  el.innerHTML = markerHtml;
  el.style.cursor = "pointer";
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${place.title} - ${place.category || "lieu abandonné"}`);
  el.setAttribute("tabindex", "0");

  // Add click handler
  if (onClick) {
    const handleClick = () => onClick(place);
    el.addEventListener("click", handleClick);
    
    // Keyboard accessibility
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    });
  }

  // Create Mapbox marker with custom anchor for silhouette centering
  const marker = new mapboxgl.Marker({
    element: el,
    anchor: "center", // Center anchor for building silhouettes
  }).setLngLat([place.lng, place.lat]);

  return marker;
}

/**
 * Détermine le statut d'un spot pour l'affichage du marker
 */
export function getMarkerStatus(place: Place): MarkerStatus {
  // Si le spot a un statut de validation
  if ("validationStatus" in place) {
    const validationStatus = (place as any).validationStatus;
    if (validationStatus === "approved") return "approved";
    if (validationStatus === "rejected") return "rejected";
    if (validationStatus === "pending") return "pending";
  }

  // Si le spot a un statut isPublic
  if ("isPublic" in place) {
    return place.isPublic ? "approved" : "pending";
  }

  // Par défaut, considérer comme approuvé
  return "approved";
}

/**
 * Crée un popup HTML minimaliste pour un spot
 * Design: dark, cinematic, matches marker aesthetic
 */
export function createSpotPopupHTMLV2(place: Place): string {
  const tier = getPlaceTier(place);
  const tierColors = {
    EPIC: "#ffd35c",
    GHOST: "#b8fdff",
    COMMON: "#ffffff",
  };
  const tierColor = tierColors[tier];

  const imageHtml = place.photos?.[0]
    ? `
      <div style="
        width: 100%;
        height: 180px;
        overflow: hidden;
        border-radius: 8px 8px 0 0;
        position: relative;
      ">
        <img 
          src="${place.photos[0]}" 
          alt="${place.title}" 
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: grayscale(0.3) contrast(1.1);
          " 
        />
        <div style="
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(10, 10, 10, 0.8), transparent 50%);
        "></div>
      </div>
    `
    : "";

  return `
    <div style="
      min-width: 260px;
      max-width: 320px;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: rgba(15, 15, 20, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      overflow: hidden;
    ">
      ${imageHtml}
      <div style="padding: 16px;">
        <div style="
          display: inline-block;
          padding: 4px 10px;
          background: ${tierColor}22;
          border-left: 2px solid ${tierColor};
          border-radius: 2px;
          margin-bottom: 8px;
        ">
          <span style="
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: ${tierColor};
          ">${tier}</span>
        </div>
        
        <h3 style="
          margin: 0 0 8px 0;
          font-size: 17px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          line-height: 1.3;
        ">
          ${place.title}
        </h3>
        
        ${
          place.description
            ? `<p style="
                margin: 0 0 12px 0;
                font-size: 13px;
                color: rgba(255, 255, 255, 0.6);
                line-height: 1.5;
              ">
                ${place.description.substring(0, 120)}${place.description.length > 120 ? "..." : ""}
              </p>`
            : ""
        }
        
        <div style="
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        ">
          ${
            place.category
              ? `<span style="
                  background: rgba(255, 255, 255, 0.08);
                  color: rgba(255, 255, 255, 0.7);
                  padding: 5px 10px;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 500;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                ">
                  ${place.category}
                </span>`
              : ""
          }
          ${
            place.riskLevel
              ? `<span style="
                  background: rgba(255, 107, 107, 0.15);
                  color: rgba(255, 138, 138, 0.9);
                  padding: 5px 10px;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 500;
                  border: 1px solid rgba(255, 107, 107, 0.2);
                ">
                  ${place.riskLevel}
                </span>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

/**
 * Updates marker appearance based on zoom level
 * Call this in your map zoom event handler
 */
export function updateMarkerForZoom(
  marker: mapboxgl.Marker,
  zoomLevel: number
): void {
  const element = marker.getElement();
  const markerDiv = element.querySelector(".urbex-marker-v2");
  
  if (!markerDiv) return;

  // Remove existing zoom classes
  markerDiv.classList.remove("urbex-marker-v2--distant", "urbex-marker-v2--close");

  // Add appropriate zoom class
  if (zoomLevel < 10) {
    markerDiv.classList.add("urbex-marker-v2--distant");
  } else if (zoomLevel > 13) {
    markerDiv.classList.add("urbex-marker-v2--close");
  }
}
