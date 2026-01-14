import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import * as Sentry from "@sentry/node";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import {
  createPrintfulOrder,
  fetchPrintfulOrders,
  fetchPrintfulProducts,
} from "./services/printful";
import {
  enforceRateLimit,
  requireAppCheck,
  requireAppCheckRequest,
  logSecurityEvent,
} from "./security";
import {
  ADMIN_UI_CONFIG_SCHEMA_VERSION,
  DEFAULT_ADMIN_UI_CONFIG,
} from "../../shared/adminUiConfig";
import type { AdminUiConfig } from "../../shared/adminUiConfig";
import { sanitizeText } from "./sanitization";
import { computeGeohash } from "./lib/geohash";
import type { File } from "@google-cloud/storage";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const QUARANTINE_BUCKET = functions.config().security?.quarantine_bucket;

const printfulKey = functions.config().printful?.key as string | undefined;
const stripeSecret = functions.config().stripe?.secret as string | undefined;
const stripeWebhookSecret = functions.config().stripe
  ?.webhook_secret as string | undefined;
const stripePriceProMonthly = functions.config().stripe
  ?.price_pro_monthly as string | undefined;
const stripePriceProYearly = functions.config().stripe
  ?.price_pro_yearly as string | undefined;

if (!stripeSecret) {
  functions.logger.error(
    "Stripe secret key missing in functions.config().stripe.secret"
  );
}
if (!stripeWebhookSecret) {
  functions.logger.warn(
    "Stripe webhook secret missing in functions.config().stripe.webhook_secret"
  );
}
if (!stripePriceProMonthly) {
  functions.logger.warn(
    "Stripe price ID for PRO monthly missing in functions.config().stripe.price_pro_monthly"
  );
}

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const PRICE_ALIASES: Record<string, string> = {};
const ALLOWED_PRICE_IDS = new Set<string>();
const STRIPE_EVENTS_COLLECTION = "stripe_events_processed";

const sentryDsn =
  functions.config().sentry?.dsn ??
  process.env.SENTRY_DSN ??
  process.env.VITE_SENTRY_DSN;
const sentryRelease =
  functions.config().sentry?.release ?? process.env.SENTRY_RELEASE;
const sentryEnv =
  functions.config().sentry?.environment ?? process.env.NODE_ENV ?? "production";
const shouldInitSentry =
  typeof sentryDsn === "string" && sentryDsn.trim().length > 0;

const CSP_REPORT_SAMPLE_RATE = (() => {
  const parsed = Number(process.env.CSP_REPORT_SAMPLE_RATE ?? "");
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }
  return 0.1;
})();
const CSP_REPORT_HISTORY_LIMIT = (() => {
  const parsed = Number(process.env.CSP_REPORT_HISTORY_LIMIT ?? "");
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 200;
})();
const seenCspViolations = new Set<string>();
const cspViolationHistory: string[] = [];

function shouldReportCspViolation(key: string) {
  if (seenCspViolations.has(key)) {
    return false;
  }
  seenCspViolations.add(key);
  cspViolationHistory.push(key);
  if (cspViolationHistory.length > CSP_REPORT_HISTORY_LIMIT) {
    const oldest = cspViolationHistory.shift();
    if (oldest) {
      seenCspViolations.delete(oldest);
    }
  }
  return true;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

if (shouldInitSentry) {
  Sentry.init({
    dsn: sentryDsn,
    release: sentryRelease,
    environment: sentryEnv,
  });
}

function captureStripeIssue(
  error: unknown,
  extras: Record<string, unknown | undefined> = {}
) {
  if (!shouldInitSentry) {
    return;
  }
  Sentry.withScope((scope) => {
    Object.entries(extras).forEach(([key, value]) => {
      if (value !== undefined) {
        scope.setExtra(key, value);
      }
    });
    scope.setTag("feature", "stripe");
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureException(new Error(String(error)));
    }
  });
}

if (stripePriceProMonthly) {
  PRICE_ALIASES["pro_monthly"] = stripePriceProMonthly;
  ALLOWED_PRICE_IDS.add(stripePriceProMonthly);
}

if (stripePriceProYearly) {
  PRICE_ALIASES["pro_yearly"] = stripePriceProYearly;
  ALLOWED_PRICE_IDS.add(stripePriceProYearly);
}

const cartItemSchema = z.object({
  price: z.preprocess((value) => {
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  }, z.number().positive()),
  quantity: z.number().int().positive().optional(),
  name: z.string().min(1).max(100),
  currency: z.string().min(3).max(5).optional(),
});

const checkoutSchema = z.object({
  cart: z.array(cartItemSchema).min(1),
});

if (!printfulKey) {
  functions.logger.warn("⚠️ Printful key is not set in functions config.");
}

const PRINTFUL_PRODUCTS_URL =
  "https://api.printful.com/store/products?include=sync_variants";
const PRINTFUL_PRODUCT_DETAIL_URL = (id: string | number) =>
  `https://api.printful.com/store/products/${id}?include=sync_variants`;

type UQProduct = {
  id: number | string;
  name: string;
  thumbnail?: string;
  price: number;
  currency: string;
  shortDescription?: string;
};

function parseVariantPrice(raw?: string | number | null) {
  if (!raw) return null;
  const normalized = typeof raw === "string" ? raw.replace(",", ".") : String(raw);
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

const ADMIN_SYMBOLS = new Set(["yes", "true", "1"]);

function normalizeAdminValue(value: unknown): string | boolean | number | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim().toLowerCase();
  return null;
}

function isTruthyAdminValue(value: unknown): boolean {
  const normalized = normalizeAdminValue(value);
  if (normalized === true) return true;
  if (typeof normalized === "number") {
    return normalized === 1;
  }
  if (typeof normalized === "string") {
    return ADMIN_SYMBOLS.has(normalized);
  }
  return false;
}

function mapHttpsErrorCodeToStatus(
  code: functions.https.FunctionsErrorCode
): number {
  switch (code) {
    case "ok":
      return 200;
    case "cancelled":
      return 499;
    case "unknown":
      return 500;
    case "invalid-argument":
      return 400;
    case "deadline-exceeded":
      return 504;
    case "not-found":
      return 404;
    case "already-exists":
      return 409;
    case "permission-denied":
      return 403;
    case "resource-exhausted":
      return 429;
    case "failed-precondition":
      return 400;
    case "aborted":
      return 409;
    case "out-of-range":
      return 400;
    case "unimplemented":
      return 501;
    case "internal":
      return 500;
    case "unavailable":
      return 503;
    case "data-loss":
      return 500;
    case "unauthenticated":
      return 401;
    default:
      return 500;
  }
}

function getRequestOrigin(req: functions.https.Request) {
  const origin =
    req.header("origin") ??
    req.header("x-forwarded-proto") ??
    `${req.protocol}://${req.get("host")}`;

  if (!origin) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Impossible de déterminer l’origine de la requête."
    );
  }

  return origin.replace(/\/+$/, "");
}

function setCorsHeaders(req: functions.https.Request, res: functions.Response) {
  const requestOrigin = req.header("origin");
  if (requestOrigin) {
    res.set("Access-Control-Allow-Origin", requestOrigin);
  } else {
    res.set("Access-Control-Allow-Origin", "*");
  }
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Firebase-AppCheck"
  );
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

async function verifyFirebaseIdToken(
  req: functions.https.Request
): Promise<admin.auth.DecodedIdToken> {
  const header = req.header("Authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Token d’authentification manquant."
    );
  }

  const token = match[1];
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    functions.logger.warn("Firebase token invalid", {
      error: err,
      token: token ? "[REDACTED]" : null,
    });
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Token invalide."
    );
  }
}

function resolveProPriceId(candidate: unknown): string | null {
  if (typeof candidate === "string") {
    const normalized = candidate.trim();
    if (normalized.length > 0) {
      const alias = PRICE_ALIASES[normalized];
      if (alias) {
        return alias;
      }
      if (ALLOWED_PRICE_IDS.has(normalized)) {
        return normalized;
      }
    }
  }
  return stripePriceProMonthly ?? null;
}

function respondWithHttpError(
  res: functions.Response,
  err: unknown,
  fallbackMessage: string,
  code?: string
) {
  let message = fallbackMessage;
  let status = 500;

  if (err instanceof functions.https.HttpsError) {
    status = mapHttpsErrorCodeToStatus(err.code);
    message = err.message;
  } else {
    functions.logger.error("Stripe endpoint error", err);
  }

  const payload: { error: string; code?: string } = { error: message };
  if (code) {
    payload.code = code;
  }
  return res.status(status).json(payload);
}

