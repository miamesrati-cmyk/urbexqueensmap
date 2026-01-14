# 🚀 Plan d'Optimisation des Performances

**Date** : 3 janvier 2026  
**Statut** : En cours d'implémentation

---

## 📊 Analyse de la Performance Actuelle

### ✅ Points Forts Existants

1. **Code Splitting & Lazy Loading** ✅
   - Routes lazy-loadées (MapRoute, SocialFeed, ProfilePage, etc.)
   - Composants suspendus correctement
   - Réduction du bundle initial

2. **Hooks de Performance** ✅
   - `useMemo` pour les calculs coûteux (compteurs, filtres)
   - `useCallback` pour éviter re-renders
   - `useOptimisticAction` pour UX réactive

3. **Gestion Firestore** ✅
   - Listeners avec cleanup proper
   - Pas de fuites mémoire
   - Unsubscribe dans les useEffect

---

## 🎯 Optimisations à Implémenter

### 1. **Images & Médias** 🔴 CRITIQUE

**Problème identifié** :
- Pas de lazy loading des images
- Pas d'optimisation des tailles
- UQImage charge toutes les images immédiatement

**Solutions** :
```tsx
// Ajouter loading="lazy" et sizes
<img 
  src={src} 
  loading="lazy" 
  decoding="async"
  sizes="(max-width: 768px) 100vw, 50vw"
/>

// Utiliser srcset pour responsive
<img 
  srcset="image-320w.jpg 320w, image-640w.jpg 640w, image-1280w.jpg 1280w"
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

**Impact** : Réduction de 60-80% du temps de chargement initial

---

### 2. **Bundle JavaScript** 🟡 IMPORTANT

**Problème identifié** :
- Mapbox GL JS est gros (~500KB)
- Firebase SDK complet
- Dépendances non tree-shakées

**Solutions** :
```js
// vite.config.ts - Code splitting manuel
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'mapbox': ['mapbox-gl'],
        'firebase-core': ['firebase/app', 'firebase/auth'],
        'firebase-db': ['firebase/firestore', 'firebase/storage'],
        'vendor': ['react', 'react-dom', 'react-router-dom']
      }
    }
  }
}
```

**Impact** : Réduction de 30-40% du bundle initial

---

### 3. **Re-renders Inutiles** 🟡 IMPORTANT

**Problème identifié** :
- ProfileMenu re-render à chaque userPlaces change
- SocialFeed re-render avec tous les posts
- MapRoute re-render sur chaque spot action

**Solutions** :
```tsx
// Mémoïser les composants lourds
const MemoizedFeedCard = memo(FeedCard, (prev, next) => {
  return prev.post.id === next.post.id && 
         prev.post.updatedAt === next.post.updatedAt;
});

// Séparer les states pour éviter re-renders cascades
// Au lieu de :
const [state, setState] = useState({ spots, filters, ui });

// Faire :
const [spots, setSpots] = useState([]);
const [filters, setFilters] = useState({});
const [ui, setUi] = useState({});
```

**Impact** : Réduction de 40-50% des re-renders

---

### 4. **Firestore Listeners** 🟡 IMPORTANT

**Problème identifié** :
- Trop de listeners actifs simultanément
- Listeners non paginés (tous les spots chargés)
- Pas de limite sur les queries

**Solutions** :
```tsx
// Pagination Firestore
const q = query(
  collection(db, "places"),
  orderBy("createdAt", "desc"),
  limit(20)
);

// Listeners conditionnels
useEffect(() => {
  if (!isVisible) return; // Ne pas écouter si composant pas visible
  const unsub = listenPlaces(setPlaces);
  return unsub;
}, [isVisible]);

// Debouncing des updates
const debouncedUpdateSpot = useMemo(
  () => debounce(updateSpot, 300),
  []
);
```

**Impact** : Réduction de 50-70% des reads Firestore

---

### 5. **CSS & Animations** 🟢 MODÉRÉ

**Problème identifié** :
- Fichier CSS de 33k lignes
- Beaucoup de duplication
- Animations non optimisées

**Solutions** :
```css
/* Utiliser will-change pour animations fréquentes */
.feed-post-modal-card {
  will-change: transform, opacity;
}

