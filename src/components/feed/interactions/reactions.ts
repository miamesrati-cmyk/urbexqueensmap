import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { ensureWritesAllowed } from "../../../lib/securityGuard";

export async function setReaction(
  userId: string,
  postId: string,
  emoji: string
) {
  ensureWritesAllowed();
  const reference = doc(db, "posts", postId, "reactions", userId);
  await setDoc(
    reference,
    {
      emoji,
      userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function clearReaction(userId: string, postId: string) {
  ensureWritesAllowed();
  const reference = doc(db, "posts", postId, "reactions", userId);
  await deleteDoc(reference);
}
