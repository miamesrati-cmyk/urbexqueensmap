import { useEffect, useMemo, useRef, useState } from "react";
import { listenUserProfile } from "../services/userProfiles";
import { makeStormLogger } from "../utils/stormLogger";

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

export function useLiveUserProfiles(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, LiveUserProfileSummary>>({});
  const unsubs = useRef<Record<string, () => void>>({});
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
    normalized.forEach((uid) => {
      if (unsubs.current[uid]) return;
      unsubs.current[uid] = listenUserProfile(uid, (profile) => {
        const nextProfile = {
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
        setProfiles((prev) => {
          if (areProfilesEqual(prev[uid], nextProfile)) {
            return prev;
          }
          logLiveProfileStorm(nextProfile);
          return {
            ...prev,
            [uid]: nextProfile,
          };
        });
      });
    });

    Object.keys(unsubs.current)
      .filter((uid) => !normalized.includes(uid))
      .forEach((uid) => {
        unsubs.current[uid]?.();
        delete unsubs.current[uid];
        setProfiles((prev) => {
          const next = { ...prev };
          delete next[uid];
          return next;
        });
      });

    return () => {
      Object.values(unsubs.current).forEach((fn) => fn());
      unsubs.current = {};
    };
  }, [normalized, logLiveProfileStorm]);

  return profiles;
}

export function useLiveUserProfile(uid?: string | null) {
  const profiles = useLiveUserProfiles(uid ? [uid] : []);
  return uid ? profiles[uid] ?? null : null;
}
