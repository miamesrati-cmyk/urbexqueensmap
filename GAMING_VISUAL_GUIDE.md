# 🎮 Gaming-Urbex Visual System - Integration Guide

## 🎨 What's Included

This gaming-inspired visual system adds cyberpunk aesthetics to your urbex platform:

### Components Created:
1. **`src/styles/gaming-urbex.css`** - Complete CSS framework with neon colors, glows, animations
2. **`src/components/GamingEffects.tsx`** - React components for visual effects
3. **`src/pages/GamingStyleDemo.tsx`** - Full demo page showing all components

### Visual Features:
- 🌈 **Neon color palette**: Pink, cyan, purple, green, orange glows
- ✨ **Particle system**: Floating animated particles
- 📺 **CRT effects**: Scanlines and film grain overlay
- 💫 **Glitch animations**: Text glitching, holographic effects
- 🎯 **HUD elements**: Gaming-style stats and displays
- 🔘 **Neon buttons**: Interactive buttons with glow effects
- 🎴 **Gaming cards**: Holographic hover effects
- ⚠️ **Risk indicators**: Animated danger levels
- 📊 **Progress bars**: Animated gradient fills
- 🖥️ **Terminal output**: Matrix-style console

---

## 🚀 Quick Start

### 1. View the Demo Page

Add this route to your router:

```tsx
// In your App.tsx or routes config
import GamingStyleDemo from './pages/GamingStyleDemo';

// Add route:
<Route path="/gaming-demo" element={<GamingStyleDemo />} />
```

Then visit: `http://localhost:5173/gaming-demo`

---

### 2. Add Global Effects

Wrap your app with gaming effects (scanlines, particles, grain):

```tsx
import { GamingEffects } from './components/GamingEffects';

function App() {
  return (
    <>
      <GamingEffects /> {/* Add this at root level */}
      <YourRoutes />
    </>
  );
}
```

---

### 3. Use Gaming Components

#### Glitch Title
```tsx
import { GlitchTitle } from './components/GamingEffects';

<GlitchTitle>URBEX QUEENS</GlitchTitle>
```

#### Neon Buttons
```tsx
import { NeonButton } from './components/GamingEffects';

<NeonButton variant="cyan" onClick={handleClick}>
  EXPLORER →
</NeonButton>

// Variants: 'pink' | 'cyan' | 'purple' | 'green'
```

#### Gaming Cards
```tsx
import { GamingCard } from './components/GamingEffects';

<GamingCard>
  <h3>Usine Désaffectée</h3>
  <p>Description...</p>
  <NeonButton>VOIR PLUS</NeonButton>
</GamingCard>
```

#### HUD Stats
```tsx
import { HudStat } from './components/GamingEffects';

<HudStat label="SPOTS" value="347" icon="📍" />
<HudStat label="EXPLORERS" value="12.5K" icon="👥" />
```

#### Risk Indicators
```tsx
import { RiskIndicator } from './components/GamingEffects';

<RiskIndicator level="high" />
// Levels: 'low' | 'medium' | 'high' | 'extreme'
```

#### Progress Bars
```tsx
import { GamingProgress } from './components/GamingEffects';

<GamingProgress value={75} /> {/* 0-100 */}
```

#### Badges
```tsx
import { CyberBadge } from './components/GamingEffects';

<CyberBadge variant="cyan">NOUVEAU</CyberBadge>
<CyberBadge variant="purple">POPULAIRE</CyberBadge>
```

---

## 🎯 Apply to Existing Pages

### Example: MapRoute.tsx

```tsx
import { GamingCard, NeonButton, HudStat } from './components/GamingEffects';

// Replace regular cards with GamingCard:
<GamingCard onClick={() => selectSpot(spot)}>
  <h3>{spot.title}</h3>
  <RiskIndicator level={spot.riskLevel} />
  <NeonButton variant="cyan">VOIR DÉTAILS</NeonButton>
</GamingCard>

// Replace stats display:
<div style={{ display: 'flex', gap: '20px' }}>
  <HudStat label="SPOTS" value={totalSpots} icon="📍" />
  <HudStat label="VUES" value={totalViews} icon="👁️" />
</div>
```

### Example: SpotPage.tsx

```tsx
import { GlitchTitle, GamingHud, NeonButton } from './components/GamingEffects';

// Replace title:
<GlitchTitle>{spot.title}</GlitchTitle>

// Wrap content in HUD:
<GamingHud>
  <h2>Informations</h2>
  <p>{spot.description}</p>
  <NeonButton variant="pink">AJOUTER AUX FAVORIS</NeonButton>
</GamingHud>
```

---

## 🎨 Customize Colors

Edit `src/styles/gaming-urbex.css` variables:

```css
:root {
  /* Change neon colors */
  --neon-pink: #ff2d95;
  --neon-cyan: #00f0ff;
  --neon-purple: #b537ff;
  --neon-green: #39ff14;
  
  /* Adjust glow intensity */
  --glow-pink: 0 0 20px rgba(255, 45, 149, 0.6);
  
  /* Control effects */
  --scanline-opacity: 0.08; /* Lower = less visible */
  --grain-opacity: 0.03;     /* Lower = less grainy */
}
```

