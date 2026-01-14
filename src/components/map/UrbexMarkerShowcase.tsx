import React from "react";
import { UrbexMarker } from "./UrbexMarker";
import "./UrbexMarkerShowcase.css";

/**
 * Composant de démonstration des différents états du marker urbex
 */
export const UrbexMarkerShowcase: React.FC = () => {
  return (
    <div className="marker-showcase">
      <h2 className="marker-showcase-title">🎯 Urbex Marker - États</h2>

      <div className="marker-showcase-grid">
        {/* Approved marker */}
        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker status="approved" size={48} emoji="🏚️" />
          </div>
          <div className="marker-showcase-info">
            <h3>✅ Approuvé</h3>
            <p>Spot validé et visible publiquement</p>
            <ul>
              <li>Couleur: Violet</li>
              <li>Emoji personnalisé</li>
              <li>Animation hover</li>
            </ul>
          </div>
        </div>

        {/* Pending marker */}
        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker status="pending" size={48} emoji="⏳" />
          </div>
          <div className="marker-showcase-info">
            <h3>⏳ En attente</h3>
            <p>Spot soumis, en cours de validation</p>
            <ul>
              <li>Couleur: Orange vif</li>
              <li>Pulse animation</li>
              <li>Glow orange</li>
            </ul>
          </div>
        </div>

        {/* Rejected marker */}
        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker status="rejected" size={48} emoji="❌" />
          </div>
          <div className="marker-showcase-info">
            <h3>❌ Rejeté</h3>
            <p>Spot non validé ou supprimé</p>
            <ul>
              <li>Couleur: Gris</li>
              <li>Pas d'animation</li>
              <li>Visuellement discret</li>
            </ul>
          </div>
        </div>

        {/* PRO marker */}
        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker status="approved" isPro={true} size={48} emoji="👑" />
          </div>
          <div className="marker-showcase-info">
            <h3>👑 PRO</h3>
            <p>Spot ajouté par un membre PRO</p>
            <ul>
              <li>Badge PRO doré</li>
              <li>Emoji spécial</li>
              <li>Shimmer effect</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="marker-showcase-grid" style={{ marginTop: '40px' }}>
        <h3 style={{ gridColumn: '1 / -1', fontSize: '20px', marginBottom: '20px' }}>🏗️ Exemples par catégorie</h3>
        
        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker emoji="🏭" size={44} />
          </div>
          <div className="marker-showcase-info">
            <h3>🏭 Usine</h3>
          </div>
        </div>

        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker emoji="🏥" size={44} />
          </div>
          <div className="marker-showcase-info">
            <h3>🏥 Hôpital</h3>
          </div>
        </div>

        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker emoji="⛪" size={44} />
          </div>
          <div className="marker-showcase-info">
            <h3>⛪ Église</h3>
          </div>
        </div>

        <div className="marker-showcase-item">
          <div className="marker-showcase-preview">
            <UrbexMarker emoji="🏰" size={44} />
          </div>
          <div className="marker-showcase-info">
            <h3>🏰 Manoir</h3>
          </div>
        </div>
      </div>

      <div className="marker-showcase-sizes">
        <h3>📏 Tailles disponibles</h3>
        <div className="marker-showcase-sizes-grid">
          <div>
            <UrbexMarker size={28} />
            <span>Small (28px)</span>
          </div>
          <div>
            <UrbexMarker size={40} />
            <span>Default (40px)</span>
          </div>
          <div>
            <UrbexMarker size={56} />
            <span>Large (56px)</span>
          </div>
        </div>
      </div>

      <div className="marker-showcase-usage">
        <h3>💻 Utilisation</h3>
        <pre>
          <code>{`import { UrbexMarker } from "./components/map/UrbexMarker";

// Marker basique
<UrbexMarker status="approved" size={40} />

// Marker en attente avec pulse
<UrbexMarker status="pending" size={48} />

// Marker PRO avec badge
<UrbexMarker status="approved" isPro={true} size={40} />

// Marker rejeté (gris)
<UrbexMarker status="rejected" size={40} />`}</code>
        </pre>
      </div>

      <div className="marker-showcase-integration">
        <h3>🗺️ Intégration Mapbox</h3>
        <pre>
          <code>{`import { createUrbexMarker } from "./utils/mapMarkers";

// Créer un marker sur la carte
const marker = createUrbexMarker({
  place: spotData,
  status: "approved",
  isPro: true,
  size: 40,
  onClick: (place) => {
    console.log("Clicked on:", place.title);
  }
});

marker.addTo(map);`}</code>
        </pre>
      </div>
    </div>
  );
};

export default UrbexMarkerShowcase;
