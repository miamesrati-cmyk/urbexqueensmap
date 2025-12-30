import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { saveDarkEntrySession } from "../services/proGames";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";

type Discovery = {
  id: string;
  label: string;
  description: string;
  detail: string;
  x: number;
  y: number;
  type: "note" | "artefact" | "trace";
};

const LOCATION_NAME = "Usine d'acier Silencieux";
const DISCOVERIES: Discovery[] = [
  {
    id: "note-planche",
    label: "Note griffonnée",
    description: "Une liste de runs et de contre-mesures griffonnée sur une planche près du vestiaire.",
    detail:
      "Tu repères les coordonnées d'une trappe oubliée, la date d'une livraison manquée et les premiers signes d'une présence inattendue.",
    x: 28,
    y: 34,
    type: "note",
  },
  {
    id: "amulet-shadow",
    label: "Amulette en cuivre",
    description: "Un petit médaillon accroché sur les barres métalliques, chaud malgré la poussière.",
    detail:
      "L'amulette pulsera quand tu séjourneras près de la mezzanine ; une note précise qu'elle servait à guider les éclaireurs.",
    x: 65,
    y: 40,
    type: "artefact",
  },
  {
    id: "tunnel-mark",
    label: "Marque du tunnelier",
    description: "Une peinture phosphorescente sur le conduit qui mène au tunnel des chaudières.",
    detail:
      "Tu suis la marque et tu découvres deux symboles : une flèche vers la sortie et une croix barrée. Le journal mentionne \"Silence ou mort\".",
    x: 55,
    y: 70,
    type: "trace",
  },
  {
    id: "vent-cover",
    label: "Couvercle de ventilation",
    description: "Une grille tordue qui libère un souffle glacial et le cliquetis d'une ancienne machinerie.",
    detail:
      "En démontant la grille (virtuellement), tu caches ton passage et découvres les étapes d'un ancien trajet de maintenance.",
    x: 42,
    y: 20,
    type: "artefact",
  },
  {
    id: "observation-note",
    label: "Observation nocturne",
    description: "Un carnet abandonné ouvert sur une page de nuit, détaillant des bruits indistincts.",
    detail:
      "Le carnet décrit des ombres qui surgissent à la tombée de la nuit. Il précise un rituel d'évasion et des timings précis.",
    x: 70,
    y: 62,
    type: "note",
  },
];

type EventKind = "noise" | "shadow" | "blackout" | "pulse";
const EVENT_POOL: Array<{ message: string; kind: EventKind; duration?: number }> = [
  { message: "Un craquement métallique résonne, comme si quelque chose se repositionnait au-dessus de toi.", kind: "noise" },
  { message: "Des reflets d'argent glissent sur les murs : une ombre vient d'entrer dans ta vision périphérique.", kind: "shadow" },
  { message: "La lumière vacille, puis cède à un blackout total pendant un instant.", kind: "blackout", duration: 2400 },
  { message: "Le silence se fissure, un souffle profond s'échappe d'un conduit près du sol.", kind: "noise" },
  { message: "Un halo spectral pulse : la tension monte, le batteur de ton pouls rejoint la cadence.", kind: "pulse" },
];

const RANKS = [
  { label: "Exploratrice Initiée", minDiscoveries: 0, detail: "Le lieu reste mystérieux, même si ta présence a déjà été remarquée." },
  { label: "Ombre Veilleuse", minDiscoveries: 2, detail: "Tu lis les indices et tu évites les mauvais réflexes, la confiance monte." },
  { label: "Traceuse Silencieuse", minDiscoveries: 4, detail: "Tu démasques les signes d'anciennes équipes et tu es presque incorporelle." },
  { label: "Reine des Vestiges", minDiscoveries: 5, detail: "Tu connais chaque couloir, chaque note chuchotée et tout te ramène à la sortie." },
];

const QA_PRO_PREVIEW_KEY = "UQ_QA_PRO_PREVIEW";
const QA_PREVIEW_ENABLED = import.meta.env.VITE_ENABLE_E2E_HOOKS === "1";
const ONBOARDING_STORAGE_KEY = "uq_dark_entry_intro_skip";

