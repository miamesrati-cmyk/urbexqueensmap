import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useHaptics } from "./useHaptics";
import "./quickReactions.css";

const DEFAULT_EMOJIS = ["❤️", "🔥", "😮", "😂", "😢", "😡"];
const LONG_PRESS_MS = 350;
const MOVE_THRESHOLD = 12;

type QuickReactionsProps = {
  postId: string;
  currentReaction?: string | null;
  onRequireAuth?: () => void;
  onReact?: (emoji: string) => Promise<void>;
  children: ReactNode;
  emojis?: string[];
  isGuest?: boolean;
};

export function QuickReactions({
  postId,
  currentReaction = null,
  onRequireAuth,
  onReact,
  children,
  emojis = DEFAULT_EMOJIS,
  isGuest = false,
}: QuickReactionsProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pressTimer = useRef<number | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { impact } = useHaptics();

  const cancelLongPress = useCallback(() => {
    if (pressTimer.current !== null && typeof window !== "undefined") {
      window.clearTimeout(pressTimer.current);
    }
    pressTimer.current = null;
    startPoint.current = null;
  }, []);

  const closeTray = useCallback(() => {
    setIsOpen(false);
    cancelLongPress();
  }, [cancelLongPress]);

  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, [cancelLongPress]);

  const openTray = useCallback(() => {
    if (isGuest) {
      onRequireAuth?.();
      cancelLongPress();
      return;
    }
    setIsOpen(true);
  }, [cancelLongPress, isGuest, onRequireAuth]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      startPoint.current = { x: event.clientX, y: event.clientY };
      pressTimer.current = window.setTimeout(() => {
        openTray();
      }, LONG_PRESS_MS);
    },
    [openTray]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!startPoint.current) return;
      const deltaX = Math.abs(event.clientX - startPoint.current.x);
      const deltaY = Math.abs(event.clientY - startPoint.current.y);
      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        cancelLongPress();
      }
    },
    [cancelLongPress]
  );

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleSelectEmoji = useCallback(
    (emoji: string) => {
      impact("light");
      closeTray();
      onReact?.(emoji);
    },
    [closeTray, impact, onReact]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTray();
      }
    };
    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (!wrapperRef.current.contains(event.target)) {
        closeTray();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [closeTray, isOpen]);

  return (
    <div
      ref={wrapperRef}
      className="quick-reactions-shell"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {children}
      {isOpen && (
        <>
          <div className="quick-reactions-backdrop" role="presentation" />
          <div className="quick-reactions-tray" aria-label="Réactions rapides">
            {emojis.map((emoji) => (
              <button
                key={`${postId}-${emoji}`}
                type="button"
                className={emoji === currentReaction ? "is-active" : ""}
                onClick={() => handleSelectEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
