import { db } from "../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";

export type SpotTier = "STANDARD" | "EPIC" | "GHOST";

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
};

const PLACES = collection(db, "places");

function toMillis(value: unknown): number | undefined {
  if (!value) return undefined;
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

function detectTierFromRecord(x: any): SpotTier {
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

export function listenPlaces(
  cb: (p: Place[]) => void,
  options?: { isPro?: boolean },
  onError?: (error: unknown) => void
) {
  const q = query(PLACES, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const out: Place[] = [];
      snap.forEach((d) => {
        const x: any = d.data();
        if (x.isDraft) return;
        const status = normalizeStatus(x.status) ?? "published";
        if (status !== "published") return;
        const proOnly = (x.proOnly ?? false) || x.isPublic === false || !!x.isProOnly;
        const isProOnly = !!(x.isProOnly ?? proOnly);
        const isGhost = x.isGhost ?? false;
        const isLegend = x.isLegend ?? false;
        const createdAt = toMillis(x.createdAt) ?? Date.now();
        const updatedAt = toMillis(x.updatedAt);
        const historyUpdatedAt = toMillis(x.historyUpdatedAt);
        out.push({
          id: d.id,
          title: x.title,
          name: x.name ?? x.title,
          description: x.description ?? "",
          category: x.category ?? "autre",
          riskLevel: x.riskLevel ?? "moyen",
          access: x.access ?? "moyen",
          lat: x.lat,
          lng: x.lng,
          createdAt,
          updatedAt,
          addedBy: x.addedBy ?? "anon",
          isPublic: x.isPublic ?? true,
          city: x.city ?? undefined,
          region: x.region ?? undefined,
          history: x.history ?? "",
          dangerLevel: x.dangerLevel ?? null,
          dangerLabel: x.dangerLabel ?? "",
          dangerIndex:
            typeof x.dangerIndex === "number" ? x.dangerIndex : null,
          paranormalIndex:
            typeof x.paranormalIndex === "number" ? x.paranormalIndex : null,
          parking: x.parking ?? "",
          entrances: x.entrances ?? "",
          communityScore: x.communityScore ?? null,
          popularity: x.popularity ?? 0,
          tags: x.tags ?? [],
          proOnly,
          isProOnly,
          isGhost,
          isLegend,
          missionIds: Array.isArray(x.missionIds) ? x.missionIds : [],
          isDraft: !!x.isDraft,
          videoUrl: x.videoUrl ?? undefined,
          historyTitle: x.historyTitle,
          historyShort: x.historyShort,
          historyShortHtml: x.historyShortHtml ?? "",
          historyFull: x.historyFull,
          historyFullHtml: x.historyFullHtml,
          historyIsPro: x.historyIsPro ?? false,
          historyImages: Array.isArray(x.historyImages) ? x.historyImages : [],
          historyUpdatedAt,
          tier: detectTierFromRecord(x),
          blurRadius:
            typeof x.blurRadius === "number" ? x.blurRadius : null,
          accessNotes: x.accessNotes ?? "",
          storySteps: Array.isArray(x.storySteps) ? x.storySteps : [],
          lootTags: Array.isArray(x.lootTags) ? x.lootTags : [],
          photos: Array.isArray(x.photos) ? x.photos : [],
          historyUpdatedBy: x.historyUpdatedBy ?? null,
          adminNotes: x.adminNotes ?? "",
          archives: x.archives ?? [],
          status,
        });
      });
      const filtered = options?.isPro ? out : out.filter((p) => !p.proOnly);
      cb(filtered);
    },
    onError
  );
}

export async function getPlace(id: string): Promise<Place | null> {
  const ref = doc(db, "places", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const x: any = snap.data();
  if (x.isDraft) return null;
  const status = normalizeStatus(x.status) ?? "published";
  if (status !== "published") return null;
  const proOnly = (x.proOnly ?? false) || x.isPublic === false || !!x.isProOnly;
  const isProOnly = !!(x.isProOnly ?? proOnly);
  const isGhost = x.isGhost ?? false;
  const isLegend = x.isLegend ?? false;
  const createdAt = toMillis(x.createdAt) ?? Date.now();
  const updatedAt = toMillis(x.updatedAt);
  const historyUpdatedAt = toMillis(x.historyUpdatedAt);
  return {
    id: snap.id,
    title: x.title,
    name: x.name ?? x.title,
    description: x.description ?? "",
    category: x.category ?? "autre",
    riskLevel: x.riskLevel ?? "moyen",
    access: x.access ?? "moyen",
    lat: x.lat,
    lng: x.lng,
    createdAt,
    updatedAt,
    addedBy: x.addedBy ?? "anon",
    isPublic: x.isPublic ?? true,
    approved: x.approved ?? false,
    history: x.history ?? "",
    dangerLevel: x.dangerLevel ?? null,
    dangerLabel: x.dangerLabel ?? "",
    dangerIndex:
      typeof x.dangerIndex === "number" ? x.dangerIndex : null,
    paranormalIndex:
      typeof x.paranormalIndex === "number" ? x.paranormalIndex : null,
    parking: x.parking ?? "",
    entrances: x.entrances ?? "",
    communityScore: x.communityScore ?? null,
    popularity: x.popularity ?? 0,
    tags: x.tags ?? [],
    proOnly,
    isProOnly,
    isGhost,
    isLegend,
    missionIds: Array.isArray(x.missionIds) ? x.missionIds : [],
    isDraft: !!x.isDraft,
    videoUrl: x.videoUrl ?? undefined,
    historyTitle: x.historyTitle,
    historyShort: x.historyShort,
    historyShortHtml: x.historyShortHtml ?? "",
    historyFull: x.historyFull,
    historyFullHtml: x.historyFullHtml,
    historyIsPro: x.historyIsPro ?? false,
    historyImages: Array.isArray(x.historyImages) ? x.historyImages : [],
    historyUpdatedAt,
    historyUpdatedBy: x.historyUpdatedBy ?? null,
    adminNotes: x.adminNotes ?? "",
    archives: x.archives ?? [],
    status,
  };
}

export function listenPlace(id: string, cb: (p: Place | null) => void) {
  const ref = doc(db, "places", id);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const x: any = snap.data();
    if (x.isDraft) {
      cb(null);
      return;
    }
    const status = normalizeStatus(x.status) ?? "published";
    if (status !== "published") {
      cb(null);
      return;
    }
    const proOnly = (x.proOnly ?? false) || x.isPublic === false || !!x.isProOnly;
    const isProOnly = !!(x.isProOnly ?? proOnly);
    const isGhost = x.isGhost ?? false;
    const isLegend = x.isLegend ?? false;
    const createdAt = toMillis(x.createdAt) ?? Date.now();
    const updatedAt = toMillis(x.updatedAt);
    const historyUpdatedAt = toMillis(x.historyUpdatedAt);
    cb({
      id: snap.id,
      title: x.title,
      name: x.name ?? x.title,
      description: x.description ?? "",
      category: x.category ?? "autre",
      riskLevel: x.riskLevel ?? "moyen",
      access: x.access ?? "moyen",
      lat: x.lat,
      lng: x.lng,
      createdAt,
      updatedAt,
      addedBy: x.addedBy ?? "anon",
      isPublic: x.isPublic ?? true,
      city: x.city ?? undefined,
      region: x.region ?? undefined,
      approved: x.approved ?? false,
      history: x.history ?? "",
      dangerLevel: x.dangerLevel ?? null,
      dangerLabel: x.dangerLabel ?? "",
      dangerIndex:
        typeof x.dangerIndex === "number" ? x.dangerIndex : null,
      paranormalIndex:
        typeof x.paranormalIndex === "number" ? x.paranormalIndex : null,
      parking: x.parking ?? "",
      entrances: x.entrances ?? "",
      communityScore: x.communityScore ?? null,
      popularity: x.popularity ?? 0,
      tags: x.tags ?? [],
      proOnly,
      isProOnly,
      isGhost,
      isLegend,
      missionIds: Array.isArray(x.missionIds) ? x.missionIds : [],
      videoUrl: x.videoUrl ?? undefined,
      historyTitle: x.historyTitle,
      historyShort: x.historyShort,
      historyShortHtml: x.historyShortHtml ?? "",
      historyFull: x.historyFull,
      historyFullHtml: x.historyFullHtml,
      historyIsPro: x.historyIsPro ?? false,
      historyImages: Array.isArray(x.historyImages) ? x.historyImages : [],
      historyUpdatedAt,
      historyUpdatedBy: x.historyUpdatedBy ?? null,
      adminNotes: x.adminNotes ?? "",
      archives: x.archives ?? [],
      status,
    });
  });
}

export async function createPlace(input: Omit<Place,"id"|"createdAt">) {
  const id = uuid();
  const proOnly = (input.proOnly ?? false) || input.isPublic === false || !!input.isProOnly;
  const isProOnly = !!(input.isProOnly ?? proOnly);
  const { videoUrl, ...rest } = input;
  const payload: Record<string, any> = {
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const normalizedVideoUrl = videoUrl?.trim();
  if (normalizedVideoUrl) {
    payload.videoUrl = normalizedVideoUrl;
  }

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
