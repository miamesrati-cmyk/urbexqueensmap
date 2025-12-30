import sanitizeHtml from "sanitize-html";

const SAFE_HTML_TAGS = [
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

const SAFE_HTML_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
};

export type SanitizationOptions = {
  allowHtml?: boolean;
  maxLength?: number;
};

export function sanitizeText(
  value: string,
  options: SanitizationOptions = {}
): string {
  const maxLength = Math.max(1, Math.min(100000, options.maxLength ?? 32000));
  const truncated = value.slice(0, maxLength);
  const htmlConfig = {
    allowedTags: options.allowHtml ? SAFE_HTML_TAGS : [],
    allowedAttributes: options.allowHtml ? SAFE_HTML_ATTRIBUTES : {},
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  };
  try {
    const sanitized = sanitizeHtml(truncated, htmlConfig);
    return sanitized.trim();
  } catch {
    const fallback = truncated
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .trim();
    return fallback;
  }
}
