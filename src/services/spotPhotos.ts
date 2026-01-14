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
  return onSnapshot(q, (snap) => {
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
  });
}

export async function addSpotPhotoDoc(placeId: string, input: { url: string; uploadedByUid: string }) {
  ensureWritesAllowed();
  await addDoc(photosCollection(placeId), {
    url: input.url,
    uploadedByUid: input.uploadedByUid,
    uploadedAt: serverTimestamp(),
  });
}
