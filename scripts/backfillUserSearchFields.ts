import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { backfillUserSearchFields } from "../src/services/userProfiles";

async function main() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "urbexqueenscanada.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.error("Missing Firebase env vars. Set VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_APP_ID");
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const updated = await backfillUserSearchFields(db);
  console.log(`Backfill terminé. Utilisateurs mis à jour: ${updated}`);
}

main().catch((err) => {
  console.error("Backfill échoué", err);
  process.exit(1);
});
