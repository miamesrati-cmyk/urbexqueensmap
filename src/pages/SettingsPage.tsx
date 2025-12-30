import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  SETTINGS_EVENT,
  SETTINGS_KEY,
  getDefaultSettings,
  loadSettingsFromFirestore,
  loadSettingsFromLocal,
  saveSettingsToFirestore,
} from "../services/userSettings";
import {
  generateUsername,
  isUsernameAvailable,
  sanitizeUsername,
  upsertUserProfile,
} from "../services/userProfiles";
import type { UserSettings } from "../types/UserSettings";
import "./SettingsPage.css";

type SettingsPageProps = {
  onClose?: () => void;
};

type ToggleRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onChange: () => void;
  switchClassName?: string;
};

function Switch({
  on,
  onToggle,
  className,
}: {
  on: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`uq-switch ${on ? "uq-switch--on" : ""} ${className ?? ""}`}
      onClick={onToggle}
      aria-pressed={on}
    >
      <span className="uq-switch-thumb" />
    </button>
  );
}

function SettingsToggle({
  label,
  description,
  value,
  onChange,
  switchClassName,
}: ToggleRowProps) {
  return (
    <div className="settings-row">
      <div>
        <h3>{label}</h3>
        {description && <p className="uq-settings-hint">{description}</p>}
      </div>
      <Switch on={value} onToggle={onChange} className={switchClassName} />
    </div>
  );
}