const TENSION_STATUS_TEXT = {
  safe: "Stable",
  presence: "Présence ressentie",
  threat: "Danger imminent",
  failed: "Exploration échouée",
} as const;

function computeTensionStatus(value: number) {
  if (value >= 100) return TENSION_STATUS_TEXT.failed;
  if (value >= 80) return TENSION_STATUS_TEXT.threat;
  if (value >= 50) return TENSION_STATUS_TEXT.presence;
  return TENSION_STATUS_TEXT.safe;
}

function describeDirection(item: Discovery) {
  const horizontal = item.x < 35 ? "ouest" : item.x > 65 ? "est" : "centre";
  const vertical = item.y < 35 ? "nord" : item.y > 65 ? "sud" : "centre";
  const parts: string[] = [];
  if (vertical !== "centre") parts.push(vertical);
  if (horizontal !== "centre") parts.push(horizontal);
  if (!parts.length) return "dans le cœur du lieu";
  return `au ${parts.join("-")}`;
}

const navigateWithCustomEvent = (path: string) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("urbex-nav", { detail: { path } }));
};

export default function DarkEntryGamePage() {
  const { user, isPro } = useCurrentUserRole();
  const [player, setPlayer] = useState({ x: 48, y: 72 });
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<string | null>(null);
  const [tension, setTension] = useState(12);
  const [eventLog, setEventLog] = useState<string[]>([
    "Arrivée discrète. Tu observes d'abord, tu parles ensuite.",
  ]);
  const [recentEvent, setRecentEvent] = useState<string | null>(null);
  const [blackout, setBlackout] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const onboardingInitial = (() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "1";
  })();
  const [showOnboarding, setShowOnboarding] = useState(onboardingInitial);
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [discoveryBadge, setDiscoveryBadge] = useState<string | null>(null);
  const discoveryBadgeTimer = useRef<number | null>(null);
  const [sessionFailed, setSessionFailed] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const blackoutTimer = useRef<number | null>(null);
  const statusTimer = useRef<number | null>(null);
  const sessionSavedRef = useRef(false);
  const sessionSavingRef = useRef(false);
  const qaPreviewActive = useMemo(() => {
    if (!QA_PREVIEW_ENABLED || typeof window === "undefined") return false;
    return window.localStorage.getItem(QA_PRO_PREVIEW_KEY) === "1";
  }, []);
  const canShowGame = isPro || qaPreviewActive;

  const activeDiscovery = useMemo(
    () => DISCOVERIES.find((item) => item.id === activeDiscoveryId) ?? null,
    [activeDiscoveryId]
  );

  const progressPercent = Math.round((discovered.length / DISCOVERIES.length) * 100);

  const rank = useMemo(() => {
    const prize = [...RANKS].reverse().find((entry) => discovered.length >= entry.minDiscoveries);
    return prize ?? RANKS[0];
  }, [discovered.length]);

  const locationStatus = useMemo(() => {
    if (discovered.length >= DISCOVERIES.length) {
      return "Lieu totalement découvert";
    }
    if (discovered.length >= 3) {
      return "Exploration partielle en cours";
    }
    return "Lieux encore insondés";
  }, [discovered.length]);

  const remainingIndices = DISCOVERIES.length - discovered.length;
  const nextTarget = useMemo(
    () => DISCOVERIES.find((item) => !discovered.includes(item.id)),
    [discovered]
  );
  const tensionDescriptor = computeTensionStatus(tension);
  const isDangerState = tension >= 80 && tension < 100;
  const mapStatusClass = sessionFailed
    ? "dark-entry-map--failed"
    : isDangerState
    ? "dark-entry-map--danger"
    : "";
  const mapClassNames = [
    "dark-entry-map",
    mapStatusClass,
    blackout ? "dark-entry-map--blackout" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const nextActionMessage = useMemo(() => {
    if (!canShowGame) {
      return "Deviens PRO pour accéder à l'exploration.";
    }
    if (remainingIndices === 0) {
      return "Tu as déjà collecté les 5 indices — il est temps de quitter avant que la tension n'explose.";
    }
    if (!nextTarget) {
      return "Reste concentrée, un dernier indice se cache encore dans le lieu.";
    }
    return `Un indice est proche ${describeDirection(nextTarget)} : ${nextTarget.label}.`;
  }, [canShowGame, nextTarget, remainingIndices]);
  const objectiveSummary = `Indices : ${discovered.length}/${DISCOVERIES.length} • Tension : ${Math.min(
    Math.floor(tension),
    100
  )}/100`;

  const handleObjectClick = useCallback((item: Discovery) => {
    setActiveDiscoveryId(item.id);
    setDiscovered((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    setEventLog((prev) => [
      `Découverte: ${item.label} — ${item.type === "note" ? "Indices" : "Artefact"}`,
      ...prev,
    ].slice(0, 6));
    setDiscoveryBadge("Indice trouvé");
    if (discoveryBadgeTimer.current) {
      window.clearTimeout(discoveryBadgeTimer.current);
    }
    discoveryBadgeTimer.current = window.setTimeout(() => {
      setDiscoveryBadge(null);
      discoveryBadgeTimer.current = null;
    }, 1500);
  }, []);

  const buildSessionPayload = useCallback(() => {
    if (!user?.uid) return null;
    return {
      ownerId: user.uid,
      uid: user.uid,
      location: LOCATION_NAME,
      discoveredIds: discovered,
      tension: Math.floor(tension),
      rank: rank.label,
      durationMs: Date.now() - sessionStartRef.current,
      highlights: eventLog.slice(0, 3),
    };
  }, [discovered, eventLog, rank.label, tension, user?.uid]);

  const persistSession = useCallback(
    async ({ isUnloading = false, message }: { isUnloading?: boolean; message?: string } = {}) => {
      if (!isPro) return false;
      if (sessionSavedRef.current || sessionSavingRef.current) {
        return false;
      }
      const payload = buildSessionPayload();
      if (!payload) return false;

      sessionSavingRef.current = true;
      if (!isUnloading) {
        setStatusMessage("Enregistrement de ta session…");
        if (typeof window !== "undefined") {
          window.clearTimeout(statusTimer.current ?? undefined);
        }
      }

      try {
        await saveDarkEntrySession(payload);
        sessionSavedRef.current = true;
        if (!isUnloading) {
          setStatusMessage(
            message ?? "Session archivée. Ta trace reste dans le journal PRO."
          );
        }
        return true;
      } catch (error) {
        console.error("Dark Entry save failed", error);
        if (!isUnloading) {
          setStatusMessage("Impossible d'envoyer la session, réessaie plus tard.");
        }
        return false;
      } finally {
        sessionSavingRef.current = false;
        if (!isUnloading) {
          if (typeof window !== "undefined") {
            statusTimer.current = window.setTimeout(() => {
              setStatusMessage(null);
            }, 4000);
          }
        }
      }
    },
    [buildSessionPayload, isPro]
  );

  const CONFIRM_EXIT_MESSAGE = "Quitter maintenant ? (Sauvegarde la session)";
  const handleQuit = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.confirm(CONFIRM_EXIT_MESSAGE)) return;
    await persistSession();
  }, [persistSession]);

  const handleStartOnboarding = useCallback(() => {
    if (skipOnboarding && typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    }
    setShowOnboarding(false);
  }, [skipOnboarding]);

  const handleSkipChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSkipOnboarding(event.target.checked);
  }, []);

  const toggleLogOpen = useCallback(() => {
    setLogOpen((prev) => !prev);
  }, []);

  const resetRun = useCallback(() => {
    setDiscovered([]);
    setActiveDiscoveryId(null);
    setTension(12);
    setEventLog([
      "Arrivée discrète. Tu observes d'abord, tu parles ensuite.",
    ]);
    setRecentEvent(null);
    setBlackout(false);
    sessionStartRef.current = Date.now();
    sessionSavedRef.current = false;
    sessionSavingRef.current = false;
    setSessionFailed(false);
    setDiscoveryBadge(null);
    if (typeof window !== "undefined" && discoveryBadgeTimer.current != null) {
      window.clearTimeout(discoveryBadgeTimer.current);
      discoveryBadgeTimer.current = null;
    }
    setStatusMessage(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 4 : 2;
      const delta = { x: 0, y: 0 };
      if (event.key === "w" || event.key === "ArrowUp") delta.y = -step;
      if (event.key === "s" || event.key === "ArrowDown") delta.y = step;
      if (event.key === "a" || event.key === "ArrowLeft") delta.x = -step;
      if (event.key === "d" || event.key === "ArrowRight") delta.x = step;
      if (!delta.x && !delta.y) return;
      setPlayer((prev) => ({
        x: Math.min(92, Math.max(6, prev.x + delta.x)),
        y: Math.min(88, Math.max(12, prev.y + delta.y)),
      }));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const tensionInterval = window.setInterval(() => {
      setTension((prev) => Math.min(100, prev + 1 + discovered.length * 0.1));
    }, 2000);
    return () => window.clearInterval(tensionInterval);
  }, [discovered.length]);

  useEffect(() => {
    const eventInterval = window.setInterval(() => {
      const next = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
      setRecentEvent(next.message);
      setEventLog((prev) => [next.message, ...prev].slice(0, 6));
      if (next.kind === "blackout") {
        setBlackout(true);
        if (blackoutTimer.current != null) {
          window.clearTimeout(blackoutTimer.current);
        }
        blackoutTimer.current = window.setTimeout(() => {
          setBlackout(false);
        }, next.duration ?? 2200);
      }
    }, 9000);
    return () => {
      window.clearInterval(eventInterval);
      if (blackoutTimer.current != null) {
        window.clearTimeout(blackoutTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canShowGame || typeof window === "undefined") return;
    const handleUnload = () => {
      void persistSession({ isUnloading: true });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [canShowGame, persistSession]);

  useEffect(() => {
    if (tension >= 100 && !sessionFailed) {
      setSessionFailed(true);
      void persistSession({
        message: "Exploration échouée. Ta trace a été sauvegardée.",
      });
    }
  }, [tension, sessionFailed, persistSession]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && statusTimer.current != null) {
        window.clearTimeout(statusTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && discoveryBadgeTimer.current != null) {
        window.clearTimeout(discoveryBadgeTimer.current);
      }
    };
  }, []);

  if (!canShowGame) {
    return (
      <section className="dark-entry-gate">
        <header>
          <p className="dark-entry-subtitle">Espace Jeux</p>
          <h2>Dark Entry est réservé aux membres PRO.</h2>
        </header>
        <p>
          Ce run narratif, sans combats, augmente la tension à mesure que tu explores les ténèbres.
          Seuls les membres PRO peuvent sauvegarder leur progression.
        </p>
        <button
          type="button"
          className="dark-entry-cta"
          onClick={() => navigateWithCustomEvent("/pro")}
        >
          Devenir PRO
        </button>
      </section>
    );
  }

  return (
    <section className="dark-entry-shell">
      {showOnboarding && (
        <div className="dark-entry-onboarding">
          <div className="dark-entry-onboarding-card">
            <p className="dark-entry-onboarding-pill">OBJECTIF</p>
            <h2>OBJECTIF</h2>
            <p className="dark-entry-onboarding-text">
              Explore, trouve 5 indices, puis quitte avant 100 de tension.
            </p>
            <p className="dark-entry-onboarding-controls">
              WASD/flèches • Clique/Tap sur un point • Quitter = sauver
            </p>
            <label className="dark-entry-onboarding-skip">
              <input
                type="checkbox"
                checked={skipOnboarding}
                onChange={handleSkipChange}
              />
              Ne plus afficher
            </label>
            <button
              type="button"
              className="dark-entry-cta"
              onClick={handleStartOnboarding}
            >
              COMMENCER
            </button>
          </div>
        </div>
      )}
      <header className="dark-entry-header">
        <div>
          <p className="dark-entry-subtitle">Espace Jeux — PRO only</p>
          <h1>Dark Entry</h1>
          <p className="dark-entry-objective-text">
            Explore l'usine, découvre des indices cachés et décide quand quitter avant que tout ne
            bascule.
          </p>
          <div className="dark-entry-header-meta">
            <strong>{locationStatus}</strong>
            <span>Progression {progressPercent}%</span>
            <span>{rank.label}</span>
          </div>
        </div>
        <button type="button" className="dark-entry-quit-btn" onClick={handleQuit}>
          Quitter
        </button>
      </header>
      <div className="dark-entry-main">
        <div className="dark-entry-map-area">
          <div className="dark-entry-map-meta">
            <span className="dark-entry-map-objective">{objectiveSummary}</span>
            <div className="dark-entry-legend">
              <div>
                <span className="legend-dot legend-dot-player" aria-hidden="true" />
                Toi
              </div>
              <div>
                <span className="legend-dot legend-dot-clue" aria-hidden="true" />
                Indice
              </div>
              <div>
                <span className="legend-dot legend-dot-danger" aria-hidden="true" />
                Danger
              </div>
            </div>
          </div>
          <div className={mapClassNames}>
            {discoveryBadge && (
              <div className="dark-entry-feedback-badge">{discoveryBadge}</div>
            )}
            <div className="dark-entry-noise" aria-hidden="true" />
            {DISCOVERIES.map((item) => {
              const isFound = discovered.includes(item.id);
              const classes = [
                "dark-entry-object",
                isFound ? "is-active" : "",
                !isFound ? "dark-entry-object--pulse" : "",
                activeDiscoveryId === item.id ? "is-highlighted" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={item.id}
                  type="button"
                  className={classes}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  onClick={() => handleObjectClick(item)}
                  aria-label={`Examiner ${item.label}`}
                  title="Explorer"
                >
                  <span />
                </button>
              );
            })}
            <div
              className="dark-entry-player"
              style={{ left: `${player.x}%`, top: `${player.y}%` }}
              aria-label="Position du joueur"
            />
            {sessionFailed && (
              <div className="dark-entry-failure-screen">
                <h3>Exploration échouée</h3>
                <p>Tension maximale atteinte. Ta session a été sauvegardée comme échec.</p>
                <button type="button" onClick={resetRun}>
                  Recommencer
                </button>
              </div>
            )}
          </div>
          <div className="dark-entry-map-footer">
            <span>Déplacement : WASD / flèches</span>
            <span>Navigation mobile : tap long sur une zone</span>
            {recentEvent && (
              <span className="dark-entry-map-snippet">{recentEvent}</span>
            )}
          </div>
        </div>
        <aside className="dark-entry-panel">
          <section className="dark-entry-tension">
            <header>
              <h3>Tension</h3>
              <span>{Math.min(Math.floor(tension), 100)} / 100</span>
            </header>
            <div className="dark-entry-meter">
              <div style={{ width: `${Math.min(tension, 100)}%` }} />
            </div>
            <p className="dark-entry-tension-status">{tensionDescriptor}</p>
            {isDangerState && !sessionFailed && (
              <p className="dark-entry-urgency">Tu devrais sortir.</p>
            )}
            {statusMessage && <p className="dark-entry-status">{statusMessage}</p>}
          </section>
          <section className="dark-entry-next-action">
            <header>
              <p>PROCHAINE ACTION</p>
              <span>
                {remainingIndices} indice{remainingIndices > 1 ? "s" : ""} restants
              </span>
            </header>
            <p className="dark-entry-next-action-message">{nextActionMessage}</p>
            <div className="dark-entry-next-action-tags">
              <span>Dernière découverte : {activeDiscovery?.label ?? "—"}</span>
              <span>
                Zone : {activeDiscovery ? describeDirection(activeDiscovery) : "—"}
              </span>
            </div>
            <div className="dark-entry-next-action-list">
              {DISCOVERIES.map((item) => {
                const isFound = discovered.includes(item.id);
                return (
                  <article
                    key={item.id}
                    className={`dark-entry-next-action-card ${isFound ? "is-found" : ""}`}
                  >
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className="dark-entry-next-action-status">
                      {isFound ? "Découvert" : "À découvrir"}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
          <div className="dark-entry-panel-cta">
            <button
              type="button"
              className="dark-entry-quit-btn dark-entry-quit-panel"
              onClick={handleQuit}
            >
              Quitter le lieu
            </button>
          </div>
        </aside>
      </div>
      <div className="dark-entry-log">
        <button
          type="button"
          className="dark-entry-log-toggle"
          onClick={toggleLogOpen}
        >
          {logOpen ? "Masquer" : "Afficher"} événements aléatoires
        </button>
        {logOpen && (
          <ul>
            {eventLog.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
