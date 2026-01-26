import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import { captureException } from "../lib/monitoring";

export function listenLikedPostIds(
  userId: string,
  callback: (ids: string[]) => void
) {
  const likedCollection = collection(db, "users", userId, "likedPosts");
  const q = query(likedCollection, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = snapshot.docs.map((document) => document.id);
      callback(ids);
    },
    (error: any) => {
      if (error?.code === "permission-denied") {
        if (import.meta.env.DEV) {
          console.warn("[postsLikes] listenLikedPostIds permission-denied (expected during boot/guest)");
        }
        callback([]);
      } else {
        console.error("[postsLikes] listenLikedPostIds error:", error);
        captureException(error);
        callback([]);
      }
    }
  );
}

export async function fetchLikedPostIdsForUser(userId: string): Promise<string[]> {
  const likedCollection = collection(db, "users", userId, "likedPosts");
  const q = query(likedCollection, orderBy("createdAt", "desc"));
  try {
    const snap = await getDocs(q);
    return snap.docs.map((document) => document.id);
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[fetchLikedPostIdsForUser] permission-denied: userId=${userId}`);
      }
      return [];
    }
    captureException(e);
    return [];
  }
}

export async function likePostForUser(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "users", userId, "likedPosts", postId);
  try {
    await setDoc(reference, { createdAt: serverTimestamp() }, { merge: true });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[likePostForUser] permission-denied: userId=${userId} postId=${postId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}

export async function unlikePostForUser(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "users", userId, "likedPosts", postId);
  try {
    await deleteDoc(reference);
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[unlikePostForUser] permission-denied: userId=${userId} postId=${postId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
