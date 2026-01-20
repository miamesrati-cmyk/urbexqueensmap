import { useEffect, useMemo, useState } from "react";
import { getUserProfile, type UserProfile } from "../services/userProfiles";
import { makeStormLogger } from "../utils/stormLogger";
import { scheduleDeferredTask } from "../utils/scheduleDeferredTask";

export type LiveUserProfileSummary = {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  avatarCropX: number;
  avatarCropY: number;
  avatarZoom: number;
  avatarMode: "cover" | "logo";
  isPro: boolean;
  isAdmin?: boolean | string | number | null;
  rolesAdmin?: boolean | string | number | null;
};

function areProfilesEqual(
  a: LiveUserProfileSummary | undefined,
  b: LiveUserProfileSummary
) {
  if (!a) return false;
  return (
    a.uid === b.uid &&
    a.displayName === b.displayName &&
    a.username === b.username &&
    a.photoURL === b.photoURL &&
    a.avatarCropX === b.avatarCropX &&
    a.avatarCropY === b.avatarCropY &&
    a.avatarZoom === b.avatarZoom &&
    a.avatarMode === b.avatarMode &&
    a.isPro === b.isPro &&
    a.isAdmin === b.isAdmin &&
    a.rolesAdmin === b.rolesAdmin
  );
}

function buildLiveProfile(uid: string, profile: UserProfile): LiveUserProfileSummary {
  return {
    uid,
    displayName: profile.displayName,
    username: profile.username ?? profile.qrSlug ?? null,
    photoURL: profile.photoURL,
    avatarCropX: profile.avatarCropX ?? 0,
    avatarCropY: profile.avatarCropY ?? 0,
    avatarZoom: profile.avatarZoom ?? 1,
    avatarMode: profile.avatarMode ?? "cover",
    isPro: !!profile.isPro,
    isAdmin: profile.isAdmin ?? null,
    rolesAdmin: profile.roles?.admin ?? null,
  };
}

export function useLiveUserProfiles(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, LiveUserProfileSummary>>({});
  const normalized = useMemo(
    () => Array.from(new Set(uids.filter((uid) => !!uid))),
    [uids]
  );
  const logLiveProfileStorm = useMemo(
    () =>
      makeStormLogger<LiveUserProfileSummary>("liveUserProfile", (profile) => ({
        uid: profile.uid,
        displayName: profile.displayName,
      })),
    []
  );

  useEffect(() => {
    setProfiles((prev) => {
      const next: Record<string, LiveUserProfileSummary> = {};
      normalized.forEach((uid) => {
        if (prev[uid]) {
          next[uid] = prev[uid];
        }
      });
      return next;
    });

    if (normalized.length === 0) {
      return () => {};
    }

    let active = true;
    normalized.forEach((uid) => {
      if (!uid) return;
      scheduleDeferredTask(
        async () => {
          const raw = await getUserProfile(uid);
          if (!active) return;
          const nextProfile = buildLiveProfile(uid, raw);
          setProfiles((prev) => {
            if (areProfilesEqual(prev[uid], nextProfile)) {
              return prev;
            }
            logLiveProfileStorm(nextProfile);
            return { ...prev, [uid]: nextProfile };
          });
        },
        { key: `profile:${uid}`, ttlMs: 10 * 60_000 }
      ).catch((error) => {
        if (import.meta.env.DEV) {
          console.error("[UQ] fetchUserProfile failed", uid, error);
        }
      });
    });

    return () => {
      active = false;
    };
  }, [normalized, logLiveProfileStorm]);

  return profiles;
}

export function useLiveUserProfile(uid?: string | null) {
  const profiles = useLiveUserProfiles(uid ? [uid] : []);
  return uid ? profiles[uid] ?? null : null;
}
