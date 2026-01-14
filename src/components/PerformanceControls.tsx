import { usePerformanceSettings } from "../hooks/usePerformanceSettings";
import "./PerformanceControls.css";

/**
 * ⚡ Performance Controls (Dev-only)
 * 
 * Quick toggles for performance debugging:
 * - Halo blur comparison (0 vs 0.5)
 * - Performance HUD visibility
 */
export default function PerformanceControls() {
  const { settings, toggleHaloBlur, togglePerformanceHUD } = usePerformanceSettings();

  return (
    <div className="performance-controls">
      <div className="performance-controls-header">🔧 Dev Tools</div>
      
      <div className="performance-controls-list">
        {/* Halo Blur Toggle */}
        <button
          type="button"
          className={`performance-control-btn ${settings.haloBlur > 0 ? "is-active" : ""}`}
          onClick={toggleHaloBlur}
          title="Compare halo blur performance (0 vs 0.5)"
        >
          <span className="performance-control-icon">
            {settings.haloBlur > 0 ? "🎨" : "⚡"}
          </span>
          <span className="performance-control-label">
            Halo Blur: {settings.haloBlur}
          </span>
        </button>

        {/* Performance HUD Toggle */}
        <button
          type="button"
          className={`performance-control-btn ${settings.performanceHUDEnabled ? "is-active" : ""}`}
          onClick={togglePerformanceHUD}
          title="Toggle performance HUD"
        >
          <span className="performance-control-icon">📊</span>
          <span className="performance-control-label">
            Perf HUD
          </span>
        </button>
      </div>

      <div className="performance-controls-info">
        💡 Test blur impact on FPS/frame time
      </div>
    </div>
  );
}
