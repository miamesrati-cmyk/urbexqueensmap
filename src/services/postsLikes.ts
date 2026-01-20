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

export function listenLikedPostIds(
  userId: string,
  callback: (ids: string[]) => void
) {
  const likedCollection = collection(db, "users", userId, "likedPosts");
  const q = query(likedCollection, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const ids = snapshot.docs.map((document) => document.id);
    callback(ids);
  });
}

export async function fetchLikedPostIdsForUser(userId: string): Promise<string[]> {
  const likedCollection = collection(db, "users", userId, "likedPosts");
  const q = query(likedCollection, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((document) => document.id);
}

export async function likePostForUser(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "users", userId, "likedPosts", postId);
  await setDoc(reference, { createdAt: serverTimestamp() }, { merge: true });
}

export async function unlikePostForUser(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "users", userId, "likedPosts", postId);
  await deleteDoc(reference);
}
