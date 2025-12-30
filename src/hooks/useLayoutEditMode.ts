import { useCallback, useEffect, useState } from "react";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
} from "../utils/storage";

const STORAGE_KEY = "urbex_map_layout_edit_mode";

export function useLayoutEditMode() {
  const [enabled, setEnabled] = useState(() => safeLocalStorageGet(STORAGE_KEY) === "1");

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      setEnabled(event.newValue === "1");
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setEditMode = useCallback((value: boolean) => {
    setEnabled(value);
    if (value) {
      safeLocalStorageSet(STORAGE_KEY, "1");
    } else {
      safeLocalStorageRemove(STORAGE_KEY);
    }
  }, []);

  return [enabled, setEditMode] as const;
}
