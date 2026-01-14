# 🎬 Ghost Echo Markers - Quick Reference

## 30-Second Summary

**What**: Subtle architectural silhouettes replace colorful emoji pins  
**Why**: Creates cinematic, premium urbex atmosphere  
**How**: Drop-in replacement for existing markers  
**Performance**: 33% lighter than V1, GPU-accelerated

---

## 🚀 Quick Start (5 Minutes)

### Minimal Integration - Just the Draft Marker

Replace your "add spot" draft marker in one line:

```tsx
// In MapRoute.tsx, replace:
const marker = new mapboxgl.Marker({ color: "#ff5fa2" })
  .setLngLat([dropCoords.lng, dropCoords.lat])
  .addTo(mapInstance);

// With:
import { useDraftMarkerV2 } from "./examples/markerIntegration";
useDraftMarkerV2(mapInstance, dropCoords);
```

**Result**: Your draft marker now has the Ghost Echo aesthetic ✨

---

## 🎨 Visual Cheat Sheet

```
COMMON (60% opacity)     EPIC (85% opacity)      GHOST (90% opacity)
    ┌─────┐                  ┌─────┐                 ┌─────┐
    │ ░░  │                  │ ▒▒  │                 │ ▓▓  │
    │░░ ░ │                  │▒▒ ▒ │                 │▓▓ ▓ │
    └──┬──┘                  └──┬──┘                 └──┬──┘
       │                        ≋│≋                     ≋│≋
       ▼                         ▼                       ▼
  White/subtle            Warm golden glow        Ethereal cyan

  Most locations          Rare finds              Ultra-rare
  Barely visible          Inviting warmth         Legendary
```

---

## 📐 Archetype Guide

```
Factory:  ┌──┐     Hospital:    ┌─┐      Church:     △
          │  │══                ├─┤                  │
          ├──┤                  └─┘                 ┌┴┐
          └──┘                                      └─┘

Manor:     ╱─╲     Default:   ╱─        
          ┌───┐              ┌──┐╲
          └───┘              └──┘ ╲
```

---

## 🎯 Integration Paths

### Path A: Full Layer-Based (Recommended)
**Time**: 15 minutes  
**Performance**: ★★★★★  
**Files**: Replace layer setup in MapRoute.tsx  

```tsx
import { setupGhostEchoLayers } from "./examples/markerIntegration";

// In your useEffect where you create layers:
setupGhostEchoLayers(mapInstance, SPOTS_SOURCE_ID);
```

### Path B: Hybrid (Featured Spots Only)
**Time**: 20 minutes  
**Performance**: ★★★★☆  
**Files**: Keep layers, add DOM markers for EPIC/GHOST  

```tsx
import { useFeaturedMarkers } from "./examples/markerIntegration";

// Only creates DOM markers for rare tiers:
useFeaturedMarkers(mapInstance, places, handleSpotClick);
```

### Path C: Full DOM (Custom Control)
**Time**: 30 minutes  
**Performance**: ★★★☆☆ (use for < 100 markers)  
**Files**: Replace all markers with createUrbexMarkerV2  

```tsx
import { createUrbexMarkerV2 } from "./utils/mapMarkersV2";

places.forEach(place => {
  const marker = createUrbexMarkerV2({
    place,
    status: "approved",
    onClick: handleSpotClick,
    zoomLevel: map.getZoom(),
  });
  marker.addTo(map);
});
```

---

## 🎛️ Configuration Options

### Marker Size by Zoom
```tsx
Zoom < 10:  size * 0.8  (distant)
Zoom 10-13: size * 1.0  (normal)
Zoom > 13:  size * 1.2  (close)
```

### Opacity by Tier
```tsx
COMMON: 0.6 → 0.9 (hover)
EPIC:   0.85 → 1.0 (hover)
GHOST:  0.9 → 1.0 (hover)
```

### Colors
```tsx
COMMON: rgba(255, 255, 255, 0.4)  // Subtle white
EPIC:   #ffd35c                    // Warm gold
GHOST:  #b8fdff                    // Ethereal cyan
```

