import { useEffect, useRef, useState } from 'react';

/**
 * Hook pour pagination infinie optimisée
 * Charge progressivement les items au scroll
 */
export function useInfiniteScroll<T>(
  allItems: T[],
  initialBatchSize = 20,
  batchSize = 10
) {
  const [visibleCount, setVisibleCount] = useState(initialBatchSize);
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // Items visibles actuels
  const visibleItems = allItems.slice(0, visibleCount);
  const hasMore = visibleCount < allItems.length;
  
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => 
            Math.min(prev + batchSize, allItems.length)
          );
        }
      },
      { 
        rootMargin: '200px', // Charger avant d'atteindre le bas
        threshold: 0.1 
      }
    );
    
    observer.observe(sentinel);
    
    return () => {
      observer.disconnect();
    };
  }, [hasMore, batchSize, allItems.length]);
  
  // Reset quand les items changent (nouveau filtre, etc.)
  useEffect(() => {
    setVisibleCount(Math.min(initialBatchSize, allItems.length));
  }, [allItems, initialBatchSize]);
  
  return {
    visibleItems,
    hasMore,
    sentinelRef,
    totalCount: allItems.length,
    visibleCount,
  };
}
