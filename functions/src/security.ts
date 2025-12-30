import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export type SecurityEventSeverity = "info" | "warning" | "alert" | "error";

export type SecurityEvent = {
  type: string;
  detail: string;
  severity?: SecurityEventSeverity;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logSecurityEvent(event: SecurityEvent) {
  try {
    await admin
      .firestore()
      .collection("securityEvents")
      .add({
        type: event.type,
        detail: event.detail,
        severity: event.severity ?? "info",
        userId: event.userId ?? null,
        metadata: event.metadata ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    functions.logger.log("securityEvent", {
      type: event.type,
      severity: event.severity ?? "info",
      userId: event.userId ?? null,
      metadata: event.metadata ?? null,
      detail: event.detail,
    });
  } catch (err) {
    functions.logger.warn("Unable to log security event", err);
  }
}

export function requireAppCheck(
  context: functions.https.CallableContext,
  action: string
) {
  if (!context.app?.token?.appId) {
    const detail = {
      action,
      uid: context.auth?.uid ?? null,
      method: context.rawRequest.method,
    };
    void logSecurityEvent({
      type: "app_check.missing",
      detail: `App Check token required for ${action}`,
      severity: "warning",
      userId: context.auth?.uid ?? null,
      metadata: detail,
    });
    functions.logger.warn("App Check validation failed", detail);
    throw new functions.https.HttpsError(
      "failed-precondition",
      "App Check token requis."
    );
  }
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateBuckets: Map<string, number[]> = new Map();

function getRequestIdentifier(
  context: functions.https.CallableContext,
  action: string
) {
  const uid = context.auth?.uid ?? "anonymous";
  const rawIp =
    context.rawRequest.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
    context.rawRequest.socket.remoteAddress ??
    "unknown";
  return `${action}:${uid}:${rawIp}`;
}

export function enforceRateLimit(
  context: functions.https.CallableContext,
  action: string
) {
  const key = getRequestIdentifier(context, action);
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? [];
  const windowed = bucket.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  windowed.push(now);
  rateBuckets.set(key, windowed);
  if (windowed.length > RATE_LIMIT_MAX) {
    void logSecurityEvent({
      type: "rate_limit.trigger",
      detail: `Rate limit exceeded for ${action}`,
      severity: "warning",
      userId: context.auth?.uid ?? null,
      metadata: {
        key,
        count: windowed.length,
        limit: RATE_LIMIT_MAX,
      },
    });
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Trop de requêtes. Réessaie dans quelques instants."
    );
  }
}
