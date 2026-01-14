import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * 🎮 DOUBLE-TAP TO LIKE
 * Style Instagram - Double-tap l'image pour liker
 */
interface DoubleTapLikeProps {
  children: React.ReactNode;
  onLike: () => void;
  isLiked: boolean;
  className?: string;
}

export function DoubleTapLike({ children, onLike, isLiked, className = '' }: DoubleTapLikeProps) {
  const [showHeart, setShowHeart] = useState(false);
  const lastTap = useRef<number>(0);

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      e.stopPropagation();
      e.preventDefault();

      if (!isLiked) {
        onLike();
        // Haptic feedback
        window.navigator?.vibrate?.(10);
      }

      // Show heart animation
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 1000);
    }

    lastTap.current = now;
  };

  return (
    <div
      className={`double-tap-container ${className}`}
      onClick={handleTap}
      onTouchEnd={handleTap}
      style={{ position: 'relative' }}
    >
      {children}
      {showHeart && (
        <div className="heart-burst">
          ❤️
        </div>
      )}
    </div>
  );
}

/**
 * 🎥 AUTO-PLAY VIDEO
 * Joue automatiquement quand visible, pause quand invisible
 */
interface AutoPlayVideoProps {
  src: string;
  poster?: string;
  className?: string;
  onView?: () => void; // Callback après 2s de visionnage
}

export function AutoPlayVideo({ src, poster, className = '', onView }: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // Visible - play
          video.play().catch(() => {
            // Autoplay bloqué, fallback sur mute
            video.muted = true;
            video.play();
          });

          // Track view après 2 secondes
          if (onView) {
            viewTimerRef.current = setTimeout(() => {
              onView();
            }, 2000);
          }
        } else {
          // Invisible - pause
          video.pause();
          if (viewTimerRef.current) {
            clearTimeout(viewTimerRef.current);
          }
        }
      },
      { threshold: 0.7 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
    };
  }, [onView]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      loop
      muted
      playsInline
      className={`auto-play-video ${className}`}
    />
  );
}

/**
 * 🎠 IMAGE CAROUSEL
 * Swipe horizontal pour naviguer entre plusieurs images
 */
interface ImageCarouselProps {
  images: string[];
  alt?: string;
  className?: string;
}

export function ImageCarousel({ images, alt = '', className = '' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < images.length - 1) {
        // Swipe left
        setCurrentIndex(i => i + 1);
        window.navigator?.vibrate?.(5);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right
        setCurrentIndex(i => i - 1);
        window.navigator?.vibrate?.(5);
      }
    }

    setTouchStart(null);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    window.navigator?.vibrate?.(5);
  };

  if (images.length <= 1) {
    return <img src={images[0]} alt={alt} className={className} />;
  }

  return (
    <div
      className={`image-carousel ${className}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="carousel-track"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        {images.map((url, idx) => (
          <div key={idx} className="carousel-slide">
            <img src={url} alt={`${alt} ${idx + 1}`} />
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          className="carousel-arrow carousel-prev"
          onClick={(e) => {
            e.stopPropagation();
            goToSlide(currentIndex - 1);
          }}
          aria-label="Image précédente"
        >
          ‹
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          className="carousel-arrow carousel-next"
          onClick={(e) => {
            e.stopPropagation();
            goToSlide(currentIndex + 1);
          }}
          aria-label="Image suivante"
        >
          ›
        </button>
      )}

      {/* Dots indicator */}
      <div className="carousel-dots">
        {images.map((_, idx) => (
          <button
            key={idx}
            className={`carousel-dot ${idx === currentIndex ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(idx);
            }}
            aria-label={`Aller à l'image ${idx + 1}`}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="carousel-counter">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}

/**
 * 💗 QUICK REACTIONS MENU
 * Long-press sur le bouton like pour voir plus d'emojis
 */
interface QuickReactionsProps {
  currentReaction?: string;
  onReact: (emoji: string) => void;
  reactions?: string[];
  className?: string;
}

