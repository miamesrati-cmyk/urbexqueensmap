import { useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db } from "../lib/firebase";

export type UserSpotStats = {
  favoritesCount: number;
  completedCount: number;
  savedCount: number;
};

const createEmptyStats = (): UserSpotStats => ({
  favoritesCount: 0,
  completedCount: 0,
  savedCount: 0,
});

export function useUserSpotStats(uid?: string | null) {
  const [stats, setStats] = useState<UserSpotStats>(createEmptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setStats(createEmptyStats());
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    const ref = collection(db, "users", uid, "spotActions");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const nextStats = {
          favoritesCount: 0,
          completedCount: 0,
          savedCount: 0,
        };
        snapshot.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          if (data.favorited) {
            nextStats.favoritesCount += 1;
          }
          if (data.completed) {
            nextStats.completedCount += 1;
          }
          if (data.saved) {
            nextStats.savedCount += 1;
          }
        });
        setStats(nextStats);
        setLoading(false);
      },
      (err) => {
        console.error("[useUserSpotStats] snapshot", err);
        setStats(createEmptyStats());
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [uid]);

  return {
    ...stats,
    loading,
  };
}
