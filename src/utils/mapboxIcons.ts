import type { Map } from "mapbox-gl";

/**
 * Icon names used in the app (Ghost Echo markers)
 * These icons are expected to be in the Mapbox sprite, but may be missing
 * depending on the style (Streets, Satellite, custom styles, etc.)
 */
const REQUIRED_ICONS = [
  "marker-15",  // Default exploration pin
  "heart-15",   // Saved spot
  "home-15",    // Done spot
  "diamond-15", // Done GHOST tier
] as const;

type RequiredIcon = (typeof REQUIRED_ICONS)[number];

/**
 * Create a simple colored circle as a fallback icon
 * Used when Mapbox sprite doesn't contain the required icon
 */
function createFallbackIcon(
  iconName: RequiredIcon,
  size = 30
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Return empty ImageData if canvas context fails
    return new ImageData(size, size);
  }

  // Icon-specific colors
  const colors: Record<RequiredIcon, string> = {
    "marker-15": "#3FB1CE", // Mapbox blue
    "heart-15": "#FF6B9D", // Pink (saved)
    "home-15": "#10B981", // Green (done)
    "diamond-15": "#B8FDFF", // Cyan (GHOST tier)
  };

  // Draw circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = colors[iconName] || "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw simple icon shape
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const symbols: Record<RequiredIcon, string> = {
    "marker-15": "📍",
    "heart-15": "❤️",
    "home-15": "🏠",
    "diamond-15": "💎",
  };

  ctx.fillText(symbols[iconName] || "•", size / 2, size / 2);

  // Convert canvas to ImageData
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Ensure all required icons are loaded in the map
 * This function should be called after style.load to handle style changes
 * 
 * @param map - Mapbox map instance
 * @param options - Configuration options
 * @returns Promise that resolves when all icons are loaded or fallbacks created
 */
export async function ensureMapboxIcons(
  map: Map,
  options: {
    /** Use fallback icons immediately without checking sprite */
    forceFallback?: boolean;
    /** Log icon loading status */
    verbose?: boolean;
  } = {}
): Promise<void> {
  const { forceFallback = false, verbose = import.meta.env.DEV } = options;

  const promises = REQUIRED_ICONS.map(async (iconName) => {
    try {
      // Check if icon already exists (may have been added previously)
      if (map.hasImage(iconName)) {
        if (verbose) {
          console.log(`[ICONS] ✓ ${iconName} already loaded`);
        }
        return;
      }

      // If forcing fallback, skip sprite check
      if (forceFallback) {
        const fallback = createFallbackIcon(iconName);
        map.addImage(iconName, fallback);
        if (verbose) {
          console.log(`[ICONS] ➕ ${iconName} added (forced fallback)`);
        }
        return;
      }

      // ✅ ROOT-CAUSE FIX: Don't race with sprite loading
      // Just check immediately if icon exists. If not, styleimagemissing will handle it.
      // This eliminates the 100ms timeout race that causes warnings.
      if (map.hasImage(iconName)) {
        if (verbose) {
          console.log(`[ICONS] ✓ ${iconName} already in style`);
        }
        return;
      }

      // Icon not in style yet - add fallback immediately
      // (styleimagemissing will also try, but this is proactive)
      const fallback = createFallbackIcon(iconName);
      map.addImage(iconName, fallback);
      if (verbose) {
        console.log(`[ICONS] ➕ ${iconName} fallback added proactively`);
      }
    } catch (error) {
      console.error(`[ICONS] ❌ Failed to load ${iconName}:`, error);
    }
  });

  await Promise.all(promises);
}

/**
 * Setup automatic icon loading on style changes
 * Attaches to style.load event to re-add icons when style changes
 * 
 * @param map - Mapbox map instance
 * @param options - Configuration options
 */
export function setupIconAutoLoad(
  map: Map,
  options: {
    forceFallback?: boolean;
    verbose?: boolean;
  } = {}
): void {
  const handleStyleLoad = () => {
    ensureMapboxIcons(map, options).catch((error) => {
      console.error("[ICONS] Failed to auto-load icons after style change:", error);
    });
  };

  // Load icons when style loads
  map.on("style.load", handleStyleLoad);

  // Initial load if style is already loaded
  if (map.isStyleLoaded()) {
    handleStyleLoad();
  }
}

/**
 * Setup styleimagemissing event handler (reactive fallback)
 * This handles icons that are requested but not found in the sprite
 * 
 * ⚠️ IDEMPOTENT: Safe to call multiple times (uses named handler)
 * 
 * @param map - Mapbox map instance
 */

// Idempotency flag: track if handler is already attached
const styleImageMissingAttached = new WeakSet<Map>();

export function setupStyleImageMissing(map: Map): void {
  // Skip if already attached to this map instance
  if (styleImageMissingAttached.has(map)) {
    if (import.meta.env.DEV) {
      console.log("[ICONS] ✓ styleimagemissing already attached (idempotent skip)");
    }
    return;
  }

  const handler = (e: { id: string }) => {
    const iconName = e.id as RequiredIcon;

    // Only handle our required icons
    if (!REQUIRED_ICONS.includes(iconName)) {
      return;
    }

    // Check if already added (race condition)
    if (map.hasImage(iconName)) {
      return;
    }

    // Add fallback icon
    const fallback = createFallbackIcon(iconName);
    map.addImage(iconName, fallback);

    if (import.meta.env.DEV) {
      console.log(`[ICONS] 🔧 ${iconName} added via styleimagemissing`);
    }
  };

  map.on("styleimagemissing", handler);
  styleImageMissingAttached.add(map);

  if (import.meta.env.DEV) {
    console.log("[ICONS] ✓ styleimagemissing handler attached");
  }
}
