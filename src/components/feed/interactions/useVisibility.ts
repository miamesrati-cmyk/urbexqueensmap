import { useEffect, type RefObject } from "react";

type VisibilityCallback = (entry: IntersectionObserverEntry) => void;

type ObserverEntry = {
  observer: IntersectionObserver;
  callbacks: WeakMap<Element, VisibilityCallback>;
  count: number;
};

const observerRegistry = new Map<string, ObserverEntry>();

function stringifyOptions(options: IntersectionObserverInit) {
  const threshold =
    Array.isArray(options.threshold)
      ? options.threshold.join(",")
      : options.threshold ?? "0";
  const root = options.root ? "custom-root" : "default-root";
  return `${root}|${options.rootMargin ?? "0"}|${threshold}`;
}

function getObserverEntry(options: IntersectionObserverInit): ObserverEntry {
  const key = stringifyOptions(options);
  let entry = observerRegistry.get(key);
  if (!entry) {
    const callbacks = new WeakMap<Element, VisibilityCallback>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((intersection) => {
        const callback = callbacks.get(intersection.target);
        if (callback) {
          callback(intersection);
        }
      });
    }, options);
    entry = { observer, callbacks, count: 0 };
    observerRegistry.set(key, entry);
  }
  return entry;
}

export function useVisibility(
  ref: RefObject<Element | null>,
  options: IntersectionObserverInit,
  onChange: VisibilityCallback
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const entry = getObserverEntry(options);
    entry.callbacks.set(element, onChange);
    entry.count += 1;
    entry.observer.observe(element);

    return () => {
      entry.observer.unobserve(element);
      entry.callbacks.delete(element);
      entry.count -= 1;
      if (entry.count <= 0) {
        entry.observer.disconnect();
        observerRegistry.delete(stringifyOptions(options));
      }
    };
  }, [options, onChange, ref]);
}
