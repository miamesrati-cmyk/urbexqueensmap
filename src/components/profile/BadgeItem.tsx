import { memo } from "react";

type BadgeItemProps = {
  icon: string;
  label: string;
  description: string;
  unlockHint: string;
  unlocked: boolean;
};

function BadgeItem({ icon, label, description, unlockHint, unlocked }: BadgeItemProps) {
  return (
    <div 
      className={`uq-profile-badge-item ${unlocked ? 'is-unlocked' : 'is-locked'}`}
      title={description}
    >
      <div className="uq-profile-badge-icon">{icon}</div>
      <div className="uq-profile-badge-text">
        <div className="uq-profile-badge-title">
          {label}
          <span className={`uq-profile-badge-status ${unlocked ? 'unlocked' : 'locked'}`}>
            {unlocked ? "✓ Débloqué" : "🔒 Verrouillé"}
          </span>
        </div>
        <div className="uq-profile-badge-desc">{unlockHint}</div>
      </div>
    </div>
  );
}

export default memo(BadgeItem);
