import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import { captureException } from "../lib/monitoring";

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
  try {
    const docRef = await addDoc(sessionsRef, {
      ...payload,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[saveDarkEntrySession] permission-denied`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
