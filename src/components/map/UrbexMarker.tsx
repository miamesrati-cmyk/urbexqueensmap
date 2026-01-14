import React from "react";
import "./UrbexMarker.css";

type MarkerStatus = "pending" | "approved" | "rejected";

interface UrbexMarkerProps {
  status?: MarkerStatus;
  size?: number;
  isPro?: boolean;
  className?: string;
  emoji?: string;
}

export const UrbexMarker: React.FC<UrbexMarkerProps> = ({
  status = "approved",
  size = 40,
  isPro = false,
  className = "",
  emoji = "🏚️",
}) => {
  const getStatusColor = () => {
    switch (status) {
      case "pending":
        return {
          primary: "#FFA726", // Orange vif
          secondary: "#FF7043",
          glow: "rgba(255, 167, 38, 0.4)",
        };
      case "approved":
        return {
          primary: "#BA68C8", // Violet
          secondary: "#9C27B0",
          glow: "rgba(186, 104, 200, 0.4)",
        };
      case "rejected":
        return {
          primary: "#9E9E9E", // Gris
          secondary: "#757575",
          glow: "rgba(158, 158, 158, 0.3)",
        };
    }
  };

  const colors = getStatusColor();
  const pulseClass = status === "pending" ? "urbex-marker--pulse" : "";
  const proClass = isPro ? "urbex-marker--pro" : "";

  return (
    <div
      className={`urbex-marker ${pulseClass} ${proClass} ${className}`}
      style={{
        width: size,
        height: size * 1.3,
      }}
    >
      <svg
        width={size}
        height={size * 1.3}
        viewBox="0 0 36 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="urbex-marker-svg"
      >
        {/* Definitions */}
        <defs>
          <filter id={`shadow-${status}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.4" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`gradient-${status}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} />
            <stop offset="100%" stopColor={colors.secondary} />
          </linearGradient>
        </defs>

        {/* Shadow ellipse under pin */}
        <ellipse
          cx="18"
          cy="44"
          rx="7"
          ry="2.5"
          fill="rgba(0, 0, 0, 0.25)"
          className="urbex-marker-shadow"
        />

        {/* Outer glow (pending state) */}
        {status === "pending" && (
          <circle
            cx="18"
            cy="14"
            r="13"
            fill={colors.glow}
            opacity="0.3"
            className="urbex-marker-glow"
          />
        )}

        {/* Main pin shape */}
        <g filter={`url(#shadow-${status})`}>
          <path
            d="M18 2C12.477 2 8 6.477 8 12C8 19 18 36 18 36C18 36 28 19 28 12C28 6.477 23.523 2 18 2Z"
            fill={`url(#gradient-${status})`}
            className="urbex-marker-pin"
          />
        </g>

        {/* Inner white circle */}
        <circle
          cx="18"
          cy="12"
          r="7"
          fill="white"
          className="urbex-marker-inner-bg"
        />

        {/* Emoji */}
        <text
          x="18"
          y="15.5"
          textAnchor="middle"
          fontSize="9"
          className="urbex-marker-emoji"
        >
          {emoji}
        </text>

        {/* PRO badge */}
        {isPro && (
          <g>
            <circle 
              cx="27" 
              cy="5" 
              r="5.5" 
              fill="#FFD700"
              stroke="white"
              strokeWidth="1"
            />
            <text
              x="27"
              y="7.5"
              textAnchor="middle"
              fontSize="5"
              fontWeight="bold"
              fill="white"
            >
              PRO
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default UrbexMarker;
