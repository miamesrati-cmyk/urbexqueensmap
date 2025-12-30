import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined;
    stripePromise = loadStripe(key || "");
  }
  return stripePromise;
}
