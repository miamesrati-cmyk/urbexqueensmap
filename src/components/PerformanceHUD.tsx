import type { PerformanceMetrics } from "../hooks/useMapPerformanceMonitor";
import "./PerformanceHUD.css";

interface PerformanceHUDProps {
  metrics: PerformanceMetrics;
}

/**
 * ⚡ Performance HUD (Dev-only)
 * 
 * Displays real-time performance metrics for map rendering.
 * Shows FPS, frame time, feature count, and update duration.
 * 
 * Activate with ?perf=1 or in DEV mode
 */
export default function PerformanceHUD({ metrics }: PerformanceHUDProps) {
  const {
    fps,
    frameTime,
    featureCount,
    lastUpdateTime,
    updateCount,
    layerRecreationDetected,
    averageUpdateTime,
  } = metrics;

  // Performance status indicators
  const fpsStatus = fps >= 55 ? "good" : fps >= 40 ? "ok" : "bad";
  const updateStatus =
    lastUpdateTime <= 16
      ? "good"
      : lastUpdateTime <= 33
      ? "ok"
      : "bad";

  return (
    <div className="performance-hud">
      <div className="performance-hud-header">
        ⚡ Performance Monitor
      </div>

      <div className="performance-hud-metrics">
        {/* FPS */}
        <div className={`performance-metric performance-metric--${fpsStatus}`}>
          <div className="performance-metric-label">FPS</div>
          <div className="performance-metric-value">{fps}</div>
        </div>

        {/* Frame Time */}
        <div className="performance-metric">
          <div className="performance-metric-label">Frame</div>
          <div className="performance-metric-value">{frameTime.toFixed(1)}ms</div>
        </div>

        {/* Feature Count */}
        <div className="performance-metric">
          <div className="performance-metric-label">Features</div>
          <div className="performance-metric-value">{featureCount}</div>
        </div>

        {/* Last Update Time */}
        <div className={`performance-metric performance-metric--${updateStatus}`}>
          <div className="performance-metric-label">Update</div>
          <div className="performance-metric-value">{lastUpdateTime.toFixed(1)}ms</div>
        </div>

        {/* Average Update Time */}
        <div className="performance-metric">
          <div className="performance-metric-label">Avg Update</div>
          <div className="performance-metric-value">{averageUpdateTime.toFixed(1)}ms</div>
        </div>

        {/* Update Count */}
        <div className="performance-metric">
          <div className="performance-metric-label">Updates</div>
          <div className="performance-metric-value">{updateCount}</div>
        </div>
      </div>

      {/* Layer Recreation Warning */}
      {layerRecreationDetected && (
        <div className="performance-hud-warning">
          ⚠️ Layer recreation detected!
        </div>
      )}

      {/* Performance Status Summary */}
      <div className="performance-hud-status">
        {fpsStatus === "good" && updateStatus === "good" && (
          <span className="performance-status-good">✅ Excellent</span>
        )}
        {fpsStatus === "ok" || updateStatus === "ok" && (
          <span className="performance-status-ok">⚠️ Acceptable</span>
        )}
        {(fpsStatus === "bad" || updateStatus === "bad") && (
          <span className="performance-status-bad">🔴 Performance Issue</span>
        )}
      </div>

      {/* Budget Indicators */}
      <div className="performance-hud-budget">
        <div className="performance-budget-bar">
          <div className="performance-budget-label">Update Budget:</div>
          <div className="performance-budget-track">
            <div
              className={`performance-budget-fill performance-budget-fill--${updateStatus}`}
              style={{
                width: `${Math.min((lastUpdateTime / 33) * 100, 100)}%`,
              }}
            />
            <div className="performance-budget-marker performance-budget-marker--ideal" style={{ left: "48.5%" }}>
              16ms
            </div>
            <div className="performance-budget-marker performance-budget-marker--max" style={{ left: "100%" }}>
              33ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
