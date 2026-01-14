import { db } from "../lib/firebase";
import { onSnapshot } from "../lib/firestoreHelpers";
import {
  collection,
  doc,
  setDoc,
  orderBy,
  query,
  serverTimestamp,
  getDoc,
  getDocs,
  updateDoc,
  limit,
  startAfter,
  startAt,
  endAt,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { computeGeohash } from "../lib/geohash";

export type SpotTier = "STANDARD" | "EPIC" | "GHOST";
export type UserLevel = "guest" | "member" | "pro";
export type SpotValidationStatus = "pending" | "approved" | "rejected";

export type Place = {
  id: string;
  title: string;
  description?: string;
  category?: "maison"|"usine"|"école"|"hôpital"|"religieux"|"autre";
  riskLevel?: "faible"|"moyen"|"élevé";
  access?: "facile"|"moyen"|"difficile";
  lat: number;
  lng: number;
  createdAt: number;
  addedBy?: string;
  isPublic: boolean;
  createdBy?: string;
  approved?: boolean;
  history?: string;
  dangerLevel?: number;
  dangerLabel?: string;
  dangerIndex?: number | null;
  paranormalIndex?: number | null;
  parking?: string;
  entrances?: string;
  communityScore?: number;
  popularity?: number;
  tags?: string[];
  proOnly?: boolean;
  isProOnly?: boolean;
  isGhost?: boolean;
  isLegend?: boolean;
  missionIds?: string[];
  isDraft?: boolean;
  videoUrl?: string;
  validationStatus?: SpotValidationStatus;
  // Histoire du lieu
  historyTitle?: string;
  historyShort?: string;
  historyShortHtml?: string;
  historyFull?: string;
  historyFullHtml?: string;
  historyIsPro?: boolean;
  historyImages?: string[];
  updatedAt?: number;
  historyUpdatedAt?: number;
  historyUpdatedBy?: string | null;
  adminNotes?: string;
  archives?: string[];
  name?: string;
  city?: string;
  region?: string;
  status?: "draft" | "published";
  tier?: SpotTier;
  blurRadius?: number;
  accessNotes?: string;
  storySteps?: string[];
  lootTags?: string[];
  photos?: string[];
  geohash?: string;
};

export type PlaceCreateInput = Omit<Place, "id" | "createdAt">;

const PLACES = collection(db, "places");
// Performance optimisée : charge initial petit, puis pagination
const MAP_PLACE_LIMIT = 50; // Réduit de 200 → 50 pour chargement initial rapide
const GEOHASH_QUERY_LIMIT = 50; // Réduit aussi pour cohérence

function toMillis(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

type PlaceStatus = "draft" | "published";

function normalizeStatus(value: unknown): PlaceStatus | undefined {
  if (value === "published") {
    return "published";
  }
  if (value === "draft") {
    return "draft";
  }
  return undefined;
}

function normalizeTier(value: unknown): SpotTier {
  const tier = typeof value === "string" ? value.toUpperCase() : null;
  if (tier === "EPIC") return "EPIC";
  if (tier === "GHOST") return "GHOST";
  return "STANDARD";
}

export function detectTierFromRecord(x: any): SpotTier {
  if (typeof x !== "object" || x === null) {
    return "STANDARD";
  }
  if (x.tier) {
    return normalizeTier(x.tier);
  }
  if (x.isLegend) {
    return "EPIC";
  }
  if (x.isGhost) {
    return "GHOST";
  }
  return "STANDARD";
}

export function shouldDisplayTier(
  markerTier: SpotTier,
  showEpic: boolean,
  showGhost: boolean
): boolean {
  if (!showEpic && !showGhost) return true;
  if (showEpic && showGhost) return markerTier === "EPIC" || markerTier === "GHOST";
  if (showEpic) return markerTier === "EPIC";
  if (showGhost) return markerTier === "GHOST";
  return true;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function buildPlaceFromRecord(
  id: string,
  raw: Record<string, unknown> | null | undefined
): Place | null {
  if (!raw) return null;
  const x = raw as Record<string, any>;
  if (x.isDraft) return null;
  const status = normalizeStatus(x.status) ?? "published";
  if (status !== "published") return null;
  if (typeof x.lat !== "number" || typeof x.lng !== "number") {
    return null;
  }
  const createdAt = toMillis(x.createdAt) ?? Date.now();
  const updatedAt = toMillis(x.updatedAt);
  const historyUpdatedAt = toMillis(x.historyUpdatedAt);
  const title = typeof x.title === "string" ? x.title : "";
  const name =
    typeof x.name === "string" && x.name ? x.name : title;
  const description =
    typeof x.description === "string" ? x.description : "";
  const category =
    (x.category as Place["category"]) ?? "autre";
  const riskLevel =
    (x.riskLevel as Place["riskLevel"]) ?? "moyen";
  const access = (x.access as Place["access"]) ?? "moyen";
  const isPublic = x.isPublic ?? true;
  const proOnly =
    (x.proOnly ?? false) || isPublic === false || !!x.isProOnly;
  const isProOnly = !!(x.isProOnly ?? proOnly);
  const tags = toStringArray(x.tags);
  const missionIds = toStringArray(x.missionIds);
  const storySteps = toStringArray(x.storySteps);
  const lootTags = toStringArray(x.lootTags);
  const photos = toStringArray(x.photos);
  const historyImages = toStringArray(x.historyImages);
  const archives = toStringArray(x.archives);
  const accessNotes =
    typeof x.accessNotes === "string" ? x.accessNotes : "";
  const adminNotes =
    typeof x.adminNotes === "string" ? x.adminNotes : "";
  const historyTitle =
    typeof x.historyTitle === "string" ? x.historyTitle : undefined;
  const historyShort =
    typeof x.historyShort === "string" ? x.historyShort : "";
  const historyShortHtml =
    typeof x.historyShortHtml === "string" ? x.historyShortHtml : "";
  const historyFull =
    typeof x.historyFull === "string" ? x.historyFull : "";
  const historyFullHtml =
    typeof x.historyFullHtml === "string" ? x.historyFullHtml : undefined;
  const historyIsPro = !!x.historyIsPro;
  const videoUrl =
    typeof x.videoUrl === "string" && x.videoUrl.trim()
      ? x.videoUrl.trim()
      : undefined;
  const blurRadius =
    typeof x.blurRadius === "number" ? x.blurRadius : undefined;
  const dangerLevel =
    typeof x.dangerLevel === "number" ? x.dangerLevel : undefined;
  const dangerIndex =
    typeof x.dangerIndex === "number" ? x.dangerIndex : null;
  const paranormalIndex =
    typeof x.paranormalIndex === "number" ? x.paranormalIndex : null;
  const popularity =
    typeof x.popularity === "number" ? x.popularity : 0;
  const communityScore =
    typeof x.communityScore === "number" ? x.communityScore : undefined;
  const isGhost = !!x.isGhost;
  const isLegend = !!x.isLegend;
  const geohash =
    typeof x.geohash === "string" && x.geohash ? x.geohash : undefined;
  
  // Validation status (pour les spots soumis)
  const validationStatus = 
    (x.validationStatus === "pending" || x.validationStatus === "approved" || x.validationStatus === "rejected")
      ? x.validationStatus as SpotValidationStatus
      : x.approved === false
        ? "rejected" as SpotValidationStatus
        : "approved" as SpotValidationStatus;

  return {
    id,
    title,
    name,
    description,
    category,
    riskLevel,
    access,
    lat: x.lat,
    lng: x.lng,
    createdAt,
    updatedAt,
    addedBy: x.addedBy ?? "anon",
    isPublic,
    approved: x.approved ?? false,
    city: x.city ?? undefined,
    region: x.region ?? undefined,
    history: typeof x.history === "string" ? x.history : "",
    dangerLevel,
    dangerLabel:
      typeof x.dangerLabel === "string" ? x.dangerLabel : "",
    dangerIndex,
    paranormalIndex,
    parking:
      typeof x.parking === "string" ? x.parking : "",
    entrances:
      typeof x.entrances === "string" ? x.entrances : "",
    communityScore,
    popularity,
    tags,
    proOnly,
    isProOnly,
    isGhost,
    isLegend,
    missionIds,
    isDraft: !!x.isDraft,
    videoUrl,
    historyTitle,
    historyShort,
    historyShortHtml,
    historyFull,
    historyFullHtml,
    historyIsPro,
    historyImages,
    historyUpdatedAt,
    tier: detectTierFromRecord(x),
    blurRadius,
    accessNotes,
    storySteps,
    lootTags,
    photos,
    geohash,
    historyUpdatedBy: x.historyUpdatedBy ?? null,
    adminNotes,
    archives,
    status,
    validationStatus,
  };
}

function mapPlaceSnapshot(
  doc: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): Place | null {
  if (!doc.exists()) return null;
  const place = buildPlaceFromRecord(doc.id, doc.data());
  return place;
}

/**
 * Filtre les spots selon le niveau d'utilisateur et les règles de visibilité
 * 
 * Règles:
 * - Guest (non inscrit): Max 2-3 spots publics (approved uniquement)
 * - Member (inscrit): Tous les spots publics (approved uniquement)
 * - Pro: Tous les spots (publics + PRO-only, approved uniquement)
 * - Utilisateur voit toujours ses propres spots pending/rejected
 */
export function filterPlacesByUserLevel(
  places: Place[],
  userLevel: UserLevel,
  userId?: string | null,
  guestLimit: number = 3
): Place[] {
  // Filtre 1: Enlever les spots pending/rejected sauf ceux de l'utilisateur
  const visiblePlaces = places.filter((place) => {
    const isOwner = userId && place.addedBy === userId;
    const validationStatus = place.validationStatus || "approved";
    
    // L'utilisateur voit toujours ses propres spots (peu importe le statut)
    if (isOwner) {
      return true;
    }
    
    // Les autres ne voient que les spots approuvés
    return validationStatus === "approved";
  });

  // Filtre 2: Appliquer les règles selon le niveau utilisateur
  switch (userLevel) {
    case "guest": {
      // Guest: max 2-3 spots publics uniquement
      const publicSpots = visiblePlaces.filter((p) => !p.proOnly && !p.isProOnly);
      return publicSpots.slice(0, guestLimit);
    }
    
    case "member":
      // Member: tous les spots publics (pas PRO-only)
      return visiblePlaces.filter((p) => !p.proOnly && !p.isProOnly);
    
    case "pro":
      // Pro: accès illimité à tous les spots
      return visiblePlaces;
    
    default:
      return [];
  }
}

export function listenPlaces(
  cb: (p: Place[]) => void,
  options?: { 
    isPro?: boolean;
    userLevel?: UserLevel;
    userId?: string | null;
    guestLimit?: number;
  },
  onError?: (error: unknown) => void
) {
  const q = query(
    PLACES,
    orderBy("createdAt", "desc"),
    limit(MAP_PLACE_LIMIT)
  );
  return onSnapshot(
    q,
    (snap) => {
      const places = snap.docs
        .map((doc) => mapPlaceSnapshot(doc))
        .filter((place): place is Place => Boolean(place));
      
      // Nouvelle logique: utiliser filterPlacesByUserLevel si userLevel est fourni
      if (options?.userLevel) {
        const filtered = filterPlacesByUserLevel(
          places,
          options.userLevel,
          options.userId,
          options.guestLimit
        );
        cb(filtered);
      } else {
        // Ancienne logique (rétrocompatibilité)
        const filtered = options?.isPro ? places : places.filter((p) => !p.proOnly);
        cb(filtered);
      }
    },
    onError
  );
}

export async function queryPlacesByGeohashRange(
  range: [string, string],
  options?: { 
    isPro?: boolean; 
    limit?: number;
    userLevel?: UserLevel;
    userId?: string | null;
    guestLimit?: number;
  }
): Promise<Place[]> {
  const { isPro, limit: perRange = GEOHASH_QUERY_LIMIT, userLevel, userId, guestLimit } = options ?? {};
  const constraints = [
    orderBy("geohash"),
    startAt(range[0]),
    endAt(range[1]),
    limit(perRange),
  ];
  const q = query(PLACES, ...constraints);
  const snap = await getDocs(q);
  const places = snap.docs
    .map((doc) => mapPlaceSnapshot(doc))
    .filter((place): place is Place => Boolean(place));
  
  // Nouvelle logique: utiliser filterPlacesByUserLevel si userLevel est fourni
  if (userLevel) {
    return filterPlacesByUserLevel(places, userLevel, userId, guestLimit);
  } else {
    // Ancienne logique (rétrocompatibilité)
    const filtered = isPro ? places : places.filter((p) => !p.proOnly);
    return filtered;
  }
}

export type PlacesPageCursor = QueryDocumentSnapshot<DocumentData>;

type PlacesPageResult = {
  places: Place[];
  lastDoc: PlacesPageCursor | null;
};

export function listenPlacesPage(
  params: {
    pageSize: number;
    cursor?: PlacesPageCursor | null;
    isPro?: boolean;
  },
  cb: (result: PlacesPageResult) => void,
  onError?: (error: unknown) => void
) {
  const { pageSize, cursor, isPro } = params;
  const constraints = [
    orderBy("createdAt", "desc"),
    limit(pageSize),
    ...(cursor ? [startAfter(cursor)] : []),
  ];
  const q = query(PLACES, ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      const places = snap.docs
        .map((doc) => mapPlaceSnapshot(doc))
        .filter((place): place is Place => Boolean(place));
      const filtered = isPro ? places : places.filter((p) => !p.proOnly);
      const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
      cb({ places: filtered, lastDoc });
    },
    onError
  );
}

export async function getPlace(id: string): Promise<Place | null> {
  const ref = doc(db, "places", id);
  const snap = await getDoc(ref);
  return mapPlaceSnapshot(snap);
}

export function listenPlace(id: string, cb: (p: Place | null) => void) {
  const ref = doc(db, "places", id);
  return onSnapshot(ref, (snap) => {
    cb(mapPlaceSnapshot(snap));
  });
}

type PlacePayloadTimestamp = number | ReturnType<typeof serverTimestamp>;

export function validatePlaceInput(input: PlaceCreateInput) {
  if (!input.title || !input.title.trim()) {
    throw new Error("Missing title");
  }
  if (!input.category || typeof input.category !== "string") {
    throw new Error("Missing category");
  }
  if (typeof input.lat !== "number" || typeof input.lng !== "number") {
    throw new Error("Missing coordinates");
  }
}

export function buildPlacePayload(
  input: PlaceCreateInput,
  options?: {
    createdAt?: PlacePayloadTimestamp;
    updatedAt?: PlacePayloadTimestamp;
  }
) {
  validatePlaceInput(input);
  const { videoUrl, ...rest } = input;
  const proOnly =
    (input.proOnly ?? false) || input.isPublic === false || !!input.isProOnly;
  const isProOnly = !!(input.isProOnly ?? proOnly);
  const createdAt = options?.createdAt ?? serverTimestamp();
  const updatedAt = options?.updatedAt ?? serverTimestamp();
  const payload: Record<string, unknown> = {
    ...rest,
    proOnly,
    isProOnly,
    isDraft: !!input.isDraft,
    dangerIndex:
      typeof input.dangerIndex === "number" ? input.dangerIndex : null,
    paranormalIndex:
      typeof input.paranormalIndex === "number" ? input.paranormalIndex : null,
    missionIds: input.missionIds ?? [],
    isGhost: input.isGhost ?? false,
    isLegend: input.isLegend ?? false,
    historyImages: input.historyImages ?? [],
    tier: input.tier ?? detectTierFromRecord(input),
    blurRadius:
      typeof input.blurRadius === "number" ? input.blurRadius : null,
    accessNotes:
      input.accessNotes !== undefined ? input.accessNotes : null,
    storySteps: Array.isArray(input.storySteps) ? input.storySteps : [],
    lootTags: Array.isArray(input.lootTags) ? input.lootTags : [],
    photos: Array.isArray(input.photos) ? input.photos : [],
    createdAt,
    updatedAt,
  };

  if (typeof rest.lat === "number" && typeof rest.lng === "number") {
    const geohash = computeGeohash(rest.lat, rest.lng);
    if (geohash) {
      payload.geohash = geohash;
    }
  }

  const normalizedVideoUrl = videoUrl?.trim();
  if (normalizedVideoUrl) {
    payload.videoUrl = normalizedVideoUrl;
  }

  return payload;
}

export async function createPlace(input: PlaceCreateInput) {
  const id = uuid();
  const payload = buildPlacePayload(input);
  await setDoc(doc(db, "places", id), payload);
  return id;
}

export async function updatePlaceHistory(
  placeId: string,
  data: {
    historyTitle?: string | null;
    historyShort?: string | null;
    historyFull?: string | null;
    historyFullHtml?: string | null;
    historyShortHtml?: string | null;
    historyImages?: string[];
    adminNotes?: string | null;
    historyIsPro?: boolean;
    historyUpdatedBy?: string | null;
  }
) {
  const updates: Record<string, any> = {};
  if (data.historyTitle !== undefined) {
    updates.historyTitle = data.historyTitle;
  }
  if (data.historyShort !== undefined) {
    updates.historyShort = data.historyShort;
  }
  if (data.historyFull !== undefined) {
    updates.historyFull = data.historyFull;
  }
  if (data.historyFullHtml !== undefined) {
    updates.historyFullHtml = data.historyFullHtml;
  }
  if (data.historyShortHtml !== undefined) {
    updates.historyShortHtml = data.historyShortHtml;
  }
  if (data.historyImages !== undefined) {
    updates.historyImages = data.historyImages;
  }
  if (data.adminNotes !== undefined) {
    updates.adminNotes = data.adminNotes;
  }
  if (data.historyIsPro !== undefined) {
    updates.historyIsPro = data.historyIsPro;
  }
  if (data.historyUpdatedBy !== undefined) {
    updates.historyUpdatedBy = data.historyUpdatedBy;
  }
  if (Object.keys(updates).length === 0) return;

  updates.updatedAt = serverTimestamp();
  updates.historyUpdatedAt = serverTimestamp();

  await updateDoc(doc(db, "places", placeId), updates);
}
