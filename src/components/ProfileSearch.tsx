import { useEffect, useMemo, useState } from "react";
import {
  searchUserProfiles,
  type ProfileSearchResult,
} from "../services/userProfiles";

type Props = {
  onSelect: (profile: ProfileSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function ProfileSearch({ onSelect, placeholder, autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchUserProfiles(value, 8);
        setResults(res);
      } catch (err) {
        console.error("profile search", err);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [query]);

  const empty = useMemo(() => query.trim().length > 0 && results.length === 0 && !loading, [query, results.length, loading]);

  return (
    <div className="profile-search">
      <div className="profile-search-bar">
        <span>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || "Rechercher un profil"}
          autoFocus={autoFocus}
        />
      </div>

      <div className="profile-search-dropdown">
        {loading && <div className="profile-search-note">Scan des exploratrices…</div>}
        {empty && <div className="profile-search-note">Aucun profil ne correspond</div>}
        {results.map((profile) => (
          <button
            key={profile.uid}
            type="button"
            className="profile-search-item"
            onClick={() => onSelect(profile)}
          >
            <div className="profile-search-avatar">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt={profile.username || profile.displayName || profile.uid} />
              ) : (
                <span>{(profile.username || profile.displayName || "U").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="profile-search-texts">
              <div className="profile-search-username">
                @{profile.username || profile.uid.slice(0, 6)}
                {profile.isPro && <span className="profile-search-pro">PRO</span>}
              </div>
              <div className="profile-search-bio">
                {profile.displayName || "Exploratrice"} — {profile.bio || "Vibes urbex"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
