import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import type { Place } from "../services/places";
import type { UserPlacesMap } from "../services/userPlaces";
import {
  buildUserSpotCollections,
  countUserSpotStates,
  type SpotListView,
} from "../lib/userSpotStats";
import { SPOT_TYPE_LABELS } from "../services/userProfiles";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullToRefreshIndicator from "./ui/PullToRefreshIndicator";

type Props = {
  open: boolean;
  view: SpotListView | null;
  places: Place[];
  userPlaces: UserPlacesMap;
  onClose: () => void;
  onViewChange: (view: SpotListView) => void;
  onSelectPlace: (place: Place) => void;
  onToggleDone: (place: Place) => Promise<void>;
  onToggleSaved: (place: Place) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
};

const TAB_CONFIG: { id: SpotListView; label: string; subtitle: string }[] = [
  {
    id: "done",
    label: "Faits",
    subtitle: "Ton carnet d’explorations urbex.",
  },
  {
    id: "favorites",
    label: "Favoris",
    subtitle: "Les spots que tu gardes précieusement.",
  },
];

export default function SpotListsModal({
  open,
  view,
  places,
  userPlaces,
  onClose,
  onViewChange,
  onSelectPlace,
  onToggleDone,
  onToggleSaved,
  onRefresh,
}: Props) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const mismatchWarnRef = useRef(false);

  const counts = useMemo(() => countUserSpotStates(userPlaces), [userPlaces]);
  const collections = useMemo(
    () => buildUserSpotCollections(places, userPlaces),
    [places, userPlaces]
  );
  const activeView = view ?? "done";
  const activeNormalizedCollection =
    activeView === "done" ? collections.donePlaces : collections.savedPlaces;
  const activeCollection = activeNormalizedCollection.map(
    (entry) => entry.place
  );

  useEffect(() => {
    if (!import.meta.env.DEV || !open) {
      mismatchWarnRef.current = false;
      return;
    }
    const mismatch =
      counts.totalDone !== collections.donePlaces.length ||
      counts.totalSaved !== collections.savedPlaces.length;
    if (mismatch && !mismatchWarnRef.current) {
      mismatchWarnRef.current = true;
      console.warn("[UQ][COUNTS_MISMATCH]", {
        badgeDone: counts.totalDone,
        listDone: collections.donePlaces.length,
        badgeSaved: counts.totalSaved,
        listSaved: collections.savedPlaces.length,
      });
    }
  }, [
    counts.totalDone,
    counts.totalSaved,
    collections.donePlaces.length,
    collections.savedPlaces.length,
    open,
  ]);

  const activeDescription =
    TAB_CONFIG.find((tab) => tab.id === activeView)?.subtitle ??
    "Spots urbex";

  const activeCount = activeCollection.length;

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    await onRefresh();
  }, [onRefresh]);

  const {
    attachSurface: attachListSurface,
    pullDistance: listPullDistance,
    status: listPullStatus,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 70,
    minSpinnerTime: 800,
    disabled: !onRefresh,
  });

  const handleTabClick = (tabId: SpotListView) => {
    if (tabId === activeView) return;
    onViewChange(tabId);
  };

  const handleAction = async (
    key: string,
    fn: () => Promise<void>
  ) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await fn();
    } catch (err) {
      console.error("Spot list action failed", err);
    } finally {
      setPendingAction(null);
    }
  };

  if (!open) return null;

  const handleBackdropClick = (event: MouseEvent) => {
    if (event.target !== event.currentTarget) return;
    onClose();
  };

  const handleBackdropKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="spot-lists-modal-backdrop"
      role="button"
      tabIndex={0}
      aria-label="Fermer les spots urbex"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
    >
      <div
        className="spot-lists-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Spots urbex"
      >
        <header className="spot-lists-modal-header">
          <div>
              <p className="spot-lists-modal-title">
                {TAB_CONFIG.find((tab) => tab.id === activeView)?.label} ·{" "}
                {activeCount} {activeCount > 1 ? "spots" : "spot"}
              </p>
              <p className="spot-lists-modal-subtitle">{activeDescription}</p>
          </div>
          <button
            type="button"
            className="spot-lists-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>
        <div className="spot-lists-modal-tabs">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`spot-lists-modal-tab${
                tab.id === activeView ? " is-active" : ""
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="spot-lists-modal-tab-count">
                {tab.id === "done"
                  ? collections.donePlaces.length
                  : collections.savedPlaces.length}
              </span>
            </button>
          ))}
        </div>
        <div className="spot-lists-modal-list" ref={attachListSurface}>
          <PullToRefreshIndicator
            pullDistance={listPullDistance}
            status={listPullStatus}
          />
          {activeCollection.length === 0 ? (
            <p className="spot-lists-modal-empty">
              {activeView === "done"
                ? "Tu n’as encore marqué aucun spot comme fait."
                : "Aucun favori pour l’instant."}
            </p>
          ) : (
            activeCollection.map((place) => {
              const state = userPlaces[place.id];
              const isDone = !!state?.done;
              const isSaved = !!state?.saved;
              const cityLabel =
                place.city || place.region || "Ville confidentielle";
              const typeLabel =
                SPOT_TYPE_LABELS[place.category || ""] ||
                place.category ||
                "Autre";
              const accessLabel = place.access || "moyen";
              const riskLabel = place.riskLevel || "non évalué";
              return (
                <div key={place.id} className="spot-lists-item">
                  <div className="spot-lists-item-heading">
                    <strong>{place.title}</strong>
                    <span className="spot-lists-item-location">
                      {cityLabel}
                    </span>
                  </div>
                  <div className="spot-lists-item-badges">
                    <span className="spot-lists-item-badge">{typeLabel}</span>
                    <span className="spot-lists-item-badge">Accès {accessLabel}</span>
                    <span className="spot-lists-item-badge">Risque {riskLabel}</span>
                    {place.isLegend && (
                      <span className="spot-lists-item-badge spot-lists-item-badge--legend">
                        Légendaire
                      </span>
                    )}
                  </div>
                  <div className="spot-lists-item-actions">
                    <button
                      type="button"
                      className="spot-lists-item-btn"
                      onClick={() => {
                        onSelectPlace(place);
                        onClose();
                      }}
                    >
                      🌍 Ouvrir sur la carte
                    </button>
                    <button
                      type="button"
                      className="spot-lists-item-btn spot-lists-item-btn--ghost"
                      onClick={() =>
                        handleAction(`${place.id}-done`, () =>
                          onToggleDone(place)
                        )
                      }
                      disabled={pendingAction === `${place.id}-done`}
                    >
                      {isDone ? "✅ Déjà fait" : "Marquer comme fait"}
                    </button>
                    <button
                      type="button"
                      className="spot-lists-item-btn spot-lists-item-btn--accent"
                      onClick={() =>
                        handleAction(`${place.id}-saved`, () =>
                          onToggleSaved(place)
                        )
                      }
                      disabled={pendingAction === `${place.id}-saved`}
                    >
                      {isSaved ? "💗 Retirer des favoris" : "💗 Ajouter aux favoris"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
