import { useEffect, useMemo, useState } from "react";
import {
  searchUserProfiles,
  type ProfileSearchResult,
} from "../../services/userProfiles";

type Props = {
  onSelect: (profile: ProfileSearchResult) => void;
};

export default function UrbexFeedUserSearch({ onSelect }: Props) {
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
        const res = await searchUserProfiles(value, 6);
        setResults(res);
      } catch (err) {
        console.error("feed user search", err);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  const empty = useMemo(
    () => query.trim().length > 0 && results.length === 0 && !loading,
    [query, results.length, loading]
  );

  return (
    <div className="feed-user-search">
      <div className="feed-user-search-bar">
        <span>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Trouve une exploratrice (@username)"
        />
      </div>

      {(loading || empty || results.length > 0) && (
        <div className="feed-user-search-dropdown">
          {loading && <div className="feed-user-search-note">Scan des profils…</div>}
          {empty && <div className="feed-user-search-note">Aucun pseudo trouvé.</div>}
          {results.map((profile) => (
            <button
              key={profile.uid}
              type="button"
              className="feed-user-search-item"
              onClick={() => onSelect(profile)}
            >
              <div className="feed-user-search-avatar">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.username || profile.uid} />
                ) : (
                  <span>{(profile.username || profile.displayName || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="feed-user-search-texts">
                <div className="feed-user-search-username">
                  @{profile.username || profile.uid.slice(0, 6)}
                  {profile.isPro && <span className="feed-user-search-pro">PRO</span>}
                </div>
                <div className="feed-user-search-bio">
                  {profile.displayName || "Exploratrice"} · {profile.bio || "Vibes urbex"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
