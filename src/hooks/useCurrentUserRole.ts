import { useMemo } from "react";
import type { User } from "firebase/auth";
import { isUserAdmin, isUserSuperAdmin } from "../services/users";
import { useProStatus } from "../contexts/ProStatusContext";

export type CurrentUserRole = {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  isPro: boolean;
  isAdminLoading: boolean;
  isSuperAdmin: boolean;
  role: "admin" | "pro" | "member" | "guest";
};

export function useCurrentUserRole(): CurrentUserRole {
  const { user, profile, profileReady, isPro, authReady } = useProStatus();
  const isAdmin = useMemo(() => isUserAdmin(profile), [profile]);
  const isSuperAdmin = useMemo(() => isUserSuperAdmin(profile), [profile]);
  const isAdminLoading = Boolean(user && !profileReady);
  const role: CurrentUserRole["role"] = user
    ? isAdmin
      ? "admin"
      : isPro
      ? "pro"
      : "member"
    : "guest";

  return {
    user,
    isLoading: !authReady,
    isAdmin,
    isPro,
    isAdminLoading,
    isSuperAdmin,
    role,
  };
}
