import {
  type Firestore,
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type UserProfile = {
  displayName: string | null;
  username?: string | null;
  usernameLower?: string | null;
  displayNameLower?: string | null;
  photoURL: string | null;
  avatarCropX?: number;
  avatarCropY?: number;
  avatarZoom?: number;
  avatarMode?: "cover" | "logo";
  bannerURL: string | null;
  bio: string | null;
  favoriteSpotTypes: string[];
  level: "beginner" | "queen" | "legend";
  stats: {
    spotsVisitedCount: number;
    spotsSavedCount: number;
    spotsAddedCount: number;
    kmExplored: number;
  };
  badges: Record<
    string,
    {
      unlocked: boolean;
      unlockedAt?: any;
    }
  >;
  qrSlug: string | null;
  isPrivate?: boolean;
  followersCount?: number;
  followingCount?: number;
  createdAt?: any;
  updatedAt?: any;
  isPro?: boolean;
  isAdmin?: boolean | string | number | null;
  roles?: Record<string, any>;
};

export type UserStats = {
  spotsVisitedCount: number;
  spotsSavedCount: number;
  spotsAddedCount: number;
  kmExplored: number;
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: null,
  photoURL: null,
  avatarCropX: 0,
  avatarCropY: 0,
  avatarZoom: 1,
  avatarMode: "cover",
  bannerURL: null,
  bio: null,
  username: null,
  usernameLower: null,
  displayNameLower: null,
  favoriteSpotTypes: [],
  level: "beginner",
  stats: {
    spotsVisitedCount: 0,
    spotsSavedCount: 0,
    spotsAddedCount: 0,
    kmExplored: 0,
  },
  badges: {},
  qrSlug: null,
  isPrivate: false,
  followersCount: 0,
  followingCount: 0,
  isPro: false,
  isAdmin: false,
  roles: {},
};

export type ProfileSearchResult = {
  uid: string;
  username: string | null;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  isPro?: boolean;
};

export type UrbexLevelId = "rookie" | "explorer" | "queen" | "legend";

export type UrbexLevel = {
  id: UrbexLevelId;
  label: string;
  shortLabel: string;
  minVisited: number;
  maxVisited: number;
  description: string;
};

export const URBEX_LEVELS: UrbexLevel[] = [
  {
    id: "rookie",
    label: "Rookie des Ruines",
    shortLabel: "Rookie",
    minVisited: 0,
    maxVisited: 4,
    description:
      "Tu viens d’entrer dans le game. Quelques spots, beaucoup de curiosité, et déjà l’appel des lieux oubliés.",
  },
  {
    id: "explorer",
    label: "Exploratrice Nocturne",
    shortLabel: "Exploratrice",
    minVisited: 5,
    maxVisited: 19,
    description:
      "Tu connais déjà l’odeur de la poussière et du métal rouillé. Les nuits d’exploration commencent à faire partie de ta routine.",
  },
  {
    id: "queen",
    label: "Urbex Queen",
    shortLabel: "Queen",
    minVisited: 20,
    maxVisited: 49,
    description:
      "Tu guides les autres dans le labyrinthe des lieux abandonnés. Tes spots, tes règles, ta couronne.",
  },
  {
    id: "legend",
    label: "Légende des Lieux Oubliés",
    shortLabel: "Légende",
    minVisited: 50,
    maxVisited: Infinity,
    description:
      "Ton nom circule en chuchotements dans la communauté. Tu as laissé des traces dans des endroits où peu ont osé mettre les pieds.",
  },
];

export function getUrbexLevel(stats: UserStats): UrbexLevel {
  const { spotsVisitedCount } = stats;
  return (
    URBEX_LEVELS.find(
      (lvl) =>
        spotsVisitedCount >= lvl.minVisited &&
        spotsVisitedCount <= lvl.maxVisited
    ) ?? URBEX_LEVELS[0]
  );
}

export const SPOT_TYPE_LABELS: Record<string, string> = {
  hospitals: "Hôpitaux & asiles abandonnés",
  manors: "Manoirs, villas & résidences de luxe",
  industries: "Usines & complexes industriels",
  villages_ghosts: "Villages fantômes & hameaux désertés",
  schools: "Écoles, internats & collèges",
  religious: "Églises & lieux sacrés oubliés",
  others: "Autres curiosités urbex",
};

export type BadgeId =
  | "queen_houses"
  | "risk_taker"
  | "cartographer"
  | "viral_explorer"
  | "ghost_spotter"
  | "mother_of_ruins"
  | "night_guardian"
  | "soul_connector";

export type UrbexBadge = {
  id: BadgeId;
  icon: string;
  label: string;
  description: string;
  unlockHint: string;
  rarity: "common" | "rare" | "ultra_rare";
};

export const ALL_BADGES: UrbexBadge[] = [
  {
    id: "queen_houses",
    icon: "🏆",
    label: "Queen of Abandoned Houses",
    description:
      "Les maisons murmurent ton nom. Tu as fait de leurs couloirs vides ton terrain de jeu.",
    unlockHint:
      "Débloqué après avoir exploré plusieurs maisons ou manoirs abandonnés.",
    rarity: "common",
  },
  {
    id: "risk_taker",
    icon: "🔥",
    label: "Risk Taker",
    description:
      "Tu vas là où les autres reculent. Escaliers brisés, planchers douteux, alarmes possibles… tu y es déjà passée.",
    unlockHint:
      "Débloqué en visitant plusieurs spots à haut risque ou marqués comme difficiles.",
    rarity: "common",
  },
  {
    id: "cartographer",
    icon: "🧭",
    label: "Cartographer",
    description:
      "Tu ne fais pas que suivre la map, tu l’écris. Sans toi, ces lieux seraient encore invisibles.",
    unlockHint: "Débloqué en ajoutant plusieurs spots à la carte.",
    rarity: "common",
  },
  {
    id: "viral_explorer",
    icon: "🎬",
    label: "Viral Explorer",
    description:
      "Un de tes spots a fait le tour des écrans. L’urbex que tu vis, le monde la regarde maintenant.",
    unlockHint:
      "Débloqué quand un de tes contenus ou spots atteint un seuil de popularité (placeholder pour l’instant).",
    rarity: "common",
  },
  {
    id: "ghost_spotter",
    icon: "👻",
    label: "Ghost Spotter",
    description:
      "Tu sais reconnaître quand un lieu n’est pas seulement vide, mais habité par autre chose.",
    unlockHint:
      "Débloqué en visitant plusieurs spots marqués comme paranormaux ou très creepy.",
    rarity: "common",
  },
  {
    id: "mother_of_ruins",
    icon: "💎",
    label: "Mother of Ruins",
    description:
      "Tu as traversé assez de lieux pour comprendre que ce n’est plus un simple hobby. Les ruines t’acceptent comme une des leurs.",
    unlockHint:
      "Badge ultra rare, réservé aux exploratrices qui marquent l’histoire d’UrbexQueens.",
    rarity: "ultra_rare",
  },
  {
    id: "night_guardian",
    icon: "🌌",
    label: "Night Guardian",
    description:
      "Quand la ville dort, tu veilles sur ses cicatrices. Tes pas résonnent là où il ne reste plus que le vent.",
    unlockHint:
      "Débloqué après de nombreuses explorations nocturnes (ou taguées comme telles).",
    rarity: "rare",
  },
  {
    id: "soul_connector",
    icon: "🕊",
    label: "Soul Connector",
    description:
      "Tu ne visites pas seulement des lieux, tu touches les histoires qui y sont restées coincées.",
    unlockHint:
      "Attribué aux membres qui élèvent la communauté par leur présence et leurs actions.",
    rarity: "ultra_rare",
  },
];

export function getUnlockedBadges(
  stats: UserStats,
  visitedPlaces: { category?: string; riskLevel?: string }[],
  preferredTypes: string[]
): Array<UrbexBadge & { unlocked: boolean }> {
  const unlockedIds = new Set<BadgeId>();

  const manorVisits = visitedPlaces.filter(
    (p) => p.category === "manors" || p.category === "maison" || p.category === "maison_maitre"
  ).length;
  if (manorVisits >= 3) unlockedIds.add("queen_houses");

  const riskyVisits = visitedPlaces.filter(
    (p) => (p.riskLevel || "").toLowerCase() === "élevé" || (p.riskLevel || "").toLowerCase() === "eleve"
  ).length;
  if (riskyVisits >= 5 || stats.spotsVisitedCount >= 15) unlockedIds.add("risk_taker");

  if (stats.spotsAddedCount >= 3) unlockedIds.add("cartographer");

  if (preferredTypes.includes("villages_ghosts") || preferredTypes.includes("religious")) {
    unlockedIds.add("ghost_spotter");
  }

  if (stats.spotsVisitedCount >= 100) unlockedIds.add("mother_of_ruins");

  if (stats.spotsVisitedCount >= 40) unlockedIds.add("night_guardian");

  if (stats.spotsSavedCount >= 30) unlockedIds.add("soul_connector");

  return ALL_BADGES.map((b) => ({
    ...b,
    unlocked: unlockedIds.has(b.id),
  }));
}

export async function getUserProfile(uid: string): Promise<UserProfile> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...(snap.data() as any) };
}

