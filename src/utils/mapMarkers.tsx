import { renderToString } from "react-dom/server";
import mapboxgl from "mapbox-gl";
import { UrbexMarker } from "../components/map/UrbexMarker";
import type { Place } from "../services/places";

type MarkerStatus = "pending" | "approved" | "rejected";

interface CreateUrbexMarkerOptions {
  place: Place;
  status?: MarkerStatus;
  isPro?: boolean;
  size?: number;
  onClick?: (place: Place) => void;
}

/**
 * Crée un marker Mapbox avec le design urbex personnalisé
 */
export function createUrbexMarker({
  place,
  status = "approved",
  isPro = false,
  size = 40,
  onClick,
}: CreateUrbexMarkerOptions): mapboxgl.Marker {
  // Render React component to HTML string
  const markerElement = UrbexMarker({ status, isPro, size });
  const markerHtml = renderToString(markerElement as any);

  // Create DOM element from HTML string
  const el = document.createElement("div");
  el.innerHTML = markerHtml;
  el.style.cursor = "pointer";

  // Add click handler
  if (onClick) {
    el.addEventListener("click", () => onClick(place));
  }

  // Create Mapbox marker
  const marker = new mapboxgl.Marker({
    element: el,
    anchor: "bottom",
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
 * Crée un élément HTML pour un cluster de markers
 */
export function createClusterElement(pointCount: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "urbex-marker urbex-marker--cluster";
  el.textContent = pointCount.toString();
  el.style.width = `${Math.min(40 + pointCount * 2, 80)}px`;
  el.style.height = `${Math.min(40 + pointCount * 2, 80)}px`;
  return el;
}

/**
 * Retourne la couleur du marker selon son statut
 */
export function getMarkerColor(status: MarkerStatus): string {
  switch (status) {
    case "pending":
      return "#EC407A"; // Rose
    case "approved":
      return "#BA68C8"; // Violet
    case "rejected":
      return "#757575"; // Gris
    default:
      return "#BA68C8";
  }
}

/**
 * Crée un popup HTML pour un spot
 */
export function createSpotPopupHTML(place: Place): string {
  const imageHtml = place.photos?.[0]
    ? `<img src="${place.photos[0]}" alt="${place.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px 8px 0 0;" />`
    : "";

  const categoryEmoji: Record<string, string> = {
    usine: "🏭",
    hopital: "🏥",
    eglise: "⛪",
    manoir: "🏰",
    autre: "📍",
  };

  const emoji = place.category ? (categoryEmoji[place.category] || "📍") : "📍";

  return `
    <div style="min-width: 200px; max-width: 300px; font-family: system-ui, -apple-system, sans-serif;">
      ${imageHtml}
      <div style="padding: 12px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">
          ${emoji} ${place.title}
        </h3>
        ${
          place.description
            ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #666; line-height: 1.4;">
                ${place.description.substring(0, 100)}${place.description.length > 100 ? "..." : ""}
              </p>`
            : ""
        }
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
          <span style="background: rgba(236, 64, 122, 0.1); color: #EC407A; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
            ${place.category}
          </span>
          <span style="background: rgba(186, 104, 200, 0.1); color: #BA68C8; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
            ${place.riskLevel}
          </span>
        </div>
      </div>
    </div>
  `;
}
