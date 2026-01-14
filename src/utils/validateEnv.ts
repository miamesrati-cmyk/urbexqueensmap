import { captureEnvIssue } from "../lib/monitoring";
import type { EnvCheckResult, EnvValidationIssue } from "../types/envValidation";

export const REQUIRED_ENV_VARS = [
  "VITE_MAPBOX_TOKEN",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

const buildSha =
  import.meta.env.VITE_BUILD_SHA ??
  import.meta.env.VITE_COMMIT_SHA ??
  import.meta.env.VITE_APP_VERSION ??
  "local";
const buildTime = import.meta.env.VITE_BUILD_TIME ?? new Date().toISOString();

function createMessageFromIssues(issues: EnvValidationIssue[]) {
  if (issues.length === 1) {
    return `${issues[0].name}: ${issues[0].reason}`;
  }
  return issues.map((issue) => `${issue.name}: ${issue.reason}`).join("; ");
}

function hasValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return Boolean(value);
}

export function validateEnv(): EnvCheckResult {
  const baseMetadata = { buildSha, buildTime };
  const missing = REQUIRED_ENV_VARS.filter((variable) => {
    return !hasValue(import.meta.env[variable]);
  });

  if (missing.length > 0) {
    const message = `Missing env vars: ${missing.join(", ")}`;
    if (import.meta.env.DEV) {
      throw new Error(message);
    }
    console.error(message);
    captureEnvIssue({
      message,
      issueType: "missing",
      missingVars: missing,
      buildSha,
      buildTime,
    });
    return { ...baseMetadata, ok: false, type: "missing", missing };
  }

  const invalidIssues: EnvValidationIssue[] = [];

  const mapboxToken = String(import.meta.env.VITE_MAPBOX_TOKEN ?? "").trim();
  if (!mapboxToken.startsWith("pk.")) {
    invalidIssues.push({
      name: "VITE_MAPBOX_TOKEN",
      reason: "Le token doit commencer par « pk. » et ne doit pas être vide.",
    });
  } else if (mapboxToken.length < 10) {
    invalidIssues.push({
      name: "VITE_MAPBOX_TOKEN",
      reason: "Le token semble trop court pour correspondre au format Mapbox.",
    });
  }

  const firebaseChecks: Array<{ name: string; label: string }> = [
    { name: "VITE_FIREBASE_PROJECT_ID", label: "Identifiant du projet Firebase" },
    { name: "VITE_FIREBASE_APP_ID", label: "App ID Firebase" },
    { name: "VITE_FIREBASE_API_KEY", label: "Clé API Firebase" },
  ];

  firebaseChecks.forEach((check) => {
    const value = String(import.meta.env[check.name] ?? "").trim();
    if (value.length === 0) {
      invalidIssues.push({
        name: check.name,
        reason: `${check.label} vide ou manquant.`,
      });
    }
  });

  if (invalidIssues.length > 0) {
    const message = `Invalid env vars: ${createMessageFromIssues(invalidIssues)}`;
    if (import.meta.env.DEV) {
      throw new Error(message);
    }
    console.error(message);
    captureEnvIssue({
      message,
      issueType: "invalid",
      invalidIssues,
      buildSha,
      buildTime,
    });
    return { ...baseMetadata, ok: false, type: "invalid", issues: invalidIssues };
  }

  return { ...baseMetadata, ok: true };
}