const PRO_DOWNGRADE_STATUSES = new Set([
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

function isSubscriptionActive(status: string | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return !PRO_DOWNGRADE_STATUSES.has(normalized);
}

async function ensureAdminRequest(req: functions.https.Request, action: string) {
  const header = req.header("Authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentification requise."
    );
  }
  const idToken = match[1];
  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Token invalide."
    );
  }

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const data = userSnap.exists ? userSnap.data() : null;
  const isAdminFlag = isTruthyAdminValue(data?.isAdmin);
  const isAdminRole = isTruthyAdminValue(data?.roles?.admin);
  if (!isAdminFlag && !isAdminRole) {
    await logSecurityEvent({
      type: "function.admin.accessDenied",
      detail: `User ${decoded.uid} attempted ${action} without admin rights.`,
      severity: "warning",
      userId: decoded.uid,
      metadata: {
        action,
      },
    });
    throw new functions.https.HttpsError(
      "permission-denied",
      "Accès administrateur requis."
    );
  }
}

async function requireAdmin(context: functions.https.CallableContext, action: string) {
  requireAppCheck(context, action);
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentification requise."
    );
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const data = userSnap.exists ? userSnap.data() : null;
  const roles = data?.roles;
  const isAdminRole = isTruthyAdminValue(roles?.admin);
  const isAdminFlag = isTruthyAdminValue(data?.isAdmin);

  if (isAdminFlag || isAdminRole) {
    return uid;
  }

  await logSecurityEvent({
    type: "function.admin.accessDenied",
    detail: `User ${uid} attempted ${action} without admin rights.`,
    severity: "warning",
    userId: uid,
    metadata: {
      action,
    },
  });

  throw new functions.https.HttpsError(
    "permission-denied",
    "Accès administrateur requis."
  );
}

const publishThemeSchema = z.object({
  themeId: z.string().min(1),
  versionId: z.string().min(1),
  note: z.string().max(1000).optional(),
});

const overlayPublishSchema = z.object({
  overlayId: z.string().min(1),
  versionId: z.string().min(1),
  note: z.string().max(1000).optional(),
});

const overlayRollbackSchema = z.object({
  overlayId: z.string().min(1),
  versionId: z.string().min(1),
});

const mapStyleValueSchema = z.enum(["default", "night", "satellite"]);

const overlayDevicesSchema = z.enum(["mobile", "tablet", "desktop"]);
const overlaySlotsSchema = z.enum([
  "top",
  "left",
  "right",
  "bottomRight",
  "floating",
]);

const overlayVisibilitySchema = z
  .object({
    roles: z.array(z.string().min(1)).optional(),
    devices: z.array(overlayDevicesSchema).optional(),
    minWidth: z.number().min(0).optional(),
    maxWidth: z.number().min(0).optional(),
    minZoom: z.number().min(0).optional(),
    maxZoom: z.number().min(0).optional(),
    mapStyles: z.array(mapStyleValueSchema).optional(),
  })
  .passthrough();

const overlayComponentSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1).max(100),
    slot: overlaySlotsSchema,
    order: z.number().int().nonnegative(),
    content: z.string().max(200).optional(),
    visibility: overlayVisibilitySchema.optional(),
  })
  .passthrough();

const overlayVersionSchema = z
  .object({
    components: z.array(overlayComponentSchema),
  })
  .passthrough();

const themeTokensSchema = z.record(z.string(), z.any()).optional();

function getZodErrorMessage(error: z.ZodError) {
  return (
    error.flatten().formErrors?.[0] ??
    error.issues?.[0]?.message ??
    "Données invalides."
  );
}

export const getPrintfulProducts = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    requireAppCheck(context, "fetch Printful products");
    enforceRateLimit(context, "getPrintfulProducts");
    const apiKey = functions.config().printful?.key as string | undefined;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Printful API key not set in functions config."
      );
    }

    try {
      const res = await fetch(PRINTFUL_PRODUCTS_URL, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        functions.logger.error("Printful error:", {
          status: res.status,
          text,
        });
        throw new functions.https.HttpsError(
          "unknown",
          "Printful API request failed."
        );
      }

      const json = await res.json();
      const list = Array.isArray(json?.result) ? json.result : [];
      const products: UQProduct[] = list.map((p: any) => {
        const firstVariant =
          (p.sync_variants && p.sync_variants[0]) ||
          (p.variants && p.variants[0]) ||
          {};
        const rawPrice = firstVariant?.retail_price ?? p.retail_price ?? null;
        const currency = (firstVariant?.currency || p.currency || "CAD").toUpperCase();
        const parsedPrice = parseVariantPrice(rawPrice);
        const price = parsedPrice !== null && parsedPrice > 0 ? parsedPrice : 39.99;
        const thumbnail =
          p.thumbnail_url ||
          firstVariant?.files?.[0]?.preview_url ||
          firstVariant?.thumbnail_url;

        return {
          id: p.id,
          name: p.name,
          thumbnail,
          price,
          currency,
          shortDescription: p.description ?? p["short_description"] ?? undefined,
        };
      });

      return { products };
    } catch (err) {
      functions.logger.error("Printful fetch error:", err);
      throw new functions.https.HttpsError(
        "unknown",
        "Error contacting Printful."
      );
    }
  });

export const getPrintfulProductDetails = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    requireAppCheck(context, "fetch Printful product details");
    enforceRateLimit(context, "getPrintfulProductDetails");
    const apiKey = functions.config().printful?.key as string | undefined;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Printful API key not set in functions config."
      );
    }

    const productId = data?.productId;
    if (!productId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "productId requis"
      );
    }

    try {
      const res = await fetch(PRINTFUL_PRODUCT_DETAIL_URL(productId), {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        functions.logger.error("Printful details error:", {
          status: res.status,
          text,
        });
        throw new functions.https.HttpsError(
          "unknown",
          "Impossible de récupérer le produit."
        );
      }

      const json = await res.json();
      return json;
    } catch (err) {
      functions.logger.error("Printful details error:", err);
      throw new functions.https.HttpsError(
        "unknown",
        "Impossible de récupérer le produit."
      );
    }
  });

const FORCE_INACTIVE_EVENTS = new Set([
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
]);

type ProEntitlement = {
  isPro: boolean;
  status: string;
  priceId: string | null;
  currentPeriodEnd: admin.firestore.Timestamp | null;
  cancelAtPeriodEnd: boolean;
};

function toFirestoreTimestamp(value?: number): admin.firestore.Timestamp {
  const millis = (value ?? Math.floor(Date.now() / 1000)) * 1000;
  return admin.firestore.Timestamp.fromMillis(millis);
}

function resolveSubscriptionId(
  reference?: string | Stripe.Subscription | null
): string | null {
  if (!reference) return null;
  if (typeof reference === "string") {
    return reference;
  }
  return reference.id ?? null;
}

function getCustomerIdFromSubscription(
  subscription: Stripe.Subscription
): string | null {
  if (!subscription.customer) return null;
  if (typeof subscription.customer === "string") {
    return subscription.customer;
  }
  return subscription.customer.id ?? null;
}

export const stripeWebhook = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Méthode non autorisée.");
      return;
    }

    if (!stripe || !stripeWebhookSecret) {
      functions.logger.warn("Stripe webhook called without configuration.");
      res.status(503).send("Stripe non configuré.");
      return;
    }

    const signature = req.header("stripe-signature");
    if (!signature) {
      res.status(400).send("En-tête Stripe-Signature manquant.");
      return;
    }

    let event: Stripe.Event | null = null;
    try {
      const rawBody = req.rawBody ?? Buffer.from("", "utf8");
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        stripeWebhookSecret
      );
    } catch (err) {
      functions.logger.warn("Webhook signature invalide.", { error: err });
      res.status(400).send("Signature invalide.");
      return;
    }

    try {
      if (event) {
        await processStripeWebhookEvent(event);
      }
      res.status(200).send("ok");
    } catch (err) {
      functions.logger.error("Erreur lors du traitement du webhook Stripe.", {
        error: err,
        eventId: event?.id,
        eventType: event?.type,
      });
      captureStripeIssue(err, {
        eventId: event?.id,
        eventType: event?.type,
      });
      res.status(500).send("Erreur serveur.");
    }
  });

