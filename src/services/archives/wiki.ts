/**
 * 📜 ARCHIVES MODE: Wikipedia GeoSearch Service
 * 
 * Fetches Wikipedia articles around a lat/lng point.
 * Returns summary, thumbnail, and link for "Archive Cards".
 */

export type WikiCard = {
  pageid: number;
  title: string;
  lat?: number;
  lon?: number;
  dist?: number; // Distance in meters
  extract?: string; // Intro summary (plain text)
  thumbnail?: { source: string; width: number; height: number };
  fullurl?: string; // Link to Wikipedia article
};

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/**
 * Fetch Wikipedia articles around a geographic point.
 * 
 * @param lat Latitude
 * @param lon Longitude
 * @param radiusM Search radius in meters (default: 2500m = 2.5km)
 * @param limit Max number of results (default: 10)
 * @param signal AbortSignal for cancellation
 * @returns Array of WikiCard objects
 */
export async function fetchWikiCardsAround(
  lat: number,
  lon: number,
  radiusM = 2500,
  limit = 10,
  signal?: AbortSignal
): Promise<WikiCard[]> {
  // Wikipedia API requires origin=* for CORS (not encoded URL)
  
  // Step 1: GeoSearch to find nearby articles
  const geoUrl =
    `${WIKI_API}?origin=*` +
    `&action=query&format=json&list=geosearch` +
    `&gscoord=${lat}|${lon}&gsradius=${radiusM}&gslimit=${limit}`;

  const geoRes = await fetch(geoUrl, { signal });
  if (!geoRes.ok) {
    throw new Error(`Wikipedia GeoSearch failed: ${geoRes.status}`);
  }

  const geoJson = await geoRes.json();
  const hits: Array<{ 
    pageid: number; 
    title: string; 
    lat: number; 
    lon: number; 
    dist: number;
  }> = geoJson?.query?.geosearch ?? [];

  if (!hits.length) return [];

  // Step 2: Fetch details (extract + thumbnail + fullurl)
  const ids = hits.map(h => h.pageid).join("|");
  const detailUrl =
    `${WIKI_API}?origin=*` +
    `&action=query&format=json&prop=extracts|pageimages|info` +
    `&exintro=1&explaintext=1&exchars=220` + // 220 char intro
    `&piprop=thumbnail&pithumbsize=320` +
    `&inprop=url` +
    `&pageids=${ids}`;

  const detailRes = await fetch(detailUrl, { signal });
  if (!detailRes.ok) {
    throw new Error(`Wikipedia details fetch failed: ${detailRes.status}`);
  }

  const detailJson = await detailRes.json();
  const pages = detailJson?.query?.pages ?? {};

  // Build a map of pageid → page details
  const byId = new Map<number, any>();
  Object.values(pages).forEach((p: any) => byId.set(p.pageid, p));

  // Merge geosearch hits with details
  return hits.map(h => {
    const p = byId.get(h.pageid);
    return {
      pageid: h.pageid,
      title: h.title,
      lat: h.lat,
      lon: h.lon,
      dist: h.dist,
      extract: p?.extract,
      thumbnail: p?.thumbnail,
      fullurl: p?.fullurl,
    } satisfies WikiCard;
  });
}
