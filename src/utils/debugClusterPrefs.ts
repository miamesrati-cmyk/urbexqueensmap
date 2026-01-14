/**
 * Debug utilities for cluster preferences (localStorage management)
 * 
 * Usage in browser console:
 * ```js
 * // Import dynamically in console
 * import('/src/utils/debugClusterPrefs.ts').then(m => {
 *   m.resetClusterPrefs();
 *   m.inspectClusterPrefs();
 * });
 * ```
 * 
 * Or expose globally in dev mode (add to main.tsx):
 * ```ts
 * if (import.meta.env.DEV) {
 *   import('./utils/debugClusterPrefs').then(m => {
 *     (window as any).debugCluster = m;
 *   });
 * }
 * ```
 */

const CLUSTER_KEY = "urbex-clustering-enabled";

/**
 * Reset cluster preference to default (false)
 */
export function resetClusterPrefs(): void {
  try {
    localStorage.removeItem(CLUSTER_KEY);
    console.log("[DEBUG] ✅ Cluster prefs reset (removed from localStorage)");
    console.log("[DEBUG] 💡 Reload the page to apply changes");
  } catch (error) {
    console.error("[DEBUG] ❌ Failed to reset cluster prefs:", error);
  }
}

/**
 * Force cluster preference to a specific value
 */
export function setClusterPrefs(enabled: boolean): void {
  try {
    localStorage.setItem(CLUSTER_KEY, String(enabled));
    console.log(`[DEBUG] ✅ Cluster prefs set to: ${enabled}`);
    console.log("[DEBUG] 💡 Reload the page to apply changes");
  } catch (error) {
    console.error("[DEBUG] ❌ Failed to set cluster prefs:", error);
  }
}

/**
 * Inspect current cluster preference
 */
export function inspectClusterPrefs(): void {
  try {
    const stored = localStorage.getItem(CLUSTER_KEY);
    console.log("[DEBUG] 🔍 Current cluster preference:");
    console.log(`  - Raw value: ${stored === null ? "null (not set)" : `"${stored}"`}`);
    console.log(`  - Parsed as boolean: ${stored === "true"}`);
    console.log(`  - Will initialize as: ${stored === "true" ? "CLUSTER MODE" : "PLAIN MODE"}`);
  } catch (error) {
    console.error("[DEBUG] ❌ Failed to inspect cluster prefs:", error);
  }
}

/**
 * Clear all urbex-related localStorage keys (nuclear option)
 */
export function clearAllUrbexPrefs(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("urbex-")) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    
    console.log("[DEBUG] ✅ Cleared all urbex-* localStorage keys:", keysToRemove);
    console.log("[DEBUG] 💡 Reload the page to apply changes");
  } catch (error) {
    console.error("[DEBUG] ❌ Failed to clear urbex prefs:", error);
  }
}
