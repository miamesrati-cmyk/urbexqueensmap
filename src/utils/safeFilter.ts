import type { Expression } from "mapbox-gl";

export function safeFilter(
  filterExpr?: Expression | null,
  fallbackToNeutral = true
): Expression | undefined {
  if (filterExpr == null) {
    return fallbackToNeutral ? (["all"] as Expression) : undefined;
  }
  return filterExpr;
}
