import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { listenUserProfile } from "../services/users";
import { ensureShopCustomerFromAuth, touchCustomerLastLogin } from "../services/shop";

export function useSyncShopCustomer() {
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (user) => {
      profileUnsub?.();
      profileUnsub = null;
      if (!user) return;

      profileUnsub = listenUserProfile(user.uid, async (profile) => {
        const isPro = !!profile.isPro;
        await ensureShopCustomerFromAuth(user, isPro);
        await touchCustomerLastLogin(user.uid, isPro);
      });
    });

    return () => {
      authUnsub();
      profileUnsub?.();
    };
  }, []);
}
