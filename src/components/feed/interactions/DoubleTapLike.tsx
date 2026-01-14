import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, MouseEvent, TouchEvent } from "react";
import "./doubleTapLike.css";
import { useHaptics } from "./useHaptics";

const DOUBLE_TAP_MAX_DELAY = 280;
const MOVEMENT_THRESHOLD = 24;

export type DoubleTapLikeProps = {
  postId: string;
  isLiked: boolean;
  likeCount?: number;
  onRequireAuth?: () => void;
  onToggleLike: (next: boolean) => Promise<void>;
  children: ReactNode;
  className?: string;
};

export function DoubleTapLike({
  postId,
  isLiked,
  likeCount,
  onRequireAuth,
  onToggleLike,
  children,
  className = "",
}: DoubleTapLikeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const burstTimer = useRef<number | null>(null);
  const [showBurst, setShowBurst] = useState(false);
  const [burstPosition, setBurstPosition] = useState({ x: 0, y: 0 });
  const { tap } = useHaptics();

  useEffect(() => {
    return () => {
      if (burstTimer.current) {
        window.clearTimeout(burstTimer.current);
      }
    };
  }, []);

  const triggerBurst = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setBurstPosition({
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
    setShowBurst(true);
    if (burstTimer.current) {
      window.clearTimeout(burstTimer.current);
    }
    burstTimer.current = window.setTimeout(() => {
      setShowBurst(false);
    }, 900);
  }, []);

  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      triggerBurst(clientX, clientY);
      if (onRequireAuth) {
        onRequireAuth();
        return;
      }
      if (isLiked) {
        return;
      }
      tap();
      onToggleLike(true).catch((err) => {
        console.error("[DoubleTapLike]", err);
      });
    },
    [isLiked, onRequireAuth, onToggleLike, triggerBurst]
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      const now = Date.now();
      const moveStart = touchStartRef.current ?? { x: touch.clientX, y: touch.clientY };
      const deltaX = Math.abs(touch.clientX - moveStart.x);
      const deltaY = Math.abs(touch.clientY - moveStart.y);
      const lastTap = lastTapRef.current;
      const isCloseInTime = now - lastTap.time <= DOUBLE_TAP_MAX_DELAY;
      const isCloseInSpace =
        Math.abs(touch.clientX - lastTap.x) <= MOVEMENT_THRESHOLD &&
        Math.abs(touch.clientY - lastTap.y) <= MOVEMENT_THRESHOLD;

      if (
        deltaX <= MOVEMENT_THRESHOLD &&
        deltaY <= MOVEMENT_THRESHOLD &&
        isCloseInTime &&
        isCloseInSpace
      ) {
        handleDoubleTap(touch.clientX, touch.clientY);
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        event.preventDefault();
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      }

      touchStartRef.current = null;
    },
    [handleDoubleTap]
  );

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleDoubleTap(event.clientX, event.clientY);
    },
    [handleDoubleTap]
  );

  return (
    <div
      ref={containerRef}
      className={`double-tap-like ${className}`}
      data-post-id={postId}
      data-like-count={likeCount ?? undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      {children}
      {showBurst && (
        <span
          className="double-tap-like__burst"
          style={{ left: burstPosition.x, top: burstPosition.y }}
        >
          ❤️
        </span>
      )}
    </div>
  );
}
