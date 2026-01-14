import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RequireAuthOptions } from "../contexts/authUICore";
import type { UserLevel } from "../services/places";
import GuestLimitModal from "./GuestLimitModal";

const MIN_SPOTS_TO_TRIGGER = 3;
const SESSION_KEY = "guestLimitModalDismissed";

type GuestLimitModalManagerProps = {
  userLevel: UserLevel;
  requireAuth: (options?: RequireAuthOptions) => Promise<boolean>;
  spotsVisible: number;
  totalSpots: number;
};

export default function GuestLimitModalManager({
  userLevel,
  requireAuth,
  spotsVisible,
  totalSpots,
}: GuestLimitModalManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const node = document.createElement("div");
    document.body.appendChild(node);
    setPortalContainer(node);
    return () => {
      cancelTimer();
      if (node.parentElement) {
        node.parentElement.removeChild(node);
      }
      setPortalContainer(null);
    };
  }, [cancelTimer]);

  const shouldScheduleGuestModal =
    userLevel === "guest" &&
    !hasShown &&
    spotsVisible >= MIN_SPOTS_TO_TRIGGER;

  useEffect(() => {
    if (!shouldScheduleGuestModal || typeof window === "undefined") {
      return;
    }
    if (window.sessionStorage.getItem(SESSION_KEY)) {
      return;
    }
    if (timerRef.current !== null) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setIsOpen(true);
      setHasShown(true);
      timerRef.current = null;
    }, 3000);

    return cancelTimer;
  }, [cancelTimer, shouldScheduleGuestModal]);

  useEffect(() => {
    if (userLevel !== "guest") {
      setIsOpen(false);
    }
  }, [userLevel]);

  const markDismissed = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.sessionStorage.setItem(SESSION_KEY, "true");
  }, []);

  const handleClose = useCallback(() => {
    markDismissed();
    cancelTimer();
    setIsOpen(false);
  }, [markDismissed, cancelTimer]);

  const handleSignUp = useCallback(() => {
    markDismissed();
    cancelTimer();
    setIsOpen(false);
    void requireAuth({ mode: "signup" });
  }, [markDismissed, requireAuth, cancelTimer]);

  if (!portalContainer) {
    return null;
  }

  return createPortal(
    <GuestLimitModal
      isOpen={isOpen}
      onClose={handleClose}
      onSignUp={handleSignUp}
      spotsVisible={spotsVisible}
      totalSpots={totalSpots}
    />,
    portalContainer
  );
}
