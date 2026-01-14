import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import UQImage from "../../UQImage";
import "./imageCarousel.css";

export type MediaItem = {
  url: string;
  alt?: string;
};

type Aspect = "square" | "portrait" | "auto";

export type ImageCarouselProps = {
  media: MediaItem[];
  aspect?: Aspect;
  onIndexChange?: (idx: number) => void;
  renderImage?: (item: MediaItem, index: number, isActive: boolean) => ReactNode;
};

export function ImageCarousel({
  media,
  aspect = "auto",
  onIndexChange,
  renderImage,
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const hasMultiple = media.length > 1;

  useEffect(() => {
    onIndexChange?.(activeIndex);
  }, [activeIndex, onIndexChange]);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, media.length - 1));
      if (clamped === activeIndex) return;
      setActiveIndex(clamped);
    },
    [activeIndex, media.length]
  );

  const goNext = useCallback(() => goToIndex(activeIndex + 1), [activeIndex, goToIndex]);
  const goPrev = useCallback(() => goToIndex(activeIndex - 1), [activeIndex, goToIndex]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      if (!start) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      if (isHorizontal && Math.abs(deltaX) > 40) {
        if (deltaX < 0) {
          goNext();
        } else {
          goPrev();
        }
      }
      touchStartRef.current = null;
    },
    [goNext, goPrev]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    },
    [goNext, goPrev]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const listener = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        handleKeyDown(event as unknown as KeyboardEvent);
      }
    };
    el.addEventListener("keydown", listener);
    return () => {
      el.removeEventListener("keydown", listener);
    };
  }, [handleKeyDown]);

  const aspectClass = useMemo(() => {
    if (aspect === "square") return "image-carousel--square";
    if (aspect === "portrait") return "image-carousel--portrait";
    return "";
  }, [aspect]);

  return (
    <div
      ref={containerRef}
      className={`image-carousel ${aspectClass}`}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="image-carousel__track"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {media.map((item, idx) => {
          const isActive = idx === activeIndex;
          const content = renderImage
            ? renderImage(item, idx, isActive)
            : (
              <UQImage
                src={item.url}
                alt={item.alt ?? ""}
                className="image-carousel__img"
                priority={idx === 0}
              />
            );
          return (
            <div
              key={`${item.url}-${idx}`}
              className="image-carousel__slide"
              data-active={isActive}
            >
              {content}
            </div>
          );
        })}
      </div>

      {hasMultiple && (
        <>
          <button
            type="button"
            className="image-carousel__arrow image-carousel__arrow--prev"
            onClick={goPrev}
            disabled={activeIndex === 0}
            aria-label="Image précédente"
          >
            ‹
          </button>
          <button
            type="button"
            className="image-carousel__arrow image-carousel__arrow--next"
            onClick={goNext}
            disabled={activeIndex === media.length - 1}
            aria-label="Image suivante"
          >
            ›
          </button>
          <div className="image-carousel__dots">
            {media.map((_, idx) => (
              <button
                key={`dot-${idx}`}
                type="button"
                className={`image-carousel__dot ${
                  idx === activeIndex ? "is-active" : ""
                }`}
                onClick={() => goToIndex(idx)}
                aria-label={`Aller à l’image ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
