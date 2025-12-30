import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const LARGE_VENDOR_CHUNKS: Array<{ match: string; chunkName: string }> = [
  { match: "node_modules/mapbox-gl", chunkName: "vendor-mapbox" },
  { match: "node_modules/firebase", chunkName: "vendor-firebase" },
  { match: "node_modules/react-dom", chunkName: "vendor-react-dom" },
  { match: "node_modules/react", chunkName: "vendor-react" },
  { match: "node_modules/@stripe/stripe-js", chunkName: "vendor-stripe" },
  { match: "node_modules/axios", chunkName: "vendor-axios" },
  { match: "node_modules/quill", chunkName: "vendor-quill" },
  { match: "node_modules/uuid", chunkName: "vendor-uuid" },
]

const chunkMatchers: Array<{ test: (id: string) => boolean; name: string }> = [
  {
    test: (id) => id.includes("src/components/MapView") || id.includes("src/components/AdminDashboard"),
    name: "chunk.map-view",
  },
  {
    test: (id) => id.includes("src/components/SocialFeed"),
    name: "chunk.social-feed",
  },
  {
    test: (id) => id.includes("src/pages/EditHistoryView"),
    name: "chunk.edit-history",
  },
]

function getVendorChunkName(id: string) {
  for (const candidate of LARGE_VENDOR_CHUNKS) {
    if (id.includes(candidate.match)) {
      return candidate.chunkName
    }
  }
  return "vendor-core"
}

export default defineConfig({
  plugins: [react()],
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return getVendorChunkName(id)
          }

          for (const matcher of chunkMatchers) {
            if (matcher.test(id)) {
              return matcher.name
            }
          }
        },
      },
    },
  },
})
