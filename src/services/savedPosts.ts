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

export function listenSavedPostIds(
  userId: string,
  callback: (ids: string[]) => void
) {
  const savedCollection = collection(db, "users", userId, "savedPosts");
  const q = query(savedCollection, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const ids = snapshot.docs.map((document) => document.id);
      callback(ids);
    },
    (error: any) => {
      if (error?.code === "permission-denied") {
        if (import.meta.env.DEV) {
          console.warn("[savedPosts] listenSavedPostIds permission-denied (expected during boot/guest)");
        }
        callback([]);
      } else {
        console.error("[savedPosts] listenSavedPostIds error:", error);
        captureException(error);
        callback([]);
      }
    }
  );
}

export async function fetchSavedPostIdsForUser(userId: string): Promise<string[]> {
  const savedCollection = collection(db, "users", userId, "savedPosts");
  const q = query(savedCollection, orderBy("createdAt", "desc"));
  try {
    const snap = await getDocs(q);
    return snap.docs.map((doc) => doc.id);
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[fetchSavedPostIdsForUser] permission-denied: userId=${userId}`);
      }
      return [];
    }
    captureException(e);
    return [];
  }
}

export async function savePostForUser(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "users", userId, "savedPosts", postId);
  try {
    await setDoc(reference, { createdAt: serverTimestamp() }, { merge: true });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[savePostForUser] permission-denied: userId=${userId} postId=${postId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}

export async function unsavePostForUser(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "users", userId, "savedPosts", postId);
  try {
    await deleteDoc(reference);
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[unsavePostForUser] permission-denied: userId=${userId} postId=${postId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
