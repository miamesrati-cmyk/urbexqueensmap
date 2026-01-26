import {
  collection,
  doc,
  
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";
import { applyXpDeltaInTransaction } from "./gamification";
import type { SpotTier, Place } from "./places";
import { captureException } from "../lib/monitoring";

export type AchievementTier = "COMMON" | "RARE" | "LEGEND" | "GHOST";

export type AchievementTrigger =
  | { type: "first_done" }
  | { type: "night_done" }
  | { type: "risk_done"; riskLevel: Place["riskLevel"] }
  | { type: "tier_done"; tier: SpotTier }
  | { type: "tier_night_done"; tier: SpotTier };

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  xp: number;
  icon: string;
  tier: AchievementTier;
  unlockHint: string;
  proOnly?: boolean;
  trigger: AchievementTrigger;
};

export type AchievementUnlockDetail = {
  id: string;
  title: string;
  xp: number;
  icon: string;
  tier: AchievementTier;
  proOnly?: boolean;
  isPro?: boolean;
  metadata?: Record<string, unknown>;
};

export type UserAchievementRecord = {
  unlockedAt: number;
  xp: number;
  source?: string;
};

export type PlaceDoneMetadata = {
  placeId?: string;
  tier?: SpotTier;
  riskLevel?: Place["riskLevel"];
  timestamp?: number;
  isNight?: boolean;
};

const BASE_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_spot_done",
    title: "Premier spot marqué",
    description: "Tu as enfin coché ton premier spot urbex dans ta checklist.",
    xp: 30,
    icon: "✅",
    tier: "COMMON",
    unlockHint: "Marque un spot comme fait.",
    trigger: { type: "first_done" },
  },
  {
    id: "night_vision",
    title: "Gardienne nocturne",
    description:
      "Les ruines s’illuminent dès que tu te balades entre minuit et l’aube.",
    xp: 45,
    icon: "🌙",
    tier: "RARE",
    unlockHint: "Marque un spot comme fait pendant la nuit.",
    trigger: { type: "night_done" },
  },
  {
    id: "risk_taker",
    title: "Prête à tout",
    description: "Tu as affronté la dangerosité et décoché un spot à risque élevé.",
    xp: 55,
    icon: "🔥",
    tier: "RARE",
    unlockHint: "Marque un spot avec un risque évalué à « élevé ». ",
    trigger: { type: "risk_done", riskLevel: "élevé" },
  },
  {
    id: "epic_pathfinder",
    title: "Pathfinder légendaire",
    description:
      "Les lieux ÉPIQUES se méritent, tu as marqué l’un d’entre eux comme déjà fouillé.",
    xp: 80,
    icon: "⚜️",
    tier: "LEGEND",
    unlockHint: "Complète un spot classé EPIC.",
    trigger: { type: "tier_done", tier: "EPIC" },
  },
  {
    id: "ghost_whisperer",
    title: "Whisperer des fantômes",
    description:
      "Les spots GHOST ne restent plus secrets pour toi : tu en as finalisé un.",
    xp: 120,
    icon: "👻",
    tier: "GHOST",
    unlockHint: "PRO requis · Marque un spot GHOST comme fait.",
    proOnly: true,
    trigger: { type: "tier_done", tier: "GHOST" },
  },
  {
    id: "night_ghost_hunter",
    title: "Ghost Night Shift",
    description:
      "Tu as affronté les spectres de la nuit tout en complétant un spot GHOST.",
    xp: 140,
    icon: "🌑",
    tier: "GHOST",
    unlockHint: "PRO requis · Marque un spot GHOST la nuit.",
    proOnly: true,
    trigger: { type: "tier_night_done", tier: "GHOST" },
  },
];

export const ACHIEVEMENTS = BASE_ACHIEVEMENTS;
export const ACHIEVEMENT_UNLOCK_EVENT = "urbex-achievement-unlocked";

const ACHIEVEMENTS_BY_ID = Object.fromEntries(
  BASE_ACHIEVEMENTS.map((item) => [item.id, item])
);

