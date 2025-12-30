#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [uidArg, flagArg, keyArg] = process.argv.slice(2);
const adminUid = uidArg || process.env.ADMIN_UID;
const serviceAccountPath =
  keyArg || process.env.FIREBASE_SERVICE_ACCOUNT || "./serviceAccountKey.json";
const shouldSetAdmin = flagArg !== "false";

if (!adminUid) {
  console.error("Usage: node scripts/setAdmin.js <uid> [true|false] [serviceAccountPath]");
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account file not found at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(path.resolve(serviceAccountPath), "utf-8")
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function run() {
  try {
    await db
      .doc(`users/${adminUid}`)
      .set({ isAdmin: shouldSetAdmin }, { merge: true });
    console.log(
      `Document users/${adminUid} updated with isAdmin=${shouldSetAdmin}`
    );
  } catch (err) {
    console.error("Erreur lors de la mise à jour de isAdmin", err);
    process.exit(1);
  } finally {
    await app.delete();
  }
}

run();