---

## 🔧 Toggle Effects On/Off

### Disable Global Effects
Remove from App.tsx:
```tsx
// Comment out or remove:
// <GamingEffects />
```

### Disable Individual Effects
Edit `GamingEffects.tsx`:
```tsx
export function GamingEffects() {
  return (
    <>
      {/* <Scanlines /> */}        // Disable scanlines
      {/* <FilmGrain /> */}         // Disable grain
      <ParticlesBackground />      // Keep particles
    </>
  );
}
```

### Reduce Particle Count
In `GamingEffects.tsx`, line 30:
```tsx
{[...Array(10)].map(...)} // Change 20 to 10 or 5
```

---

## 📱 Mobile Optimization

The CSS is responsive, but you can disable heavy effects on mobile:

```tsx
import { useEffect, useState } from 'react';

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  return (
    <>
      {!isMobile && <GamingEffects />} {/* Desktop only */}
      <YourRoutes />
    </>
  );
}
```

---

## 🎮 Advanced: Custom Animations

### Add Your Own Glitch Effect
```css
@keyframes custom-glitch {
  0% { transform: translate(0); }
  33% { transform: translate(-2px, 2px); }
  66% { transform: translate(2px, -2px); }
  100% { transform: translate(0); }
}

.my-element {
  animation: custom-glitch 0.3s infinite;
}
```

### Create Custom Neon Color
```css
:root {
  --neon-yellow: #ffff00;
  --glow-yellow: 0 0 20px rgba(255, 255, 0, 0.6);
}

.neon-button.yellow {
  border-color: var(--neon-yellow);
  color: var(--neon-yellow);
  box-shadow: var(--glow-yellow);
}
```

---

## 🎯 Performance Tips

1. **Particle count**: Keep under 20 for smooth 60fps
2. **Scanlines**: Can disable on low-end devices
3. **Glitch animations**: Use sparingly on many elements
4. **HUD containers**: Limit blur effects on mobile

---

## 🚀 Deployment Checklist

- [x] Fonts loaded from Google Fonts (Orbitron, Rajdhani)
- [x] CSS imported in main.tsx
- [x] Components exported from GamingEffects.tsx
- [ ] Test on mobile devices
- [ ] Verify performance (60fps target)
- [ ] Check accessibility (contrast ratios)
- [ ] Test with real content

---

## 🎨 Design Philosophy

**Gaming-Urbex fusion:**
- **Dark brutalist backgrounds** → abandoned industrial feel
- **Neon accents** → urban exploration's flashlight/headlamp aesthetic
- **Glitch effects** → decay and deterioration
- **HUD elements** → exploration mission briefing
- **Scanlines/grain** → vintage camera/VHS found footage
- **Particles** → dust and debris in abandoned spaces

---

## 📚 Component API Reference

### GamingEffects
Props: None
```tsx
<GamingEffects />
```

### GlitchTitle
Props: `{ children: ReactNode }`
```tsx
<GlitchTitle>Text</GlitchTitle>
```

### NeonButton
Props: `{ children, onClick?, variant?, disabled?, className? }`
```tsx
<NeonButton variant="cyan" onClick={fn}>Click</NeonButton>
```

### GamingCard
Props: `{ children, className?, onClick? }`
```tsx
<GamingCard onClick={fn}>{content}</GamingCard>
```

### HudStat
Props: `{ label: string, value: string|number, icon?: ReactNode }`
```tsx
<HudStat label="COUNT" value={42} icon="🎯" />
```

### GamingProgress
Props: `{ value: number, className? }` (value 0-100)
```tsx
<GamingProgress value={75} />
```

### RiskIndicator
Props: `{ level: 'low'|'medium'|'high'|'extreme', label? }`
```tsx
<RiskIndicator level="high" />
```

### CyberBadge
Props: `{ children, variant?: 'purple'|'pink'|'cyan'|'green' }`
```tsx
<CyberBadge variant="cyan">NEW</CyberBadge>
```

### GamingHud
Props: `{ children, className? }`
```tsx
<GamingHud>{content}</GamingHud>
```

### TerminalOutput
Props: `{ lines: string[], className? }`
```tsx
<TerminalOutput lines={['Line 1', 'Line 2']} />
```

### DataGrid
Props: `{ children, columns?: number, className? }`
```tsx
<DataGrid columns={3}>{items}</DataGrid>
```

### GamingModal
Props: `{ isOpen: boolean, onClose: () => void, children, title? }`
```tsx
<GamingModal isOpen={true} onClose={fn} title="MISSION">
  Content
</GamingModal>
```

---

## 🎉 Next Steps

1. **Visit demo**: `/gaming-demo` route
2. **Pick 2-3 components** to try on your main pages
3. **Customize colors** to match your brand
4. **Test performance** on target devices
5. **Gradually migrate** existing UI elements

**Pro tip**: Start with buttons and titles, then expand to cards and effects!

---

Made with 💜 for Urbex Queens Montreal
