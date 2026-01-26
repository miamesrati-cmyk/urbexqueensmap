import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { captureException } from "../lib/monitoring";

export type Enigma = {
  id: string;
  spotId: string;
  title: string;
  hint: string;
  answerKeyword: string;
  xpReward: number;
};

export async function getEnigmasForSpot(spotId: string): Promise<Enigma[]> {
  const q = query(collection(db, "enigmas"), where("spotId", "==", spotId));
  try {
    const snap = await getDocs(q);
    const list: Enigma[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      list.push({
        id: docSnap.id,
        spotId: data.spotId,
        title: data.title ?? "Énigme",
        hint: data.hint ?? "",
        answerKeyword: (data.answerKeyword ?? "").toString(),
        xpReward: typeof data.xpReward === "number" ? data.xpReward : 50,
      });
    });
    return list;
  } catch (e: any) {
    if (e?.code === "permission-denied") {
      if (import.meta.env.DEV) {
        console.warn(`[getEnigmasForSpot] permission-denied: spotId=${spotId}`);
      }
      return [];
    }
    captureException(e);
    return [];
  }
}
