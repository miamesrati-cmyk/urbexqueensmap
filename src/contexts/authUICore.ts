import { createContext } from "react";

export type AuthMode = "login" | "signup";

export type RequireAuthOptions = {
  reason?: string;
  redirectTo?: string;
  mode?: AuthMode;
};

export type AuthUIState = {
  open: boolean;
  mode: AuthMode;
  reason?: string;
  redirectTo?: string;
};

export type AuthUIContextValue = {
  requireAuth: (options?: RequireAuthOptions) => Promise<boolean>;
  openAuthModal: (mode: AuthMode, options?: Omit<RequireAuthOptions, "mode">) => void;
  closeAuthModal: () => void;
  authState: AuthUIState;
};

export const AuthUIContext = createContext<AuthUIContextValue | undefined>(
  undefined
);
