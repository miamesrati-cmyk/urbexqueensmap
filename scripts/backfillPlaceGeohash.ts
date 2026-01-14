import "dotenv/config";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { computeGeohash } from "../src/lib/geohash.ts";

async function backfillPlaceGeohashes(db: ReturnType<typeof getFirestore>) {
  const placesRef = collection(db, "places");
  const missingGeohashQuery = query(placesRef, where("geohash", "==", null));
  const snapshot = await getDocs(missingGeohashQuery);
  const totalSnapshot = await getDocs(placesRef);
  const missingCount = snapshot.size;
  const totalCount = totalSnapshot.size;
  const alreadyHasGeohash = Math.max(totalCount - missingCount, 0);
  console.log(
    "Places backfill summary:",
    `total=${totalCount}`,
    `missingGeohash=${missingCount}`,
    `alreadyHasGeohash=${alreadyHasGeohash}`
  );
  const updates: Promise<void>[] = [];
  let skippedCoords = 0;
  let sampleSkipped:
    | { id: string; fields: string[] }
    | null = null;
  snapshot.docs.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const lat = data.lat;
    const lng = data.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      skippedCoords += 1;
      if (!sampleSkipped) {
        const coordFields = Object.keys(data).filter((key) =>
          /lat|lng|latitude|longitude|location/i.test(key)
        );
        sampleSkipped = {
          id: docSnapshot.id,
          fields: coordFields,
        };
      }
      return;
    }
    const geohash = computeGeohash(lat, lng);
    if (!geohash) {
      return;
    }
    updates.push(updateDoc(docSnapshot.ref, { geohash }));
  });
  await Promise.all(updates);
  console.log(
    "Backfill stats:",
    `updates=${updates.length}`,
    `skippedCoords=${skippedCoords}`
  );
  if (sampleSkipped) {
    console.log(
      "Sample skipped doc due to missing coords:",
      sampleSkipped.id,
      "possible coord fields:",
      sampleSkipped.fields.length > 0
        ? sampleSkipped.fields
        : "<no coord-like fields detected>"
    );
  }
  return updates.length;
}

async function main() {
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      "urbexqueenscanada.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.error(
      "Missing Firebase env vars. Set VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_APP_ID"
    );
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const updated = await backfillPlaceGeohashes(db);
  console.log(`Backfill terminé. Places mises à jour: ${updated}`);
}

main().catch((error) => {
  console.error("Backfill géohash échoué", error);
  process.exit(1);
});