export function listenUserProfile(uid: string, cb: (p: UserProfile) => void) {
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb(DEFAULT_PROFILE);
      return;
    }
    cb({ ...DEFAULT_PROFILE, ...(snap.data() as any) });
  });
}

export async function upsertUserProfile(
  uid: string,
  data: Partial<UserProfile>
) {
  ensureWritesAllowed();
  const sanitizedData: Partial<UserProfile> = { ...data };
  const adminFields = ["isAdmin", "roles", "role", "permissions", "admin"];
  const foundRestricted: string[] = [];
  adminFields.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(sanitizedData, key)) {
      foundRestricted.push(key);
      delete (sanitizedData as any)[key];
    }
  });
  if (foundRestricted.length > 0 && import.meta.env.DEV) {
    console.warn("[UQ] stripped admin fields before writing user profile", {
      uid,
      fields: foundRestricted,
    });
  }

  const ref = doc(db, "users", uid);
  const searchFields: Record<string, any> = {};
  if (data.username !== undefined && data.username !== null) {
    searchFields.usernameLower = data.username.toLowerCase();
  }
  if (data.displayName !== undefined) {
    searchFields.displayNameLower = data.displayName
      ? data.displayName.toLowerCase()
      : null;
  }

  if (data.username === undefined) {
    const snap = await getDoc(ref);
    const current: any = snap.exists() ? snap.data() : {};
    if (!current.usernameLower) {
      const generated = await generateUsername(uid, data.displayName ?? current.displayName);
      data.username = generated;
      searchFields.usernameLower = generated.toLowerCase();
    }
  }

  await setDoc(
    ref,
    {
      ...sanitizedData,
      ...searchFields,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function normalizeProfileResult(docSnap: any): ProfileSearchResult {
  const data: any = docSnap.data();
  return {
    uid: docSnap.id,
    username: data.username ?? data.qrSlug ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    bio: data.bio ?? null,
    isPro: !!data.isPro,
  };
}

export async function searchUserProfiles(
  term: string,
  limitCount = 8
): Promise<ProfileSearchResult[]> {
  const queryText = term.trim().toLowerCase();
  if (!queryText) return [];
  const start = queryText;
  const end = `${queryText}\uf8ff`;
  const users = collection(db, "users");

  const [byUsername, byDisplay] = await Promise.allSettled([
    getDocs(
      query(users, orderBy("usernameLower"), startAt(start), endAt(end), limit(limitCount))
    ),
    getDocs(
      query(users, orderBy("displayNameLower"), startAt(start), endAt(end), limit(limitCount))
    ),
  ]);

  const results: Map<string, ProfileSearchResult> = new Map();

  function append(snapResult: PromiseSettledResult<any>) {
    if (snapResult.status !== "fulfilled") return;
    snapResult.value.forEach((docSnap: any) => {
      const normalized = normalizeProfileResult(docSnap);
      results.set(normalized.uid, normalized);
    });
  }

  append(byUsername);
  append(byDisplay);

  return Array.from(results.values()).slice(0, limitCount);
}

export async function resolveUserByHandle(handle: string): Promise<ProfileSearchResult | null> {
  const clean = handle.trim().toLowerCase();
  if (!clean) return null;
  const users = collection(db, "users");
  const snap = await getDocs(query(users, where("usernameLower", "==", clean), limit(1)));
  if (!snap.empty) return normalizeProfileResult(snap.docs[0]);
  const slugSnap = await getDocs(query(users, where("qrSlug", "==", clean), limit(1)));
  if (!slugSnap.empty) return normalizeProfileResult(slugSnap.docs[0]);
  return null;
}

export function sanitizeUsername(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

export async function isUsernameAvailable(username: string, currentUid?: string) {
  const clean = sanitizeUsername(username);
  if (!clean || clean.length < 3) return false;
  const users = collection(db, "users");
  const snap = await getDocs(query(users, where("usernameLower", "==", clean), limit(1)));
  if (snap.empty) return true;
  const docId = snap.docs[0].id;
  return currentUid ? docId === currentUid : false;
}

function randomSuffix() {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, 4);
}

export async function generateUsername(uid: string, displayName?: string | null) {
  const base = sanitizeUsername(displayName || "") || `user_${uid.slice(0, 4)}`;
  let candidate = base;
  // limit attempts to avoid infinite loop
  for (let i = 0; i < 5; i++) {
    const available = await isUsernameAvailable(candidate, uid);
    if (available) return candidate;
    candidate = `${base}_${randomSuffix()}`.slice(0, 20);
  }
  return `${base}_${randomSuffix()}`.slice(0, 20);
}

export async function ensureUserSearchFields(uid: string, displayName?: string | null) {
  ensureWritesAllowed();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data: any = snap.exists() ? snap.data() : {};
  const username: string | null = data.username ?? null;
  const usernameLower: string | null = data.usernameLower ?? null;
  const displayLower: string | null =
    data.displayNameLower ?? (data.displayName ? (data.displayName as string).toLowerCase() : null);

  let nextUsername = username;
  if (!nextUsername || !usernameLower) {
    nextUsername = await generateUsername(uid, displayName || data.displayName);
  }

  await setDoc(
    ref,
    {
      username: nextUsername,
      usernameLower: nextUsername ? nextUsername.toLowerCase() : null,
      displayName: displayName ?? data.displayName ?? null,
      displayNameLower:
        displayName !== undefined
          ? displayName?.toLowerCase?.() ?? null
          : displayLower ?? null,
      createdAt: snap.exists() ? data.createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function backfillUserSearchFields(firestoreOverride?: Firestore) {
  const store = firestoreOverride ?? db;
  const usersCol = collection(store, "users");
  const snap = await getDocs(usersCol);
  const batch = writeBatch(store);
  let updated = 0;
  snap.forEach((docSnap) => {
    const d: any = docSnap.data();
    const username: string | null = d.username ?? null;
    const usernameLower: string | null = d.usernameLower ?? null;
    const displayName: string | null = d.displayName ?? null;
    const displayNameLower: string | null = d.displayNameLower ?? null;
    if (username && usernameLower && displayNameLower) return;
    const generated = username || sanitizeUsername(displayName || "") || `user_${docSnap.id.slice(0, 4)}`;
    batch.set(
      docSnap.ref,
      {
        username: generated,
        usernameLower: generated.toLowerCase(),
        displayName: displayName ?? null,
        displayNameLower: displayName ? displayName.toLowerCase() : null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    updated += 1;
  });
  if (updated > 0) {
    await batch.commit();
  }
  return updated;
}
