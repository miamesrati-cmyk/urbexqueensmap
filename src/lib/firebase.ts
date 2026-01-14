// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import type { AppCheck } from "firebase/app-check";
// AppCheck temporairement désactivé - imports commentés
// import { CustomProvider, initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "urbexqueenscanada.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ═══════════════════════════════════════════════════════════════
// APP CHECK (Temporairement désactivé pour v3.0)
// ═══════════════════════════════════════════════════════════════
// Status: Mode debug only (console + sessionStorage) ne nécessite pas App Check
// Activation: Après ship v3.0, voir APP_CHECK_SETUP.md
// ═══════════════════════════════════════════════════════════════
// APP CHECK (Temporairement désactivé pour v3.0)
// ═══════════════════════════════════════════════════════════════
// Status: Mode debug only (console + sessionStorage) ne nécessite pas App Check
// Activation: Après ship v3.0, voir APP_CHECK_SETUP.md
const appCheckInstance: AppCheck | null = null;

// NOTE: Pour réactiver App Check (post-v3.0):
// 1. Uncomment imports: initializeAppCheck, ReCaptchaV3Provider
// 2. Configurer reCAPTCHA site key (APP_CHECK_SETUP.md)
// 3. Uncomment code ci-dessous:
/*
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;

if (appCheckSiteKey) {
  const appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  console.log("[APP CHECK] Initialized successfully");
}
*/

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
export const appCheck = appCheckInstance;

// Fonction pour vider le cache Firestore en cas de problème
export async function clearFirestoreCache() {
  try {
    console.info("[Firebase] Nettoyage du cache Firestore...");
    // Nettoyer IndexedDB Firestore
    const dbs = await indexedDB.databases();
    for (const dbInfo of dbs) {
      if (dbInfo.name?.includes("firestore")) {
        console.info(`[Firebase] Suppression de ${dbInfo.name}`);
        indexedDB.deleteDatabase(dbInfo.name);
      }
    }
    console.info("[Firebase] Cache Firestore nettoyé");
    return true;
  } catch (error) {
    console.error("[Firebase] Erreur nettoyage cache:", error);
    return false;
  }
}

export default app;
