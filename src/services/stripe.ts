import { httpsCallable } from "firebase/functions";
import type { CartItem } from "../contexts/cartLogic";
import { auth, functions } from "../lib/firebase";

export type StripeCheckoutResponse = {
  url: string;
};

export type ProPricePlan = "pro_monthly" | "pro_yearly";

export async function createCheckout(cart: CartItem[]) {
  const callable = httpsCallable(functions, "createStripeCheckoutSession");
  const response = await callable({
    cart: cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      currency: item.currency || "cad",
      quantity: item.quantity,
    })),
  });

  return response.data as StripeCheckoutResponse;
}

type StartProCheckoutOptions = {
  priceId?: ProPricePlan;
};

export async function startProCheckout(options?: StartProCheckoutOptions) {
  console.info("[analytics] pro_checkout_start");
  if (typeof window === "undefined") {
    throw new Error("Impossible de démarrer un paiement côté serveur.");
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error("Connecte-toi pour devenir PRO.");
  }

  const token = await user.getIdToken();
  const origin = window.location.origin.replace(/\/+$/, "");
  const response = await fetch("/api/stripe/create-pro-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      priceId: options?.priceId ?? "pro_monthly",
      successUrl: `${origin}/pro/success`,
      cancelUrl: `${origin}/pro?canceled=1`,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === "string"
        ? payload.error
        : "Impossible de démarrer le paiement PRO.") ?? "";
    throw new Error(message);
  }

  if (!payload || typeof payload.url !== "string") {
    throw new Error("Aucune URL de paiement disponible.");
  }

  return payload.url;
}
