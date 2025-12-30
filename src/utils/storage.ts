export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error("Failed to read localStorage key", key, error);
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Failed to persist localStorage key", key, error);
    return false;
  }
}

export function safeLocalStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // best effort
  }
}

export function safeLocalStorageClear(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.clear();
  } catch (error) {
    console.error("Failed to clear localStorage", error);
  }
}

export function safeSessionStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Failed to persist sessionStorage key", key, error);
    return false;
  }
}

export function safeSessionStorageClear(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.clear();
  } catch (error) {
    console.error("Failed to clear sessionStorage", error);
  }
}

export function safeSessionStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.error("Failed to read sessionStorage key", key, error);
    return null;
  }
}

export function safeSessionStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // best effort
  }
}
