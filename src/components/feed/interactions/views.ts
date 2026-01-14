import {
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { ensureWritesAllowed } from "../../../lib/securityGuard";

type PendingView = { userId: string; postId: string };

const pendingViews = new Map<string, PendingView>();
let flushTimer: number | null = null;

function scheduleFlush() {
  if (typeof window === "undefined") {
    flushTimer = null;
    flushPendingViews();
    return;
  }
  if (flushTimer !== null) {
    return;
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushPendingViews();
  }, 1200);
}

async function flushPendingViews() {
  if (pendingViews.size === 0) {
    return;
  }
  const entries = Array.from(pendingViews.values());
  pendingViews.clear();
  await Promise.all(
    entries.map(async ({ userId, postId }) => {
      try {
        ensureWritesAllowed();
        await setDoc(
          doc(db, "users", userId, "postViews", postId),
          { viewedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error("[postViews]", error);
      }
    })
  );
}

export function enqueueView(userId: string, postId: string) {
  const key = `${userId}-${postId}`;
  if (pendingViews.has(key)) {
    return;
  }
  pendingViews.set(key, { userId, postId });
  scheduleFlush();
}
