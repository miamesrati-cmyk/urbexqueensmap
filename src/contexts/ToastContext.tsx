import {
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "../styles/toast.css";
import { ToastContext } from "./toast-context";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

const AUTO_DISMISS_MIN = 2000;
const AUTO_DISMISS_MAX = 4000;
const EXIT_DURATION = 220;
const MAX_TOASTS = 3;

const getAutoDismissDuration = () =>
  AUTO_DISMISS_MIN + Math.random() * (AUTO_DISMISS_MAX - AUTO_DISMISS_MIN);

type TimerHandle = ReturnType<typeof setTimeout>;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextIdRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((type: ToastType, message: string) => {
    setToasts((current) => {
      const trimmed = current.length >= MAX_TOASTS ? current.slice(1) : current;
      nextIdRef.current += 1;
      return [...trimmed, { id: `toast-${nextIdRef.current}`, type, message }];
    });
  }, []);

  const api = useMemo(
    () => ({
      success: (message: string) => pushToast("success", message),
      error: (message: string) => pushToast("error", message),
      info: (message: string) => pushToast("info", message),
      warning: (message: string) => pushToast("warning", message),
    }),
    [pushToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onRemove,
}: {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}) {
  const [isEntered, setIsEntered] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const autoDismissRef = useRef<TimerHandle | null>(null);
  const exitTimerRef = useRef<TimerHandle | null>(null);
  const isClosingRef = useRef(false);
  const touchStartRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const startClose = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }
    isClosingRef.current = true;
    setIsLeaving(true);
    setIsEntered(false);
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
    exitTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onRemove(toast.id);
      }
    }, EXIT_DURATION);
  }, [onRemove, toast.id]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches?.[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartRef.current === null) {
      return;
    }
    const endY = event.changedTouches?.[0]?.clientY ?? null;
    if (typeof endY === "number" && Math.abs(endY - touchStartRef.current) > 12) {
      startClose();
    }
    touchStartRef.current = null;
  };

  const handleCloseButton = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    startClose();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsEntered(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setIsEntered(true));
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    autoDismissRef.current = setTimeout(() => {
      startClose();
    }, getAutoDismissDuration());
    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
        autoDismissRef.current = null;
      }
    };
  }, [startClose]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
        autoDismissRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`toast-item ${toast.type} ${isEntered ? "is-entered" : ""} ${
        isLeaving ? "is-leaving" : ""
      }`}
      onClick={startClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="status"
    >
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" type="button" onClick={handleCloseButton}>
        ×
      </button>
    </div>
  );
}
