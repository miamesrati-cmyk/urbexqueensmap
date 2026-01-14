import { useState } from 'react';
import MapView from './MapView';
import {
  GamingHud,
  HudStat,
  NeonButton,
  RiskIndicator,
  GamingCard,
  CyberBadge,
} from './GamingEffects';

/**
 * 🎮 GAMING-ENHANCED MAP VIEW
 * Wraps your existing MapView with cyberpunk UI elements
 */
interface GamingMapWrapperProps {
  // Pass through all MapView props
  [key: string]: any;
}

export function GamingMapWrapper(props: GamingMapWrapperProps) {
  const [selectedSpot, setSelectedSpot] = useState<any>(null);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* Original MapView */}
      <MapView {...props} />

      {/* Gaming HUD Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <HudStat label="SPOTS" value="347" icon="📍" />
          <HudStat label="ONLINE" value="89" icon="🟢" />
          <HudStat label="MISSIONS" value="12" icon="🎯" />
        </div>
      </div>

      {/* Action Buttons - Top Right */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <NeonButton variant="cyan">🗺️ EXPLORER</NeonButton>
        <NeonButton variant="purple">📸 GALERIE</NeonButton>
        <NeonButton variant="pink">➕ AJOUTER</NeonButton>
      </div>

      {/* Bottom Panel - Spot Info */}
      {selectedSpot && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            width: '90%',
            maxWidth: '600px',
          }}
        >
          <GamingCard>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <CyberBadge variant="cyan">{selectedSpot.category || 'INCONNU'}</CyberBadge>
                <RiskIndicator level={selectedSpot.riskLevel || 'medium'} />
              </div>
              
              <h2
                style={{
                  color: 'var(--neon-cyan)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '1.8rem',
                  marginBottom: '12px',
                  textShadow: '0 0 10px rgba(0, 240, 255, 0.8)',
                }}
              >
                {selectedSpot.title}
              </h2>

              <p
                style={{
                  color: '#ccc',
                  marginBottom: '16px',
                  lineHeight: '1.6',
                }}
              >
                {selectedSpot.description}
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  color: 'var(--neon-green)',
                  fontFamily: 'Courier New, monospace',
                  fontSize: '0.9rem',
                  marginBottom: '20px',
                }}
              >
                <span>📍 {selectedSpot.location || 'Montréal'}</span>
                <span>•</span>
                <span>👁️ {selectedSpot.views || 0} vues</span>
                <span>•</span>
                <span>❤️ {selectedSpot.likes || 0} likes</span>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <NeonButton variant="cyan">🔍 VOIR DÉTAILS</NeonButton>
                <NeonButton variant="purple">📸 PHOTOS</NeonButton>
                <NeonButton variant="pink">💾 SAUVEGARDER</NeonButton>
              </div>

              <button
                onClick={() => setSelectedSpot(null)}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: 'var(--deep-black)',
                  border: '2px solid var(--neon-pink)',
                  color: 'var(--neon-pink)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px var(--neon-pink)',
                }}
              >
                ×
              </button>
            </div>
          </GamingCard>
        </div>
      )}

      {/* Legend Panel - Bottom Left */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
        }}
      >
        <div style={{ background: 'rgba(10, 10, 15, 0.9)', padding: '16px', maxWidth: '250px' }}>
          <GamingHud>
            <h3
              style={{
                color: 'var(--neon-cyan)',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '1rem',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              🎯 Légende
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ color: 'var(--neon-green)' }}>🟢 Accès facile</div>
              <div style={{ color: 'var(--neon-cyan)' }}>🔵 Accès modéré</div>
              <div style={{ color: 'var(--neon-orange)' }}>🟠 Accès difficile</div>
              <div style={{ color: 'var(--neon-pink)' }}>🔴 Accès expert</div>
            </div>
          </GamingHud>
        </div>
      </div>
    </div>
  );
}

export default GamingMapWrapper;
