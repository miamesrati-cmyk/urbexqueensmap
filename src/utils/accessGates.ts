// src/utils/accessGates.ts
import type { User } from "firebase/auth";

export type AccessTier = "guest" | "free" | "pro" | "admin";

export interface AccessCheck {
  canAccess: boolean;
  tier: AccessTier;
  reason?: string;
}

/**
 * Feature keys for access control and analytics tracking
 */
export type FeatureKey =
  | "satellite"        // Map style switch
  | "ghost-lite"       // Ghost Echo cosmetic (Guest/Free accessible)
  | "ghost-intel"      // Ghost Echo heatmap (Pro-only)
  | "time-rift"        // Time Rift (Decay/Intelligence/Archives)
  | "cluster"          // Cluster toggle
  | "route-planner"    // Route planner
  | "add-spot"         // Create new spot
  | "edit-spot"        // Edit existing spot
  | "delete-spot"      // Delete spot
  | "comment"          // Comment on spot or activity
  | "upload-photo"     // Upload photo to spot
  | "upload-story"     // Upload story
  | "add-intel"        // Add Pro intelligence data
  | "claim-spot"       // Claim spot ownership
  | "like-activity"    // Like/react to activity
  | "post-activity"    // Post new activity
  | "direct-message"   // Send DM
  | "pro-dashboard"    // Access Pro dashboard
  | "missions"         // View/claim missions
  | "admin-panel"      // Admin-only panel
  | "moderate"         // Moderate content (admin)
  | "ban-user";        // Ban user (admin)

/**
 * Microcopy for paywall/lock messaging (UX "Backrooms elite" style)
 */
export const FEATURE_LOCKS: Record<FeatureKey, {
  title: string;
  teaser: string;
  cta: string;
  tier: AccessTier;
}> = {
  "satellite": {
    title: "Vue Satellite — Réservée PRO",
    teaser: "Révèle les lieux depuis l'espace. Analyse terrain, accès, isolation.",
    cta: "Devenir Explorateur PRO",
    tier: "pro",
  },
  "ghost-lite": {
    title: "Ghost Echo — Ambiance Mystère",
    teaser: "Un murmure dans les backrooms… quelque chose se cache ici.",
    cta: "Voir la légende",
    tier: "guest", // Accessible to all (teaser)
  },
  "ghost-intel": {
    title: "Ghost Echo Intel — Patterns Exploitables",
    teaser: "Heatmap densité. Patterns réels. Intel terrain. Réservé aux PRO.",
    cta: "Débloquer Intel Mode",
    tier: "pro",
  },
  "time-rift": {
    title: "Time Rift — Voyage Temporel",
    teaser: "Decay Score. Archives historiques. Intelligence exploitable. Réservé PRO.",
    cta: "Activer Time Rift",
    tier: "pro",
  },
  "cluster": {
    title: "Cluster — Vision Stratégique",
    teaser: "Regroupe les spots proches. Révèle l'essentiel. Stratégie territoire.",
    cta: "Débloquer Clustering",
    tier: "pro",
  },
  "route-planner": {
    title: "Route Planner — Itinéraires Optimisés",
    teaser: "Planifie tes expéditions. Calcul de trajets entre spots. Navigation terrain.",
    cta: "Débloquer Route Planner",
    tier: "pro",
  },
  "add-spot": {
    title: "Ajouter un Spot",
    teaser: "Contribue à la carte. Partage tes découvertes avec la communauté.",
    cta: "Se connecter pour ajouter",
    tier: "free",
  },
  "edit-spot": {
    title: "Modifier le Spot",
    teaser: "Mets à jour les infos. Améliore la précision. Seul le créateur peut éditer.",
    cta: "Se connecter",
    tier: "free",
  },
  "delete-spot": {
    title: "Supprimer le Spot",
    teaser: "Action irréversible. Seul le créateur ou un admin peut supprimer.",
    cta: "Se connecter",
    tier: "free",
  },
  "comment": {
    title: "Commenter",
    teaser: "Partage ton expérience. Ajoute des conseils. Rejoins la discussion.",
    cta: "Se connecter pour commenter",
    tier: "free",
  },
  "upload-photo": {
    title: "Ajouter une Photo",
    teaser: "Documente le lieu. Partage l'ambiance. Enrichis la base visuelle.",
    cta: "Se connecter pour uploader",
    tier: "free",
  },
  "upload-story": {
    title: "Publier une Story",
    teaser: "Partage ton exploration. Crée un récit éphémère. Connect avec la communauté.",
    cta: "Se connecter pour poster",
    tier: "free",
  },
  "add-intel": {
    title: "Ajouter Intel — PRO",
    teaser: "Intelligence terrain réservée. Données exploitables. Contribution PRO.",
    cta: "Devenir Explorateur PRO",
    tier: "pro",
  },
  "claim-spot": {
    title: "Revendiquer le Spot",
    teaser: "Marque ton territoire. Deviens le référent du lieu.",
    cta: "Se connecter pour revendiquer",
    tier: "free",
  },
  "like-activity": {
    title: "Réagir",
    teaser: "Like, soutiens, partage l'énergie. Interagis avec la communauté.",
    cta: "Se connecter pour réagir",
    tier: "free",
  },
  "post-activity": {
    title: "Poster une Activité",
    teaser: "Partage une découverte. Annonce une expédition. Connect avec la communauté.",
    cta: "Se connecter pour poster",
    tier: "free",
  },
  "direct-message": {
    title: "Message Privé",
    teaser: "Échange en privé. Organise des expéditions. Connect 1-on-1.",
    cta: "Se connecter pour DM",
    tier: "free",
  },
  "pro-dashboard": {
    title: "Pro Dashboard",
    teaser: "Analytics. Stats terrain. Historique. Intelligence exploitable. Réservé PRO.",
    cta: "Devenir Explorateur PRO",
    tier: "pro",
  },
  "missions": {
    title: "Missions PRO",
    teaser: "Défis exclusifs. Rewards XP. Unlock secrets. Réservé aux PRO.",
    cta: "Débloquer Missions",
    tier: "pro",
  },
  "admin-panel": {
    title: "Admin Panel",
    teaser: "Modération. Gestion utilisateurs. Accès restreint admin uniquement.",
    cta: "Accès refusé",
    tier: "admin",
  },
  "moderate": {
    title: "Modération",
    teaser: "Modérer le contenu. Gérer signalements. Accès admin uniquement.",
    cta: "Accès refusé",
    tier: "admin",
  },
  "ban-user": {
    title: "Bannir Utilisateur",
    teaser: "Action critique. Modération admin. Accès restreint.",
    cta: "Accès refusé",
    tier: "admin",
  },
};

