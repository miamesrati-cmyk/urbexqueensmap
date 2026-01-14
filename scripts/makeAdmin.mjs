#!/usr/bin/env node

/**
 * Script pour donner les droits admin à un utilisateur
 * Usage: node scripts/makeAdmin.mjs <email>
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
config({ path: join(__dirname, "../.env") });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: "urbexqueenscanada.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function makeAdmin(uid) {
  try {
    console.log(`Attribution des droits admin à ${uid}...`);
    
    await setDoc(
      doc(db, "users", uid),
      {
        isAdmin: true,
        roles: {
          admin: true,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    
    console.log("✅ Droits admin attribués avec succès !");
    console.log("   Rechargez la page pour appliquer les changements.");
    return true;
  } catch (error) {
    console.error("❌ Erreur lors de l'attribution des droits:", error);
    return false;
  }
}

// Récupérer l'UID depuis les arguments
const targetUid = process.argv[2];

if (!targetUid) {
  console.error("Usage: node scripts/makeAdmin.mjs <uid>");
  console.log("\nExemple: node scripts/makeAdmin.mjs AQqXqFOgu4aCRSDUAS8wwUZcJB53");
  process.exit(1);
}

makeAdmin(targetUid)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
