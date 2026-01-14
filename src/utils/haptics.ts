const POINTER_COARSE_QUERY = "(pointer: coarse)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches;

const isLikelyTouchDevice = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const navigatorObj = window.navigator;
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia(POINTER_COARSE_QUERY).matches) ||
    (navigatorObj?.maxTouchPoints ?? 0) > 0 ||
    "ontouchstart" in window
  );
};

const supportsVibration = () =>
  typeof window !== "undefined" &&
  typeof window.navigator?.vibrate === "function" &&
  isLikelyTouchDevice() &&
  !prefersReducedMotion();

export function triggerHapticFeedback(duration = 30) {
  if (!supportsVibration()) {
    return;
  }
  window.navigator.vibrate(duration);
}
