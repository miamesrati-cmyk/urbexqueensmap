# ⚡ Test de Performance - Guide Rapide

## 🎯 Comment vérifier que le lag est éliminé

### Test Visuel (30 secondes)

1. **Ouvre la map** dans Chrome
2. **Pan rapide** (clic + drag dans toutes les directions)
3. **Zoom in/out** répété avec molette
4. **Observe** : Doit être fluide, pas de "saccades"

**Avant** : Sensation de lourdeur, frame drops visibles
**Après** : Fluide comme Google Maps

---

## 🔬 Test Chrome DevTools (2 minutes)

### 1. Ouvrir Performance Panel

```
Chrome DevTools → Performance tab → Record (●)
Pan/zoom sur la map pendant 5-10 secondes
Stop recording
```

### 2. Vérifier les métriques

**FPS Graph** (en haut) :
- ✅ **Bon** : Ligne verte stable ~60 FPS
- ❌ **Mauvais** : Ligne rouge qui descend à 20-30 FPS

**Flame Chart** :
- ✅ **Bon** : Frames courtes (~16ms)
- ❌ **Mauvais** : Frames longues (> 50ms) en rouge

**Main Thread** :
- ✅ **Bon** : Scripting < 10ms par frame
- ❌ **Mauvais** : Scripting > 50ms par frame

---

## 🧪 Tests Spécifiques

### Test A : Data Update (CRITIQUE)

**Objectif** : Vérifier que liker un spot ne cause pas de lag

1. Ouvre la console : `F12`
2. Colle ce code :

```javascript
// Mesure le temps d'update
let updates = [];
const originalSetData = mapboxgl.GeoJSONSource.prototype.setData;
mapboxgl.GeoJSONSource.prototype.setData = function(data) {
  const start = performance.now();
  originalSetData.call(this, data);
  const duration = performance.now() - start;
  updates.push(duration);
  console.log(`⚡ setData: ${duration.toFixed(2)}ms (avg: ${(updates.reduce((a,b)=>a+b,0)/updates.length).toFixed(2)}ms)`);
};
```

3. **Like plusieurs spots** rapidement
4. **Observe la console** :
   - ✅ **Bon** : < 10ms par update
   - ❌ **Mauvais** : > 50ms par update

---

### Test B : Clustering Toggle

**Objectif** : Vérifier que le toggle ne casse rien

1. **Click CLUSTER button** → ON
2. **Pan/zoom** pendant 10 sec
3. **Click CLUSTER button** → OFF
4. **Pan/zoom** à nouveau

**Résultat attendu** :
- Toggle prend ~150ms (normal)
- Pan/zoom fluide dans les 2 modes
- Pas d'erreur console

---

### Test C : Filter Rapid Toggle

**Objectif** : Vérifier que les filtres n'impactent pas la perf

1. **Toggle EPIC filter** : ON → OFF → ON → OFF (rapide)
2. **Toggle GHOST filter** : ON → OFF → ON → OFF (rapide)
3. **Les deux ensemble** : ON → OFF

**Résultat attendu** :
- Changements instantanés
- Pas de freeze
- Map reste fluide

---

## 📊 Benchmark Automatique (Optionnel)

### Script de test performance

Copie dans la console Chrome :

```javascript
async function benchmarkMapPerformance() {
  console.log('🚀 Starting performance benchmark...');
  
  // Test 1: Data updates
  console.log('\n📦 Test 1: Data Update Speed');
  const map = window.mapInstance; // Assume map is exposed
  const source = map.getSource('uq-spots-source');
  
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    source.setData(source._data); // Re-set same data
    const duration = performance.now() - start;
    times.push(duration);
    await new Promise(r => setTimeout(r, 100));
  }
  
  const avg = times.reduce((a,b) => a+b, 0) / times.length;
  const max = Math.max(...times);
  
  console.log(`Average: ${avg.toFixed(2)}ms`);
  console.log(`Max: ${max.toFixed(2)}ms`);
  console.log(avg < 10 ? '✅ EXCELLENT' : avg < 30 ? '⚠️ OK' : '❌ PROBLÈME');
  
  // Test 2: FPS during pan
  console.log('\n🎬 Test 2: FPS During Pan');
  let frames = 0;
  let lastTime = performance.now();
  const duration = 3000; // 3 seconds
  
  const countFrames = () => {
    frames++;
    if (performance.now() - lastTime < duration) {
      requestAnimationFrame(countFrames);
    } else {
      const fps = frames / (duration / 1000);
      console.log(`FPS: ${fps.toFixed(1)}`);
      console.log(fps > 55 ? '✅ EXCELLENT' : fps > 40 ? '⚠️ OK' : '❌ PROBLÈME');
    }
  };
  
  // Simulate pan (if auto-pan available)
  console.log('Pan the map manually NOW...');
  requestAnimationFrame(countFrames);
}

benchmarkMapPerformance();
```

