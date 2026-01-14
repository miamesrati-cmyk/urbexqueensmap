import { memo } from "react";

type AchievementCardProps = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlockHint: string;
  xp: number;
  tier: string;
  proOnly: boolean;
  unlocked: boolean;
  unlockedAt?: number;
};

function AchievementCard({
  icon,
  title,
  description,
  unlockHint,
  xp,
  tier,
  proOnly,
  unlocked,
  unlockedAt,
}: AchievementCardProps) {
  const unlockedDate =
    unlockedAt && unlockedAt > 0
      ? new Date(unlockedAt).toLocaleDateString("fr-CA", {
          day: "2-digit",
          month: "short",
        })
      : null;

  return (
    <div
      className={`achievement-card${
        unlocked ? " is-unlocked" : " is-locked"
      } achievement-card--tier-${tier.toLowerCase()}${
        proOnly ? " achievement-card--pro" : ""
      }`}
      title={unlockHint}
    >
      <div className="achievement-card-icon">{icon}</div>
      <div className="achievement-card-content">
        <div className="achievement-card-head">
          <span className="achievement-card-title">{title}</span>
          {proOnly && (
            <span className="achievement-card-pro-pill">PRO ✨</span>
          )}
        </div>
        <p className="achievement-card-desc">{description}</p>
        <span className="achievement-card-hint">{unlockHint}</span>
      </div>
      <div className="achievement-card-footer">
        <span className="achievement-card-xp">+{xp} XP</span>
        <span className="achievement-card-status">
          {unlocked
            ? `✓ Débloqué${unlockedDate ? ` · ${unlockedDate}` : ""}`
            : "🔒 Verrouillé"}
        </span>
      </div>
    </div>
  );
}

export default memo(AchievementCard);
