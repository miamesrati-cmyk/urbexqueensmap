type Feature = {
  icon: string;
  title: string;
  detail?: string;
};

type ProUnlockPanelProps = {
  title?: string;
  subtitle?: string;
  badge?: string;
  features?: Feature[];
  className?: string;
  lockedNote?: string;
};

const DEFAULT_FEATURES: Feature[] = [
  { icon: "👻", title: "Ghost Maps (PRO)", detail: "Explorer les zones paranormales et cartes déverrouillées." },
  { icon: "👑", title: "Spots légendaires", detail: "Badges brillants, histoires exclusives et aura lumineuse." },
  { icon: "🗺️", title: "Pathfinder (PRO)", detail: "Planifier tes runs, filtrer par risque et tracer tes itinéraires." },
  { icon: "📚", title: "Historiques détaillés", detail: "Des récits complets sur chaque spot et leur légende." },
  { icon: "🌃", title: "Mode nuit urbex", detail: "Ambiance violette et contrastée pour tes reconnaissances nocturnes." },
];

function goToPro() {
  window.dispatchEvent(new CustomEvent("urbex_open_pro_modal"));
}

export default function ProUnlockPanel({
  title = "PRO débloque ceci",
  subtitle,
  badge = "Club élite",
  features,
  className,
  lockedNote,
}: ProUnlockPanelProps) {
  const featureList = features && features.length > 0 ? features : DEFAULT_FEATURES;
  return (
    <div className={`pro-unlock-panel ${className ?? ""}`.trim()}>
      <div className="pro-unlock-head">
        {badge && <span className="pro-unlock-pill">{badge}</span>}
        <h3>{title}</h3>
        {subtitle && <p className="pro-unlock-subtitle">{subtitle}</p>}
      </div>
      <div className="pro-unlock-grid">
        {featureList.map((feature) => (
          <div key={feature.title} className="pro-unlock-feature">
            <span className="pro-unlock-icon" aria-hidden>
              {feature.icon}
            </span>
            <div>
              <div className="pro-unlock-feature-title">{feature.title}</div>
              {feature.detail && <p>{feature.detail}</p>}
            </div>
          </div>
        ))}
      </div>
      {lockedNote && <div className="pro-unlock-note">{lockedNote}</div>}
      <button
        type="button"
        className="pro-unlock-cta"
        onClick={goToPro}
      >
        Devenir PRO
      </button>
    </div>
  );
}