export function QuickReactions({
  currentReaction,
  onReact,
  reactions = ['🖤', '🔥', '😍', '💀', '👻', '🤯'],
  className = '',
}: QuickReactionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
      window.navigator?.vibrate?.(20);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleReact = (emoji: string) => {
    onReact(emoji);
    setShowMenu(false);
    window.navigator?.vibrate?.(10);
  };

  const handleQuickLike = () => {
    if (!showMenu) {
      onReact(currentReaction === '🖤' ? '' : '🖤');
      window.navigator?.vibrate?.(10);
    }
  };

  return (
    <div className={`quick-reactions ${className}`}>
      <button
        className={`reaction-trigger ${currentReaction ? 'is-active' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onClick={handleQuickLike}
        aria-label="Réagir"
      >
        {currentReaction || '🤍'}
      </button>

      {showMenu && (
        <>
          <div
            className="reaction-menu-backdrop"
            onClick={() => setShowMenu(false)}
          />
          <div className="reaction-menu">
            {reactions.map((emoji) => (
              <button
                key={emoji}
                className={`reaction-option ${emoji === currentReaction ? 'active' : ''}`}
                onClick={() => handleReact(emoji)}
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

/**
 * 🔖 SAVE BUTTON
 * Bookmark un post pour le retrouver plus tard
 */
interface SaveButtonProps {
  isSaved: boolean;
  onToggle: () => void;
  className?: string;
}

export function SaveButton({ isSaved, onToggle, className = '' }: SaveButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    onToggle();
    setIsAnimating(true);
    window.navigator?.vibrate?.(10);
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <button
      className={`save-button ${isSaved ? 'is-saved' : ''} ${isAnimating ? 'is-animating' : ''} ${className}`}
      onClick={handleClick}
      aria-label={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      {isSaved ? '🔖' : '📌'}
    </button>
  );
}

/**
 * 👁️ VIEW TRACKER
 * Track les vues d'un post (2s visible = 1 vue)
 */
interface ViewTrackerProps {
  postId: string;
  onView: (postId: string) => void;
  children: React.ReactNode;
  threshold?: number; // Pourcentage visible (0-1)
  delay?: number; // Délai avant de compter (ms)
}

export function ViewTracker({
  postId,
  onView,
  children,
  threshold = 0.5,
  delay = 2000,
}: ViewTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting && !viewedRef.current) {
          // Start timer
          timerRef.current = setTimeout(() => {
            viewedRef.current = true;
            onView(postId);
          }, delay);
        } else if (!entry.isIntersecting && timerRef.current) {
          // Cancel timer if user scrolls away
          clearTimeout(timerRef.current);
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [postId, onView, threshold, delay]);

  return <div ref={ref}>{children}</div>;
}

/**
 * 📱 SWIPE NAVIGATION
 * Hook pour détecter les swipes gauche/droite
 */
export function useSwipeNavigation(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold: number = 100
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) return;

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };

      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = Math.abs(touchEnd.y - touchStart.y);

      // Swipe horizontal (pas vertical scroll)
      if (Math.abs(deltaX) > threshold && deltaY < 50) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
          window.navigator?.vibrate?.(10);
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
          window.navigator?.vibrate?.(10);
        }
      }

      setTouchStart(null);
    },
    [touchStart, onSwipeLeft, onSwipeRight, threshold]
  );

  return {
    handleTouchStart,
    handleTouchEnd,
  };
}

/**
 * 🎯 HAPTIC FEEDBACK
 * Utilitaires pour les vibrations
 */
export const haptic = {
  light: () => window.navigator?.vibrate?.(10),
  medium: () => window.navigator?.vibrate?.(20),
  heavy: () => window.navigator?.vibrate?.([10, 20, 10]),
  success: () => window.navigator?.vibrate?.([10, 50, 10]),
  error: () => window.navigator?.vibrate?.([50, 20, 50]),
};

/**
 * 🔢 VIEW COUNTER Display
 */
interface ViewCounterProps {
  count: number;
  className?: string;
}

export function ViewCounter({ count, className = '' }: ViewCounterProps) {
  const formatCount = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <span className={`view-counter ${className}`}>
      👁️ {formatCount(count)}
    </span>
  );
}
