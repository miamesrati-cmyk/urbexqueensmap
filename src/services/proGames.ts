import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type DarkEntrySessionPayload = {
  ownerId: string;
  uid: string;
  location: string;
  discoveredIds: string[];
  tension: number;
  rank: string;
  durationMs: number;
  highlights: string[];
};

export async function saveDarkEntrySession(payload: DarkEntrySessionPayload) {
  ensureWritesAllowed();
  const sessionsRef = collection(db, "proGameSessions");
  const docRef = await addDoc(sessionsRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
