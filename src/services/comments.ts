import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type Comment = {
  id: string;
  placeId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: number;
  likedBy?: string[];
};

const COMMENTS = collection(db, "comments");

export function listenComments(
  placeId: string,
  cb: (comments: Comment[]) => void
) {
  const q = query(
    COMMENTS,
    where("placeId", "==", placeId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const out: Comment[] = [];
    snap.forEach((d) => {
      const x: any = d.data();
      out.push({
        id: d.id,
        placeId: x.placeId,
        userId: x.userId,
        displayName: x.displayName ?? "explorateur",
        text: x.text ?? "",
        createdAt: x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now(),
        likedBy: x.likedBy ?? [],
      });
    });
    cb(out);
  });
}

export async function addComment(input: {
  placeId: string;
  userId: string;
  displayName: string;
  text: string;
}) {
  ensureWritesAllowed();
  await addDoc(COMMENTS, {
    placeId: input.placeId,
    userId: input.userId,
    displayName: input.displayName,
    text: input.text,
    createdAt: serverTimestamp(),
    likedBy: [],
    lastWriteTime: serverTimestamp(),
  });
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const ref = doc(COMMENTS, commentId);
  ensureWritesAllowed();
  await updateDoc(ref, {
    likedBy: arrayUnion(userId),
    lastWriteTime: serverTimestamp(),
  });
}

export async function removeCommentLike(commentId: string, userId: string) {
  const ref = doc(COMMENTS, commentId);
  ensureWritesAllowed();
  await updateDoc(ref, {
    likedBy: arrayRemove(userId),
    lastWriteTime: serverTimestamp(),
  });
}
