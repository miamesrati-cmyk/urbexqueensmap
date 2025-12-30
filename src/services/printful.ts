import type { HttpsCallableResult } from "firebase/functions";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

export type PrintfulVariantFile = {
  preview_url?: string;
};

export type PrintfulVariant = {
  id: number;
  retail_price?: string;
  currency?: string;
  name?: string;
  files?: PrintfulVariantFile[];
};

export type UQProduct = {
  id: number | string;
  name: string;
  thumbnail?: string;
  price: number;
  currency: string;
  shortDescription?: string;
};

type FetchPrintfulProductsResponse = {
  products?: UQProduct[];
};

export async function fetchPrintfulProducts(): Promise<UQProduct[]> {
  const callable = httpsCallable<undefined, FetchPrintfulProductsResponse>(
    functions,
    "getPrintfulProducts"
  );

  try {
    const response: HttpsCallableResult<FetchPrintfulProductsResponse> =
      await callable();

    return response.data.products ?? [];
  } catch (err) {
    console.error("printful service error", err);
    throw new Error("Impossible de récupérer les produits Printful.");
  }
}
