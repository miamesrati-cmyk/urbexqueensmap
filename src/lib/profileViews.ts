export type ProfileViewSection = "spots" | "posts" | "done" | "favorites";

const PROFILE_VIEW_SET: Set<ProfileViewSection> = new Set([
  "spots",
  "posts",
  "done",
  "favorites",
]);

/**
 * Lit la query string `view=` et retourne la section reconnue, sinon undefined.
 */
export function parseProfileViewFromSearch(
  search?: string | null
): ProfileViewSection | undefined {
  if (!search) return undefined;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return undefined;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch (err) {
    console.error("Impossible de parser la query string profile view", err);
    return undefined;
  }
  const view = params.get("view");
  if (view && PROFILE_VIEW_SET.has(view as ProfileViewSection)) {
    return view as ProfileViewSection;
  }
  return undefined;
}
