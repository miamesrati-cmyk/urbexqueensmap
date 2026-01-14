import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVisibility } from "./useVisibility";
import "./autoPlayVideo.css";

type AutoPlayVideoProps = {
  src: string;
  poster?: string;
  loop?: boolean;
  muted?: boolean;
  threshold?: number;
  className?: string;
  onView?: () => void;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function AutoPlayVideo({
  src,
  poster,
  loop = true,
  muted = true,
  threshold = 0.6,
  className = "",
  onView,
}: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );
  const manualInteraction = useRef(false);
  const viewReported = useRef(false);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  }, []);

  const observerOptions = useMemo(() => ({ threshold }), [threshold]);
  const handleVisibility = useCallback(
    (entry: IntersectionObserverEntry) => {
      setIsVisible(entry.intersectionRatio >= threshold);
    },
    [threshold]
  );

  useVisibility(videoRef, observerOptions, handleVisibility);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibilityChange = () => {
      setDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    manualInteraction.current = false;
    viewReported.current = false;
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleUserPlay = (event: Event) => {
      if (event.isTrusted) {
        manualInteraction.current = true;
      }
    };
    const handleUserPause = (event: Event) => {
      if (event.isTrusted) {
        manualInteraction.current = true;
      }
    };
    const handleVolumeChange = (event: Event) => {
      if (event.isTrusted) {
        manualInteraction.current = true;
      }
    };
    video.addEventListener("play", handleUserPlay);
    video.addEventListener("pause", handleUserPause);
    video.addEventListener("volumechange", handleVolumeChange);
    return () => {
      video.removeEventListener("play", handleUserPlay);
      video.removeEventListener("pause", handleUserPause);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, []);

  const shouldAutoplay = useMemo(() => {
    return (
      !prefersReducedMotion &&
      isVisible &&
      documentVisible &&
      !manualInteraction.current
    );
  }, [documentVisible, isVisible, prefersReducedMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldAutoplay) {
      video
        .play()
        .then(() => {
          if (onView && !viewReported.current) {
            onView();
            viewReported.current = true;
          }
        })
        .catch(() => {
          // Autoplay blocked, leave paused.
        });
    } else {
      if (!video.paused) {
        video.pause();
      }
    }
  }, [shouldAutoplay, onView]);

  return (
    <video
      ref={videoRef}
      className={`auto-play-video ${prefersReducedMotion ? "is-paused" : ""} ${className}`}
      src={src}
      poster={poster}
      loop={loop}
      muted={muted}
      playsInline
      autoPlay={!prefersReducedMotion}
      preload="metadata"
      controls={prefersReducedMotion}
    />
  );
}
