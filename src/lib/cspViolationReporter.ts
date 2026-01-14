import { captureSecurityPolicyViolation } from "./monitoring";

const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "edge-extension://",
  "ms-browser-extension://",
];

const HISTORY_LIMIT = 200;
const seenViolations = new Set<string>();
const violationHistory: string[] = [];

const buildViolationKey = (event: SecurityPolicyViolationEvent) => {
  const directive = event.violatedDirective ?? "unknown";
  const blocked = event.blockedURI ?? event.sourceFile ?? "unknown";
  const documentUri = event.documentURI ?? "unknown";
  return `${directive}|${blocked}|${documentUri}`;
};

const isExtensionViolation = (event: SecurityPolicyViolationEvent) => {
  const candidate = event.sourceFile ?? event.blockedURI ?? "";
  if (!candidate) return false;
  return EXTENSION_SCHEMES.some((scheme) => candidate.startsWith(scheme));
};

const recordViolation = (key: string) => {
  seenViolations.add(key);
  violationHistory.push(key);
  if (violationHistory.length > HISTORY_LIMIT) {
    const oldest = violationHistory.shift();
    if (oldest) {
      seenViolations.delete(oldest);
    }
  }
};

const handleSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
  if (isExtensionViolation(event)) return;
  const key = buildViolationKey(event);
  if (seenViolations.has(key)) return;
  recordViolation(key);
  captureSecurityPolicyViolation(event);
};

export const installSecurityPolicyReporter = () => {
  if (typeof window === "undefined") return;
  window.addEventListener("securitypolicyviolation", handleSecurityPolicyViolation);
};