function NotificationToggle({
  label,
  description,
  value,
  onChange,
  switchClassName,
}: ToggleRowProps) {
  return (
    <div className="settings-row">
      <div>
        <h3>{label}</h3>
        {description && <p className="uq-settings-hint">{description}</p>}
      </div>
      <Switch on={value} onToggle={onChange} className={switchClassName} />
    </div>
  );
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [displayName, setDisplayName] = useState(
    () => auth.currentUser?.displayName || ""
  );
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(() =>
    loadSettingsFromLocal()
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setDisplayName(current?.displayName || "");
      if (current?.uid) {
        getDoc(doc(db, "users", current.uid))
          .then((snap) => {
            const data = snap.data() as any;
            setIsPro(!!data?.isPro);
            const uname = data?.username || "";
            setUsername(uname);
            setInitialUsername(uname);
          })
          .catch(() => setIsPro(false));
      } else {
        setIsPro(false);
        setUsername("");
        setInitialUsername("");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const local = loadSettingsFromLocal();
    setSettings(local);
    setLoading(true);
    loadSettingsFromFirestore(user.uid)
      .then((remote) => setSettings(remote))
      .catch((err) => console.error("Erreur chargement settings remote", err))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key && e.key !== SETTINGS_KEY) return;
      setSettings(loadSettingsFromLocal());
    }
    function handleSettingsEvent(e: Event) {
      const detail = (e as CustomEvent<UserSettings>).detail;
      if (detail) {
        setSettings({ ...getDefaultSettings(), ...detail });
      } else {
        setSettings(loadSettingsFromLocal());
      }
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      SETTINGS_EVENT,
      handleSettingsEvent as EventListener
    );
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        SETTINGS_EVENT,
        handleSettingsEvent as EventListener
      );
    };
  }, []);

  const email = user?.email || "—";
  const lastLogin = useMemo(
    () => user?.metadata?.lastSignInTime,
    [user?.metadata?.lastSignInTime]
  );

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      window.dispatchEvent(
        new CustomEvent("urbex-nav", { detail: { path: "/" } })
      );
    }
  }

  function updateSetting(patch: Partial<UserSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function updatePreference(key: keyof UserSettings, value: boolean) {
    // garder l’alias notifyNewSpotsNearMe synchronisé
    if (key === "notifyNewSpotsNearby" || key === "notifyNewSpotsNearMe") {
      updateSetting({
        notifyNewSpotsNearby: value,
        notifyNewSpotsNearMe: value,
      });
      return;
    }
    updateSetting({ [key]: value } as Partial<UserSettings>);
  }

  async function handleSaveAll() {
    if (!user) return;
    setSaving(true);
    setStatus("idle");
    setStatusMessage("");
    try {
      await saveSettingsToFirestore(user.uid, settings);
      setStatus("success");
      setStatusMessage("Paramètres sauvegardés");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Impossible de sauvegarder pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    if (!user) {
      setStatus("error");
      setStatusMessage("Connecte-toi pour modifier ton nom d’affichage.");
      return;
    }
    const trimmed = displayName.trim();
    const candidate = username.trim();
    setProfileSaving(true);
    setStatus("idle");
    setStatusMessage("");
    setUsernameError(null);
    try {
      const clean =
        candidate.length === 0 ? await generateUsername(user.uid, trimmed) : sanitizeUsername(candidate);
      const validFormat = /^[a-z0-9_]{3,20}$/i.test(clean);
      if (!validFormat) {
        setUsernameError("3-20 caractères, lettres/chiffres/underscore uniquement.");
        setProfileSaving(false);
        return;
      }
      if (clean !== initialUsername) {
        const available = await isUsernameAvailable(clean, user.uid);
        if (!available) {
          setUsernameError("Ce pseudo est déjà pris.");
          setProfileSaving(false);
          return;
        }
      }

      await updateProfile(user, { displayName: trimmed || null });
      await upsertUserProfile(user.uid, {
        displayName: trimmed || null,
        username: clean,
      });
      setUsername(clean);
      setInitialUsername(clean);
      setStatus("success");
      setStatusMessage("Profil mis à jour ✨");
      setDisplayName(auth.currentUser?.displayName || trimmed);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Impossible de mettre à jour le profil pour le moment.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setStatus("success");
      setStatusMessage("Email de réinitialisation envoyé.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Impossible d’envoyer l’email pour le moment.");
    }
  }

  async function handleDownloadData() {
    if (!user) return;
    setDownloading(true);
    const timestamp = new Date().toISOString();
    try {
      const placesSnap = await getDoc(doc(db, "userPlaces", user.uid));
      const placesData = placesSnap.data() as { places?: Record<string, any> } | undefined;
      const payload = {
        profile: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          lastLogin,
        },
        settings,
        places: placesData?.places || {},
        downloadedAt: timestamp,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "urbexqueens-data.json";
      a.click();
      URL.revokeObjectURL(url);

      const next = { ...settings, lastDataDownloadAt: timestamp };
      setSettings(next);
      await saveSettingsToFirestore(user.uid, next);
      setStatus("success");
      setStatusMessage("Export JSON généré.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Téléchargement impossible pour le moment.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    const ok = window.confirm(
      "Supprimer ton compte supprimera tes données UrbexQueens (action définitive). Continuer ?"
    );
    if (!ok) return;
    try {
      await user.delete();
      setStatus("success");
      setStatusMessage("Compte supprimé (si la session est valide).");
      handleClose();
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage(
        "Suppression non finalisée. Il faut peut-être te reconnecter avant de supprimer."
      );
    }
  }

  if (!user) {
    return (
      <div className="uq-settings-page settings-page">
        <div className="uq-settings-card">
          <button className="uq-close-btn" type="button" onClick={handleClose}>
            ×
          </button>
          <h1 className="uq-settings-title">Paramètres</h1>
          <p className="uq-settings-hint">
            Connecte-toi pour accéder à tes réglages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="uq-settings-page settings-page uq-container">
      <div className="uq-settings-card">
        <button className="uq-close-btn" type="button" onClick={handleClose}>
          ×
        </button>

        <div className="uq-settings-header">
          <div>
            <p className="uq-kicker">Tableau de bord</p>
            <h1 className="uq-settings-title">Paramètres</h1>
            <p className="uq-settings-lead">
              Sécurité, confidentialité, notifications et PRO — tout est centralisé ici.
            </p>
          </div>
          <div className="uq-settings-meta">
            <span>Statut : {loading ? "Chargement..." : "Prêt"}</span>
            {lastLogin && <span>Dernière connexion : {lastLogin}</span>}
          </div>
        </div>

        <div className="settings-sections">
          <section className="settings-section">
            <h2 className="settings-section-title">Profil & compte</h2>
            <div className="settings-row user-summary">
              <div className="user-avatar">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={displayName || email} />
                ) : (
                  <span>{(displayName || email || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="user-summary-text">
                <div className="user-name">{displayName || "Explorateur"}</div>
                <div className="user-handle">@{username || (email || "").split("@")[0]}</div>
                <div className="user-email">{email}</div>
              </div>
              <div className="settings-row-actions">
                <button
                  className="uq-secondary-btn"
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                >
                  {profileSaving ? "En cours..." : "Modifier mon profil"}
                </button>
              </div>
            </div>

            <div className="uq-settings-grid">
              <label className="uq-field">
                <span>Email</span>
                <div className="uq-readonly">{email}</div>
              </label>
              <label className="uq-field">
                <span>Nom d’affichage</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Reine de l’Urbex"
                />
              </label>
              <label className="uq-field">
                <span>Pseudo (URL)</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(null);
                  }}
                  placeholder="queen_urbex"
                />
                <p className="uq-settings-hint">3–20 caractères, lettres/chiffres/underscore. Uniquement si disponible.</p>
                {usernameError && <p className="uq-settings-hint" style={{ color: "#ff7f98" }}>{usernameError}</p>}
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Sécurité</h2>
            <div className="settings-row">
              <div>
                <h3>Modifier le mot de passe</h3>
                <p className="uq-settings-hint">
                  Change ton mot de passe UrbexQueens pour sécuriser ton compte.
                </p>
              </div>
              <button className="uq-secondary-btn" type="button" onClick={handlePasswordReset}>
                Réinitialiser
              </button>
            </div>

            <div className="settings-row">
              <div>
                <h3>Déconnexion globale</h3>
                <p className="uq-settings-hint">
                  Bientôt : déconnecter tous les appareils connectés à ton compte.
                </p>
              </div>
              <button
                className="uq-secondary-btn"
                type="button"
              >
                Bientôt dispo
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Notifications</h2>
            <NotificationToggle
              label="Nouveaux spots près de moi"
              description="Recevoir une alerte quand un nouveau lieu urbex est ajouté dans ta région."
              value={settings.notifyNewSpotsNearby ?? settings.notifyNewSpotsNearMe ?? false}
              onChange={() =>
                updatePreference(
                  "notifyNewSpotsNearby",
                  !(settings.notifyNewSpotsNearby ?? settings.notifyNewSpotsNearMe ?? false)
                )
              }
            />
            <NotificationToggle
              label="Messages"
              description="Être prévenu quand tu reçois un nouveau message."
              value={settings.notifyMessages ?? false}
              onChange={() =>
                updatePreference("notifyMessages", !(settings.notifyMessages ?? false))
              }
            />
            <NotificationToggle
              label="Commentaires"
              description="Être prévenu quand quelqu’un commente un de tes spots."
              value={settings.notifyComments ?? false}
              onChange={() =>
                updatePreference("notifyComments", !(settings.notifyComments ?? false))
              }
            />
            <NotificationToggle
              label="Alertes spots dangereux"
              description="Alerte quand un lieu est signalé risqué."
              value={settings.notifyDangerousSpots}
              onChange={() =>
                updatePreference("notifyDangerousSpots", !settings.notifyDangerousSpots)
              }
            />
            <NotificationToggle
              label="News UrbexQueens par email"
              description="Recevoir les mises à jour et nouveautés."
              value={settings.notifyNewsEmail}
              onChange={() =>
                updatePreference("notifyNewsEmail", !settings.notifyNewsEmail)
              }
            />
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Carte & exploration</h2>
            <SettingsToggle
              label="Afficher les spots Ghost"
              description="Montrer les spots paranormaux sur la carte."
              value={settings.mapShowGhost}
              onChange={() => updatePreference("mapShowGhost", !settings.mapShowGhost)}
            />
            <SettingsToggle
              label="Afficher les spots Légendaires"
              description="Montrer les lieux iconiques."
              value={settings.mapShowLegend}
              onChange={() => updatePreference("mapShowLegend", !settings.mapShowLegend)}
            />
            <SettingsToggle
              label="Afficher les spots faits"
              description="Mettre en avant les spots que tu as déjà visités."
              value={settings.mapShowDone}
              onChange={() => updatePreference("mapShowDone", !settings.mapShowDone)}
            />
            <SettingsToggle
              label="Recentrer automatiquement sur ma position"
              description="La carte se place sur toi à l’ouverture."
              value={settings.autoCenterOnUser}
              onChange={() =>
                updatePreference("autoCenterOnUser", !settings.autoCenterOnUser)
              }
            />
            <SettingsToggle
              label="Mode nuit urbex"
              description="Ambiance violet / rose / noir pour planifier tes runs nocturnes."
              value={settings.lowLightMap}
              onChange={() => updatePreference("lowLightMap", !settings.lowLightMap)}
              switchClassName="uq-switch--night"
            />
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Abonnement PRO</h2>
            {isPro ? (
              <div className="settings-row">
                <div>
                  <h3>Tu es Explorateur PRO</h3>
                  <p className="uq-settings-hint">
                    Accès aux spots privés, ghost maps et histoires complètes. Merci de soutenir UrbexQueens ✨
                  </p>
                </div>
                <button
                  className="uq-secondary-btn"
                  type="button"
                >
                  Gérer mon abonnement
                </button>
              </div>
            ) : (
              <div className="settings-row">
                <div>
                  <h3>Passer en Explorateur PRO</h3>
                  <p className="uq-settings-hint">
                    Débloque les spots privés, les ghost maps et les fonctions avancées.
                  </p>
                </div>
                <button
                  className="uq-primary-btn"
                  type="button"
                >
                  Devenir PRO
                </button>
              </div>
            )}
          </section>

          <section className="settings-section">
            <h2 className="settings-section-title">Confidentialité & données</h2>
            <SettingsToggle
              label="Profil public"
              description="Si désactivé, seuls tes abonnés peuvent voir tes activités."
              value={settings.profilePublic}
              onChange={() => updatePreference("profilePublic", !settings.profilePublic)}
            />
            <SettingsToggle
              label="Afficher mes spots faits"
              description="Permettre aux autres de voir tes spots marqués comme faits."
              value={settings.showDonePublic}
              onChange={() => updatePreference("showDonePublic", !settings.showDonePublic)}
            />
            <SettingsToggle
              label="Afficher mes favoris"
              description="Permettre aux autres de voir tes favoris urbex."
              value={settings.showFavoritesPublic}
              onChange={() =>
                updatePreference("showFavoritesPublic", !settings.showFavoritesPublic)
              }
            />
            <SettingsToggle
              label="Autoriser les messages"
              description="Recevoir des messages privés d’autres membres."
              value={settings.allowMessages}
              onChange={() => updatePreference("allowMessages", !settings.allowMessages)}
            />
            <SettingsToggle
              label="Mode discret"
              description="Masquer ton nom et ton avatar sur certains écrans."
              value={settings.stealthMode}
              onChange={() => updatePreference("stealthMode", !settings.stealthMode)}
            />

            <div className="settings-row">
              <div>
                <h3>Exporter mes données</h3>
                <p className="uq-settings-hint">
                  Télécharger un fichier avec les données de ton compte.
                </p>
              </div>
              <button
                type="button"
                className="uq-secondary-btn"
                onClick={handleDownloadData}
                disabled={downloading}
              >
                {downloading ? "Préparation..." : "Télécharger mes données"}
              </button>
            </div>

            <div className="settings-row danger-zone">
              <div>
                <h3>Supprimer mon compte</h3>
                <p className="uq-settings-hint">
                  Supprimer définitivement ton compte et toutes tes données urbex.
                </p>
              </div>
              <button className="uq-danger-btn" type="button" onClick={handleDeleteAccount}>
                Supprimer mon compte
              </button>
            </div>
          </section>
        </div>

        <div className="uq-settings-actions">
          <button
            className="uq-primary-btn"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
          </button>
          {statusMessage && (
            <span
              className={`uq-settings-status ${
                status === "error" ? "is-error" : "is-success"
              }`}
            >
              {statusMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
