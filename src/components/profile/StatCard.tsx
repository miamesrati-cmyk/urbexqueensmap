import { memo } from "react";

type StatCardProps = {
  value: number | string;
  label: string;
  icon?: string;
  color?: "pink" | "cyan" | "gold";
  onClick?: () => void;
};

function StatCard({ value, label, icon, color = "pink", onClick }: StatCardProps) {
  const colorClass = `stat-card--${color}`;
  
  return (
    <div 
      className={`uq-profile-stat-card ${colorClass} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon && <div className="uq-profile-stat-icon">{icon}</div>}
      <span className="uq-profile-stat-value">{value}</span>
      <span className="uq-profile-stat-label">{label}</span>
    </div>
  );
}

export default memo(StatCard);
