import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
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

function followersCollection(uid: string) {
  return collection(db, "users", uid, "followers");
}

function followingCollection(uid: string) {
  return collection(db, "users", uid, "following");
}

function followerDocumentRef(toUid: string, fromUid: string) {
  return doc(db, "users", toUid, "followers", fromUid);
}

function followingDocumentRef(fromUid: string, toUid: string) {
  return doc(db, "users", fromUid, "following", toUid);
}

function timestampToMillis(value: unknown): number {
  const maybeTimestamp = value as { toMillis?: () => number } | number | null | undefined;
  if (
    typeof maybeTimestamp === "object" &&
    maybeTimestamp !== null &&
    typeof maybeTimestamp.toMillis === "function"
  ) {
    return maybeTimestamp.toMillis();
  }
  if (typeof maybeTimestamp === "number") {
    return maybeTimestamp;
  }
  return Date.now();
}

export function listenFollowers(uid: string, cb: (f: Follow[]) => void) {
  const col = followersCollection(uid);
  return onSnapshot(col, (snap) => {
    const out: Follow[] = [];
    snap.forEach((d) => {
      const data: any = d.data();
      out.push({
        id: d.id,
        fromUid: d.id,
        toUid: uid,
        createdAt: timestampToMillis(data.createdAt),
      });
    });
    cb(out);
  });
}

export function listenFollowing(uid: string, cb: (f: Follow[]) => void) {
  const col = followingCollection(uid);
  return onSnapshot(col, (snap) => {
    const out: Follow[] = [];
    snap.forEach((d) => {
      const data: any = d.data();
      out.push({
        id: d.id,
        fromUid: uid,
        toUid: d.id,
        createdAt: timestampToMillis(data.createdAt),
      });
    });
    cb(out);
  });
}

export async function followUser(fromUid: string, toUid: string) {
  ensureWritesAllowed();
  if (fromUid === toUid) return;
  const followerRef = followerDocumentRef(toUid, fromUid);
  const followingRef = followingDocumentRef(fromUid, toUid);
  const [followerSnap, followingSnap] = await Promise.all([
    getDoc(followerRef),
    getDoc(followingRef),
  ]);
  if (followerSnap.exists() && followingSnap.exists()) {
    return;
  }
  const batch = writeBatch(db);
  if (!followerSnap.exists()) {
    batch.set(followerRef, { createdAt: serverTimestamp() });
  }
  if (!followingSnap.exists()) {
    batch.set(followingRef, { createdAt: serverTimestamp() });
  }
  await batch.commit();
}

export async function unfollowUser(fromUid: string, toUid: string) {
  ensureWritesAllowed();
  if (fromUid === toUid) return;
  const followerRef = followerDocumentRef(toUid, fromUid);
  const followingRef = followingDocumentRef(fromUid, toUid);
  const batch = writeBatch(db);
  batch.delete(followerRef);
  batch.delete(followingRef);
  await batch.commit();
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