function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function normalizeMetadata(
  metadata: PlaceDoneMetadata
): {
  tier: SpotTier;
  riskLevel: Place["riskLevel"];
  timestamp: number;
  isNight: boolean;
} {
  const timestamp = metadata.timestamp ?? Date.now();
  const tier = metadata.tier ?? "STANDARD";
  const riskLevel = metadata.riskLevel ?? "moyen";
  const isNight =
    metadata.isNight ??
    (() => {
      const hour = new Date(timestamp).getHours();
      return hour >= 21 || hour < 6;
    })();
  return { tier, riskLevel, timestamp, isNight };
}

function matchesTrigger(
  trigger: AchievementTrigger,
  normalized: ReturnType<typeof normalizeMetadata>
): boolean {
  switch (trigger.type) {
    case "first_done":
      return true;
    case "night_done":
      return normalized.isNight;
    case "risk_done":
      return normalized.riskLevel === trigger.riskLevel;
    case "tier_done":
      return normalized.tier === trigger.tier;
    case "tier_night_done":
      return normalized.tier === trigger.tier && normalized.isNight;
    default:
      return false;
  }
}

export function getAchievementDefinition(id: string) {
  return ACHIEVEMENTS_BY_ID[id];
}

export function listenUserAchievements(
  uid: string,
  callback: (records: Record<string, UserAchievementRecord>) => void
) {
  if (!uid) {
    callback({});
    return () => {};
  }

  const ref = collection(db, "users", uid, "achievements");
  const unsub = onSnapshot(
    ref,
    (snapshot) => {
      const next: Record<string, UserAchievementRecord> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as DocumentData;
        next[doc.id] = {
          unlockedAt: toMillis(data.unlockedAt),
          xp: typeof data.xp === "number" ? data.xp : 0,
          source: typeof data.source === "string" ? data.source : undefined,
        };
      });
      callback(next);
    },
    (error: any) => {
      if (error?.code === "permission-denied") {
        if (import.meta.env.DEV) {
          console.warn("[achievements] listenUserAchievements permission-denied (expected during boot/guest)");
        }
        callback({});
      } else {
        console.error("[achievements] listenUserAchievements error:", error);
        captureException(error);
        callback({});
      }
    }
  );

  return unsub;
}

async function unlockAchievement(
  uid: string,
  definition: AchievementDefinition,
  options?: {
    isPro?: boolean;
    source?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<AchievementUnlockDetail | null> {
  if (!uid) return null;
  if (definition.proOnly && !options?.isPro) {
    return null;
  }
  ensureWritesAllowed();
  const achievementRef = doc(
    db,
    "users",
    uid,
    "achievements",
    definition.id
  );
  let unlocked = false;
  let xpAwarded = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(achievementRef);
    if (snap.exists()) return;

    const xpResult = await applyXpDeltaInTransaction(tx, uid, definition.xp, {
      isPro: options?.isPro,
    });
    xpAwarded = xpResult.xpGain;
    unlocked = true;

    tx.set(
      achievementRef,
      {
        unlockedAt: serverTimestamp(),
        xp: xpAwarded,
        source: options?.source ?? "achievement",
        metadata: options?.metadata ?? null,
      },
      { merge: true }
    );
  });

  if (!unlocked) return null;

  const detail: AchievementUnlockDetail = {
    id: definition.id,
    title: definition.title,
    xp: xpAwarded,
    icon: definition.icon,
    tier: definition.tier,
    proOnly: definition.proOnly,
    isPro: options?.isPro,
    metadata: options?.metadata,
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ACHIEVEMENT_UNLOCK_EVENT, {
        detail,
      })
    );
  }

  return detail;
}

export async function evaluateAchievementsForPlaceDone(
  uid: string,
  metadata: PlaceDoneMetadata,
  options?: { isPro?: boolean; source?: string }
) {
  if (!uid) return [];
  const normalized = normalizeMetadata(metadata);
  const candidates = ACHIEVEMENTS.filter(
    (def) => !def.proOnly || options?.isPro
  ).filter((def) =>
    matchesTrigger(def.trigger, normalized)
  );

  const results: AchievementUnlockDetail[] = [];
  for (const candidate of candidates) {
    const unlocked = await unlockAchievement(uid, candidate, {
      isPro: options?.isPro,
      source: options?.source ?? "place_done",
      metadata: {
        placeId: metadata.placeId,
        tier: normalized.tier,
        riskLevel: normalized.riskLevel,
        isNight: normalized.isNight,
      },
    });
    if (unlocked) {
      results.push(unlocked);
    }
  }

  return results;
}
