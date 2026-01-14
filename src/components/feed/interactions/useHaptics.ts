import { useCallback, useMemo } from "react";

type ImpactLevel = "light" | "medium" | "heavy";

type HapticsApi = {
  tap: () => void;
  success: () => void;
  impact: (level: ImpactLevel) => void;
};

function supportsTouch() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const hasTouchEvent = "ontouchstart" in window;
  const hasTouchPoints = navigator.maxTouchPoints > 0;
  const mobileMatch = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return hasTouchEvent || hasTouchPoints || mobileMatch;
}

function prefersReduceMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useHaptics(): HapticsApi {
  const canVibrate = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    if (typeof navigator.vibrate !== "function") return false;
    if (!supportsTouch()) return false;
    if (prefersReduceMotion()) return false;
    return true;
  }, []);

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!canVibrate || typeof navigator === "undefined") return;
      navigator.vibrate(pattern);
    },
    [canVibrate]
  );

  const tap = useCallback(() => {
    vibrate(15);
  }, [vibrate]);

  const success = useCallback(() => {
    vibrate([10, 30, 20]);
  }, [vibrate]);

  const impact = useCallback(
    (level: ImpactLevel) => {
      if (level === "light") {
        vibrate(8);
      } else if (level === "medium") {
        vibrate([12, 12, 10]);
      } else {
        vibrate([20, 30, 10]);
      }
    },
    [vibrate]
  );

  return { tap, success, impact };
}
