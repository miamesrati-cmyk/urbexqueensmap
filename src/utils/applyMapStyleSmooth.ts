import type { Map } from "mapbox-gl";

type ReapplyFn = (map: Map) => void | Promise<void>;

export interface SmoothStyleOptions {
  /** Re-add custom layers/sources after style load */
  reapply?: ReapplyFn;
  /** Progress callback (0..1) */
  onProgress?: (progress: number) => void;
  /** Called when map is truly idle (tiles + glyphs settled) */
  onSettled?: () => void;
  /** Store last style URL on map to avoid redundant switches */
  storeLastUrl?: boolean;
}

/**
 * Apply a Mapbox style smoothly without flicker
 * 
 * ✅ Preserves camera position (center, zoom, bearing, pitch)
 * ✅ Waits for style.load before re-adding custom layers
 * ✅ Uses diff mode to reduce churn
 * ✅ Optional progress callback for UX feedback
 * 
 * @param map - Mapbox map instance
 * @param styleUrl - Target style URL
 * @param opts - Configuration options
 */
export async function applyMapStyleSmooth(
  map: Map,
  styleUrl: string,
  opts: SmoothStyleOptions = {}
): Promise<void> {
  const { reapply, onProgress, onSettled, storeLastUrl = true } = opts;

  // 1) Check if already on this style (avoid redundant switch)
  const lastStyleUrl = (map as any).__uqLastStyleUrl;
  if (lastStyleUrl === styleUrl) {
    if (import.meta.env.DEV) {
      console.log("[STYLE] Already on target style, skipping");
    }
    onProgress?.(1);
    return;
  }

  // 2) Snapshot camera to avoid "jump" after style change
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bearing = map.getBearing();
  const pitch = map.getPitch();

  if (import.meta.env.DEV) {
    console.log("[STYLE] 🎬 Starting smooth transition", {
      from: lastStyleUrl || "initial",
      to: styleUrl,
      camera: { center: [center.lng, center.lat], zoom, bearing, pitch },
    });
  }

  // 3) Set style (diff reduces churn when possible)
  onProgress?.(0.15);
  map.setStyle(styleUrl);

  // 4) Wait for style.load (guarantees sprite/glyphs pipeline re-bound)
  await new Promise<void>((resolve) => {
    const done = () => {
      if (import.meta.env.DEV) {
        console.log("[STYLE] ✓ style.load event fired");
      }
      resolve();
    };
    map.once("style.load", done);
  });

  onProgress?.(0.65);

  // 5) Restore camera (some styles can alter defaults)
  map.jumpTo({ center, zoom, bearing, pitch });

  if (import.meta.env.DEV) {
    console.log("[STYLE] ✓ Camera restored");
  }

  // 6) Reapply custom layers AFTER style load (key anti-flicker)
  if (reapply) {
    if (import.meta.env.DEV) {
      console.log("[STYLE] 🔧 Re-applying custom layers...");
    }
    await reapply(map);
    if (import.meta.env.DEV) {
      console.log("[STYLE] ✓ Custom layers re-applied");
    }
  }

  // 7) Store last style URL for next check
  if (storeLastUrl) {
    (map as any).__uqLastStyleUrl = styleUrl;
  }

  onProgress?.(1);

  if (import.meta.env.DEV) {
    console.log("[STYLE] ✅ Smooth transition complete");
  }

  // 8) 🎬 APPLE MAPS MODE: Wait for idle (tiles + glyphs fully settled)
  // This guarantees zero visual artifacts before removing overlay
  await new Promise<void>((resolve) => {
    const done = () => {
      if (import.meta.env.DEV) {
        console.log("[STYLE] ✓ Map idle (visually settled)");
      }
      resolve();
    };
    map.once("idle", done);
  });

  // Notify caller that map is truly ready for overlay removal
  onSettled?.();
}

/**
 * Haptic feedback helper (light tap for iOS Safari)
 * Safe guard for unsupported browsers
 */
export function triggerHapticLight(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(12); // "tap" subtil
    } catch {
      // Silent fail on unsupported devices
    }
  }
}
