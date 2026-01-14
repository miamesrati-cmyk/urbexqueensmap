import { useEffect, useState } from "react";
import {
  ACHIEVEMENT_UNLOCK_EVENT,
  type AchievementUnlockDetail,
} from "../services/achievements";

const TOAST_DURATION = 4200;

type ToastItem = AchievementUnlockDetail & {
  id: string;
};

function buildToastId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function AchievementToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AchievementUnlockDetail>).detail;
      if (!detail) return;
      const nextToast: ToastItem = { ...detail, id: buildToastId() };
      setToasts((prev) => [...prev, nextToast]);
    };
    window.addEventListener(
      ACHIEVEMENT_UNLOCK_EVENT,
      handler as EventListener
    );
    return () => {
      window.removeEventListener(
        ACHIEVEMENT_UNLOCK_EVENT,
        handler as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, TOAST_DURATION);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="achievement-toast-wrapper" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`achievement-toast achievement-toast--tier-${toast.tier.toLowerCase()}${
            toast.proOnly ? " achievement-toast--pro" : ""
          }`}
        >
          <div className="achievement-toast-icon">{toast.icon}</div>
          <div className="achievement-toast-body">
            <div className="achievement-toast-title">{toast.title}</div>
            <div className="achievement-toast-meta">
              <span>+{toast.xp} XP</span>
              {toast.proOnly && (
                <span className="achievement-toast-pro-pill">PRO</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
