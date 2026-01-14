import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

const buildSha =
  process.env.VITE_BUILD_SHA ??
  process.env.GITHUB_SHA ??
  process.env.COMMIT_SHA ??
  process.env.VITE_COMMIT_SHA ??
  "local"
const buildTime = process.env.VITE_BUILD_TIME ?? new Date().toISOString()

export default defineConfig({
  define: {
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(buildSha),
    "import.meta.env.VITE_BUILD_TIME": JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    VitePWA({
      srcDir: "src",
      filename: "service-worker.js",
      strategies: "injectManifest",
      includeAssets: ["offline.html"],
      manifest: false,
      injectRegister: false,
      registerType: "prompt",
      injectManifest: {
        swSrc: "src/service-worker.ts",
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,pdf,woff2,woff,eot,ttf}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB pour permettre le bundle principal
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "scheduler"],
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 2600,
  },
})
