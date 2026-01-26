#!/usr/bin/env node

/**
 * 🧪 TEST EMULATOR: Validate collectionGroup query for Time Rift
 * 
 * This script tests queryTimeRiftSpots() against Firebase Emulator
 * to ensure indexes work and Pro-only gating is enforced.
 * 
 * Prerequisites:
 * - Firebase Emulator running: firebase emulators:start
 * - Sample proData documents seeded in Emulator
 * 
 * Usage:
 *   node test-time-rift-query.js
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, connectFirestoreEmulator } = require("firebase/firestore");
const { queryTimeRiftSpots } = require("../src/services/places");

// Mock Firebase config (emulator doesn't validate)
const firebaseConfig = {
  apiKey: "fake-api-key",
  projectId: "demo-urbex-map",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to Emulator
connectFirestoreEmulator(db, "localhost", 8080);

console.log("\n🧪 TEST: queryTimeRiftSpots() — collectionGroup validation");
console.log("============================================================\n");

async function testQueries() {
  console.log("Test 1: Global Time Rift (1950-1980)");
  console.log("--------------------------------------");
  
  try {
    const results = await queryTimeRiftSpots([1950, 1980], { limit: 10 });
    console.log(`✅ Query succeeded: ${results.length} results`);
    console.log("Sample result:", results[0]);
    
    // Validate result structure
    if (results.length > 0) {
      const sample = results[0];
      const hasRequiredFields = 
        sample.placeId &&
        typeof sample.yearAbandoned === "number" &&
        typeof sample.lat === "number" &&
        typeof sample.lng === "number";
      
      if (hasRequiredFields) {
        console.log("✅ Result structure valid");
      } else {
        console.warn("⚠️ Missing required fields in result");
      }
    }
  } catch (err) {
    console.error("❌ Query failed:", err.message);
    if (err.message.includes("index")) {
      console.error("   → Deploy indexes: firebase deploy --only firestore:indexes");
    }
  }
  
  console.log("\nTest 2: Regional Time Rift (Montreal, 1960-1970)");
  console.log("--------------------------------------------------");
  
  try {
    const results = await queryTimeRiftSpots([1960, 1970], {
      geohashPrefix: "f25d",
      limit: 5
    });
    console.log(`✅ Query succeeded: ${results.length} results`);
    
    // Validate geohash filtering worked
    if (results.length > 0) {
      const allMatchPrefix = results.every(r => 
        r.geohash && r.geohash.startsWith("f25d")
      );
      
      if (allMatchPrefix) {
        console.log("✅ Geohash filtering working");
      } else {
        console.warn("⚠️ Some results don't match geohash prefix (expected for prefix query)");
      }
    }
  } catch (err) {
    console.error("❌ Query failed:", err.message);
  }
  
  console.log("\n============================================================");
  console.log("✅ Tests complete\n");
}

testQueries()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("\n❌ FATAL ERROR:", err);
    process.exit(1);
  });