async function processStripeWebhookEvent(event: Stripe.Event) {
  if (!stripe) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe n’est pas configuré."
    );
  }

  const eventRef = db.collection(STRIPE_EVENTS_COLLECTION).doc(event.id);
  const snapshot = await eventRef.get();
  if (snapshot.exists) {
    functions.logger.info("Événement Stripe déjà traité", {
      eventId: event.id,
      type: event.type,
    });
    return;
  }

  try {
    await eventRef.create({
      eventType: event.type,
      livemode: event.livemode,
      createdAt: toFirestoreTimestamp(event.created),
    });
  } catch (err: any) {
    if (err.code === 6 || err.code === "already-exists") {
      functions.logger.info("Événement Stripe déjà traité", {
        eventId: event.id,
        type: event.type,
      });
      return;
    }
    throw err;
  }

  let subscription: Stripe.Subscription | null = null;
  let session: Stripe.Checkout.Session | null = null;
  let invoice: Stripe.Invoice | null = null;
  let charge: Stripe.Charge | null = null;

  switch (event.type) {
    case "checkout.session.completed":
      session = event.data.object as Stripe.Checkout.Session;
      {
        const subId = resolveSubscriptionId(session.subscription);
        if (subId) {
          subscription = await fetchSubscriptionFromStripe(subId);
        }
      }
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      subscription = event.data.object as Stripe.Subscription;
      if (!subscription.customer || !subscription.metadata?.uid) {
        if (subscription.id) {
          subscription = await fetchSubscriptionFromStripe(subscription.id);
        }
      }
      break;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      invoice = event.data.object as Stripe.Invoice;
      {
        const subId = resolveSubscriptionId(invoice.subscription);
        if (subId) {
          subscription = await fetchSubscriptionFromStripe(subId);
        }
      }
      break;
    case "charge.refunded":
    case "charge.dispute.created":
      charge = event.data.object as Stripe.Charge;
      {
        const invoiceReference = charge.invoice;
        const invoiceId =
          typeof invoiceReference === "string"
            ? invoiceReference
            : invoiceReference?.id ?? null;
        if (invoiceId) {
          invoice = await stripe.invoices.retrieve(invoiceId);
          const subId = resolveSubscriptionId(invoice.subscription);
          if (subId) {
            subscription = await fetchSubscriptionFromStripe(subId);
          }
        }
      }
      break;
    default:
      functions.logger.info("Stripe webhook event ignored.", {
        eventType: event.type,
      });
      return;
  }

  if (!subscription) {
    functions.logger.warn("Événement Stripe sans abonnement associé.", {
      eventId: event.id,
      eventType: event.type,
    });
    captureStripeIssue("Subscription manquante", {
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  const uid = await resolveStripeUid(subscription, session, invoice, charge);
  if (!uid) {
    functions.logger.warn("Impossible d’identifier l’utilisateur Stripe.", {
      eventId: event.id,
      eventType: event.type,
      subscriptionId: subscription.id,
    });
    captureStripeIssue("Utilisateur Stripe introuvable", {
      eventId: event.id,
      eventType: event.type,
      subscriptionId: subscription.id,
    });
    return;
  }

  const customerId = getCustomerIdFromSubscription(subscription);
  if (customerId) {
    await ensureCustomerMetadata(customerId, uid);
  }

  if (subscription.id) {
    await ensureSubscriptionMetadata(subscription.id, uid);
  }

  const entitlement = computeProEntitlementFromStripe(subscription);
  const isPro = FORCE_INACTIVE_EVENTS.has(event.type)
    ? false
    : entitlement.isPro;

  await persistUserProState(uid, subscription, event, entitlement, isPro);
  await recordStripeEvent(
    eventRef,
    event,
    uid,
    subscription.id,
    customerId,
    entitlement,
    isPro
  );
}

async function fetchSubscriptionFromStripe(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!stripe) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe n’est pas configuré."
    );
  }
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["customer"],
  });
}

async function resolveStripeUid(
  subscription: Stripe.Subscription,
  session: Stripe.Checkout.Session | null,
  invoice: Stripe.Invoice | null,
  charge: Stripe.Charge | null
): Promise<string | null> {
  const candidates: Array<string | null | undefined> = [
    session?.metadata?.uid,
    session?.client_reference_id,
    invoice?.metadata?.uid,
    charge?.metadata?.uid,
    subscription.metadata?.uid,
    await getCustomerMetadataUid(subscription),
  ];
  const candidate = candidates
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .find((item) => item && item.length > 0);
  return candidate ?? null;
}

async function getCustomerMetadataUid(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const customerId = getCustomerIdFromSubscription(subscription);
  if (!customerId || !stripe) {
    return null;
  }
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) {
      return null;
    }
    const activeCustomer = customer as Stripe.Customer;
    return activeCustomer.metadata?.uid ?? null;
  } catch (err) {
    functions.logger.warn("Impossible de récupérer les métadonnées du client Stripe.", {
      customerId,
      error: err,
    });
    captureStripeIssue(err, { customerId });
    return null;
  }
}

async function ensureCustomerMetadata(customerId: string, uid: string) {
  if (!stripe) return;
  try {
    await stripe.customers.update(customerId, {
      metadata: { uid },
    });
  } catch (err) {
    functions.logger.warn("Impossible de sauvegarder les métadonnées du client Stripe.", {
      customerId,
      uid,
      error: err,
    });
    captureStripeIssue(err, { customerId, uid });
  }
}

async function ensureSubscriptionMetadata(subscriptionId: string, uid: string) {
  if (!stripe) return;
  try {
    await stripe.subscriptions.update(subscriptionId, {
      metadata: { uid },
    });
  } catch (err) {
    functions.logger.warn("Impossible de sauvegarder les métadonnées de l’abonnement Stripe.", {
      subscriptionId,
      uid,
      error: err,
    });
    captureStripeIssue(err, { subscriptionId, uid });
  }
}

