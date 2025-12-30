const STORM_LOGGING_ENABLED =
  Boolean(import.meta.env.DEV) ||
  import.meta.env.VITE_ENABLE_E2E_HOOKS === "1";

export function makeStormLogger<T>(name: string, summarize: (next: T) => unknown) {
  if (!STORM_LOGGING_ENABLED) {
    return () => {};
  }
  const calls: number[] = [];
  let lastWarn = 0;
  return (next: T) => {
    const now = Date.now();
    calls.push(now);
    if (calls.length > 30) {
      calls.shift();
    }
    if (calls.length >= 10) {
      const windowMs = calls[calls.length - 1] - calls[calls.length - 10];
      if (windowMs < 250 && now - lastWarn > 1500) {
        console.warn("[UQ][STATE_STORM]", name, {
          windowMs,
          sample: summarize(next),
        });
        console.trace("[UQ][STATE_STORM_TRACE]");
        lastWarn = now;
      }
    }
  };
}
