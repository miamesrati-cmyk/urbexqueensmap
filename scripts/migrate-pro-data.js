#!/usr/bin/env node

/**
 * 🔒 MIGRATION CRITIQUE: Séparer data Pro en sous-collection
 * 
 * Contexte:
 * - Avant: historyFull, yearAbandoned, yearLastSeen dans /places/{id}
 * - Après: ces fields dans /places/{id}/proData/main
 * - Raison: Firestore Rules ne peuvent pas masquer fields → contournement SDK possible
 * 
 * Ce script:
 * 1. Lit tous les documents places
 * 2. Pour chaque place avec fields Pro, crée /proData/main
 * 3. Supprime optionnellement les fields Pro du document principal (mode --cleanup)
 * 
 * Usage:
 *   node migrate-pro-data.js --dry-run       # Preview sans écrire
 *   node migrate-pro-data.js                 # Migration seule
 *   node migrate-pro-data.js --cleanup       # Migration + suppression fields originaux
 */

const admin = require("firebase-admin");
const path = require("path");

// =====================================================================
// CONFIGURATION
// =====================================================================

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT || "./serviceAccountKey.json";
const DRY_RUN = process.argv.includes("--dry-run");
const CLEANUP = process.argv.includes("--cleanup");

console.log("\n🔒 MIGRATION PRO DATA → SUBCOLLECTION");
console.log("=====================================");
console.log(`Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "LIVE MIGRATION"}`);
console.log(`Cleanup original fields: ${CLEANUP ? "YES" : "NO"}`);
console.log("");

// =====================================================================
// FIREBASE INIT
// =====================================================================

let serviceAccount;
try {
  serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH));
} catch (err) {
  console.error("❌ Service account key not found:", SERVICE_ACCOUNT_PATH);
  console.error("   Create one from Firebase Console → Project Settings → Service Accounts");
  console.error("   Save as serviceAccountKey.json (NOT committed to git)");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =====================================================================
// PRO FIELDS TO MIGRATE
// =====================================================================

const PRO_FIELDS = [
  "historyFull",
  "historyFullHtml",
  "yearAbandoned",
  "yearLastSeen",
  // Future fields:
  // "intel",
  // "decay",
];

// =====================================================================
// MIGRATION LOGIC
// =====================================================================

async function migratePlaces() {
  console.log("📊 Fetching all places...");
  const placesSnapshot = await db.collection("places").get();
  console.log(`Found ${placesSnapshot.size} places\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const placeDoc of placesSnapshot.docs) {
    const placeId = placeDoc.id;
    const placeData = placeDoc.data();

    // Check if place has any Pro fields
    const proData = {};
    let hasProData = false;

    for (const field of PRO_FIELDS) {
      if (placeData[field] !== undefined && placeData[field] !== null && placeData[field] !== "") {
        proData[field] = placeData[field];
        hasProData = true;
      }
    }

    if (!hasProData) {
      skippedCount++;
      continue;
    }

    // ✅ Place has Pro data → migrate
    console.log(`🔄 [${placeId}] Migrating Pro data:`);
    console.log(`   Fields: ${Object.keys(proData).join(", ")}`);

    if (!DRY_RUN) {
      try {
        // ✅ SCALABLE: Add queryable fields (placeId, geohash, lat, lng) for collectionGroup queries
        const proDataDoc = {
          ...proData,
          placeId: placeId, // ✅ Required for merging with public data
          geohash: placeData.geohash || null, // ✅ Enable geographic filtering (exact same format as places)
          lat: typeof placeData.lat === "number" ? placeData.lat : null, // ✅ Validated number type
          lng: typeof placeData.lng === "number" ? placeData.lng : null,
        };
        
        // 🔒 CRITICAL: Ensure yearAbandoned/yearLastSeen are numeric (not strings) for range queries
        if (proData.yearAbandoned !== undefined) {
          proDataDoc.yearAbandoned = typeof proData.yearAbandoned === "number" 
            ? proData.yearAbandoned 
            : parseInt(proData.yearAbandoned, 10) || null;
        }
        if (proData.yearLastSeen !== undefined) {
          proDataDoc.yearLastSeen = typeof proData.yearLastSeen === "number" 
            ? proData.yearLastSeen 
            : parseInt(proData.yearLastSeen, 10) || null;
        }
        
        const proDataRef = db.collection("places").doc(placeId).collection("proData").doc("main");
        await proDataRef.set(proDataDoc, { merge: true });

        // Optional: cleanup original fields
        if (CLEANUP) {
          const updates = {};
          for (const field of PRO_FIELDS) {
            if (placeData[field] !== undefined) {
              updates[field] = admin.firestore.FieldValue.delete();
            }
          }
          await db.collection("places").doc(placeId).update(updates);
          console.log(`   ✅ Migrated + cleaned up`);
        } else {
          console.log(`   ✅ Migrated (original fields kept)`);
        }

        migratedCount++;
      } catch (err) {
        console.error(`   ❌ Error:`, err.message);
        errors.push({ placeId, error: err.message });
      }
    } else {
      console.log(`   [DRY RUN] Would migrate`);
      migratedCount++;
    }
  }

  console.log("\n=====================================");
  console.log("📊 MIGRATION SUMMARY");
  console.log("=====================================");
  console.log(`Total places: ${placesSnapshot.size}`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Skipped (no Pro data): ${skippedCount}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n❌ ERRORS:");
    errors.forEach(({ placeId, error }) => {
      console.log(`   [${placeId}] ${error}`);
    });
  }

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. No data was written.");
    console.log("   Run without --dry-run to apply changes.");
  }

  console.log("\n✅ Migration complete");
}

// =====================================================================
// RUN
// =====================================================================

migratePlaces()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ FATAL ERROR:", err);
    process.exit(1);
  });
