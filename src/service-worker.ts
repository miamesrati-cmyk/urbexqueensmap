/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { ExpirationPlugin } from "workbox-expiration"
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies"

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<import("workbox-build").ManifestEntry>
}

const OFFLINE_FALLBACK = "/offline.html"
const BUILD_HASH =
  import.meta.env.VITE_COMMIT_SHA ??
  import.meta.env.VITE_COMMIT_REF ??
  `local-${Date.now().toString(36)}`
const CACHE_PREFIX = `urbex-v1-${BUILD_HASH}`

precacheAndRoute(self.__WB_MANIFEST)

const pageHandler = new NetworkFirst({
  cacheName: `${CACHE_PREFIX}-pages`,
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 }),
  ],
})

registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event, request }) => {
    const response = await pageHandler.handle({ event, request })
    if (response) {
      return response
    }
    const fallbackResponse = await caches.match(OFFLINE_FALLBACK)
    return (
      fallbackResponse ??
      new Response("offline", {
        status: 503,
        statusText: "off-line",
      })
    )
  }
)

const assetHandler = new StaleWhileRevalidate({
  cacheName: `${CACHE_PREFIX}-assets`,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
  ],
})

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    ["style", "script", "worker", "image", "font"].includes(request.destination),
  assetHandler
)

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
