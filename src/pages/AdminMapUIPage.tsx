import type { ChangeEvent } from "react";
import { SectionCard, UrbexButton } from "../components/ui/UrbexUI";
import { useLayoutEditMode } from "../hooks/useLayoutEditMode";
import {
  DEFAULT_ADMIN_UI_CONFIG,
  useAdminUiConfig,
} from "../hooks/useAdminUiConfig";

type MapUiToggleKey = keyof typeof DEFAULT_ADMIN_UI_CONFIG.mapUi;

const MAP_UI_TOGGLES: Array<{
  key: MapUiToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "showMapboxControls",
    label: "Contrôles Mapbox",
    description: "Retire les boutons Mapbox (zoom, orientation) sans toucher à la carte.",
  },
  {
    key: "showSearchBar",
    label: "Barre de recherche",
    description: "Basculer l’input de recherche sans toucher aux champs de saisie internes.",
  },
  {
    key: "showProBar",
    label: "Barre PRO",
    description: "Masque la barre PRO située au-dessus de la carte tout en conservant la logique.",
  },
  {
    key: "showLeftOverlay",
    label: "Overlay gauche",
    description: "Affiche ou masque la zone d’overlays gauche (légende, filtres, etc.).",
  },
  {
    key: "showRightOverlay",
    label: "Overlay droite",
    description: "Contrôle les overlays qui apparaissent à droite (PH/CTA, panneaux).",
  },
];

export default function AdminMapUIPage() {
  const [layoutEditMode, setLayoutEditMode] = useLayoutEditMode();
  const { config, loading, savePatch } = useAdminUiConfig();
  const mapUiConfig = config?.mapUi ?? DEFAULT_ADMIN_UI_CONFIG.mapUi;

  const handleToggle =
    (key: MapUiToggleKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.checked;
      if (mapUiConfig[key] === nextValue) return;
      savePatch({
        mapUi: {
          ...mapUiConfig,
          [key]: nextValue,
        },
      });
    };

  return (
    <SectionCard>
      <h2>Map UI</h2>
      <p>
        Activez le mode édition pour réorganiser les blocs de la carte principale. Une fois activé,
        rendez-vous sur la page d’accueil pour faire glisser les sections entre les zones.
      </p>
      <p className="admin-map-ui-page__note">
        Les modifications sont enregistrées dans Firestore sous <code>adminConfig/layouts/mapLayout</code>.
      </p>
      <div className="admin-map-ui-page__toggles">
        {MAP_UI_TOGGLES.map((toggle) => {
          const enabled = mapUiConfig[toggle.key];
          return (
            <div key={toggle.key} className="admin-map-ui-page__toggle">
              <div>
                <strong>{toggle.label}</strong>
                <p>{toggle.description}</p>
              </div>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  disabled={loading}
                  checked={enabled}
                  onChange={handleToggle(toggle.key)}
                />
                <span>{enabled ? "Activé" : "Désactivé"}</span>
              </label>
            </div>
          );
        })}
      </div>
      <div className="admin-map-ui-page__actions">
        <UrbexButton
          variant={layoutEditMode ? "danger" : "primary"}
          onClick={() => setLayoutEditMode(!layoutEditMode)}
        >
          {layoutEditMode ? "Désactiver le mode édition" : "Activer le mode édition"}
        </UrbexButton>
        <p>État actuel : {layoutEditMode ? "activé" : "désactivé"} (admin uniquement)</p>
      </div>
    </SectionCard>
  );
}
