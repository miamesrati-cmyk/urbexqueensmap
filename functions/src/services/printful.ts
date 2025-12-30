import * as functions from "firebase-functions";

const BASE_URL = "https://api.printful.com";

export async function printfulRequest(endpoint: string, options: any = {}) {
  const key = functions.config().printful?.key as string | undefined;
  if (!key) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Printful key is not configured in functions config (printful.key)."
    );
  }

  const res = await fetch(BASE_URL + endpoint, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    functions.logger.error("Printful API error", { status: res.status, text });
    throw new functions.https.HttpsError(
      "internal",
      `Printful request failed with status ${res.status}`
    );
  }

  return res.json();
}

export async function fetchPrintfulProducts() {
  // TODO: map paginated products if needed (Printful paginates)
  return printfulRequest("/store/products");
}

export async function fetchPrintfulOrders() {
  // TODO: support pagination / filters if needed
  return printfulRequest("/orders");
}

export async function createPrintfulOrder(body: any) {
  return printfulRequest("/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// TODOs for future integration:
// - Use printfulRequest to sync variants and map to shopProducts with size/color variants
// - Map Printful orders to shopOrders with status mapping
// - Securely store PRINTFUL_API_KEY in functions config (never on the client)
