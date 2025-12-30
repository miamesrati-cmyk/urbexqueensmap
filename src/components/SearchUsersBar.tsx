import { useEffect, useState } from "react";
import { searchUserProfiles, type ProfileSearchResult } from "../services/userProfiles";

type Props = {
  placeholder?: string;
  onResults: (query: string, results: ProfileSearchResult[]) => void;
  onLoadingChange?: (loading: boolean) => void;
};

export default function SearchUsersBar({ placeholder, onResults, onLoadingChange }: Props) {
  const [value, setValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    const term = value.trim();
    if (!term) {
      onResults("", []);
      onLoadingChange?.(false);
      return;
    }
    onLoadingChange?.(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUserProfiles(term, 20);
        if (cancelled) return;
        onResults(term, results);
      } finally {
        if (!cancelled) onLoadingChange?.(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, onLoadingChange, onResults]);

  return (
    <div className="dm-search-bar">
      <span className="dm-search-icon">🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "Rechercher un explorateur..."}
        aria-label="Rechercher un explorateur"
      />
    </div>
  );
}