function computeProEntitlementFromStripe(
  subscription: Stripe.Subscription
): ProEntitlement {
  const status = subscription.status ?? "unknown";
  const lineItems = Array.isArray(subscription.items?.data)
    ? subscription.items.data
    : [];
  let priceId: string | null = null;
  for (const item of lineItems) {
    const candidate = item.price?.id;
    if (candidate && ALLOWED_PRICE_IDS.has(candidate)) {
      priceId = candidate;
      break;
    }
  }

  if (ALLOWED_PRICE_IDS.size > 0 && !priceId && lineItems.length > 0) {
    captureStripeIssue("Un prix Stripe inconnu a été détecté.", {
      subscriptionId: subscription.id,
      status,
      lineItems: lineItems.map((item) => item.price?.id),
    });
  }

  const currentPeriodEnd =
    typeof subscription.current_period_end === "number"
      ? admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000)
      : null;

  const active = isSubscriptionActive(status);
  return {
    isPro: active && Boolean(priceId),
    status,
    priceId,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

async function persistUserProState(
  uid: string,
  subscription: Stripe.Subscription,
  event: Stripe.Event,
  entitlement: ProEntitlement,
  forcedPro?: boolean
) {
  const isPro = forcedPro ?? entitlement.isPro;
  const userRef = db.collection("users").doc(uid);
  const priceId = entitlement.priceId;
  const customerId = getCustomerIdFromSubscription(subscription);
  const updates: Record<string, unknown> = {
    isPro,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    pro: {
      status: entitlement.status,
      priceId,
      subscriptionId: subscription.id,
      currentPeriodEnd: entitlement.currentPeriodEnd,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
      lastStripeEventId: event.id,
    },
    proLastStripeEventAt: toFirestoreTimestamp(event.created),
    proLastStripeEventType: event.type,
  };

  if (isPro) {
    updates.proSince = admin.firestore.FieldValue.serverTimestamp();
  } else {
    updates.proSince = admin.firestore.FieldValue.delete();
  }

  await userRef.set(updates, { merge: true });
  await syncProCustomClaim(uid, isPro);
}

async function syncProCustomClaim(uid: string, isPro: boolean) {
  try {
    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = userRecord.customClaims || {};
    const mergedClaims = { ...existingClaims };
    if (isPro) {
      mergedClaims.pro = true;
    } else {
      delete mergedClaims.pro;
    }
    await admin.auth().setCustomUserClaims(uid, mergedClaims);
  } catch (err) {
    functions.logger.error("Unable to sync PRO custom claim", {
      uid,
      error: err,
    });
    captureStripeIssue(err, { uid });
  }
}

async function recordStripeEvent(
  eventRef: admin.firestore.DocumentReference,
  event: Stripe.Event,
  uid: string,
  subscriptionId: string,
  customerId: string | null,
  entitlement: ProEntitlement,
  isPro: boolean
) {
  await eventRef.set(
    {
      eventType: event.type,
      subscriptionId,
      customerId,
      uid,
      isPro,
      priceId: entitlement.priceId,
      status: entitlement.status,
      createdAt: toFirestoreTimestamp(event.created),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export const createProCheckoutSession = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Méthode non autorisée." });
      return;
    }

    const action = "createProCheckoutSession";
    await requireAppCheckRequest(req, action);

    if (!stripe || !stripeSecret) {
      respondWithHttpError(
        res,
        new functions.https.HttpsError(
          "failed-precondition",
          "Stripe n’est pas configuré sur le serveur."
        ),
        "Stripe n’est pas configuré.",
        "stripe_config_missing"
      );
      return;
    }

    if (!stripePriceProMonthly) {
      respondWithHttpError(
        res,
        new functions.https.HttpsError(
          "failed-precondition",
          "Le tarif PRO n’est pas configuré."
        ),
        "Le tarif PRO n’est pas configuré.",
        "stripe_price_missing"
      );
      return;
    }

    try {
      const decoded = await verifyFirebaseIdToken(req);
      const payload =
        typeof req.body === "object" && req.body !== null ? req.body : {};
      const priceId = resolveProPriceId(payload.priceId);

      if (!priceId) {
        respondWithHttpError(
          res,
          new functions.https.HttpsError(
            "invalid-argument",
            "Plan PRO invalide."
          ),
          "Plan PRO invalide.",
          "stripe_invalid_plan"
        );
        return;
      }

      const origin = getRequestOrigin(req);
      const successUrl = `${origin}/pro/return?status=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/pro/return?status=cancel&session_id={CHECKOUT_SESSION_ID}`;
      const idempotencyKey = `${decoded.uid}:${priceId}:${getIdempotencyKeySuffix()}`;

      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          client_reference_id: decoded.uid,
          metadata: {
            uid: decoded.uid,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        {
          idempotencyKey,
        }
      );

      if (!session.url) {
        respondWithHttpError(
          res,
          new functions.https.HttpsError(
            "internal",
            "Impossible de générer la session de paiement."
          ),
          "Impossible de générer la session de paiement.",
          "stripe_session_missing"
        );
        return;
      }

      functions.logger.info("Stripe PRO checkout session created", {
        uid: decoded.uid,
        priceId,
        sessionId: session.id,
        url: session.url,
      });

      res.status(200).json({ url: session.url });
    } catch (err) {
      respondWithHttpError(
        res,
        err,
        "Impossible de démarrer le paiement PRO.",
        "stripe_creation_error"
      );
    }
  });

async function resolveSessionCustomer(
  session: Stripe.Checkout.Session
): Promise<Stripe.Customer | null> {
  if (!stripe || !session.customer) {
    return null;
  }
  if (typeof session.customer === "object") {
    if ("deleted" in session.customer && session.customer.deleted) {
      return null;
    }
    return session.customer as Stripe.Customer;
  }
  try {
    const customer = await stripe.customers.retrieve(session.customer);
    if ("deleted" in customer && customer.deleted) {
      return null;
    }
    return customer as Stripe.Customer;
  } catch (err) {
    functions.logger.warn("Unable to resolve Stripe customer metadata", {
      customer: session.customer,
      error: err,
    });
    captureStripeIssue(err, {
      customerId: session.customer,
      context: "verify_pro_session",
    });
    return null;
  }
}

async function resolveSessionSubscription(
  session: Stripe.Checkout.Session
): Promise<Stripe.Subscription | null> {
  if (!stripe || !session.subscription) {
    return null;
  }
  if (typeof session.subscription === "object") {
    return session.subscription;
  }
  try {
    return await stripe.subscriptions.retrieve(session.subscription, {
      expand: ["customer"],
    });
  } catch (err) {
    functions.logger.warn("Unable to resolve Stripe subscription for verification", {
      sessionId: session.id,
      subscription: session.subscription,
      error: err,
    });
    captureStripeIssue(err, {
      sessionId: session.id,
      subscriptionId: session.subscription,
      context: "verify_pro_session",
    });
    return null;
  }
}

export const verifyProSession = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Méthode non autorisée." });
      return;
    }

    const action = "verifyProSession";
    await requireAppCheckRequest(req, action);

    if (!stripe || !stripeSecret) {
      respondWithHttpError(
        res,
        new functions.https.HttpsError(
          "failed-precondition",
          "Stripe n’est pas configuré sur le serveur."
        ),
        "Stripe n’est pas configuré.",
        "stripe_config_missing"
      );
      return;
    }

    try {
      const decoded = await verifyFirebaseIdToken(req);
      const payload =
        typeof req.body === "object" && req.body !== null ? req.body : {};
      const sessionId =
        typeof payload.sessionId === "string" && payload.sessionId.trim().length > 0
          ? payload.sessionId.trim()
          : null;
      if (!sessionId) {
        respondWithHttpError(
          res,
          new functions.https.HttpsError(
            "invalid-argument",
            "Identifiant de session manquant."
          ),
          "Identifiant de session manquant."
        );
        return;
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "customer"],
      });

      const customer = await resolveSessionCustomer(session);
      const ownsSession =
        session.client_reference_id === decoded.uid ||
        session.metadata?.uid === decoded.uid ||
        customer?.metadata?.uid === decoded.uid;
      if (!ownsSession) {
        res.status(403).json({
          error: "Cette session Stripe n’est pas associée à ton compte.",
        });
        return;
      }

      const sessionPaid =
        session.payment_status === "paid" || session.status === "complete";
      if (!sessionPaid) {
        functions.logger.info("[UQ][STRIPE_VERIFY]", {
          uid: decoded.uid,
          session: sessionId,
          entitled: false,
          reason: "session_not_paid",
          paymentStatus: session.payment_status,
          status: session.status,
        });
        res.status(200).json({
          entitled: false,
          reason: "session_not_paid",
          paymentStatus: session.payment_status ?? "unknown",
          status: session.status ?? "unknown",
        });
        return;
      }

      const subscription = await resolveSessionSubscription(session);
      if (!subscription) {
        functions.logger.info("[UQ][STRIPE_VERIFY]", {
          uid: decoded.uid,
          session: sessionId,
          entitled: false,
          reason: "subscription_missing",
        });
        res.status(200).json({
          entitled: false,
          reason: "subscription_missing",
        });
        return;
      }

      const entitlement = computeProEntitlementFromStripe(subscription);
      const entitled = entitlement.isPro;
      if (entitled) {
    const event = {
      id: `verify-${sessionId}-${Date.now()}`,
      type: "verify.pro_session" as const,
      created: Math.floor(Date.now() / 1000),
    } as unknown as Stripe.Event;
        await persistUserProState(decoded.uid, subscription, event, entitlement, true);
      }

      functions.logger.info("[UQ][STRIPE_VERIFY]", {
        uid: decoded.uid,
        session: sessionId,
        entitled,
        reason: entitled ? undefined : "not_entitled",
      });

      res.status(200).json({
        entitled,
        reason: entitled ? undefined : "not_entitled",
      });
    } catch (err) {
      respondWithHttpError(
        res,
        err,
        "Impossible de vérifier la session Stripe.",
        "stripe_verify_failed"
      );
    }
  });

function getIdempotencyKeySuffix() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
}

export const createStripeCheckoutSession = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    requireAppCheck(context, "create a checkout session");
    enforceRateLimit(context, "createStripeCheckoutSession");
    if (!stripe || !stripeSecret) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Stripe n’est pas configuré sur le serveur."
      );
    }

    const parsed = checkoutSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        parsed.error.flatten().fieldErrors?.cart?.[0] ??
          "Le sac est vide ou invalide."
      );
    }

    const cart = parsed.data.cart;

    if (!cart || cart.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Le sac est vide ou invalide."
      );
    }

    try {
      const line_items = cart.map((item) => {
        const quantity = item.quantity ?? 1;
        const currency = (item.currency ?? "cad").toLowerCase();
        return {
          quantity,
          price_data: {
            currency,
            unit_amount: Math.round(item.price * 100),
            product_data: {
              name: item.name,
            },
          },
        };
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items,
        success_url:
          "https://urbexqueenscanada.web.app/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://urbexqueenscanada.web.app/checkout/cancel",
      });

      functions.logger.info("Stripe checkout session created", {
        sessionId: session.id,
        url: session.url,
      });

      return { url: session.url };
    } catch (err: any) {
      functions.logger.error("Stripe checkout error", {
        message: err?.message ?? "Erreur inconnue",
        err,
      });
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Impossible de créer la session de paiement."
      );
    }
  });

