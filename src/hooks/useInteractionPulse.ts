import { useCallback, useEffect, useRef, useState } from "react";

const PULSE_DURATION_MS = 360;

export default function useInteractionPulse(duration = PULSE_DURATION_MS) {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPulse = useCallback(() => {
    setActive(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (typeof window === "undefined") {
      timerRef.current = null;
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, duration);
  }, [duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [active, triggerPulse] as const;
}
