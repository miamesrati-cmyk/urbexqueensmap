import {
  addDoc,
  collection,
  doc,
  
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import { captureException } from "../lib/monitoring";

export type SpotPhoto = {
  id: string;
  url: string;
  uploadedByUid: string;
  uploadedAt: number;
};

function photosCollection(placeId: string) {
  return collection(doc(db, "places", placeId), "photos");
}

export function listenSpotPhotos(
  placeId: string,
  cb: (photos: SpotPhoto[]) => void
) {
  const q = query(photosCollection(placeId), orderBy("uploadedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const out: SpotPhoto[] = [];
      snap.forEach((d) => {
        const x: any = d.data();
        out.push({
          id: d.id,
          url: x.url,
          uploadedByUid: x.uploadedByUid,
          uploadedAt: x.uploadedAt?.toMillis?.() ?? x.uploadedAt ?? Date.now(),
        });
      });
      cb(out);
    },
    (error: any) => {
      if (error?.code === "permission-denied") {
        if (import.meta.env.DEV) {
          console.warn("[spotPhotos] listenSpotPhotos permission-denied (expected during boot/guest)");
        }
        cb([]);
      } else {
        console.error("[spotPhotos] listenSpotPhotos error:", error);
        captureException(error);
        cb([]);
      }
    }
  );
}

export async function addSpotPhotoDoc(placeId: string, input: { url: string; uploadedByUid: string }) {
  ensureWritesAllowed();
  try {
    await addDoc(photosCollection(placeId), {
      url: input.url,
      uploadedByUid: input.uploadedByUid,
      uploadedAt: serverTimestamp(),
    });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[addSpotPhotoDoc] permission-denied: placeId=${placeId}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
