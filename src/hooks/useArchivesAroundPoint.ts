/**
 * 📜 ARCHIVES MODE: Hook to fetch Wikipedia cards around a point
 * 
 * Automatically fetches and caches Wikipedia articles when:
 * - User clicks on map in ARCHIVES mode
 * - Point changes (debounced by coordinate key)
 * - resetToken changes (force invalidation on reset)
 * 
 * Anti-race: Uses cancelled flag to ignore stale responses
 */

import { useEffect, useMemo, useState, useRef } from "react";
import { fetchWikiCardsAround, type WikiCard } from "../services/archives/wiki";

type LngLat = { lng: number; lat: number };

export function useArchivesAroundPoint(
  point: LngLat | null, 
  enabled: boolean,
  resetToken?: number // 🔥 Optional for robustness (normalized below)
) {
  // Normalize resetToken to ensure stable deps (protect against undefined)
  const token = resetToken ?? 0;
  
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<WikiCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 🔥 Keep last non-empty key for useful runId even after reset
  const lastKeyRef = useRef<string>("");

  // Create a stable key based on coordinates (5 decimals ≈ 1m precision)
  // This prevents re-fetching on tiny map movements
  const key = useMemo(() => {
    if (!point) return "";
    // Convert to Number to avoid float precision issues
    const lat = Number(point.lat.toFixed(5));
    const lng = Number(point.lng.toFixed(5));
    return `${lat},${lng}`;
  }, [point]);

  useEffect(() => {
    // Update lastKey ref if we have a valid key
    if (key) lastKeyRef.current = key;
    
    // Use last known key for runId if current key is empty (useful for reset logs)
    const runId = `${key || lastKeyRef.current}:${token}`; // 🔥 Stable trace for debugging
    
    if (import.meta.env.DEV) {
      console.log("[ARCHIVES][HOOK] useEffect triggered", { 
        enabled, 
        hasPoint: !!point, 
        key, 
        token, // Use normalized token
        runId 
      });
    }

    // Reset IMMEDIATELY if disabled or no point (autoritaire)
    if (!enabled || !point || !key) {
      if (import.meta.env.DEV) {
        console.log("[ARCHIVES][HOOK] Clearing cards (disabled/no point/key)", { 
          enabled, 
          hasPoint: !!point, 
          key 
        });
      }
      setCards([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false; // 🔥 Local cancel flag (anti-race)
    
    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (import.meta.env.DEV) {
          console.log("[ARCHIVES][HOOK] Fetching Wikipedia around:", { lat: point.lat, lng: point.lng }, runId);
        }

        const fetchedCards = await fetchWikiCardsAround(point.lat, point.lng, 2500, 10);

        if (cancelled) {
          if (import.meta.env.DEV) {
            console.log("[ARCHIVES][HOOK] Ignored stale response", runId);
          }
          return;
        }
        
        if (import.meta.env.DEV) {
          console.log("[ARCHIVES][HOOK] Setting cards:", fetchedCards.length, runId);
        }
        setCards(fetchedCards);
        setError(null);
      } catch (e) {
        if (cancelled) {
          if (import.meta.env.DEV) {
            console.log("[ARCHIVES][HOOK] Ignored stale error", runId);
          }
          return;
        }
        
        console.error("[ARCHIVES][HOOK] Fetch error", e, runId);
        setError("Archives indisponibles pour l'instant.");
        setCards([]); // Clear on error
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    // Cleanup: cancel if point/token changes or component unmounts
    return () => {
      cancelled = true; // 🔥 Prevents stale responses from updating state
      if (import.meta.env.DEV) {
        console.log("[ARCHIVES][HOOK] Cleanup (cancelled)", runId);
      }
    };
  }, [enabled, key, point, token]); // 🔥 Use normalized token in deps

  return { loading, cards, error };
}
