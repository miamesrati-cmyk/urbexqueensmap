import {
  collection,
  
  orderBy,
  query,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type MissionType = "photo" | "spot" | "challenge";
export type MissionDifficulty = "facile" | "moyen" | "difficile";

export type Mission = {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  targetTag?: string;
  rewardBadgeId?: string;
  rewardPoints?: number;
  difficulty?: MissionDifficulty;
  expiresAt?: number;
  targetPlaceIds?: string[];
  week?: number;
};

const MISSIONS = collection(db, "missions");

function parseTimestamp(value: any): number | undefined {
  if (!value) return undefined;
  if (typeof value === "number") return value;
  if (value.toMillis) return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  return undefined;
}

export function listenMissions(cb: (missions: Mission[]) => void) {
  const q = query(MISSIONS, orderBy("week", "desc"));
  return onSnapshot(q, (snap) => {
    const out: Mission[] = [];
    snap.forEach((d) => {
      const x: any = d.data();
      out.push({
        id: d.id,
        title: x.title ?? "Mission secrète",
        description: x.description ?? "",
        type: x.type ?? "spot",
        targetTag: x.targetTag,
        rewardBadgeId: x.rewardBadgeId,
        rewardPoints: x.rewardPoints ?? 0,
        difficulty: x.difficulty ?? "moyen",
        expiresAt: parseTimestamp(x.expiresAt),
        targetPlaceIds: Array.isArray(x.targetPlaceIds)
          ? x.targetPlaceIds
          : [],
        week: x.week,
      });
    });
    cb(out);
  });
}

export async function createMission(data: Omit<Mission, "id">) {
  ensureWritesAllowed();
  await addDoc(MISSIONS, {
    ...data,
    targetPlaceIds: data.targetPlaceIds ?? [],
    week: data.week ?? null,
    createdAt: serverTimestamp(),
  });
}