async function reconcileStripeCustomer(uid: string, customerId: string) {
  if (!stripe) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Stripe n’est pas configuré."
    );
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    expand: ["customer"],
    limit: 10,
  });

  const event = {
    id: `reconcile-${customerId}-${Date.now()}`,
    type: "reconcile" as const,
    created: Math.floor(Date.now() / 1000),
  } as unknown as Stripe.Event;

  const [candidate] = subscriptions.data
    .slice()
    .sort((a, b) => (b.current_period_end ?? 0) - (a.current_period_end ?? 0));

  if (!candidate) {
    const fallback = {
      id: `reconcile-${customerId}-none`,
      status: "canceled",
      items: { data: [] },
      customer: customerId,
    } as Stripe.Subscription;
    const entitlement = computeProEntitlementFromStripe(fallback);
    await persistUserProState(uid, fallback, event, entitlement, false);
    return;
  }

  const entitlement = computeProEntitlementFromStripe(candidate);
  await persistUserProState(uid, candidate, event, entitlement);
}

export const reconcileProStatusForUser = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    requireAppCheck(context, "reconcileProStatusForUser");
    enforceRateLimit(context, "reconcileProStatusForUser");
    const callerUid = context.auth?.uid;
    if (!callerUid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentification requise."
      );
    }

    const targetUid =
      typeof data?.uid === "string" && data.uid !== ""
        ? data.uid
        : callerUid;
    if (targetUid !== callerUid) {
      await requireAdmin(context, "reconcileProStatusForUser");
    }

    const userSnap = await db.collection("users").doc(targetUid).get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Utilisateur introuvable."
      );
    }

    const customerId = userSnap.data()?.stripeCustomerId;
    if (!customerId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Aucun identifiant Stripe associé.",
        "missing_stripe_customer"
      );
    }

    await reconcileStripeCustomer(targetUid, customerId);
    return { success: true };
  });

export const reconcileProStatusScheduled = functions
  .region("us-central1")
  .pubsub.schedule("every 24 hours")
  .onRun(async () => {
    if (!stripe) {
      functions.logger.warn(
        "Stripe non configuré, reconciliation périodique annulée."
      );
      return;
    }

    const snapshot = await db
      .collection("users")
      .where("stripeCustomerId", ">", "")
      .orderBy("stripeCustomerId")
      .limit(20)
      .get();

    await Promise.allSettled(
      snapshot.docs.map(async (doc) => {
        const uid = doc.id;
        const customerId = doc.data().stripeCustomerId;
        if (!customerId) {
          return;
        }
        try {
          await reconcileStripeCustomer(uid, customerId);
        } catch (err) {
          functions.logger.error("Reconciliation Stripe échouée", {
            uid,
            customerId,
            error: err,
          });
          captureStripeIssue(err, { uid, customerId, context: "scheduled" });
        }
      })
    );
  });

// --- PRINTFUL SYNC ---
export const syncPrintfulProducts = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    requireAppCheck(context, "sync Printful products");
    enforceRateLimit(context, "syncPrintfulProducts");
    const products = await fetchPrintfulProducts();
    const list = products?.result ?? [];

    for (const p of list) {
      const firstVariant = p.variants?.[0] || {};
      const files = firstVariant.files || [];
      const images = files.map((f: any) => f.preview_url).filter(Boolean);
      const price = Number(firstVariant.retail_price || 0);

      await db
        .collection("shopProducts")
        .doc(String(p.id))
        .set(
          {
            id: String(p.id),
            name: p.name,
            images,
            price,
            currency: "CAD",
            category: (p as any).type || "Produit",
            status: "active",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    return { status: "success", count: list.length };
  });

export const syncPrintfulOrders = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    requireAppCheck(context, "sync Printful orders");
    enforceRateLimit(context, "syncPrintfulOrders");
    const orders = await fetchPrintfulOrders();
    // TODO: map to shopOrders
    return { status: "success", raw: orders };
  });

export const createPrintfulOrderFn = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    requireAppCheck(context, "create a Printful order");
    enforceRateLimit(context, "createPrintfulOrder");
    const result = await createPrintfulOrder(data);
    return { status: "success", raw: result };
  });

export const publishThemeVersion = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const action = "publishThemeVersion";
    requireAppCheck(context, action);
    const parsed = publishThemeSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        getZodErrorMessage(parsed.error)
      );
    }

    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const { themeId, versionId, note } = parsed.data;
    const versionRef = db
      .collection("adminThemes")
      .doc(themeId)
      .collection("versions")
      .doc(versionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Version introuvable."
      );
    }

    const versionData = versionSnap.data() ?? {};
    const status = versionData.status;
    if (status === "published") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "La version a déjà été publiée."
      );
    }

    const tokensValidation = themeTokensSchema.safeParse(versionData.tokens ?? {});
    if (!tokensValidation.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Les tokens de design sont invalides."
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: "published",
      "meta.publishedBy": uid,
      "meta.publishedAt": admin.firestore.FieldValue.serverTimestamp(),
    };
    if (note !== undefined) {
      updatePayload["meta.note"] = note;
    }

    await versionRef.update(updatePayload);
    await db.collection("adminThemes").doc(themeId).set(
      {
        publishedVersionId: versionId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await logSecurityEvent({
      type: "admin.theme.publish",
      detail: `Publié le thème ${themeId} (version ${versionId}).`,
      severity: "info",
      userId: uid,
      metadata: {
        themeId,
        versionId,
      },
    });

    return { publishedVersionId: versionId };
  });

const ADMIN_UI_CONFIG_KEYS: Array<keyof AdminUiConfig> = [
  "maintenance",
  "flags",
  "modules",
  "mapUi",
  "ui",
  "overlay",
  "theme",
];

const adminUiConfigImportSchema = z.object({
  backup: z.object({
    schemaVersion: z.number(),
    timestamp: z.number(),
    draft: z.object({}).passthrough(),
    published: z.object({}).passthrough().optional(),
  }),
  applyPublished: z.boolean().optional(),
});

function buildConfigSnapshot(raw: admin.firestore.DocumentData = {}) {
  const snapshot: Record<string, unknown> = {};
  ADMIN_UI_CONFIG_KEYS.forEach((key) => {
    if (raw[key] !== undefined) {
      snapshot[key] = raw[key];
    } else {
      snapshot[key] = DEFAULT_ADMIN_UI_CONFIG[key];
    }
  });
  return snapshot;
}

function convertTimestampToNumber(value: unknown) {
  if (!value) {
    return null;
  }
  if (value instanceof admin.firestore.Timestamp) {
    return value.toMillis();
  }
  if (typeof value === "number") {
    return value;
  }
  return null;
}

function ensureTimestamp(value: number | null | undefined) {
  if (value == null) {
    return null;
  }
  return admin.firestore.Timestamp.fromMillis(value);
}

function normalizeForExport(raw?: admin.firestore.DocumentData) {
  const data = raw ?? {};
  const snapshot = buildConfigSnapshot(data);
  return {
    version:
      typeof data.version === "number"
        ? data.version
        : DEFAULT_ADMIN_UI_CONFIG.version,
    schemaVersion:
      typeof data.schemaVersion === "number"
        ? data.schemaVersion
        : ADMIN_UI_CONFIG_SCHEMA_VERSION,
    updatedAt: convertTimestampToNumber(data.updatedAt),
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
    publishedAt: convertTimestampToNumber(data.publishedAt),
    publishedBy: typeof data.publishedBy === "string" ? data.publishedBy : null,
    configLocked:
      typeof data.configLocked === "boolean" ? data.configLocked : false,
    ...snapshot,
  };
}

