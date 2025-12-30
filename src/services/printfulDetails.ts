import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

export async function fetchProductDetails(productId: number | string) {
  const callable = httpsCallable(functions, "getPrintfulProductDetails");
  const result = await callable({ productId });
  return result.data;
}
