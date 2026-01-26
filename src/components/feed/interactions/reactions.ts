import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { ensureWritesAllowed } from "../../../lib/securityGuard";
import { captureException } from "../../../lib/monitoring";

export async function setReaction(
  userId: string,
  postId: string,
  emoji: string
) {
  ensureWritesAllowed();
  const reference = doc(db, "posts", postId, "reactions", userId);
  try {
    await setDoc(
      reference,
      {
        emoji,
        userId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[setReaction] permission-denied: ${reference.path}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}

export async function clearReaction(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "posts", postId, "reactions", userId);
  try {
    await deleteDoc(reference);
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[clearReaction] permission-denied: ${reference.path}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
