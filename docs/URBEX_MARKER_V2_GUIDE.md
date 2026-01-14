# 🎬 Urbex Marker V2: "Ghost Echo" Design System

## 🎯 Design Philosophy

**Visual Metaphor**: Subtle architectural silhouettes that emerge from darkness like faint memories of abandoned structures.

### Core Principles

1. **Subtlety over Spectacle**
   - Markers don't compete with the map
   - Barely visible until you're close enough
   - Discovery feels organic, not forced

2. **Cinematic Mood**
   - Desaturated color palette
   - Soft glows, not harsh colors
   - Film grain texture for authenticity

3. **Architectural Storytelling**
   - Each archetype tells a different story
   - Building silhouettes evoke specific atmospheres
   - No cartoonish icons or emojis

4. **Contextual Hierarchy**
   - COMMON: Whispers in the dark
   - EPIC: Golden echoes of grandeur
   - GHOST: Ethereal cyan shimmer, ultra-rare

---

## 🏗️ Architecture Types

### Factory 🏭
- **Visual**: Horizontal industrial complex with chimney
- **Mood**: Industrial decay, post-apocalyptic
- **Use**: Abandoned factories, warehouses, industrial sites

### Hospital 🏥
- **Visual**: Symmetric institutional building with central tower
- **Mood**: Haunting, sterile emptiness
- **Use**: Hospitals, asylums, medical facilities

### Church ⛪
- **Visual**: Gothic spire and nave
- **Mood**: Spiritual desolation, forgotten faith
- **Use**: Churches, chapels, religious buildings

### Manor 🏰
- **Visual**: Estate with pitched roof and gables
- **Mood**: Faded opulence, aristocratic ruins
- **Use**: Mansions, estates, historic homes

### Default 🏚️
- **Visual**: Asymmetric, partially collapsed structure
- **Mood**: Generic abandonment, entropy
- **Use**: Unknown or mixed-category locations

---

## 🎨 Visual Hierarchy

### Tier System

```
COMMON (Default)
├─ Opacity: 60% idle → 90% hover
├─ Glow: Minimal white (12% opacity)
├─ Stroke: White, 40% opacity
└─ Visibility: Requires proximity to notice

EPIC (Rare)
├─ Opacity: 85% idle → 100% hover
├─ Glow: Warm golden (#ffd35c, 30% opacity)
├─ Stroke: Gold, pulsing animation
└─ Visibility: Noticeable from distance

GHOST (Ultra-Rare)
├─ Opacity: 90% idle → 100% hover
├─ Glow: Ethereal cyan (#b8fdff, 35% opacity)
├─ Stroke: Cyan, shimmering animation
└─ Visibility: Stands out dramatically
```

### Zoom-Based Adaptation

```
Distant (zoom < 10)
├─ Size: 80% of base
├─ Opacity: 50%
└─ Detail: Minimal stroke

Normal (zoom 10-13)
├─ Size: 100% of base
├─ Opacity: 70%
└─ Detail: Full rendering

Close (zoom > 13)
├─ Size: 120% of base
├─ Opacity: 90%
└─ Detail: Enhanced stroke + glow
```

---

## 📦 Implementation

### Quick Start

```tsx
import { createUrbexMarkerV2, updateMarkerForZoom } from "../utils/mapMarkersV2";
import { Place } from "../services/places";

// Create a marker
const marker = createUrbexMarkerV2({
  place: spotData,
  status: "approved",
  isPro: user.isPro,
  zoomLevel: map.getZoom(),
  onClick: (place) => {
    console.log("Clicked:", place.title);
    openSpotDetails(place);
  },
});

// Add to map
marker.addTo(map);

// Update on zoom (optional but recommended)
map.on("zoom", () => {
  const zoom = map.getZoom();
  updateMarkerForZoom(marker, zoom);
});
```

### Migration from V1

**Old approach (emoji pins):**
```tsx
// ❌ Old - emoji-based, cartoonish
<div className="urbex-marker">
  <svg>
    <text>🏚️</text>
  </svg>
</div>
```

**New approach (architectural silhouettes):**
```tsx
// ✅ New - architectural, cinematic
<UrbexMarkerV2
  tier="EPIC"
  archetype="factory"
  size={32}
  isPro={true}
/>
```

### Category Mapping

The system automatically maps place categories to archetypes:

```typescript
// Automatic mapping
const mapping = {
  usine: "factory",
  factory: "factory",
  hopital: "hospital",
  hospital: "hospital",
  eglise: "church",
  church: "church",
  manoir: "manor",
  manor: "manor",
  château: "manor",
  castle: "manor",
  // ... defaults to "default" for unknown
};
```

### Tier Detection

Tiers are auto-detected from place data:

```typescript
// Option 1: Explicit tier field
place.tier = "EPIC"; // or "GHOST"

// Option 2: Rarity field (alternative naming)
place.rarity = "LEGENDARY"; // maps to EPIC
place.rarity = "MYTHIC"; // maps to GHOST

// Option 3: Risk level fallback
place.riskLevel = "extreme"; // maps to EPIC

// Default: COMMON
```

---

## 🎯 UX Best Practices

### 1. **Emergent Visibility**
- Don't show all markers at once
- Fade in markers as users zoom closer
- Use opacity to create depth perception

```tsx
// Adjust marker opacity based on zoom
const getMarkerOpacity = (zoom: number) => {
  if (zoom < 9) return 0.3;  // Very distant
  if (zoom < 11) return 0.6; // Distant
  if (zoom < 13) return 0.8; // Normal
  return 1.0;                // Close
};
```

### 2. **Hover Feedback**
- Subtle scale (1.15x, not 1.5x)
- Smooth transitions (400ms cubic-bezier)
- Glow enhancement, not color change