**Interprétation** :
- Data Update < 10ms : ✅ Excellent
- Data Update 10-30ms : ⚠️ OK mais peut être mieux
- Data Update > 30ms : ❌ Problème
- FPS > 55 : ✅ Excellent
- FPS 40-55 : ⚠️ OK
- FPS < 40 : ❌ Problème

---

## 🎥 Checklist Utilisateur

**Sensation de fluidité** (ce que l'utilisateur ressent) :

- [ ] Pan répond instantanément (pas de délai)
- [ ] Zoom est smooth (pas de saccades)
- [ ] Pins apparaissent sans freeze
- [ ] Clustering toggle est rapide
- [ ] Filtres répondent instantanément
- [ ] Like un spot ne cause pas de lag
- [ ] Aucun stutter visible pendant l'utilisation normale

**Si TOUS cochés** → ✅ Performance excellente, prêt à déployer

**Si 1-2 non cochés** → ⚠️ Investiguer les cas spécifiques

**Si 3+ non cochés** → ❌ Problème à résoudre

---

## 🔍 Debugging Si Lag Persiste

### 1. Vérifier le nombre de spots

```javascript
// Dans la console
const source = map.getSource('uq-spots-source');
const data = source._data;
console.log('Nombre de features:', data.features.length);
```

**Limite recommandée** :
- < 500 spots : Devrait être fluide
- 500-1000 spots : OK avec optimisations
- > 1000 spots : Considérer clustering obligatoire

### 2. Vérifier les layers

```javascript
// Dans la console
const layers = map.getStyle().layers;
const spotLayers = layers.filter(l => l.id.includes('spot') || l.id.includes('cluster'));
console.log('Layers actives:', spotLayers.map(l => l.id));
```

**Nombre attendu** :
- Sans clustering : 2 layers (`spots-circle`, `spots-icon`)
- Avec clustering : 4 layers (+ `clusters`, `cluster-count`)

**Si plus** → Duplicate layers, problème de cleanup

### 3. Vérifier les rebuilds inutiles

```javascript
// Hook sur removeLayer (avant les optimisations)
let removeCount = 0;
const original = map.removeLayer.bind(map);
map.removeLayer = function(id) {
  removeCount++;
  console.warn(`⚠️ Layer removed (#${removeCount}):`, id);
  return original(id);
};

// Pan/zoom pendant 10 sec
// Si removeCount > 5 → Rebuilds inutiles détectés
```

---

## 📈 Métriques de Succès

### Performance Targets

| Métrique | Target | Critique |
|----------|--------|----------|
| Data update | < 10ms | < 30ms |
| FPS (pan) | > 55 | > 40 |
| Toggle cluster | < 200ms | < 500ms |
| Filter toggle | < 50ms | < 150ms |
| Layer rebuilds | 0-1/session | < 5/session |

### User Experience Targets

| Critère | Target |
|---------|--------|
| "Feels smooth" | > 90% users |
| "No lag noticed" | > 85% users |
| "Better than before" | > 95% users |
| Bounce rate | < 30% |
| Avg session time | > 3 min |

---

## ✅ Validation Finale

**Checklist avant déploiement** :

- [ ] Build successful (pas d'erreurs TypeScript)
- [ ] Tests visuels passés (fluidité confirmée)
- [ ] Chrome DevTools : FPS > 55
- [ ] Console : Pas d'erreurs/warnings
- [ ] Data updates < 10ms
- [ ] Clustering toggle fonctionne
- [ ] Filtres fonctionnent
- [ ] Pas de breaking changes

**Si TOUS cochés** → 🚀 **READY TO DEPLOY**

---

## 🎉 Expected Results

Après déploiement, tu devrais observer :

1. **Feedback utilisateurs** : "La map est beaucoup plus fluide !"
2. **Metrics** : 
   - Session time ↑ +15-30%
   - Bounce rate ↓ -10-20%
   - Interactions/session ↑ +20-40%
3. **Qualitative** :
   - Moins de plaintes de lag
   - Plus d'engagement avec la map
   - Meilleure rétention

**Performance = Rétention** ✨