/**
 * Check if user can access Pro features
 */
export function canUsePro(user: User | null, isPro: boolean): AccessCheck {
  if (!user) {
    return { canAccess: false, tier: "guest", reason: "Authentication required" };
  }
  if (!isPro) {
    return { canAccess: false, tier: "free", reason: "Pro subscription required" };
  }
  return { canAccess: true, tier: "pro" };
}

/**
 * Check if user is authenticated (Free or Pro)
 */
export function canUseAuth(user: User | null): AccessCheck {
  if (!user) {
    return { canAccess: false, tier: "guest", reason: "Authentication required" };
  }
  return { canAccess: true, tier: user ? "free" : "guest" };
}

/**
 * Check if user is admin
 */
export function canUseAdmin(user: User | null, isAdmin: boolean): AccessCheck {
  if (!user) {
    return { canAccess: false, tier: "guest", reason: "Authentication required" };
  }
  if (!isAdmin) {
    return { canAccess: false, tier: "free", reason: "Admin access required" };
  }
  return { canAccess: true, tier: "admin" };
}

/**
 * Check if feature is accessible for current user tier
 */
export function canUseFeature(
  feature: FeatureKey,
  user: User | null,
  isPro: boolean,
  isAdmin: boolean
): AccessCheck {
  const lock = FEATURE_LOCKS[feature];
  const userTier = getUserTier(user, isPro, isAdmin);

  // Admin can access everything
  if (isAdmin) {
    return { canAccess: true, tier: "admin" };
  }

  // Check tier requirement
  if (lock.tier === "admin") {
    return { canAccess: false, tier: userTier, reason: "Admin access required" };
  }

  if (lock.tier === "pro") {
    return canUsePro(user, isPro);
  }

  if (lock.tier === "free") {
    return canUseAuth(user);
  }

  // Guest-accessible features
  return { canAccess: true, tier: userTier };
}

/**
 * Guard wrapper that blocks and opens paywall
 * @returns true if access granted, false if blocked
 */
export function requirePro(
  feature: FeatureKey,
  user: User | null,
  isPro: boolean,
  onUpgradeRequired: () => void
): boolean {
  const check = canUsePro(user, isPro);
  if (!check.canAccess) {
    if (import.meta.env.DEV) {
      const lock = FEATURE_LOCKS[feature];
      console.warn(`[ACCESS] ${lock.title} blocked:`, check.reason);
    }
    onUpgradeRequired();
    return false;
  }
  return true;
}

/**
 * Guard wrapper for authenticated features
 * @returns true if access granted, false if blocked
 */
export function requireAuth(
  feature: FeatureKey,
  user: User | null,
  onAuthRequired: () => void
): boolean {
  const check = canUseAuth(user);
  if (!check.canAccess) {
    if (import.meta.env.DEV) {
      const lock = FEATURE_LOCKS[feature];
      console.warn(`[ACCESS] ${lock.title} blocked:`, check.reason);
    }
    onAuthRequired();
    return false;
  }
  return true;
}

/**
 * Guard wrapper for admin features
 * @returns true if access granted, false if blocked
 */
export function requireAdmin(
  feature: FeatureKey,
  user: User | null,
  isAdmin: boolean,
  onAccessDenied?: () => void
): boolean {
  const check = canUseAdmin(user, isAdmin);
  if (!check.canAccess) {
    if (import.meta.env.DEV) {
      const lock = FEATURE_LOCKS[feature];
      console.warn(`[ACCESS] ${lock.title} blocked:`, check.reason, "(admin-only)");
    }
    onAccessDenied?.();
    return false;
  }
  return true;
}

/**
 * Get lock messaging for a feature
 */
export function explainLock(feature: FeatureKey): typeof FEATURE_LOCKS[FeatureKey] {
  return FEATURE_LOCKS[feature];
}

/**
 * Tier detection helpers
 */
export function isGuest(user: User | null): boolean {
  return !user;
}

export function isFree(user: User | null, isPro: boolean): boolean {
  return !!user && !isPro;
}

export function isProUser(user: User | null, isPro: boolean): boolean {
  return !!user && isPro;
}

/**
 * Get current user tier
 */
export function getUserTier(user: User | null, isPro: boolean, isAdmin: boolean): AccessTier {
  if (isAdmin) return "admin";
  if (isPro) return "pro";
  if (user) return "free";
  return "guest";
}
