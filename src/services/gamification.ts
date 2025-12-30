import {
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type UserGamification = {
  uid: string;
  xp: number;
  level: number;
  completedQuests?: string[];
};

// Fonction simple de calcul de niveau : 100 XP par niveau
export function computeLevelFromXp(xp: number): number {
  if (xp < 0) xp = 0;
  return Math.floor(xp / 100) + 1;
}

// Écouter les stats gamification d'un user
export function listenUserGamification(
  uid: string,
  callback: (data: UserGamification) => void
) {
  const ref = doc(db, "userGamification", uid);

  return onSnapshot(ref, async (snap) => {
    if (snap.exists()) {
      const data = snap.data() as any;
      const xp = typeof data.xp === "number" ? data.xp : 0;
      const level =
        typeof data.level === "number" ? data.level : computeLevelFromXp(xp);

      callback({
        uid,
        xp,
        level,
        completedQuests: Array.isArray(data.completedQuests)
          ? data.completedQuests
          : [],
      });
    } else {
      const initial: UserGamification = {
        uid,
        xp: 0,
        level: 1,
        completedQuests: [],
      };
      ensureWritesAllowed();
      await setDoc(ref, initial, { merge: true });
      callback(initial);
    }
  });
}

// Ajouter de l'XP de façon transactionnelle
export async function addXpToUser(uid: string, delta: number) {
  ensureWritesAllowed();
  const ref = doc(db, "userGamification", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    let xp = 0;
    let level = 1;

    if (snap.exists()) {
      const data = snap.data() as any;
      xp = typeof data.xp === "number" ? data.xp : 0;
    }

    xp += delta;
    if (xp < 0) xp = 0;

    level = computeLevelFromXp(xp);

    tx.set(
      ref,
      {
        xp,
        level,
      },
      { merge: true }
    );
  });
}

// Marquer une énigme / quête comme complétée pour un user + XP
export async function completeQuest(
  uid: string,
  questId: string,
  xpReward: number
) {
  ensureWritesAllowed();
  const ref = doc(db, "userGamification", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    let xp = 0;
    let completed: string[] = [];

    if (snap.exists()) {
      const data = snap.data() as any;
      xp = typeof data.xp === "number" ? data.xp : 0;
      if (Array.isArray(data.completedQuests)) {
        completed = data.completedQuests;
      }
    }

    if (!completed.includes(questId)) {
      completed.push(questId);
      xp += xpReward;
    }

    const level = computeLevelFromXp(xp);

    tx.set(
      ref,
      {
        xp,
        level,
        completedQuests: completed,
      },
      { merge: true }
    );
  });
}

export type XpEventType =
  | "add_spot"
  | "save_spot"
  | "checkin_spot"
  | "mark_done"
  | "add_comment"
  | "upload_photo";

export function getXpForEvent(type: XpEventType): number {
  switch (type) {
    case "add_spot":
      return 50;
    case "save_spot":
      return 10;
    case "mark_done":
      return 20;
    case "checkin_spot":
      return 25;
    case "add_comment":
      return 5;
    case "upload_photo":
      return 15;
    default:
      return 0;
  }
}

export async function awardXpForEvent(uid: string, type: XpEventType) {
  const delta = getXpForEvent(type);
  if (delta <= 0) return;
  await addXpToUser(uid, delta);
}
