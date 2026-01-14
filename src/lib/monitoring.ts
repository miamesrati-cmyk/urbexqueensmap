import * as Sentry from "@sentry/browser";
import type { EnvValidationIssue } from "../types/envValidation";
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const RELEASE =
  import.meta.env.VITE_APP_VERSION ??
  import.meta.env.VITE_COMMIT_SHA ??
  import.meta.env.VITE_BUILD_TIME ??
  "dev";
const ENVIRONMENT =
  import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE ?? "production";

const TRACE_SAMPLE_RATE = clampRate(
  Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0")
);
const ERROR_SAMPLE_RATE = clampRate(
  Number(import.meta.env.VITE_SENTRY_ERROR_SAMPLE_RATE ?? "0.2")
);

const shouldInitSentry =
  Boolean(import.meta.env.PROD) &&
  typeof SENTRY_DSN === "string" &&
  SENTRY_DSN.trim().length > 0;

const CSP_EVENT_SAMPLE_RATE = clampRate(
  Number(import.meta.env.VITE_SENTRY_CSP_SAMPLE_RATE ?? "0.02")
);

const DEFAULT_TAGS = {
  appEnv: ENVIRONMENT,
  buildVersion: RELEASE,
};

const sensitiveKeywordPatterns = ["token", "authorization", "cookie", "apikey"];

if (shouldInitSentry) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: RELEASE,
    environment: ENVIRONMENT,
    tracesSampleRate: TRACE_SAMPLE_RATE,
    sampleRate: ERROR_SAMPLE_RATE,
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = stripUrl(event.request.url);
      }
      if (event.request) {
        event.request.headers = undefined;
        event.request.cookies = undefined;
        event.request.data = undefined;
      }
      if (event.user) {
        event.user = sanitizeUser(event.user);
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeBreadcrumb(breadcrumb);
    },
  });
  Object.entries(DEFAULT_TAGS).forEach(([key, value]) => {
    if (value) {
      Sentry.setTag(key, value);
    }
  });
}

const captureException = (error: unknown, hint?: Sentry.EventHint) => {
  if (!shouldInitSentry) return;
  Sentry.captureException(error, hint);
};

const captureMapboxError = (error: unknown) => {
  if (!shouldInitSentry) return;
  Sentry.withScope((scope) => {
    scope.setTag("feature", "mapbox");
    Sentry.captureException(error);
  });
};

const captureMessage = (message: string, level?: Sentry.SeverityLevel) => {
  if (!shouldInitSentry) return;
  Sentry.captureMessage(message, level);
};

const captureSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
  if (!shouldInitSentry) return;
  if (Math.random() > CSP_EVENT_SAMPLE_RATE) return;
  const directive = event.violatedDirective ?? "unknown";
  const blocked = event.blockedURI ?? "unknown";
  const source = event.sourceFile ?? "unknown";
  Sentry.withScope((scope) => {
    scope.setTag("feature", "csp");
    scope.setTag("csp_directive", directive);
    scope.setExtra("blocked_uri", blocked);
    scope.setExtra("document_uri", event.documentURI ?? "unknown");
    scope.setExtra("source_file", source);
    scope.setExtra("referrer", event.referrer ?? "unknown");
    scope.setExtra("original_policy", event.originalPolicy ?? "unknown");
    scope.setExtra("line_number", event.lineNumber ?? 0);
    scope.setExtra("column_number", event.columnNumber ?? 0);
    scope.setContext("csp_violation", {
      directive,
      blocked,
      source,
      document: event.documentURI ?? "unknown",
    });
    scope.setFingerprint(["csp", directive, blocked, source]);
    Sentry.captureMessage("Content Security Policy violation reported", "warning");
  });
};

type EnvIssuePayload = {
  message: string;
  issueType: "missing" | "invalid";
  missingVars?: string[];
  invalidIssues?: EnvValidationIssue[];
  buildSha: string;
  buildTime: string;
};

const captureEnvIssue = (payload: EnvIssuePayload) => {
  if (!shouldInitSentry) return;
  const fingerprint = ["uq-missing-env", payload.buildSha || "unknown"];
  const missingTag =
    payload.issueType === "missing"
      ? payload.missingVars?.join(", ") ?? ""
      : payload.invalidIssues?.map((issue) => issue.name).join(", ") ?? "invalid";

  Sentry.withScope((scope) => {
    scope.setTag("uq_env_missing", "true");
    scope.setTag("build_sha", payload.buildSha || "unknown");
    scope.setTag("missing_vars", missingTag);
    scope.setFingerprint(fingerprint);
    scope.setContext("env_validation", {
      type: payload.issueType,
      missing: payload.missingVars,
      invalid: payload.invalidIssues,
      buildTime: payload.buildTime,
    });
    Sentry.captureMessage(payload.message, "fatal");
  });
};

const captureBreadcrumb = (breadcrumb: Sentry.Breadcrumb) => {
  if (!shouldInitSentry) return;
  Sentry.addBreadcrumb(breadcrumb);
};

const stripUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
};

const sanitizeUser = (user: Sentry.User): Sentry.User | undefined => {
  if (!user?.id) return undefined;
  const userId = String(user.id);
  return {
    id: `uid-${hashString(userId)}`,
  };
};

const sanitizeBreadcrumb = (
  breadcrumb: Sentry.Breadcrumb | null
): Sentry.Breadcrumb | null => {
  if (!breadcrumb) return null;
  const combinedText = `${breadcrumb.message ?? ""} ${breadcrumb.category ?? ""}`.toLowerCase();
  if (sensitiveKeywordPatterns.some((keyword) => combinedText.includes(keyword))) {
    return null;
  }
  const data = breadcrumb.data as Record<string, unknown> | undefined;
  if (!data) return breadcrumb;
  const sanitizedData: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (
      sensitiveKeywordPatterns.some((keyword) =>
        key.toLowerCase().includes(keyword)
      )
    ) {
      return;
    }
    sanitizedData[key] = value;
  });
  if (Object.keys(sanitizedData).length === 0) {
    return {
      ...breadcrumb,
      data: undefined,
    };
  }
  return {
    ...breadcrumb,
    data: sanitizedData,
  };
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

function clampRate(rate: number) {
  if (Number.isNaN(rate)) return 0;
  return Math.max(0, Math.min(1, rate));
}

export {
  captureException,
  captureMapboxError,
  captureMessage,
  captureBreadcrumb,
  captureEnvIssue,
  captureSecurityPolicyViolation,
};
