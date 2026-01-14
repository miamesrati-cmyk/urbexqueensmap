import {
  type RefCallback,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type PullToRefreshStatus = "idle" | "pulling" | "armed" | "refreshing";

type UsePullToRefreshOptions = {
  onRefresh: () => Promise<unknown> | unknown;
  threshold?: number;
  minSpinnerTime?: number;
  disabled?: boolean;
};

type UsePullToRefreshResult = {
  attachSurface: RefCallback<HTMLElement>;
  pullDistance: number;
  status: PullToRefreshStatus;
  isRefreshing: boolean;
};

const DEFAULT_THRESHOLD = 70;
const DEFAULT_MIN_SPINNER = 800;
const MAX_PULL_FACTOR = 1.4;
const MIN_SPINNER = 600;
const MAX_SPINNER = 1200;

export function usePullToRefresh({
  onRefresh,
  threshold,
  minSpinnerTime,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [surfaceNode, setSurfaceNode] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<PullToRefreshStatus>("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const armedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const actualThreshold = useMemo(() => threshold ?? DEFAULT_THRESHOLD, [threshold]);
  const spinnerTime = useMemo(() => {
    const base = minSpinnerTime ?? DEFAULT_MIN_SPINNER;
    return Math.max(MIN_SPINNER, Math.min(MAX_SPINNER, base));
  }, [minSpinnerTime]);
  const maxPullDistance = useMemo(
    () => Math.max(actualThreshold * MAX_PULL_FACTOR, actualThreshold),
    [actualThreshold]
  );

  const attachSurface = useCallback((node: HTMLElement | null) => {
    setSurfaceNode(node);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const startRefresh = useCallback(async () => {
    if (!mountedRef.current) return;
    setIsRefreshing(true);
    setStatus("refreshing");
    setPullDistance(actualThreshold);
    const startedAt = Date.now();
    try {
      await Promise.resolve(onRefresh());
    } catch (error) {
      console.error("[usePullToRefresh] refresh failed", error);
    }
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, spinnerTime - elapsed);
    if (wait > 0 && typeof window !== "undefined") {
      await new Promise<void>((resolve) => {
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          resolve();
        }, wait);
      });
    }
    if (!mountedRef.current) return;
    setIsRefreshing(false);
    setStatus("idle");
    setPullDistance(0);
    startYRef.current = null;
    armedRef.current = false;
  }, [onRefresh, spinnerTime, actualThreshold]);

  useEffect(() => {
    if (disabled) return;
    if (typeof document === "undefined") return;
    const target =
      surfaceNode ?? (document.scrollingElement ?? document.body);
    if (!target) return;

    const element = target as HTMLElement & { scrollTop: number };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || isRefreshingRef.current) return;
      const { scrollTop } = element;
      if (scrollTop > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = event.touches[0]?.clientY ?? null;
      armedRef.current = false;
      setStatus("idle");
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startYRef.current == null || isRefreshingRef.current) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY == null) return;
      const delta = currentY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        setStatus("idle");
        armedRef.current = false;
        return;
      }
      if (element.scrollTop > 0) {
        startYRef.current = null;
        setPullDistance(0);
        setStatus("idle");
        armedRef.current = false;
        return;
      }
      const clampedDistance = Math.min(delta, maxPullDistance);
      setPullDistance(clampedDistance);
      if (clampedDistance >= actualThreshold) {
        setStatus("armed");
        armedRef.current = true;
      } else {
        setStatus("pulling");
        armedRef.current = false;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const resetPull = () => {
      if (isRefreshingRef.current) {
        setPullDistance(actualThreshold);
        setStatus("refreshing");
        return;
      }
      setPullDistance(0);
      setStatus("idle");
      armedRef.current = false;
      startYRef.current = null;
    };

    const handleTouchEnd = () => {
      if (armedRef.current && !isRefreshingRef.current) {
        armedRef.current = false;
        void startRefresh();
      }
      if (!isRefreshingRef.current) {
        resetPull();
      }
    };

    const handleTouchCancel = () => {
      if (!isRefreshingRef.current) {
        resetPull();
      }
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [surfaceNode, disabled, startRefresh, maxPullDistance, actualThreshold]);

  return {
    attachSurface,
    pullDistance,
    status,
    isRefreshing,
  };
}
