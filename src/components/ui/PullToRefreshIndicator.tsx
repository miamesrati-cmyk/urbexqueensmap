import type { CSSProperties } from "react";
import type { PullToRefreshStatus } from "../../hooks/usePullToRefresh";

const INDICATOR_HEIGHT = 56;

type Props = {
  pullDistance: number;
  status: PullToRefreshStatus;
  label?: string;
  style?: CSSProperties;
};

export default function PullToRefreshIndicator({
  pullDistance,
  status,
  label = "Actualisation…",
  style,
}: Props) {
  const offset = Math.min(pullDistance, INDICATOR_HEIGHT);
  const translateY = offset - INDICATOR_HEIGHT;
  const isVisible = status !== "idle";

  return (
    <div
      className={`pull-to-refresh-indicator${isVisible ? " is-visible" : ""}`}
      style={{ transform: `translateY(${translateY}px)`, ...style }}
      role="status"
      aria-live="polite"
      aria-hidden={!isVisible}
    >
      <div className="pull-to-refresh-indicator__inner">
        <span
          className={`pull-to-refresh-spinner${status === "refreshing" ? " is-active" : ""}`}
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
