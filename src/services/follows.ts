import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { getDoc, increment } from "firebase/firestore";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type Follow = {
  id: string;
  fromUid: string;
  toUid: string;
  createdAt: number;
};

export type FollowRequest = {
  id: string;
  fromUid: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};

const FOLLOWS = collection(db, "follows");

export function listenFollowers(uid: string, cb: (f: Follow[]) => void) {
  const q = query(FOLLOWS, where("toUid", "==", uid));
  return onSnapshot(q, (snap) => {
    const out: Follow[] = [];
    snap.forEach((d) => {
      const x: any = d.data();
      out.push({
        id: d.id,
        fromUid: x.fromUid,
        toUid: x.toUid,
        createdAt: x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now(),
      });
    });
    cb(out);
  });
}

export function listenFollowing(uid: string, cb: (f: Follow[]) => void) {
  const q = query(FOLLOWS, where("fromUid", "==", uid));
  return onSnapshot(q, (snap) => {
    const out: Follow[] = [];
    snap.forEach((d) => {
      const x: any = d.data();
      out.push({
        id: d.id,
        fromUid: x.fromUid,
        toUid: x.toUid,
        createdAt: x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now(),
      });
    });
    cb(out);
  });
}

export async function followUser(fromUid: string, toUid: string) {
  ensureWritesAllowed();
  const existing = await getDocs(
    query(FOLLOWS, where("fromUid", "==", fromUid), where("toUid", "==", toUid))
  );
  if (!existing.empty) return existing.docs[0].id;

  const ref = await addDoc(FOLLOWS, {
    fromUid,
    toUid,
    createdAt: serverTimestamp(),
  });

  // best-effort counters
  await Promise.allSettled([
    updateDoc(doc(db, "users", fromUid), {
      followingCount: increment(1),
    }),
    updateDoc(doc(db, "users", toUid), {
      followersCount: increment(1),
    }),
  ]);

  return ref.id;
}

export async function unfollowUser(fromUid: string, toUid: string) {
  ensureWritesAllowed();
  const existing = await getDocs(
    query(FOLLOWS, where("fromUid", "==", fromUid), where("toUid", "==", toUid))
  );
  const batchDeletes: Promise<any>[] = [];
  existing.forEach((d) => batchDeletes.push(deleteDoc(d.ref)));
  await Promise.all(batchDeletes);

  await Promise.allSettled([
    updateDoc(doc(db, "users", fromUid), {
      followingCount: increment(-1),
    }),
    updateDoc(doc(db, "users", toUid), {
      followersCount: increment(-1),
    }),
  ]);
}

export function listenFollowRequests(
  uid: string,
  cb: (requests: FollowRequest[]) => void
) {
  const col = collection(db, "users", uid, "followRequests");
  return onSnapshot(col, (snap) => {
    const out: FollowRequest[] = [];
    snap.forEach((d) => {
      const x: any = d.data();
      out.push({
        id: d.id,
        fromUid: x.fromUid,
        status: x.status ?? "pending",
        createdAt: x.createdAt?.toMillis?.() ?? x.createdAt ?? Date.now(),
      });
    });
    cb(out);
  });
}

export async function requestFollow(profileUid: string, fromUid: string) {
  ensureWritesAllowed();
  const col = collection(db, "users", profileUid, "followRequests");
  // prevent spam duplicates
  const existing = await getDocs(
    query(col, where("fromUid", "==", fromUid), where("status", "==", "pending"))
  );
  if (!existing.empty) return existing.docs[0].id;
  const ref = await addDoc(col, {
    fromUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function acceptFollowRequest(profileUid: string, requestId: string) {
  ensureWritesAllowed();
  const reqRef = doc(db, "users", profileUid, "followRequests", requestId);
  const snap = await getDoc(reqRef);
  const data: any = snap.data();
  const fromUid = data?.fromUid;
  if (!fromUid) {
    await updateDoc(reqRef, { status: "declined" });
    return;
  }
  await updateDoc(reqRef, { status: "accepted" });
  await followUser(fromUid, profileUid);
}

export async function declineFollowRequest(profileUid: string, requestId: string) {
  ensureWritesAllowed();
  const reqRef = doc(db, "users", profileUid, "followRequests", requestId);
  await updateDoc(reqRef, { status: "declined" });
}