export const publishAdminUiConfig = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    const action = "publishAdminUiConfig";
    requireAppCheck(context, action);
    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const draftRef = db.collection("admin").doc("uiConfig_draft");
    const publishedRef = db.collection("admin").doc("uiConfig_published");
    const historyRef = db
      .collection("admin")
      .doc("uiConfig_history")
      .collection("versions");

    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Brouillon introuvable.");
    }
    const draftData = draftSnap.data() ?? {};
    if (draftData.schemaVersion !== ADMIN_UI_CONFIG_SCHEMA_VERSION) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Le schéma de la configuration n’est pas compatible."
      );
    }

    const publishedSnap = await publishedRef.get();
    const publishedData = publishedSnap.exists ? publishedSnap.data() ?? {} : {};
    const draftVersion =
      typeof draftData.version === "number"
        ? draftData.version
        : DEFAULT_ADMIN_UI_CONFIG.version;
    const publishedVersion =
      typeof publishedData.version === "number" ? publishedData.version : 0;
    const nextVersion = Math.max(draftVersion, publishedVersion) + 1;

    const now = admin.firestore.FieldValue.serverTimestamp();
    const snapshot = buildConfigSnapshot(draftData);
    const basePayload = {
      ...snapshot,
      version: nextVersion,
      schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
      updatedAt: now,
      updatedBy: uid,
      configLocked:
        typeof draftData.configLocked === "boolean"
          ? draftData.configLocked
          : false,
    };
    const publishedPayload = {
      ...basePayload,
      publishedAt: now,
      publishedBy: uid,
    };
    const historyPayload = {
      snapshot,
      version: nextVersion,
      schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
      publishedAt: now,
      publishedBy: uid,
      createdAt: now,
    };

    const batch = db.batch();
    batch.set(draftRef, basePayload, { merge: true });
    batch.set(publishedRef, publishedPayload, { merge: true });
    batch.set(historyRef.doc(`${nextVersion}-${uuid()}`), historyPayload);
    await batch.commit();

    await logSecurityEvent({
      type: "admin.uiConfig.publish",
      detail: `Publication de la configuration UI (v${nextVersion}).`,
      severity: "info",
      userId: uid,
      metadata: { version: nextVersion },
    });

    return { publishedVersion: nextVersion };
  });

export const restoreAdminUiConfig = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    const action = "restoreAdminUiConfig";
    requireAppCheck(context, action);
    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const publishedRef = db.collection("admin").doc("uiConfig_published");
    const draftRef = db.collection("admin").doc("uiConfig_draft");
    const publishedSnap = await publishedRef.get();
    if (!publishedSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Aucune version publiée.");
    }

    const publishedData = publishedSnap.data() ?? {};
    const snapshot = buildConfigSnapshot(publishedData);
    const version =
      typeof publishedData.version === "number"
        ? publishedData.version
        : DEFAULT_ADMIN_UI_CONFIG.version;

    await draftRef.set(
      {
        ...snapshot,
        version,
        schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
        configLocked: false,
      },
      { merge: true }
    );

    await logSecurityEvent({
      type: "admin.uiConfig.restore",
      detail: `Restauré la configuration UI publiée (v${version}).`,
      severity: "info",
      userId: uid,
      metadata: { version },
    });

    return { restoredVersion: version };
  });

export const exportAdminUiConfig = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    const action = "exportAdminUiConfig";
    requireAppCheck(context, action);
    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const draftRef = db.collection("admin").doc("uiConfig_draft");
    const publishedRef = db.collection("admin").doc("uiConfig_published");
    const [draftSnap, publishedSnap] = await Promise.all([
      draftRef.get(),
      publishedRef.get(),
    ]);

    const backup = {
      schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
      timestamp: Date.now(),
      draft: normalizeForExport(draftSnap.exists ? draftSnap.data() : {}),
      published: publishedSnap.exists
        ? normalizeForExport(publishedSnap.data())
        : null,
    };

    await logSecurityEvent({
      type: "admin.uiConfig.export",
      detail: "Export de la configuration UI.",
      severity: "info",
      userId: uid,
      metadata: { schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION },
    });

    return backup;
  });

