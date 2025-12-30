import { useContext } from "react";
import { AuthUIContext } from "./authUICore";

export function useAuthUI() {
  const context = useContext(AuthUIContext);
  if (!context) {
    throw new Error("useAuthUI must be used within an AuthUIProvider");
  }
  return context;
}
