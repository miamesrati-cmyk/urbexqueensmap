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
import { captureException } from "../lib/monitoring";

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

  return onSnapshot(
    q,
    (snap) => {
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
          likedBy: Array.isArray(x.likedBy) ? x.likedBy : [],
        });
      });
      cb(out);
    },
    (error: any) => {
      if (error?.code === "permission-denied") {
        if (import.meta.env.DEV) {
          console.warn("[comments] listenComments permission-denied (expected for restricted spots)");
        }
        cb([]);
      } else {
        console.error("[comments] listenComments error:", error);
        captureException(error);
      }
    }
  );
}

export async function addComment(input: {
  placeId: string;
  userId: string;
  displayName: string;
  text: string;
}) {
  ensureWritesAllowed();
  try {
    await addDoc(COMMENTS, {
      placeId: input.placeId,
      userId: input.userId,
      displayName: input.displayName,
      text: input.text,
      createdAt: serverTimestamp(),
      likedBy: [],
      lastWriteTime: serverTimestamp(),
    });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[addComment] permission-denied: placeId=${input.placeId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const ref = doc(COMMENTS, commentId);
  ensureWritesAllowed();
  try {
    await updateDoc(ref, {
      likedBy: arrayUnion(userId),
      lastWriteTime: serverTimestamp(),
    });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[toggleCommentLike] permission-denied: commentId=${commentId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}

export async function removeCommentLike(commentId: string, userId: string) {
  const ref = doc(COMMENTS, commentId);
  ensureWritesAllowed();
  try {
    await updateDoc(ref, {
      likedBy: arrayRemove(userId),
      lastWriteTime: serverTimestamp(),
    });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[removeCommentLike] permission-denied: commentId=${commentId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