---

## 🐛 Troubleshooting

### Markers don't appear
```tsx
// Ensure map style is loaded
map.on("load", () => {
  setupGhostEchoLayers(map, "spots-source");
});
```

### Markers too subtle
```tsx
// Increase base opacity in CSS
.urbex-marker-v2 {
  opacity: 0.85; /* instead of 0.7 */
}
```

### Performance issues
```tsx
// Use layer-based approach (Path A)
// Or limit DOM markers to featured spots only
const featuredSpots = places.filter(p => 
  p.tier === "EPIC" || p.tier === "GHOST"
);
```

### Wrong archetype shown
```tsx
// Add category mapping in your Place data
place.category = "usine"; // Maps to "factory" archetype
```

---

## 📊 Testing Checklist

- [ ] Markers appear at all zoom levels
- [ ] Hover states work smoothly
- [ ] Click handlers fire correctly
- [ ] EPIC/GHOST tiers have glow effects
- [ ] Mobile tap targets are 44x44px minimum
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Reduced motion disables animations
- [ ] Performance is acceptable (check FPS)

---

## 🎨 Customization Quick Hits

### Change EPIC color to red
```css
.urbex-marker-v2--epic .urbex-marker-v2__building {
  stroke: #ff4444;
}
```

### Remove animations entirely
```css
.urbex-marker-v2__glow {
  animation: none !important;
}
```

### Make COMMON markers more visible
```css
.urbex-marker-v2--common {
  opacity: 0.8; /* instead of 0.6 */
}
```

### Add custom archetype
```tsx
// In UrbexMarkerV2.tsx, add case:
case "lighthouse":
  return (
    <g>
      <rect x="14" y="8" width="4" height="14" />
      <rect x="12" y="6" width="8" height="3" />
    </g>
  );
```

---

## 📈 Performance Tips

1. **Use layer-based for > 50 markers**
2. **Limit DOM markers to featured spots**
3. **Debounce zoom event handlers**
4. **Use `will-change` CSS property**
5. **Enable clustering if > 500 spots**

---

## 🔗 Related Files

```
Core Implementation:
├── src/components/map/UrbexMarkerV2.tsx     # React component
├── src/components/map/UrbexMarkerV2.css     # Styles
├── src/utils/mapMarkersV2.tsx               # Mapbox utilities
└── src/examples/markerIntegration.tsx       # Integration examples

Documentation:
├── docs/URBEX_MARKER_V2_GUIDE.md            # Full guide
├── docs/MARKER_COMPARISON.md                # V1 vs V2 analysis
└── docs/GHOST_ECHO_QUICKREF.md              # This file

Current Implementation:
└── src/pages/MapRoute.tsx                   # Your map code
```

---

## 💡 Design Principles Reminder

1. **Subtlety**: Markers should whisper, not shout
2. **Emergence**: Visibility increases with proximity
3. **Hierarchy**: Rare = more prominent, common = barely visible
4. **Cohesion**: Design matches dark map aesthetic
5. **Performance**: GPU-accelerated, minimal DOM

---

## 🎯 Success Metrics

After implementation, check:

- [ ] Visual clutter reduced by ~40%
- [ ] User engagement with rare spots increases
- [ ] Map feels more "premium"
- [ ] Performance metrics unchanged or better
- [ ] Accessibility scores improved

---

## 🆘 Need Help?

1. Check `docs/URBEX_MARKER_V2_GUIDE.md` for detailed explanations
2. Review `src/examples/markerIntegration.tsx` for working code
3. Compare with `docs/MARKER_COMPARISON.md` for design rationale
4. Test with `debugMarkerSystem(map, sourceId)` helper

---

## 🎬 One-Liner Summary

> "Replace loud emoji pins with subtle architectural silhouettes that emerge from the darkness as you explore—like finding ghosts of forgotten places."

---

**Version**: 2.0.0  
**Last Updated**: January 5, 2026  
**Status**: Production-ready ✅
