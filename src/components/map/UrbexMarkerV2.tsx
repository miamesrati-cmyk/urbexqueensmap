import React from "react";
import "./UrbexMarkerV2.css";

type MarkerTier = "COMMON" | "EPIC" | "GHOST";
type MarkerStatus = "pending" | "approved" | "rejected";

interface UrbexMarkerV2Props {
  tier?: MarkerTier;
  status?: MarkerStatus;
  size?: number;
  isPro?: boolean;
  className?: string;
  /**
   * Building archetype - determines the silhouette shape
   * factory: industrial complex
   * hospital: institutional building
   * church: gothic spire
   * manor: residential estate
   * default: generic abandoned structure
   */
  archetype?: "factory" | "hospital" | "church" | "manor" | "default";
}

/**
 * UrbexMarkerV2 - Cinematic "Ghost Echo" marker system
 * 
 * Design Philosophy:
 * - Subtle architectural silhouettes, not loud POI pins
 * - Layered translucency creates depth without visual noise
 * - Minimal color palette: desaturated with soft glows
 * - Adapts prominence based on tier and zoom
 * 
 * Visual Hierarchy:
 * COMMON: Barely visible, requires proximity to notice
 * EPIC: Warm glow, suggests something significant
 * GHOST: Ethereal cyan shimmer, ultra-rare
 */
export const UrbexMarkerV2: React.FC<UrbexMarkerV2Props> = ({
  tier = "COMMON",
  status = "approved",
  size = 32,
  isPro = false,
  className = "",
  archetype = "default",
}) => {
  // Color system: desaturated, cinematic
  const getTierStyle = () => {
    switch (tier) {
      case "EPIC":
        return {
          glow: "rgba(255, 211, 92, 0.3)",
          stroke: "#ffd35c",
          fill: "rgba(255, 211, 92, 0.08)",
          shadow: "0 0 20px rgba(255, 211, 92, 0.4)",
        };
      case "GHOST":
        return {
          glow: "rgba(184, 253, 255, 0.35)",
          stroke: "#b8fdff",
          fill: "rgba(184, 253, 255, 0.06)",
          shadow: "0 0 24px rgba(184, 253, 255, 0.5)",
        };
      default: // COMMON
        return {
          glow: "rgba(255, 255, 255, 0.12)",
          stroke: "rgba(255, 255, 255, 0.4)",
          fill: "rgba(255, 255, 255, 0.03)",
          shadow: "0 0 8px rgba(255, 255, 255, 0.15)",
        };
    }
  };

  const style = getTierStyle();
  const isEpicOrGhost = tier === "EPIC" || tier === "GHOST";

  // Building silhouettes - simplified, cinematic shapes
  const getBuildingSilhouette = () => {
    switch (archetype) {
      case "factory":
        // Industrial complex: horizontal structure with chimney
        return (
          <g>
            {/* Main factory building */}
            <rect x="8" y="12" width="16" height="10" />
            {/* Chimney */}
            <rect x="18" y="6" width="3" height="6" />
            {/* Side annex */}
            <rect x="6" y="16" width="4" height="6" />
          </g>
        );
      case "hospital":
        // Institutional: symmetric with central tower
        return (
          <g>
            {/* Central tower */}
            <rect x="13" y="8" width="6" height="14" />
            {/* Wings */}
            <rect x="8" y="14" width="5" height="8" />
            <rect x="19" y="14" width="5" height="8" />
          </g>
        );
      case "church":
        // Gothic: spire and nave
        return (
          <g>
            {/* Spire */}
            <path d="M16 6 L13 12 L19 12 Z" />
            {/* Nave */}
            <rect x="12" y="12" width="8" height="10" />
          </g>
        );
      case "manor":
        // Estate: pitched roof, gables
        return (
          <g>
            {/* Roof */}
            <path d="M8 14 L16 8 L24 14 Z" />
            {/* Main structure */}
            <rect x="10" y="14" width="12" height="8" />
          </g>
        );
      default:
        // Generic abandoned structure: asymmetric, partially collapsed
        return (
          <g>
            {/* Main building */}
            <rect x="9" y="10" width="10" height="12" />
            {/* Collapsed section */}
            <path d="M19 16 L23 18 L23 22 L19 22 Z" opacity="0.5" />
            {/* Broken roof line */}
            <path d="M8 10 L14 6 L20 10" strokeWidth="1" fill="none" />
          </g>
        );
    }
  };

  return (
    <div
      className={`urbex-marker-v2 urbex-marker-v2--${tier.toLowerCase()} ${
        isEpicOrGhost ? "urbex-marker-v2--rare" : ""
      } ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="urbex-marker-v2__svg"
      >
        <defs>
          {/* Subtle gradient for depth */}
          <linearGradient id={`gradient-${tier}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={style.stroke} stopOpacity="0.6" />
            <stop offset="100%" stopColor={style.stroke} stopOpacity="0.2" />
          </linearGradient>

          {/* Glow filter for EPIC/GHOST tiers */}
          {isEpicOrGhost && (
            <filter id={`glow-${tier}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feComponentTransfer in="blur" result="glow">
                <feFuncA type="linear" slope="2" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}

          {/* Film grain texture overlay */}
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="3" result="noise" />
            <feColorMatrix
              in="noise"
              type="saturate"
              values="0"
              result="grain"
            />
            <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
          </filter>
        </defs>

        {/* Outer glow circle (only for rare tiers) */}
        {isEpicOrGhost && (
          <circle
            cx="16"
            cy="16"
            r="14"
            fill={style.glow}
            className="urbex-marker-v2__glow"
          />
        )}

        {/* Background circle - creates depth */}
        <circle
          cx="16"
          cy="16"
          r="11"
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth="0.5"
          opacity="0.4"
          className="urbex-marker-v2__bg"
        />

        {/* Building silhouette */}
        <g
          className="urbex-marker-v2__building"
          fill="none"
          stroke={style.stroke}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={isEpicOrGhost ? `url(#glow-${tier})` : undefined}
        >
          {getBuildingSilhouette()}
        </g>

        {/* Subtle grain overlay */}
        <circle
          cx="16"
          cy="16"
          r="11"
          fill="transparent"
          filter="url(#grain)"
          opacity="0.08"
          className="urbex-marker-v2__grain"
        />

        {/* PRO badge - minimal design */}
        {isPro && (
          <g className="urbex-marker-v2__pro-badge">
            <circle cx="24" cy="8" r="4" fill="rgba(255, 215, 0, 0.9)" />
            <text
              x="24"
              y="10"
              textAnchor="middle"
              fontSize="5"
              fontWeight="700"
              fill="#0a0a0a"
              fontFamily="system-ui, sans-serif"
            >
              P
            </text>
          </g>
        )}

        {/* Pending status indicator - subtle pulse dot */}
        {status === "pending" && (
          <circle
            cx="26"
            cy="26"
            r="2.5"
            fill="#ff8c42"
            className="urbex-marker-v2__pending-dot"
          />
        )}
      </svg>

      {/* Ground shadow - adds realism */}
      <div
        className="urbex-marker-v2__shadow"
        style={{
          background: `radial-gradient(circle, rgba(0, 0, 0, 0.3) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
};

export default UrbexMarkerV2;
