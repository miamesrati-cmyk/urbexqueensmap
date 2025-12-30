import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export type QaGlobalObject = {
  triggerReloadBanner?: () => void;
  logout?: () => Promise<void>;
};

export function ensureQaGlobal(): QaGlobalObject {
  if (typeof window === "undefined") {
    return {};
  }
  const global = (window as any).__UQ_QA__ ?? {};
  (window as any).__UQ_QA__ = global;
  return global;
}

export function initQaAuthHooks() {
  const qa = ensureQaGlobal();
  if (!qa.logout) {
    qa.logout = async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("QA logout failed", error);
      }
    };
  }
}
