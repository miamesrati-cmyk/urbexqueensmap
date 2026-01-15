import { useEffect, useRef, useState } from "react";

export function useInViewOnce<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { root: null, threshold: 0.12, ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, options]);

  return { ref, inView };
}
