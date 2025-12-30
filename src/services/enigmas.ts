import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

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
}
