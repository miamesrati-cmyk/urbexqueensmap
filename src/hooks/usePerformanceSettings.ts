import { useState, useEffect } from "react";

/**
 * ⚡ Performance Settings Hook
 * 
 * Manages dev-only performance toggles:
 * - Halo blur comparison (0 vs 0.5)
 * - Performance HUD visibility
 */

export interface PerformanceSettings {
  haloBlur: number;
  performanceHUDEnabled: boolean;
}

export function usePerformanceSettings() {
  const [settings, setSettings] = useState<PerformanceSettings>(() => {
    // Check query params
    const params = new URLSearchParams(window.location.search);
    const perfParam = params.get("perf");
    const haloParam = params.get("halo");

    // Check localStorage for persisted settings
    const stored = localStorage.getItem("urbex-perf-settings");
    const parsed = stored ? JSON.parse(stored) : {};

    return {
      haloBlur: haloParam ? parseFloat(haloParam) : (parsed.haloBlur ?? 0),
      performanceHUDEnabled: perfParam === "1" || import.meta.env.DEV || parsed.performanceHUDEnabled || false,
    };
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem("urbex-perf-settings", JSON.stringify(settings));
  }, [settings]);

  const toggleHaloBlur = () => {
    setSettings((prev) => ({
      ...prev,
      haloBlur: prev.haloBlur === 0 ? 0.5 : 0,
    }));
  };

  const togglePerformanceHUD = () => {
    setSettings((prev) => ({
      ...prev,
      performanceHUDEnabled: !prev.performanceHUDEnabled,
    }));
  };

  return {
    settings,
    toggleHaloBlur,
    togglePerformanceHUD,
  };
}
