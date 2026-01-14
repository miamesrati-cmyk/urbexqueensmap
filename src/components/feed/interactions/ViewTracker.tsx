import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { auth } from "../../../lib/firebase";
import { enqueueView } from "./views";
import { useVisibility } from "./useVisibility";

type ViewTrackerProps = {
  postId: string;
  enabled?: boolean;
  threshold?: number;
  dwellMs?: number;
  children: ReactNode;
};

const sessionTracked = new Set<string>();

export function ViewTracker({
  postId,
  enabled = true,
  threshold = 0.5,
  dwellMs = 2000,
  children,
}: ViewTrackerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const isVisibleRef = useRef(false);
  const docVisibleRef = useRef(true);
  const hasTrackedRef = useRef(sessionTracked.has(postId));

  const observerOptions = useMemo(() => ({ threshold }), [threshold]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      if (typeof window !== "undefined") {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    }
  }, []);

  const triggerView = useCallback(() => {
    if (!enabled) return;
    if (hasTrackedRef.current || sessionTracked.has(postId)) return;
    if (!isVisibleRef.current || !docVisibleRef.current) return;
    hasTrackedRef.current = true;
    sessionTracked.add(postId);
    const currentUser = auth.currentUser;
    if (currentUser) {
      enqueueView(currentUser.uid, postId);
    }
  }, [enabled, postId]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      docVisibleRef.current = document.visibilityState === "visible";
    }
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      docVisibleRef.current = document.visibilityState === "visible";
      if (!docVisibleRef.current) {
        clearTimer();
      } else if (isVisibleRef.current) {
        if (!timerRef.current && typeof window !== "undefined") {
          timerRef.current = window.setTimeout(triggerView, dwellMs);
        }
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [clearTimer, dwellMs, triggerView]);

  const handleVisibility = useCallback(
    (entry: IntersectionObserverEntry) => {
      isVisibleRef.current = entry.intersectionRatio >= threshold;
      if (
        isVisibleRef.current &&
        !hasTrackedRef.current &&
        docVisibleRef.current &&
        enabled
      ) {
        if (!timerRef.current && typeof window !== "undefined") {
          timerRef.current = window.setTimeout(triggerView, dwellMs);
        }
      } else {
        clearTimer();
      }
    },
    [clearTimer, dwellMs, enabled, threshold, triggerView]
  );

  useVisibility(containerRef, observerOptions, handleVisibility);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return (
    <div ref={containerRef} className="view-tracker">
      {children}
    </div>
  );
}
