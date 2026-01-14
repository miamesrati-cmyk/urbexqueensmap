process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "urbexqueens-placeholder";
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9095";
process.env.FUNCTIONS_EMULATOR_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5002";

import admin from "firebase-admin";

const app = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = app.firestore();
const FieldValue = admin.firestore.FieldValue;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCount(
  uid: string,
  field: "followersCount" | "followingCount",
  target: number,
  timeoutMs = 10000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const doc = await db.collection("users").doc(uid).get();
    const value = doc.data()?.[field] ?? 0;
    if (value === target) {
      return value;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${field} on ${uid} to reach ${target}`);
}

async function resetUser(uid: string) {
  await db
    .collection("users")
    .doc(uid)
    .set({ followersCount: 0, followingCount: 0 }, { merge: true });
}

async function deleteFollowDocs(fromUid: string, toUid: string) {
  await Promise.all([
    db
      .collection("users")
      .doc(toUid)
      .collection("followers")
      .doc(fromUid)
      .delete(),
    db
      .collection("users")
      .doc(fromUid)
      .collection("following")
      .doc(toUid)
      .delete(),
  ]);
}

async function createFollowDocs(fromUid: string, toUid: string) {
  await Promise.all([
    db
      .collection("users")
      .doc(toUid)
      .collection("followers")
      .doc(fromUid)
      .create({ createdAt: FieldValue.serverTimestamp() })
      .catch(() => undefined),
    db
      .collection("users")
      .doc(fromUid)
      .collection("following")
      .doc(toUid)
      .create({ createdAt: FieldValue.serverTimestamp() })
      .catch(() => undefined),
  ]);
}

async function followDocsExist(fromUid: string, toUid: string) {
  const [followerSnap, followingSnap] = await Promise.all([
    db
      .collection("users")
      .doc(toUid)
      .collection("followers")
      .doc(fromUid)
      .get(),
    db
      .collection("users")
      .doc(fromUid)
      .collection("following")
      .doc(toUid)
      .get(),
  ]);
  return followerSnap.exists && followingSnap.exists;
}

async function main() {
  const userA = "emu-test-userA";
  const userB = "emu-test-userB";

  console.log("Preparing users and ensuring clean counters.");
  await Promise.all([resetUser(userA), resetUser(userB)]);
  await deleteFollowDocs(userA, userB);

  console.log("First follow (A follows B): creating follower/following docs.");
  await createFollowDocs(userA, userB);

  await waitForCount(userB, "followersCount", 1);
  await waitForCount(userA, "followingCount", 1);
  console.log("Counts incremented; verifying notification appears.");

  const notificationsSnap = await db
    .collection("users")
    .doc(userB)
    .collection("notifications")
    .get();
  const followNotes = notificationsSnap.docs.filter(
    (doc) => doc.data().type === "follow"
  );
  if (followNotes.length === 0) {
    throw new Error("Expected follow notification for userB");
  }

  console.log("Simulating double follow (idempotence). This should not change counts.");
  await createFollowDocs(userA, userB);
  await waitForCount(userB, "followersCount", 1);
  await waitForCount(userA, "followingCount", 1);

  console.log("Rapid follow/unfollow loop to confirm counters stay consistent.");
  for (let pass = 0; pass < 3; pass += 1) {
    console.log(`Iteration ${pass + 1}: re-following.`);
    await deleteFollowDocs(userA, userB);
    await waitForCount(userB, "followersCount", 0);
    await waitForCount(userA, "followingCount", 0);
    await createFollowDocs(userA, userB);
    await waitForCount(userB, "followersCount", 1);
    await waitForCount(userA, "followingCount", 1);
    console.log("Now unfollowing quickly.");
    await deleteFollowDocs(userA, userB);
    await waitForCount(userB, "followersCount", 0);
    await waitForCount(userA, "followingCount", 0);
  }

  console.log("Offline retry scenario: delete without following and re-apply.");
  await deleteFollowDocs(userA, userB);
  await waitForCount(userB, "followersCount", 0);
  await waitForCount(userA, "followingCount", 0);
  await createFollowDocs(userA, userB);
  await waitForCount(userB, "followersCount", 1);
  await waitForCount(userA, "followingCount", 1);

  console.log("Cleaning up follower/following docs to finish.");
  await deleteFollowDocs(userA, userB);
  await waitForCount(userB, "followersCount", 0);
  await waitForCount(userA, "followingCount", 0);

  const finalExist = await followDocsExist(userA, userB);
  if (finalExist) {
    throw new Error("Follower/following documents still exist after cleanup.");
  }

  console.log("Emulator follow/unfollow validation passed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Emulator test failed:", error);
    process.exit(1);
  });
