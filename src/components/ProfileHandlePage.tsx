import { useEffect, useState } from "react";
import { resolveUserByHandle } from "../services/userProfiles";
import type { ProfileViewSection } from "../lib/profileViews";
import ProfilePage from "./ProfilePage";

type Props = {
  handle: string;
  onBack?: () => void;
  view?: ProfileViewSection;
};

export default function ProfileHandlePage({ handle, onBack, view }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setUid(null);
    resolveUserByHandle(handle)
      .then((res) => {
        if (cancelled) return;
        setUid(res?.uid ?? null);
      })
      .catch((err) => {
        console.error("resolve handle", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="uq-profile-page">
        <div className="uq-profile-card" style={{ margin: 24 }}>
          Chargement du profil…
        </div>
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="uq-profile-page">
        <div className="uq-profile-card" style={{ margin: 24 }}>
          Profil introuvable ou supprimé.
        </div>
      </div>
    );
  }

  return <ProfilePage uid={uid} view={view} onBack={onBack} />;
}