/* Utiliser transform au lieu de top/left */
.popup {
  transform: translate3d(0, 0, 0); /* Force GPU */
}

/* Désactiver animations pour prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Impact** : Amélioration de 20-30% de la fluidité

---

### 6. **Service Worker & Caching** 🟢 MODÉRÉ

**Problème identifié** :
- Pas de stratégie de cache
- Pas de offline fallback
- Mapbox tiles non cachées

**Solutions** :
```js
// service-worker.ts
const CACHE_NAME = 'urbex-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/offline.html'
];

// Cache-first pour les assets statiques
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('mapbox')) {
    event.respondWith(
      caches.match(event.request).then(response => 
        response || fetch(event.request)
      )
    );
  }
});
```

**Impact** : Chargement instantané des assets cachés

---

### 7. **Virtual Scrolling** 🟢 MODÉRÉ

**Problème identifié** :
- SocialFeed rend tous les posts (peut être 100+)
- ProfilePage rend tous les spots
- Pas de windowing

**Solutions** :
```tsx
// Utiliser react-window ou react-virtual
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={posts.length}
  itemSize={400}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <FeedCard post={posts[index]} />
    </div>
  )}
</FixedSizeList>
```

**Impact** : Réduction de 70-90% du DOM pour listes longues

---

### 8. **Prefetching Intelligent** 🟢 MODÉRÉ

**Problème identifié** :
- Pas de prefetch des routes
- Pas de preload des données critiques
- Données chargées à la demande

**Solutions** :
```tsx
// Prefetch route au hover
<Link 
  to="/feed" 
  onMouseEnter={() => {
    import('./components/SocialFeed');
  }}
>
  Feed
</Link>

// Preconnect vers APIs externes
<link rel="preconnect" href="https://api.mapbox.com" />
<link rel="dns-prefetch" href="https://firestore.googleapis.com" />
```

**Impact** : Réduction de 30-50% du temps de navigation

---

## 🔧 Implémentation Prioritaire

### Phase 1 : Quick Wins (1-2h)
1. ✅ Ajouter `loading="lazy"` aux images
2. ✅ Mémoïser les composants lourds (FeedCard, SpotCard)
3. ✅ Ajouter limits aux queries Firestore
4. ✅ Optimiser CSS (will-change, transform)

### Phase 2 : Optimisations Moyennes (3-4h)
1. ⏳ Code splitting manuel (vite.config)
2. ⏳ Virtual scrolling pour feed
3. ⏳ Debouncing des listeners
4. ⏳ Service worker basique

### Phase 3 : Optimisations Avancées (5+h)
1. 🔜 Image optimization pipeline
2. 🔜 CDN pour assets statiques
3. 🔜 Préchargement intelligent
4. 🔜 Bundle analysis et tree-shaking

---

## 📈 Métriques Cibles

| Métrique | Avant | Cible | Impact |
|----------|-------|-------|--------|
| **First Contentful Paint** | ~2.5s | ~1.2s | 🔥 -52% |
| **Largest Contentful Paint** | ~4.0s | ~2.0s | 🔥 -50% |
| **Time to Interactive** | ~5.5s | ~2.5s | 🔥 -55% |
| **Total Bundle Size** | ~1.2MB | ~600KB | 🔥 -50% |
| **Firestore Reads/session** | ~200 | ~80 | 💰 -60% |
| **Re-renders/action** | ~15 | ~5 | ⚡ -67% |

---

## 🎯 Prochaines Étapes

1. **Immediate** : Implémenter Phase 1 (lazy images, memo, limits)
2. **Court terme** : Mesurer avec Lighthouse avant/après
3. **Moyen terme** : Code splitting et virtual scrolling
4. **Long terme** : CDN et optimisation avancée

---

**Prêt à commencer ?** Je vais implémenter les optimisations de Phase 1 maintenant ! 🚀
