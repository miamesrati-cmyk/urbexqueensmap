declare global {
  interface Window {
    __UQ_RENDER_STATS__?: Record<string, number>;
  }
}

export {};
