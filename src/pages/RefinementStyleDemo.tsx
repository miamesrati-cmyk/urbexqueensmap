import { useMemo, useState } from "react";
import "../styles/gaming-design-system.css";

const navItems = ["Carte", "Feed", "Profil", "Refinement", "Favoris"];
const cardSamples = [
  {
    title: "Studio lumineux",
    detail: "Micro-interactions avec rebond doux et glow satiné.",
  },
  {
    title: "Vue panoramique",
    detail: "Panneau semi-transparent + ombre profonde pour le relief.",
  },
  {
    title: "Legende raffinée",
    detail: "Badges et boutons avec ripple léger à l’interaction.",
  },
];

export function RefinementStyleDemo() {
  const [motionPreview, setMotionPreview] = useState(false);
  const runMode = useMemo(
    () => (motionPreview ? "mode-reduced" : "mode-normal"),
    [motionPreview]
  );

  return (
    <div
      className="uq-refinement-demo"
      data-motion={runMode}
      aria-live="polite"
    >
      <div className="refinement-grain" aria-hidden="true" />
      <header className="refinement-topbar">
        <div className="refinement-logo">
          <span className="refinement-logo-mark">👑</span>
          <span className="refinement-logo-text">URBEXQUEENS</span>
        </div>
        <nav className="refinement-nav">
          {navItems.map((label, index) => (
            <button
              key={label}
              className={`refinement-pill ${index === 3 ? "is-active" : ""}`}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="refinement-actions">
          <label className="refinement-search">
            <input placeholder="Rechercher une sensation..." />
          </label>
          <button className="refinement-pro-badge" type="button">
            PRO
          </button>
          <span className="refinement-avatar" aria-label="Avatar">
            UQ
          </span>
        </div>
      </header>

      <section className="refinement-main">
        <div className="refinement-panel">
          <div className="panel-header">
            <strong>Focus avancé</strong>
            <span className="refinement-badge pulse">Nouveau</span>
          </div>
          <p>
            Les micro-interactions révèlent un léger ripple à chaque clic,
            ainsi qu’un panel qui s’élève de 2px pour donner de la profondeur.
          </p>
          <div className="refinement-actions-row">
            <button className="refinement-action-button">Découvrir</button>
            <button className="refinement-action-button">Carte</button>
            <button className="refinement-action-button">Galerie</button>
          </div>
        </div>

        <aside className="refinement-scroll">
          {cardSamples.map((card) => (
            <article key={card.title} className="refinement-card">
              <header>
                <h3>{card.title}</h3>
                <span className="refinement-clip">✨</span>
              </header>
              <p>{card.detail}</p>
            </article>
          ))}
        </aside>
      </section>

      <section className="refinement-panels">
        <div className="refinement-panel refinement-panel--secondary">
          <header className="panel-header">
            <strong>Panels</strong>
            <span className="refinement-badge">Slide-in</span>
          </header>
          <p>
            Les panneaux glissent en douceur. Le toggle ci-dessous permet
            d’activer la prévisualisation reduced-motion.
          </p>
          <div className="refinement-toggle">
            <label>
              <input
                type="checkbox"
                checked={motionPreview}
                onChange={() => setMotionPreview((prev) => !prev)}
              />
              <span>Prévisualiser la réduction d’animations</span>
            </label>
          </div>
        </div>
        <div className="refinement-panel refinement-panel--secondary">
          <header className="panel-header">
            <strong>Scroll / Grain</strong>
            <span className="refinement-badge">Gradient</span>
          </header>
          <p>
            La scrollbar est un gradient rose, et le grain reste très léger
            (0.02) pour ne pas surcharger la démo.
          </p>
          <div className="refinement-scroll demo-scroll">
            {Array.from({ length: 6 }).map((_, idx) => (
              <p key={idx}>Entrée {idx + 1} — micro-mouvement assuré.</p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default RefinementStyleDemo;
