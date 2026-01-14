import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Handles follower/following counter updates via transactions
 * to prevent race conditions
 */

export const onFollowCreate = functions.firestore
  .document("follows/{followId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const { fromUid, toUid } = data;
    if (!fromUid || !toUid) {
      functions.logger.warn("Missing fromUid or toUid in follow document", {
        followId: snap.id,
      });
      return;
    }

    try {
      await db.runTransaction(async (tx) => {
        const fromRef = db.collection("users").doc(fromUid);
        const toRef = db.collection("users").doc(toUid);

        tx.update(fromRef, {
          followingCount: admin.firestore.FieldValue.increment(1),
        });
        tx.update(toRef, {
          followersCount: admin.firestore.FieldValue.increment(1),
        });
      });

      functions.logger.info("Follow counters incremented", {
        fromUid,
        toUid,
        followId: snap.id,
      });
    } catch (error) {
      functions.logger.error("Failed to increment follow counters", {
        error,
        fromUid,
        toUid,
        followId: snap.id,
      });
    }
  });

export const onFollowDelete = functions.firestore
  .document("follows/{followId}")
  .onDelete(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const { fromUid, toUid } = data;
    if (!fromUid || !toUid) {
      functions.logger.warn("Missing fromUid or toUid in deleted follow document", {
        followId: snap.id,
      });
      return;
    }

    try {
      await db.runTransaction(async (tx) => {
        const fromRef = db.collection("users").doc(fromUid);
        const toRef = db.collection("users").doc(toUid);

        // Read current values to prevent negative counts
        const fromDoc = await tx.get(fromRef);
        const toDoc = await tx.get(toRef);

        const currentFollowing = fromDoc.data()?.followingCount ?? 0;
        const currentFollowers = toDoc.data()?.followersCount ?? 0;

        // Only decrement if current value > 0
        if (currentFollowing > 0) {
          tx.update(fromRef, {
            followingCount: admin.firestore.FieldValue.increment(-1),
          });
        }
        if (currentFollowers > 0) {
          tx.update(toRef, {
            followersCount: admin.firestore.FieldValue.increment(-1),
          });
        }
      });

      functions.logger.info("Follow counters decremented", {
        fromUid,
        toUid,
        followId: snap.id,
      });
    } catch (error) {
      functions.logger.error("Failed to decrement follow counters", {
        error,
        fromUid,
        toUid,
        followId: snap.id,
      });
    }
  });