### 3. **Click Target Size**
- Minimum 44x44px for mobile (accessibility)
- Add invisible padding if marker is smaller
- Use `cursor: pointer` for discoverability

### 4. **Performance Optimization**
- Use CSS transforms, not position changes
- Leverage `will-change` for hover states
- Limit simultaneous animations

```css
/* ✅ Good - GPU-accelerated */
.urbex-marker-v2:hover {
  transform: scale(1.15);
  opacity: 1;
}

/* ❌ Bad - triggers reflow */
.urbex-marker-v2:hover {
  width: 40px;
  height: 40px;
}
```

### 5. **Accessibility**
- Respect `prefers-reduced-motion`
- Provide keyboard navigation (Tab, Enter)
- Add ARIA labels for screen readers

```tsx
el.setAttribute("role", "button");
el.setAttribute("aria-label", `${place.title} - ${place.category}`);
el.setAttribute("tabindex", "0");
```

---

## 🎨 Customization

### Custom Colors

To match your brand or create special event markers:

```tsx
// Override tier colors in CSS
.urbex-marker-v2--halloween {
  --marker-glow: rgba(255, 100, 0, 0.4);
  --marker-stroke: #ff6400;
}

.urbex-marker-v2--halloween .urbex-marker-v2__building {
  stroke: var(--marker-stroke);
}
```

### Custom Archetypes

Add new building types in `UrbexMarkerV2.tsx`:

```tsx
case "lighthouse":
  return (
    <g>
      {/* Cylindrical tower */}
      <rect x="14" y="8" width="4" height="14" rx="2" />
      {/* Light room */}
      <rect x="12" y="6" width="8" height="3" />
    </g>
  );
```

### Animation Intensity

Adjust animation strength in CSS:

```css
/* Subtle (recommended) */
@keyframes epicPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

/* Dramatic (use sparingly) */
@keyframes epicPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}
```

---

## 🔧 Technical Details

### File Structure

```
src/
├── components/
│   └── map/
│       ├── UrbexMarkerV2.tsx      # React component
│       └── UrbexMarkerV2.css      # Styles
└── utils/
    └── mapMarkersV2.tsx           # Mapbox integration
```

### Dependencies

- `mapbox-gl`: ^3.0.0
- `react`: ^18.0.0
- `react-dom`: For `renderToString()`

### Performance Characteristics

- **Render time**: ~2ms per marker (SSR to string)
- **Memory**: ~1KB per marker instance
- **Animation cost**: Minimal (CSS-only, GPU-accelerated)
- **Recommended max markers**: 500-1000 simultaneous

### Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ IE11: Not supported (uses CSS filters)

---

## 🎬 Design Inspiration

This design system draws from:

- **Film Noir**: High contrast, desaturated palette
- **Brutalist Architecture**: Stark geometric forms
- **Ghost Signs**: Faded advertisements on old buildings
- **Urban Decay Photography**: Subtle textures, natural aging

### Reference Artists/Photographers

- **Edward Burtynsky**: Industrial landscapes
- **Alison Scarpulla**: Ethereal abandonment
- **Matthew Christopher**: Forgotten America series

---

## 🚀 Migration Checklist

Switching from emoji pins to Ghost Echo markers:

- [ ] Import new components and utilities
- [ ] Update marker creation to use `createUrbexMarkerV2()`
- [ ] Add zoom event handler for dynamic sizing
- [ ] Update popup styling to match dark aesthetic
- [ ] Test hover states and click interactions
- [ ] Verify mobile tap targets (44px minimum)
- [ ] Add keyboard navigation support
- [ ] Test with reduced motion enabled
- [ ] Optimize for your typical marker count

---

## 📊 A/B Testing Recommendations

If you want to validate this design with users:

### Metrics to Track

1. **Discoverability**: Time to first marker click
2. **Engagement**: Click-through rate on markers
3. **Preference**: User survey (1-5 scale)
4. **Performance**: Page load time, FPS during panning

### Test Variants

- **Control**: Current emoji pins
- **Variant A**: Ghost Echo with all animations
- **Variant B**: Ghost Echo with subtle animations only
- **Variant C**: Ghost Echo with no animations

### Success Criteria

- ↑ 15% increase in marker interactions
- ↓ 20% reduction in visual noise complaints
- → Same or better performance metrics

---

## 💡 Pro Tips

1. **Night Mode**: Markers are designed for dark maps (dark-v11)
2. **Clustering**: For high marker density, use Mapbox clustering
3. **LOD**: Hide COMMON markers at zoom < 11 for cleaner view
4. **Theming**: Add `.night-vision-active` class for enhanced glow
5. **Storytelling**: Use EPIC/GHOST tiers sparingly for impact

---

## 🐛 Troubleshooting

### Markers don't appear

```tsx
// Check if map style is loaded
map.on("load", () => {
  // Add markers here
});
```

### Performance issues with many markers

```tsx
// Use Mapbox clustering instead of individual markers
map.addSource("spots", {
  type: "geojson",
  data: geojsonData,
  cluster: true,
  clusterRadius: 50,
});
```

### Hover states not working

```css
/* Ensure pointer-events are enabled */
.urbex-marker-v2 {
  pointer-events: auto;
}
```

---

## 📞 Support

For questions or custom implementation help:
- Check `src/components/map/UrbexMarkerV2.tsx` for component source
- Review `src/utils/mapMarkersV2.tsx` for integration examples
- See `MapRoute.tsx` for current marker implementation patterns

---

**Last Updated**: January 5, 2026  
**Version**: 2.0.0  
**Status**: Production-ready ✅
