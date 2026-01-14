import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";

/**
 * ⚡ Performance Monitor Hook
 * 
 * Tracks map rendering performance metrics:
 * - FPS / Frame time
 * - Feature count
 * - Data update duration
 * - Layer recreation detection (regression guard)
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number; // ms
  featureCount: number;
  lastUpdateTime: number; // ms
  updateCount: number;
  layerRecreationDetected: boolean;
  averageUpdateTime: number; // ms
}

interface PerformanceBudget {
  idealUpdateTime: number; // ms
  maxUpdateTime: number; // ms
}

const DEFAULT_BUDGET: PerformanceBudget = {
  idealUpdateTime: 16, // 60 FPS
  maxUpdateTime: 33, // 30 FPS minimum
};

export function useMapPerformanceMonitor(
  map: MapboxMap | null,
  sourceId: string,
  enabled: boolean = false
) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    featureCount: 0,
    lastUpdateTime: 0,
    updateCount: 0,
    layerRecreationDetected: false,
    averageUpdateTime: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number | null>(null);
  const updateTimesRef = useRef<number[]>([]);
  const layerCountRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !map) return;

    // 🎯 FPS Monitor
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        const frameTime = parseFloat((1000 / fps).toFixed(2));

        setMetrics((prev) => ({
          ...prev,
          fps,
          frameTime,
        }));

        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(measureFPS);
    };

    // 📊 Feature Count Monitor
    const updateFeatureCount = () => {
      if (!map.isStyleLoaded()) return;

      const source = map.getSource(sourceId) as GeoJSONSource | null;
      if (source && (source as any)._data) {
        const data = (source as any)._data;
        const count = data?.features?.length || 0;

        setMetrics((prev) => ({
          ...prev,
          featureCount: count,
        }));
      }
    };

    // ⚠️ Layer Recreation Detection (Regression Guard)
    const detectLayerRecreation = () => {
      if (!map.isStyleLoaded()) return;

      const currentLayers = map
        .getStyle()
        ?.layers?.filter(
          (l) =>
            l.id.includes("spot") ||
            l.id.includes("cluster") ||
            l.id === "uq-spots-unclustered"
        );

      const currentCount = currentLayers?.length || 0;

      // If layer count changes, recreation happened
      // Note: 4 → 0 is expected during style changes (layers destroyed then recreated)
      if (layerCountRef.current > 0 && currentCount !== layerCountRef.current) {
        // Skip warning if count drops to 0 (style change in progress)
        if (currentCount === 0) {
          layerCountRef.current = currentCount;
          return;
        }

        console.warn(
          `⚠️ [PERF] Layer recreation detected! ${layerCountRef.current} → ${currentCount}`
        );

        setMetrics((prev) => ({
          ...prev,
          layerRecreationDetected: true,
        }));

        // Reset after 2 seconds
        setTimeout(() => {
          setMetrics((prev) => ({
            ...prev,
            layerRecreationDetected: false,
          }));
        }, 2000);
      }

      layerCountRef.current = currentCount;
    };

    // 📈 Data Update Monitor with Performance Budget
    const monitorSourceData = () => {
      const start = performance.now();

      return () => {
        const duration = performance.now() - start;

        // Track update times for averaging
        updateTimesRef.current.push(duration);
        if (updateTimesRef.current.length > 100) {
          updateTimesRef.current.shift();
        }

        const avg =
          updateTimesRef.current.reduce((a, b) => a + b, 0) /
          updateTimesRef.current.length;

        setMetrics((prev) => ({
          ...prev,
          lastUpdateTime: parseFloat(duration.toFixed(2)),
          updateCount: prev.updateCount + 1,
          averageUpdateTime: parseFloat(avg.toFixed(2)),
        }));

        // ⚠️ Performance Budget Check
        if (duration > DEFAULT_BUDGET.maxUpdateTime) {
          console.warn(
            `⚠️ [PERF BUDGET] Update exceeded MAX budget: ${duration.toFixed(2)}ms > ${DEFAULT_BUDGET.maxUpdateTime}ms`
          );
        } else if (duration > DEFAULT_BUDGET.idealUpdateTime) {
          if (import.meta.env.DEV) {
            console.log(
              `ℹ️ [PERF] Update exceeded IDEAL budget: ${duration.toFixed(2)}ms > ${DEFAULT_BUDGET.idealUpdateTime}ms`
            );
          }
        } else {
          if (import.meta.env.DEV) {
            console.log(
              `✅ [PERF] Update within budget: ${duration.toFixed(2)}ms`
            );
          }
        }
      };
    };

    // Intercept setData calls
    const source = map.getSource(sourceId) as GeoJSONSource | null;
    if (source) {
      const originalSetData = source.setData.bind(source);

      source.setData = function (data: any) {
        const endMonitor = monitorSourceData();
        const result = originalSetData(data);
        endMonitor();
        return result;
      };
    }

    // Start monitoring
    rafIdRef.current = requestAnimationFrame(measureFPS);

    const styleDataListener = () => {
      updateFeatureCount();
      detectLayerRecreation();
    };

    map.on("styledata", styleDataListener);
    map.on("sourcedata", updateFeatureCount);

    // Initial counts
    updateFeatureCount();
    detectLayerRecreation();

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      map.off("styledata", styleDataListener);
      map.off("sourcedata", updateFeatureCount);
    };
  }, [enabled, map, sourceId]);

  return metrics;
}
