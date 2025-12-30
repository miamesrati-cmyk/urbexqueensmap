// src/components/SearchBar.tsx
import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { Place } from "../services/places";
import {
  searchUserProfiles,
  type ProfileSearchResult,
} from "../services/userProfiles";

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

type Props = {
  places: Place[];
  onSelectPlace: (place: Place) => void;
  onSelectExternal: (lng: number, lat: number, label: string) => void;
  isProUser?: boolean;
  onSelectProfile?: (profile: ProfileSearchResult) => void;
};

type GoogleResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

// Convertit DMS → decimal
function dmsToDecimal(dms: string): number | null {
  const regex =
    /(\d+)[°\s]+(\d+)[\'\s]+([\d.]+)\"?\s*([NSEW])?/i;

  const match = dms.match(regex);
  if (!match) return null;

  const deg = parseFloat(match[1]);
  const min = parseFloat(match[2]);
  const sec = parseFloat(match[3]);
  const dir = match[4]?.toUpperCase();

  let dec = deg + min / 60 + sec / 3600;

  if (dir === "S" || dir === "W") {
    dec = -dec;
  }

  return dec;
}

// Détecte coordonnées DMS ou décimales
function looksLikeCoords(query: string) {
  const cleaned = query.trim();

  // Format DMS
  const dmsRegex =
    /([0-9°\'\"\.\sNSEW]+)\s+([0-9°\'\"\.\sNSEW]+)/i;

  const dmsMatch = cleaned.match(dmsRegex);
  if (dmsMatch) {
    const latDms = dmsMatch[1];
    const lngDms = dmsMatch[2];

    const lat = dmsToDecimal(latDms);
    const lng = dmsToDecimal(lngDms);

    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }

  // Format décimal
  const parts = cleaned.replace(/;/g, ",").split(/[,\s]+/).filter(Boolean);
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

// Appel API Google
async function fetchGoogleGeocode(query: string): Promise<GoogleResult[]> {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?address=" +
    encodeURIComponent(query) +
    "&key=" +
    GOOGLE_KEY;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") return [];

  return data.results.map((r: any, index: number) => ({
    id: r.place_id ?? String(index),
    label: r.formatted_address ?? query,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

// ⭐⭐⭐ EXPORT DEFAULT — LE PLUS IMPORTANT ⭐⭐⭐
export default function SearchBar({
  places,
  onSelectPlace,
  onSelectExternal,
  isProUser = false,
  onSelectProfile,
}: Props) {
  const [query, setQuery] = useState<string>("");
  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([]);
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const internalMatches = query.trim()
    ? places.filter((p) =>
        p.title.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  useEffect(() => {
    if (!onSelectProfile) return;
    const value = query.trim();
    if (!value) {
      setProfileResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setProfileLoading(true);
      try {
        const res = await searchUserProfiles(value, 6);
        setProfileResults(res);
      } catch (err) {
        console.error("profile search", err);
      } finally {
        setProfileLoading(false);
      }
    }, 150);
    return () => clearTimeout(timeout);
  }, [query, onSelectProfile]);

  async function handleSearch(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setShowDropdown(true);
    setGoogleResults([]);
    setErrorMsg(null);

    // 1) Coordonnées (DMS ou décimal)
    const coords = looksLikeCoords(q);
    if (coords) {
      onSelectExternal(coords.lng, coords.lat, q);
      setGoogleResults([
        {
          id: "coords",
          label: q + " (coordonnées)",
          lat: coords.lat,
          lng: coords.lng,
        },
      ]);
      return;
    }

    // 2) Sinon → Google Maps
    const results = await fetchGoogleGeocode(q);

    if (!results.length) {
      setErrorMsg("Aucun résultat Google.");
      return;
    }

    setGoogleResults(results);

    // centrer sur le premier
    const first = results[0];
    onSelectExternal(first.lng, first.lat, first.label);
  }

  function handleSelectGoogle(r: GoogleResult) {
    setShowDropdown(false);
    setQuery(r.label);
    onSelectExternal(r.lng, r.lat, r.label);
  }

  function handleSelectProfile(profile: ProfileSearchResult) {
    if (!onSelectProfile) return;
    setShowDropdown(false);
    setQuery(profile.username || profile.displayName || "");
    onSelectProfile(profile);
  }

  function handleSelectInternal(p: Place) {
    setShowDropdown(false);
    setQuery(p.title);
    onSelectPlace(p);
  }

  return (
    <div ref={containerRef} className="map-search-container">
      <form onSubmit={handleSearch} className="map-search-form">
        <span className="map-search-icon">🔍</span>

        <input
          id="map-search-input"
          name="mapSearch"
          aria-label="Recherche de spots ou coordonnées"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          placeholder="Search locations, explorers, hidden coordinates"
          className="map-search-input"
        />
        <button type="submit" className="map-search-submit">
          <span>🔍</span>
          GO
        </button>
      </form>

      {errorMsg && (
        <div style={{ color: "#ff5c7a", marginTop: 4, fontSize: 12 }}>
          {errorMsg}
        </div>
      )}

      {showDropdown &&
        (internalMatches.length > 0 || googleResults.length > 0 || profileResults.length > 0) && (
          <div
            className="uq-search-dropdown"
            style={{
              marginTop: 6,
              background: "rgba(0,0,0,0.9)",
              padding: 10,
              borderRadius: 10,
              maxHeight: 260,
              overflowY: "auto",
              boxShadow: "0 0 14px rgba(0,0,0,0.7)",
            }}
          >
            {onSelectProfile && (
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#9c9cff",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Profils</span>
                {profileLoading && <span style={{ fontSize: 10, color: "#c9c9ff" }}>scan…</span>}
              </div>
            )}

            {profileResults.map((user) => (
              <div
                key={user.uid}
                onClick={() => handleSelectProfile(user)}
                style={{
                  padding: "8px 6px",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: 8,
                  transition: "background 0.2s, transform 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                  }}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.username || user.displayName || user.uid}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>{(user.username || user.displayName || "U").charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>
                      @{user.username || user.uid.slice(0, 6)}
                    </span>
                    {user.isPro && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(255, 195, 0, 0.14)",
                          border: "1px solid rgba(255, 195, 0, 0.4)",
                        }}
                      >
                        PRO
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#c7c7d5" }}>
                    {user.displayName || "Exploratrice"} · {user.bio || "Vibes urbex"}
                  </div>
                </div>
              </div>
            ))}

            {internalMatches.length > 0 && (
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#ff9ad0",
                  marginBottom: 4,
                }}
              >
                Spots UrbexQueens
              </div>
            )}

            {internalMatches.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectInternal(p)}
                style={{
                  padding: "6px 4px",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: 6,
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>{p.title}</span>
                {isProUser && (p.proOnly || p.isPublic === false) && (
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    ✨ PRO
                  </span>
                )}
              </div>
            ))}

            {googleResults.length > 0 && (
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#8fd2ff",
                  marginTop: internalMatches.length ? 8 : 0,
                  marginBottom: 4,
                }}
              >
                Résultats Google Maps
              </div>
            )}

            {googleResults.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelectGoogle(r)}
                style={{
                  padding: "6px 4px",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: 6,
                  transition: "background 0.2s",
                  fontSize: 13,
                }}
              >
                {r.label}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
