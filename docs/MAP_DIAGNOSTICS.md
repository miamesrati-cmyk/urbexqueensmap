# Map Diagnostics Guide

Use this checklist when validating the map failure overlay or debugging Mapbox issues (debug mode enabled via `localStorage.UQ_DEBUG_MAP = "1"`):

1. **Offline correlation** – Toggle the browser offline (or disable the network connection) and confirm the overlay says “Carte indisponible.” The “Réessayer” button should trigger a new initialization attempt once the connection is restored.
2. **Mapbox blocking** – Block `api.mapbox.com` (or return a 403/401) via devtools/network throttling or a blocking proxy so the style/token load fails. The overlay should surface the failure and the retry button should reattempt while a short cooldown state prevents spamming.
3. **Retry cooldown + clipboard** – Press “Réessayer” and wait for the short cooldown to expire (the button is always available but the diagnostics capture will log the cooldown flag). Use the debug-only **Copy diagnostics** action to copy the current state (style URL, online status, last load-state tick, canvas dimensions, and latest Mapbox error) so you can paste it into a bug report.
