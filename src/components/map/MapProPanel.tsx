import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import type { MapStyleValue } from "../../services/adminConfigs";

const STYLE_BUTTONS = [
  { value: "night", label: "NIGHT" },
  { value: "satellite", label: "SATELLITE" },
] as const;

type Props = {
  styleValue: MapStyleValue;
  onStyleChange: (value: MapStyleValue) => void;
  epicFilterActive: boolean;
  ghostFilterActive: boolean;
  onEpicToggle: () => void;
  onGhostToggle: () => void;
};
export default function MapProPanel({
  styleValue,
  onStyleChange,
  epicFilterActive,
  ghostFilterActive,
  onEpicToggle,
  onGhostToggle,
}: Props) {
  const handleStyleClick = (value: MapStyleValue) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (value === styleValue) return;
    onStyleChange(value);
  };

  const [epicPulse, setEpicPulse] = useState(false);
  const [ghostPulse, setGhostPulse] = useState(false);
  const filterTimersRef = useRef<{
    epic: ReturnType<typeof setTimeout> | null;
    ghost: ReturnType<typeof setTimeout> | null;
  }>({
    epic: null,
    ghost: null,
  });

  useEffect(() => {
    const timers = filterTimersRef.current;
    return () => {
      Object.values(timers).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, []);

  const handleEpicFilterClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setEpicPulse(true);
    if (filterTimersRef.current.epic) {
      clearTimeout(filterTimersRef.current.epic);
    }
    filterTimersRef.current.epic = setTimeout(() => setEpicPulse(false), 420);
    onEpicToggle();
  };

  const handleGhostFilterClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setGhostPulse(true);
    if (filterTimersRef.current.ghost) {
      clearTimeout(filterTimersRef.current.ghost);
    }
    filterTimersRef.current.ghost = setTimeout(() => setGhostPulse(false), 420);
    onGhostToggle();
  };

  const filterHint =
    epicFilterActive && ghostFilterActive
      ? "Affiche les spots EPIC et Ghost."
      : epicFilterActive
      ? "Filtre uniquement les merveilles EPIC."
      : ghostFilterActive
      ? "Montre les repères Ghost."
      : "Aucun filtre de tier actif.";

  return (
    <div className="map-pro-panel">
      <div className="map-pro-panel-strip map-pro-panel-strip--styles">
        {STYLE_BUTTONS.map((option) => (
          <button
            type="button"
            key={option.value}
            data-style={option.value}
            className={`map-pro-pill map-pro-pill--style ${styleValue === option.value ? "is-active" : ""}`}
            onClick={handleStyleClick(option.value)}
            aria-pressed={styleValue === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="map-pro-panel-filter-row">
        <div className="map-pro-filter-buttons">
          <button
            type="button"
            className={`map-pro-pill map-pro-pill--filter ${epicFilterActive ? "is-active" : ""} ${
              epicPulse ? "is-activating" : ""
            }`}
            onClick={handleEpicFilterClick}
            aria-pressed={epicFilterActive}
          >
            👑 EPIC
          </button>
          <button
            type="button"
            className={`map-pro-pill map-pro-pill--filter ${ghostFilterActive ? "is-active" : ""} ${
              ghostPulse ? "is-activating" : ""
            }`}
            onClick={handleGhostFilterClick}
            aria-pressed={ghostFilterActive}
          >
            👻 GHOST
          </button>
        </div>
        <p className="map-pro-filter-hint">{filterHint}</p>
      </div>
    </div>
  );
}
