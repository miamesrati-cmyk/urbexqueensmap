import { useSyncExternalStore } from "react";

export const PRO_DEBUG_STORAGE_KEY = "UQ_DEBUG_PRO";
const listeners = new Set<() => void>();
let windowListenersBound = false;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function bindWindowListeners() {
  if (windowListenersBound || typeof window === "undefined") {
    return;
  }
  windowListenersBound = true;
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === PRO_DEBUG_STORAGE_KEY) {
      notifyListeners();
    }
  });
}

export function shouldShowProDebugUI() {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugPro") === "1") {
      return true;
    }
    return window.localStorage?.getItem(PRO_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function subscribeToProDebugFlagChanges(listener: () => void) {
  listeners.add(listener);
  bindWindowListeners();
  return () => {
    listeners.delete(listener);
  };
}

export function emitProDebugFlagChange() {
  notifyListeners();
}

export function useProDebugFlag() {
  return useSyncExternalStore(
    subscribeToProDebugFlagChanges,
    shouldShowProDebugUI,
    shouldShowProDebugUI
  );
}
