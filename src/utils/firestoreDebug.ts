/**
 * Utilitaires de debug pour Firestore
 * Pour vider le cache en cas d'erreur "INTERNAL ASSERTION FAILED"
 */

export async function clearFirestoreCache(): Promise<boolean> {
  try {
    console.info("[Firestore Debug] Nettoyage du cache...");
    
    // Méthode 1: Supprimer les bases IndexedDB Firestore
    if ("databases" in indexedDB) {
      const dbs = await indexedDB.databases();
      for (const dbInfo of dbs) {
        if (dbInfo.name?.includes("firestore") || dbInfo.name?.includes("firebase")) {
          console.info(`[Firestore Debug] Suppression de ${dbInfo.name}`);
          indexedDB.deleteDatabase(dbInfo.name);
        }
      }
    }
    
    // Méthode 2: Nettoyer le localStorage aussi
    Object.keys(localStorage).forEach((key) => {
      if (key.includes("firebase") || key.includes("firestore")) {
        console.info(`[Firestore Debug] Suppression localStorage: ${key}`);
        localStorage.removeItem(key);
      }
    });
    
    console.info("[Firestore Debug] Cache nettoyé avec succès");
    console.info("[Firestore Debug] Rechargez la page pour appliquer les changements");
    return true;
  } catch (error) {
    console.error("[Firestore Debug] Erreur lors du nettoyage:", error);
    return false;
  }
}

export async function clearAndReload(): Promise<void> {
  await clearFirestoreCache();
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Exposer les fonctions globalement pour debug dans la console
if (typeof window !== "undefined") {
  (window as any).__firestoreDebug = {
    clearCache: clearFirestoreCache,
    clearAndReload: clearAndReload,
  };
  console.info("[Firestore Debug] Fonctions disponibles:");
  console.info("  - window.__firestoreDebug.clearCache()");
  console.info("  - window.__firestoreDebug.clearAndReload()");
}