export const importAdminUiConfig = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const action = "importAdminUiConfig";
    requireAppCheck(context, action);
    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const parsed = adminUiConfigImportSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        getZodErrorMessage(parsed.error)
      );
    }

    const { backup, applyPublished = false } = parsed.data;
    if (backup.schemaVersion !== ADMIN_UI_CONFIG_SCHEMA_VERSION) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Le backup n'est pas compatible avec le schéma actif."
      );
    }

    const missingSections = ADMIN_UI_CONFIG_KEYS.filter(
      (key) => !(key in backup.draft)
    );
    if (missingSections.length > 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Le backup manque des sections : ${missingSections.join(", ")}.`
      );
    }

    const draftRef = db.collection("admin").doc("uiConfig_draft");
    const publishedRef = db.collection("admin").doc("uiConfig_published");
    const baseSnapshot = buildConfigSnapshot(backup.draft as admin.firestore.DocumentData);
    const draftPayload = {
      ...baseSnapshot,
      version:
        typeof backup.draft.version === "number"
          ? backup.draft.version
          : DEFAULT_ADMIN_UI_CONFIG.version,
      schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
      configLocked:
        typeof backup.draft.configLocked === "boolean" ? backup.draft.configLocked : false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid,
    };

    const batch = db.batch();
    batch.set(draftRef, draftPayload, { merge: true });

    if (applyPublished) {
      if (!backup.published) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Le backup ne contient pas de version publiée."
        );
      }
      const publishedSnapshot = buildConfigSnapshot(
        backup.published as admin.firestore.DocumentData
      );
      const publishedRaw = backup.published as Record<string, unknown>;
      const publishedAtValue =
        typeof publishedRaw.publishedAt === "number" ? publishedRaw.publishedAt : null;
      const publishedByValue =
        typeof publishedRaw.publishedBy === "string" ? publishedRaw.publishedBy : uid;
      const publishedPayload = {
        ...publishedSnapshot,
        version:
          typeof backup.published.version === "number"
            ? backup.published.version
            : draftPayload.version,
        schemaVersion: ADMIN_UI_CONFIG_SCHEMA_VERSION,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
        publishedAt:
          ensureTimestamp(publishedAtValue) ??
          admin.firestore.FieldValue.serverTimestamp(),
        publishedBy: publishedByValue,
      };
      batch.set(publishedRef, publishedPayload, { merge: true });
    }

    await batch.commit();

    await logSecurityEvent({
      type: "admin.uiConfig.import",
      detail: "Import de la configuration UI.",
      severity: "info",
      userId: uid,
      metadata: {
        schemaVersion: backup.schemaVersion,
        applyPublished,
      },
    });

    return { success: true };
  });

export const publishOverlayVersion = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const action = "publishOverlayVersion";
    requireAppCheck(context, action);
    const parsed = overlayPublishSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        getZodErrorMessage(parsed.error)
      );
    }

    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const { overlayId, versionId, note } = parsed.data;
    const versionRef = db
      .collection("adminOverlays")
      .doc(overlayId)
      .collection("versions")
      .doc(versionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Version introuvable."
      );
    }

    const versionData = versionSnap.data() ?? {};
    if (versionData.status !== "draft") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Seules les versions brouillon peuvent être publiées."
      );
    }

    const components = Array.isArray(versionData.components)
      ? versionData.components
      : [];
    const overlayResult = overlayVersionSchema.safeParse({
      components,
    });
    if (!overlayResult.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        getZodErrorMessage(overlayResult.error)
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: "published",
      "meta.publishedBy": uid,
      "meta.publishedAt": admin.firestore.FieldValue.serverTimestamp(),
    };
    if (note !== undefined) {
      updatePayload["meta.note"] = note;
    }

    await versionRef.update(updatePayload);

    const overlayRef = db.collection("adminOverlays").doc(overlayId);
    const overlaySnap = await overlayRef.get();
    const overlayData = overlaySnap.exists ? overlaySnap.data() : null;
    await overlayRef.set(
      {
        publishedVersionId: versionId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        draftVersionId:
          overlayData?.draftVersionId === versionId
            ? null
            : overlayData?.draftVersionId ?? null,
      },
      { merge: true }
    );

    await logSecurityEvent({
      type: "admin.overlay.publish",
      detail: `Publié l’overlay ${overlayId} (version ${versionId}).`,
      severity: "info",
      userId: uid,
      metadata: { overlayId, versionId },
    });

    return { publishedVersionId: versionId, components: overlayResult.data };
  });

export const rollbackOverlayVersion = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const action = "rollbackOverlayVersion";
    requireAppCheck(context, action);
    const parsed = overlayRollbackSchema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        getZodErrorMessage(parsed.error)
      );
    }

    const uid = await requireAdmin(context, action);
    enforceRateLimit(context, action);

    const { overlayId, versionId } = parsed.data;
    const versionRef = db
      .collection("adminOverlays")
      .doc(overlayId)
      .collection("versions")
      .doc(versionId);
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Version introuvable."
      );
    }

    const versionData = versionSnap.data() ?? {};
    if (versionData.status !== "published") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Seule une version publiée peut servir de rollback."
      );
    }

    const overlayRef = db.collection("adminOverlays").doc(overlayId);
    await overlayRef.set(
      {
        publishedVersionId: versionId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        draftVersionId: null,
      },
      { merge: true }
    );

    await logSecurityEvent({
      type: "admin.overlay.rollback",
      detail: `Rollback overlay ${overlayId} vers la version ${versionId}.`,
      severity: "info",
      userId: uid,
      metadata: { overlayId, versionId },
    });

    return { publishedVersionId: versionId };
  });

export const integrationHealth = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    const action = "integration.health";
    try {
      await requireAppCheckRequest(req, action);
      await ensureAdminRequest(req, action);
      const now = new Date().toISOString();
      const stripeStatus = stripe ? "ok" : "down";
      const printfulStatus = printfulKey ? "ok" : "down";
      const mapboxStatus = "ok" as const;

      const payload = {
        checkedAt: now,
        stripe: {
          status: stripeStatus,
          note: stripeStatus === "ok" ? undefined : "Clef Stripe manquante",
        },
        printful: {
          status: printfulStatus,
          note: printfulStatus === "ok" ? undefined : "Clef Printful non paramétrée",
        },
        mapbox: { status: mapboxStatus },
        firebase: { status: "ok" as const, appCheckOk: true },
      };
      if (res.headersSent) return;
      res.set("Cache-Control", "private, no-store");
      res.status(200).json(payload);
      return;
    } catch (error_1) {
      const error =
        error_1 instanceof functions.https.HttpsError
          ? error_1
          : new functions.https.HttpsError("internal", "Erreur serveur");
      const status = mapHttpsErrorCodeToStatus(error.code);
      functions.logger.warn("[integrationHealth]", error);
      res.status(status).json({ error: error.message });
      return;
    }
  });

export const cspReport = functions
  .region("us-central1")
  .https.onRequest((req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).send("Method Not Allowed");
      return;
    }

    const payload = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const rawReport = payload["csp-report"];
    const report =
      rawReport && typeof rawReport === "object"
        ? (rawReport as Record<string, unknown>)
        : payload;
    const violatedDirective = asString(report["violatedDirective"]) ?? "unknown";
    const blockedURI = asString(report["blockedURI"]) ?? asString(report["sourceFile"]) ?? "unknown";
    const sourceFile = asString(report["sourceFile"]) ?? blockedURI;
    const key = `${violatedDirective}|${blockedURI}|${sourceFile}`;

    if (CSP_REPORT_SAMPLE_RATE < 1 && Math.random() > CSP_REPORT_SAMPLE_RATE) {
      res.status(204).end();
      return;
    }
    if (!shouldReportCspViolation(key)) {
      res.status(204).end();
      return;
    }

    functions.logger.info("[cspReport] Payload recorded", {
      violatedDirective,
      blockedURI,
      sourceFile,
    });

    if (shouldInitSentry) {
      Sentry.withScope((scope) => {
        scope.setTag("feature", "csp-report");
        scope.setTag("csp_directive", violatedDirective);
        scope.setExtra("blocked_uri", blockedURI);
        scope.setExtra("document_uri", asString(report["documentURI"]) ?? "unknown");
        scope.setExtra("payload", report);
        Sentry.captureMessage("CSP report forwarded", "warning");
      });
    }

    res.status(204).end();
    return;
  });

export const printfulWebhook = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    const event = req.body;

    // Exemple: commande mise à jour
    if (event?.type === "order_updated") {
      const order = event.data;
      await db
        .collection("shopOrders")
        .doc(String(order.id))
        .set(
          {
            status: order.status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    res.sendStatus(200);
  });

async function quarantineObject(
  object: functions.storage.ObjectMetadata,
  reason: string
) {
  const sourceBucket = admin.storage().bucket(object.bucket);
  const targetBucket =
    QUARANTINE_BUCKET && QUARANTINE_BUCKET.length > 0
      ? admin.storage().bucket(QUARANTINE_BUCKET)
      : null;
  if (targetBucket && object.name) {
    const destName = `quarantine/${Date.now()}-${path.basename(object.name)}`;
    await sourceBucket.file(object.name).copy(targetBucket.file(destName));
    await sourceBucket.file(object.name).delete();
  }
  await logSecurityEvent({
    type: "media.upload.quarantine",
    detail: reason,
    severity: "warning",
    userId: object.metadata?.uploadedBy ?? null,
    metadata: {
      name: object.name ?? null,
      bucket: object.bucket,
      contentType: object.contentType ?? null,
      size: object.size ?? null,
    },
  });
}

async function normalizeImageFile(
  file: File,
  object: functions.storage.ObjectMetadata
) {
  const tempDir = os.tmpdir();
  const downloadPath = path.join(tempDir, path.basename(object.name || ""));
  const normalizedPath = `${downloadPath}-normalized`;
  await file.download({ destination: downloadPath });
  await sharp(downloadPath)
    .rotate()
    .resize({ width: 3000, withoutEnlargement: true })
    .toFile(normalizedPath);
  const metadata = {
    contentType: object.contentType ?? undefined,
    metadata: {
      ...(object.metadata ?? {}),
      normalized: "true",
      normalizedAt: Date.now().toString(),
    },
  };
  await file.save(await fs.promises.readFile(normalizedPath), {
    metadata,
    resumable: false,
  });
  await fs.promises.unlink(downloadPath);
  await fs.promises.unlink(normalizedPath);
}

export const sanitizeMediaUpload = functions
  .region("us-central1")
  .storage.object()
  .onFinalize(async (object) => {
    const resourceState =
      (object as { resourceState?: string }).resourceState ?? null;
    if (!object.name || resourceState === "not_exists") return;
    if (object.metadata?.normalized === "true") return;
    const contentType = object.contentType ?? "";
    const isImage = contentType.startsWith("image/");
    const allowedVideo = contentType === "video/mp4";
    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(object.name);
    try {
      if (!isImage && !allowedVideo) {
        await quarantineObject(object, "Unsupported content type");
        return;
      }

      if (isImage) {
        await normalizeImageFile(file, object);
      }

      await logSecurityEvent({
        type: "media.upload.processed",
        detail: object.name,
        metadata: {
          bucket: object.bucket,
          contentType,
          size: object.size,
          normalized: isImage,
        },
        userId: object.metadata?.uploadedBy ?? null,
      });
    } catch (err) {
      functions.logger.error("Media processing error", {
        error: err,
        name: object.name,
        bucket: object.bucket,
      });
      await logSecurityEvent({
        type: "media.upload.error",
        detail: object.name ?? "unknown",
        severity: "error",
        metadata: {
          bucket: object.bucket,
          contentType,
          size: object.size,
        },
        userId: object.metadata?.uploadedBy ?? null,
      });
    }
  });

type SanitizationSpec = {
  path: string;
  allowHtml?: boolean;
  maxLength?: number;
  isList?: boolean;
};

async function sanitizeDocument(
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  specs: SanitizationSpec[]
) {
  if (!change.after.exists) return;
  const updates: Record<string, unknown> = {};
  for (const spec of specs) {
    const rawValue = change.after.get(spec.path);
    if (rawValue === null || rawValue === undefined) continue;
    const options = { allowHtml: spec.allowHtml, maxLength: spec.maxLength };

    if (spec.isList && Array.isArray(rawValue)) {
      const sanitizedList = rawValue.map((item) =>
        typeof item === "string" ? sanitizeText(item, options) : item
      );
      const hasChange = sanitizedList.some(
        (value, index) => value !== rawValue[index]
      );
      if (hasChange) {
        updates[spec.path] = sanitizedList;
      }
    } else if (typeof rawValue === "string") {
      const sanitized = sanitizeText(rawValue, options);
      if (sanitized !== rawValue) {
        updates[spec.path] = sanitized;
      }
    }
  }

  if (Object.keys(updates).length === 0) return;
  const version = (change.after.get("sanitizationVersion") ?? 0) as number;
  await change.after.ref.update({
    ...updates,
    sanitizationVersion: version + 1,
    sanitizedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const PLACE_SANITIZE_SPECS: SanitizationSpec[] = [
  { path: "title", maxLength: 200 },
  { path: "description", maxLength: 2000 },
  { path: "name", maxLength: 200 },
  { path: "city", maxLength: 200 },
  { path: "region", maxLength: 200 },
  { path: "history", maxLength: 8000 },
  { path: "historyTitle", maxLength: 400 },
  { path: "historyShort", maxLength: 2000 },
  { path: "historyShortHtml", allowHtml: true, maxLength: 20000 },
  { path: "historyFull", maxLength: 8000 },
  { path: "historyFullHtml", allowHtml: true, maxLength: 50000 },
  { path: "adminNotes", maxLength: 3000 },
  { path: "dangerLabel", maxLength: 200 },
  { path: "parking", maxLength: 1000 },
  { path: "entrances", maxLength: 1000 },
  { path: "tags", maxLength: 60, isList: true },
  { path: "archives", maxLength: 2048, isList: true },
];

const POST_SANITIZE_SPECS: SanitizationSpec[] = [
  { path: "caption", maxLength: 1000 },
  { path: "authorName", maxLength: 100 },
  { path: "authorUsername", maxLength: 40 },
  { path: "location.label", maxLength: 200 },
];

const COMMENT_SANITIZE_SPECS: SanitizationSpec[] = [
  { path: "text", maxLength: 1000 },
  { path: "displayName", maxLength: 120 },
  { path: "username", maxLength: 40 },
];

const USER_SANITIZE_SPECS: SanitizationSpec[] = [
  { path: "displayName", maxLength: 120 },
  { path: "username", maxLength: 40 },
  { path: "bio", maxLength: 800 },
];

const PRO_GAME_SESSION_SPECS: SanitizationSpec[] = [
  { path: "location", maxLength: 200 },
  { path: "rank", maxLength: 100 },
  { path: "highlights", maxLength: 200, isList: true },
];

export const sanitizePlaceContent = functions
  .region("us-central1")
  .firestore.document("places/{placeId}")
  .onWrite(async (change) => {
    await sanitizeDocument(change, PLACE_SANITIZE_SPECS);
  });

export const syncPlaceGeohash = functions
  .region("us-central1")
  .firestore.document("places/{placeId}")
  .onWrite(async (change) => {
    if (!change.after.exists) return;
    const lat = change.after.get("lat");
    const lng = change.after.get("lng");
    if (typeof lat !== "number" || typeof lng !== "number") {
      return;
    }
    const computed = computeGeohash(lat, lng);
    if (!computed) return;
    const current = change.after.get("geohash");
    if (current === computed) return;
    await change.after.ref.update({ geohash: computed });
  });

export const sanitizePostContent = functions
  .region("us-central1")
  .firestore.document("posts/{postId}")
  .onWrite(async (change) => {
    await sanitizeDocument(change, POST_SANITIZE_SPECS);
  });

export const sanitizePostComments = functions
  .region("us-central1")
  .firestore.document("posts/{postId}/comments/{commentId}")
  .onWrite(async (change) => {
    await sanitizeDocument(change, COMMENT_SANITIZE_SPECS);
  });

export const sanitizeComments = functions
  .region("us-central1")
  .firestore.document("comments/{commentId}")
  .onWrite(async (change) => {
    await sanitizeDocument(change, COMMENT_SANITIZE_SPECS);
  });

export const sanitizeUsers = functions
  .region("us-central1")
  .firestore.document("users/{userId}")
  .onWrite(async (change) => {
    await sanitizeDocument(change, USER_SANITIZE_SPECS);
  });

export const sanitizeProGameSessions = functions
  .region("us-central1")
  .firestore.document("proGameSessions/{sessionId}")
  .onWrite(async (change) => {
    await sanitizeDocument(change, PRO_GAME_SESSION_SPECS);
  });

type NotificationType = "follow" | "like" | "comment" | "pro" | "spot";

type NotificationActorSnapshot = {
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
};

type NotificationPayload = {
  type: NotificationType;
  targetUserId: string;
  actorId?: string;
  postId?: string;
  commentId?: string;
  message?: string | null;
  actorSnapshot?: NotificationActorSnapshot | null;
};

async function buildActorSnapshot(actorId?: string) {
  if (!actorId) return null;
  const actorDoc = await db.collection("users").doc(actorId).get();
  if (!actorDoc.exists) return null;
  const data = actorDoc.data();
  return {
    displayName: data?.displayName ?? null,
    username: data?.username ?? null,
    photoURL: data?.photoURL ?? null,
  };
}

async function createNotification(payload: NotificationPayload) {
  if (!payload.targetUserId) return;
  await db
    .collection("users")
    .doc(payload.targetUserId)
    .collection("notifications")
    .add({
      type: payload.type,
      actorId: payload.actorId ?? null,
      targetUserId: payload.targetUserId,
      postId: payload.postId ?? null,
      commentId: payload.commentId ?? null,
      message: payload.message ?? null,
      actorSnapshot: payload.actorSnapshot ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
    });
}

type FollowCounterField = "followersCount" | "followingCount";

async function adjustFollowCount(
  userId: string,
  field: FollowCounterField,
  delta: number
) {
  if (!userId) return;
  await db
    .collection("users")
    .doc(userId)
    .set(
      {
        [field]: admin.firestore.FieldValue.increment(delta),
      },
      { merge: true }
    );
}

export const onFollowerDocumentCreated = functions
  .region("us-central1")
  .firestore.document("users/{userId}/followers/{followerUid}")
  .onCreate(async (_snap, context) => {
    const { userId, followerUid } = context.params;
    if (!userId || !followerUid || userId === followerUid) return;
    await adjustFollowCount(userId, "followersCount", 1);
    const actorSnapshot = await buildActorSnapshot(followerUid);
    await createNotification({
      type: "follow",
      targetUserId: userId,
      actorId: followerUid,
      actorSnapshot,
    });
  });

export const onFollowerDocumentDeleted = functions
  .region("us-central1")
  .firestore.document("users/{userId}/followers/{followerUid}")
  .onDelete(async (_snap, context) => {
    const { userId } = context.params;
    if (!userId) return;
    await adjustFollowCount(userId, "followersCount", -1);
  });

export const onFollowingDocumentCreated = functions
  .region("us-central1")
  .firestore.document("users/{userId}/following/{targetUid}")
  .onCreate(async (_snap, context) => {
    const { userId, targetUid } = context.params;
    if (!userId || !targetUid || userId === targetUid) return;
    await adjustFollowCount(userId, "followingCount", 1);
  });

export const onFollowingDocumentDeleted = functions
  .region("us-central1")
  .firestore.document("users/{userId}/following/{targetUid}")
  .onDelete(async (_snap, context) => {
    const { userId } = context.params;
    if (!userId) return;
    await adjustFollowCount(userId, "followingCount", -1);
  });

export const onPostReactionCreated = functions
  .region("us-central1")
  .firestore.document("posts/{postId}")
  .onUpdate(async (change, context) => {
    const beforeData: Record<string, any> = change.before.data() ?? {};
    const afterData: Record<string, any> = change.after.data() ?? {};
    const postAuthorId = afterData.userId;
    if (!postAuthorId) return;
    const beforeReactionBy = beforeData.reactionBy ?? {};
    const afterReactionBy = afterData.reactionBy ?? {};
    const newActors = Object.keys(afterReactionBy).filter(
      (actorId) => !beforeReactionBy[actorId]
    );
    if (newActors.length === 0) return;
    const postId = context.params.postId;
    await Promise.all(
      newActors.map(async (actorId) => {
        if (actorId === postAuthorId) return;
        const actorSnapshot = await buildActorSnapshot(actorId);
        await createNotification({
          type: "like",
          targetUserId: postAuthorId,
          actorId,
          postId,
          actorSnapshot,
        });
      })
    );
  });

export const onPostCommentCreated = functions
  .region("us-central1")
  .firestore.document("posts/{postId}/comments/{commentId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const actorId = data?.userId;
    const postId = context.params.postId;
    if (!actorId || !postId) return;
    const postDoc = await db.collection("posts").doc(postId).get();
    const postAuthorId = postDoc.data()?.userId;
    if (!postAuthorId || postAuthorId === actorId) return;
    const actorSnapshot = await buildActorSnapshot(actorId);
    await createNotification({
      type: "comment",
      targetUserId: postAuthorId,
      actorId,
      postId,
      commentId: context.params.commentId,
      message: data?.text ?? null,
      actorSnapshot,
    });
  });
