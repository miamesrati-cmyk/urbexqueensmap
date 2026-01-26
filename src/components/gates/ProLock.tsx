// src/components/gates/ProLock.tsx
import type { ReactNode } from "react";
import { useCurrentUserRole } from "../../hooks/useCurrentUserRole";

interface ProLockProps {
  children: ReactNode;
  /** Feature identifier for analytics */
  feature: string;
  /** Show teaser UI instead of hiding */
  showTeaser?: boolean;
  /** Custom locked message */
  lockedMessage?: string;
  /** Callback when user clicks locked element */
  onUpgradeClick?: () => void;
}

/**
 * ProLock: Gate component for Pro-only features
 * 
 * Usage:
 * ```tsx
 * <ProLock
 *   feature="satellite-style"
 *   showTeaser
 *   lockedMessage="Vue satellite réservée aux explorateurs PRO"
 *   onUpgradeClick={() => goTo("/pro")}
 * >
 *   <button>SATELLITE</button>
 * </ProLock>
 * ```
 */
export function ProLock({
  children,
  feature,
  showTeaser = false,
  lockedMessage = "Fonctionnalité réservée PRO",
  onUpgradeClick,
}: ProLockProps) {
  const { isPro } = useCurrentUserRole();

  // Pro user: render children normally
  if (isPro) {
    return <>{children}</>;
  }

  // Guest/Free: hide or show teaser
  if (!showTeaser) {
    return null; // Completely hidden
  }

  // Teaser mode: show locked UI
  return (
    <div className="pro-lock-teaser" data-feature={feature}>
      <div className="pro-lock-teaser__content" aria-disabled="true">
        {children}
      </div>
      <div className="pro-lock-teaser__overlay">
        <div className="pro-lock-teaser__badge">
          <span className="pro-lock-teaser__icon">👑</span>
          <span className="pro-lock-teaser__text">PRO</span>
        </div>
        <p className="pro-lock-teaser__message">{lockedMessage}</p>
        {onUpgradeClick && (
          <button
            type="button"
            className="pro-lock-teaser__cta"
            onClick={onUpgradeClick}
          >
            Déverrouiller
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * AccessGate: More generic gate for Free/Pro tiers
 * 
 * Usage:
 * ```tsx
 * <AccessGate
 *   tier="pro"
 *   feature="time-rift"
 *   fallback={<div>Upgrade to Pro</div>}
 *   onAccessDenied={() => trackEvent("time-rift-blocked")}
 * >
 *   <TimeRiftController />
 * </AccessGate>
 * ```
 */
interface AccessGateProps {
  children: ReactNode;
  tier: "free" | "pro";
  feature: string;
  fallback?: ReactNode;
  onAccessDenied?: () => void;
}

export function AccessGate({
  children,
  tier,
  feature,
  fallback = null,
  onAccessDenied,
}: AccessGateProps) {
  const { user, isPro } = useCurrentUserRole();

  const canAccess =
    tier === "free" ? !!user : tier === "pro" ? isPro : false;

  if (canAccess) {
    return <>{children}</>;
  }

  if (onAccessDenied) {
    onAccessDenied();
  }

  if (import.meta.env.DEV) {
    console.log(`[ACCESS_GATE] ${feature} blocked (tier: ${tier})`);
  }

  return <>{fallback}</>;
}
