import {
  collection,
  doc,
  getDocs,
  limit,
  
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import type { NotificationItem, NotificationActorSnapshot } from "../lib/notifications";
import { captureException } from "../lib/monitoring";

function toNotificationItem(id: string, data: Record<string, any>): NotificationItem {
  const createdAtRaw = data.createdAt;
  const createdAt =
    typeof createdAtRaw === "number"
      ? createdAtRaw
      : createdAtRaw?.toMillis?.()
      ? createdAtRaw.toMillis()
      : Date.now();
  return {
    id,
    type: data.type ?? "follow",
    actorId: data.actorId,
    targetUserId: data.targetUserId,
    postId: data.postId,
    commentId: data.commentId,
    createdAt,
    isRead: data.isRead === true,
    actorSnapshot: data.actorSnapshot as NotificationActorSnapshot | undefined,
    message: data.message,
  };
}

export function listenUserNotifications(
  uid: string | null,
  cb: (items: NotificationItem[]) => void
) {
  if (!uid) {
    return () => {};
  }
  const col = collection(db, "users", uid, "notifications");
  const q = query(col, orderBy("createdAt", "desc"), limit(45));
  return onSnapshot(
    q,
    (snap) => {
      const items: NotificationItem[] = [];
      snap.forEach((item) => {
        const data = item.data();
        items.push(toNotificationItem(item.id, data));
      });
      cb(items);
    },
    (error: any) => {
      if (error?.code === "permission-denied") {
        if (import.meta.env.DEV) {
          console.warn("[notifications] listenUserNotifications permission-denied (expected during boot/guest)");
        }
        cb([]);
      } else {
        console.error("[notifications] listenUserNotifications error:", error);
        captureException(error);
        cb([]);
      }
    }
  );
}

export async function markUserNotificationRead(uid: string, notificationId: string) {
  const ref = doc(db, "users", uid, "notifications", notificationId);
  try {
    await updateDoc(ref, { isRead: true });
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[markUserNotificationRead] permission-denied: uid=${uid}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}

export async function markAllUserNotificationsRead(uid: string) {
  const col = collection(db, "users", uid, "notifications");
  const unreadQuery = query(col, where("isRead", "==", false), limit(50));
  try {
    const snap = await getDocs(unreadQuery);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((notif) => {
      batch.update(notif.ref, { isRead: true });
    });
    await batch.commit();
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[markAllUserNotificationsRead] permission-denied: uid=${uid}`);
      }
    } else {
      captureException(e);
    }
    throw e;
  }
}
