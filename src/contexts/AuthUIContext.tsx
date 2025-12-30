import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { AuthUIContext } from "./authUICore";
import type { AuthMode, AuthUIState, RequireAuthOptions } from "./authUICore";

export function AuthUIProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserRole();
  const [authState, setAuthState] = useState<AuthUIState>({
    open: false,
    mode: "login",
  });
  const pendingPromise = useRef<Promise<boolean> | null>(null);
  const pendingResolver = useRef<((value: boolean) => void) | null>(null);

  const settlePending = useCallback((value: boolean) => {
    if (pendingResolver.current) {
      pendingResolver.current(value);
      pendingResolver.current = null;
    }
    pendingPromise.current = null;
  }, []);

  const openAuthModal = useCallback(
    (mode: AuthMode, options?: Omit<RequireAuthOptions, "mode">) => {
      setAuthState((prev) => {
        const reason = options?.reason ?? prev.reason;
        const redirectTo = options?.redirectTo ?? prev.redirectTo;
        if (prev.open) {
          return {
            ...prev,
            mode,
            reason,
            redirectTo,
          };
        }
        return {
          open: true,
          mode,
          reason,
          redirectTo,
        };
      });
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthState((prev) => ({
      ...prev,
      open: false,
      mode: prev.mode,
      reason: undefined,
      redirectTo: undefined,
    }));
    settlePending(false);
  }, [settlePending]);

  const requireAuth = useCallback(
    (options: RequireAuthOptions = {}) => {
      if (user) {
        if (options.redirectTo) {
          window.history.pushState({}, "", options.redirectTo);
        }
        return Promise.resolve(true);
      }

      openAuthModal(options.mode ?? "login", {
        reason: options.reason,
        redirectTo: options.redirectTo,
      });

      if (pendingPromise.current) {
        return pendingPromise.current;
      }

      const promise = new Promise<boolean>((resolve) => {
        pendingResolver.current = resolve;
      });
      pendingPromise.current = promise;
      return promise;
    },
    [openAuthModal, user]
  );

  useEffect(() => {
    if (user && authState.open) {
      const redirect = authState.redirectTo;
      setAuthState((state) => ({
        ...state,
        open: false,
        reason: undefined,
        redirectTo: undefined,
      }));
      if (redirect) {
        window.history.pushState({}, "", redirect);
      }
      settlePending(true);
    }
  }, [user, authState.open, authState.redirectTo, settlePending]);

  const value = useMemo(
    () => ({
      requireAuth,
      openAuthModal,
      closeAuthModal,
      authState,
    }),
    [authState, closeAuthModal, openAuthModal, requireAuth]
  );

  useEffect(() => {
    if (typeof window === "undefined" || authState.open) return;
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("openAuth");
    const normalizedMode =
      requestedMode === "signup"
        ? "signup"
        : requestedMode === "login"
        ? "login"
        : null;
    if (normalizedMode) {
      openAuthModal(normalizedMode);
      params.delete("openAuth");
      const hash = window.location.hash || "";
      const query =
        params.toString().length > 0 ? `?${params.toString()}` : "";
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${query}${hash}`
      );
      return;
    }
    const storedMode = window.localStorage.getItem("UQ_FORCE_AUTH");
    if (storedMode === "signup" || storedMode === "login") {
      openAuthModal(storedMode as AuthMode);
      window.localStorage.removeItem("UQ_FORCE_AUTH");
    }
  }, [authState.open, openAuthModal]);

  return <AuthUIContext.Provider value={value}>{children}</AuthUIContext.Provider>;
}
