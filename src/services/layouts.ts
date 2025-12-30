import { db } from "../lib/firebase";
import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from "firebase/firestore";

type MapLayoutZoneKey = "top" | "left" | "right" | "bottomRight" | "floating";

type MapLayoutBlockId = "search" | "proBar" | "hostBadge" | "spotHandle";

type MapLayoutZones = Record<MapLayoutZoneKey, MapLayoutBlockId[]>;

type MapLayoutPayload = {
  zones: MapLayoutZones;
  updatedAt?: number | null;
  updatedBy?: string | null;
};

const ADMIN_LAYOUT_DOC = doc(db, "adminConfig", "layouts");

const DEFAULT_LAYOUT: MapLayoutZones = {
  top: ["search", "proBar"],
  left: [],
  right: ["hostBadge"],
  bottomRight: ["spotHandle"],
  floating: [],
};

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as Timestamp).toMillis();
  }
  return null;
}

export const MAP_LAYOUT_ZONE_KEYS: MapLayoutZoneKey[] = [
  "top",
  "left",
  "right",
  "bottomRight",
  "floating",
];

export const DEFAULT_MAP_LAYOUT: MapLayoutZones = DEFAULT_LAYOUT;

export function listenGlobalMapLayout(
  onUpdate: (layout: MapLayoutPayload | null) => void,
  onError?: (error: unknown) => void
) {
  return onSnapshot(
    ADMIN_LAYOUT_DOC,
    (snap) => {
      const data = snap.data();
      if (!data?.mapLayout?.zones) {
        onUpdate(null);
        return;
      }
      const payload = data.mapLayout;
      onUpdate({
        zones: payload.zones ?? DEFAULT_LAYOUT,
        updatedAt: toMillis(payload.updatedAt),
        updatedBy: payload.updatedBy ?? null,
      });
    },
    onError
  );
}

export async function saveGlobalMapLayout(
  zones: MapLayoutZones,
  updatedBy?: string | null
) {
  await setDoc(
    ADMIN_LAYOUT_DOC,
    {
      mapLayout: {
        zones,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy ?? null,
      },
    },
    { merge: true }
  );
}

export function resetGlobalMapLayout(updatedBy?: string | null) {
  return saveGlobalMapLayout(DEFAULT_LAYOUT, updatedBy);
}

export type {
  MapLayoutZoneKey,
  MapLayoutBlockId,
  MapLayoutZones,
  MapLayoutPayload,
};
