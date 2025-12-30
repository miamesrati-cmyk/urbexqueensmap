import { db } from "../lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Query,
  type Unsubscribe,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import type { Place } from "./places";
import { ensureWritesAllowed } from "../lib/securityGuard";

export type SpotSubmissionStatus = "pending" | "approved" | "rejected" | "all";
export type SpotSubmissionSource = "guest" | "member" | "pro";

export type SpotSubmissionCoordinates = {
  lat: number;
  lng: number;
};

export type SpotSubmission = {
  id: string;
  status: SpotSubmissionStatus;
  createdAt: number;
  createdByUserId?: string;
  createdByDisplayName?: string;
  createdByEmail?: string;
  source: SpotSubmissionSource;
  title: string;
  descriptionShort?: string;
  descriptionFull?: string;
  coordinates: SpotSubmissionCoordinates;
  city?: string;
  region?: string;
  category?: Place["category"];
  riskLevel?: Place["riskLevel"];
  access?: Place["access"];
  isPublic?: boolean;
  isGhost?: boolean;
  isLegend?: boolean;
  isProOnly?: boolean;
  dangerIndex?: number | null;
  paranormalIndex?: number | null;
  notesForAdmin?: string;
  photos?: string[];
  approvedSpotId?: string;
  rejectionReason?: string;
  isDraft?: boolean;
};

export type SpotSubmissionInput = Omit<
  SpotSubmission,
  "id" | "status" | "createdAt"
>;

const SUBMISSIONS = collection(db, "spotSubmissions");

function mapDocToSubmission(id: string, data: Record<string, any>): SpotSubmission {
  const createdAt =
    data.createdAt?.toMillis?.() ?? data.createdAt ?? Date.now();
  return {
    id,
    status: data.status ?? "pending",
    createdAt,
    createdByUserId: data.createdByUserId ?? undefined,
    createdByDisplayName: data.createdByDisplayName ?? undefined,
    createdByEmail: data.createdByEmail ?? undefined,
    source: data.source ?? "guest",
    title: data.title ?? "Spot inconnu",
    descriptionShort: data.descriptionShort ?? undefined,
    descriptionFull: data.descriptionFull ?? undefined,
    coordinates: data.coordinates ?? { lat: 0, lng: 0 },
    city: data.city ?? undefined,
    region: data.region ?? undefined,
    category: data.category ?? undefined,
    riskLevel: data.riskLevel ?? undefined,
    access: data.access ?? undefined,
    isPublic: data.isPublic ?? true,
    isGhost: data.isGhost ?? false,
    isLegend: data.isLegend ?? false,
    isProOnly: data.isProOnly ?? false,
    dangerIndex:
      typeof data.dangerIndex === "number" ? data.dangerIndex : null,
    paranormalIndex:
      typeof data.paranormalIndex === "number" ? data.paranormalIndex : null,
    notesForAdmin: data.notesForAdmin ?? undefined,
    photos: Array.isArray(data.photos) ? data.photos : [],
    approvedSpotId: data.approvedSpotId ?? undefined,
    rejectionReason: data.rejectionReason ?? undefined,
    isDraft: !!data.isDraft,
  };
}

export async function submitSpotSubmission(input: SpotSubmissionInput) {
  ensureWritesAllowed();
  const id = uuid();
  const payload = {
    ...input,
    status: "pending" as SpotSubmissionStatus,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(SUBMISSIONS, id), payload);
  return id;
}

export function listenSpotSubmissions(
  cb: (items: SpotSubmission[]) => void,
  options?: { status?: SpotSubmissionStatus }
): Unsubscribe {
  let q: Query = query(SUBMISSIONS, orderBy("createdAt", "desc"));
  if (options?.status && options.status !== "all") {
    q = query(q, where("status", "==", options.status));
  }
  return onSnapshot(q, (snap) => {
    const out: SpotSubmission[] = [];
    snap.forEach((docSnap) => {
      out.push(mapDocToSubmission(docSnap.id, docSnap.data() as Record<string, any>));
    });
    cb(out);
  });
}

export async function updateSpotSubmission(
  id: string,
  updates: Partial<Omit<SpotSubmission, "id">>
) {
  if (Object.keys(updates).length === 0) return;
  ensureWritesAllowed();
  await updateDoc(doc(SUBMISSIONS, id), updates);
}
