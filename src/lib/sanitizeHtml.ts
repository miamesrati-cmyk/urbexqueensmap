import DOMPurify from "dompurify";

type SanitizeOptions = {
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: string[];
};

const DEFAULT_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "a",
  "span",
  "blockquote",
];
const DEFAULT_ATTRIBUTES = ["href", "title", "target", "rel"];

const purifier =
  typeof window !== "undefined"
    ? DOMPurify(window)
    : null;

function sanitizeFallback(value: string, maxLength: number) {
  const sanitized = value
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return sanitized.slice(0, maxLength);
}

export function sanitizeHtml(
  value: string,
  options: SanitizeOptions = {}
): string {
  if (!value) return "";
  const maxLength = options.maxLength ?? 32000;
  const truncated = value.slice(0, maxLength);
  if (!purifier) {
    return sanitizeFallback(truncated, maxLength);
  }
  return purifier.sanitize(truncated, {
    ALLOWED_TAGS: options.allowedTags ?? DEFAULT_TAGS,
    ALLOWED_ATTR: options.allowedAttributes ?? DEFAULT_ATTRIBUTES,
  });
}
