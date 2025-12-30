// src/App.tsx
import "./styles.css";
import AuthModal from "./components/AuthModal";
import {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import LegalConsentModal from "./components/LegalConsentModal";
import {
  DEFAULT_ADMIN_UI_CONFIG,
  ADMIN_UI_THEME_PRESETS,
  useAdminUiConfigRuntime,
} from "./hooks/useAdminUiConfig";
import { useCurrentUserRole } from "./hooks/useCurrentUserRole";
import { PageContainer, SectionCard } from "./components/ui/UrbexUI";
import { useProStatus } from "./contexts/ProStatusContext";
import type { AdminPageKey } from "./components/admin/AdminLayout";
import { useSyncShopCustomer } from "./hooks/useSyncShopCustomer";
import { useLiveUserProfile } from "./hooks/useLiveUserProfiles";
import CartDrawer from "./components/cart/CartDrawer";
import { CrashBanner } from "./components/CrashBanner";
import ReloadGuardBanner from "./components/ReloadGuardBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuthUI } from "./contexts/useAuthUI";
import { auth } from "./lib/firebase";
import { signOut, type User } from "firebase/auth";
import { createPortal } from "react-dom";
import markerUrbexIcon from "./assets/icons/marker-urbex.png";
import markerPhotographyIcon from "./assets/icons/marker-photography.png";
import markerAbandonedIcon from "./assets/icons/marker-abandoned.png";
import markerHistoricalIcon from "./assets/icons/marker-historical.png";
import markerNatureIcon from "./assets/icons/marker-nature.png";
import markerOtherIcon from "./assets/icons/marker-other.png";
import type { NotificationItem } from "./lib/notifications";
import {
  createNotificationSeed,
  formatRelativeTime,
  getNotificationMessage,
  getUnreadCount,
  markAllAsRead,
  markNotificationAsRead,
  notificationTypeLabels,
} from "./lib/notifications";
import {
  subscribeToUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "./services/notifications";
import type { MissionQuest } from "./lib/missions";
import {
  advanceMissionProgress,
  areMissionsComplete,
  createMissionSeed,
} from "./lib/missions";
import { dispatchSpotListView } from "./lib/userSpotStats";
import {
  parseProfileViewFromSearch,
  type ProfileViewSection,
} from "./lib/profileViews";
import { makeStormLogger } from "./utils/stormLogger";
type AppGlobalWithProcessEnv = typeof globalThis & {
  process?: { env?: { NODE_ENV?: string } };
};
const SpotPage = lazy(() => import("./pages/SpotPage"));
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const ProfileHandlePage = lazy(() => import("./components/ProfileHandlePage"));
const SocialFeed = lazy(() => import("./components/SocialFeed"));
const DMPage = lazy(() => import("./components/DMPage"));
const MapRoute = lazy(() => import("./pages/MapRoute"));
const PaymentSecurity = lazy(() => import("./pages/PaymentSecurity"));
const PaymentPolicy = lazy(() => import("./pages/PaymentPolicy"));
const LegalClause = lazy(() => import("./pages/LegalClause"));
const LegalDisclaimer = lazy(() => import("./components/LegalDisclaimer"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProLandingPage = lazy(() => import("./pages/ProLandingPage"));
const ProReturnPage = lazy(() => import("./pages/ProReturnPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const EditHistoryView = lazy(() => import("./pages/EditHistoryView"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const DarkEntryGame = lazy(() => import("./pages/DarkEntryGame"));

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, isAdmin, isAdminLoading } = useCurrentUserRole();
  const redirectedRef = useRef(false);
  const guardLogRef = useRef(false);
  const adminLoading = isLoading || isAdminLoading;

  useEffect(() => {
    if (!import.meta.env.DEV || guardLogRef.current) return;
    guardLogRef.current = true;
    console.info("[UQ][ADMIN_GUARD]", {
      isAdmin,
      loading: adminLoading,
      uid: user?.uid ?? null,
    });
  }, [adminLoading, isAdmin, user?.uid]);

  useEffect(() => {
    if (adminLoading || isAdmin) {
      redirectedRef.current = false;
      return;
    }
    if (redirectedRef.current) {
      return;
    }
    redirectedRef.current = true;
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(
        new CustomEvent("urbex-nav", {
          detail: { path: "/" },
        })
      );
    }
  }, [adminLoading, isAdmin]);

  if (adminLoading) {
    return (
      <PageContainer>
        <SectionCard>
          <p>Chargement du panneau admin…</p>
        </SectionCard>
      </PageContainer>
    );
  }

  if (!user || !isAdmin) {
    return (
      <PageContainer>
        <SectionCard>
          <h2>Accès refusé</h2>
          <p>Seuls les admins peuvent ouvrir cette section.</p>
        </SectionCard>
      </PageContainer>
    );
  }

  return <>{children}</>;
}

const LEGAL_CONSENT_KEY = "urbexqueens_legalConsent_v1";

const menuPanelInstanceCounterRef = { current: 0 };

function parseAdminRoute(
  path: string
): { kind: "admin"; page?: AdminPageKey; initialPlaceId?: string | null; selectedOrderId?: string | null } | null {
  if (!path.startsWith("/admin")) return null;
  if (path.startsWith("/admin/places/")) {
    const id = path.replace("/admin/places/", "");
    return { kind: "admin", page: "places", initialPlaceId: id };
  }

  const normalized = path.replace(/\/$/, "");

  if (normalized === "/admin/place-history") {
    return { kind: "admin", page: "histories" };
  }

  if (normalized === "/admin/spots-proposes") {
    return { kind: "admin", page: "spotSubmissions" };
  }

  if (normalized === "/admin") {
    return { kind: "admin", page: "dashboard" };
  }

  if (normalized === "/admin/shop") {
    return { kind: "admin", page: "shop" };
  }

  if (normalized.startsWith("/admin/shop/")) {
    const shopSection = normalized.replace("/admin/shop/", "");
    if (shopSection === "products") {
      return { kind: "admin", page: "products" };
    }
    if (shopSection === "customers") {
      return { kind: "admin", page: "customers" };
    }
    if (shopSection.startsWith("orders")) {
      const parts = shopSection.split("/").filter(Boolean);
      return {
        kind: "admin",
        page: "orders",
        selectedOrderId: parts[1] ?? null,
      };
    }
  }

  if (normalized === "/admin/themes") {
    return { kind: "admin", page: "themes" };
  }

  if (normalized === "/admin/ui-config") {
    return { kind: "admin", page: "uiConfig" };
  }

  if (normalized === "/admin/overlays") {
    return { kind: "admin", page: "overlays" };
  }

  const parts = path.replace("/admin/", "").split("/").filter(Boolean);
  const rawSection = parts[0];
  if (rawSection === "spots-proposes") {
    return { kind: "admin", page: "spotSubmissions" };
  }
  const alias: Record<string, AdminPageKey> = {
    analytics: "stats",
    histories: "histories",
    "map-ui": "mapUI",
  };
  const canonicalSection = (alias[rawSection] ?? rawSection) as AdminPageKey | undefined;
  const extra = parts[1];
  const valid: AdminPageKey[] = [
    "dashboard",
    "places",
    "spotSubmissions",
    "histories",
    "users",
    "products",
    "orders",
    "customers",
    "stats",
    "settings",
    "mapUI",
    "themes",
    "uiConfig",
    "overlays",
    "integrations",
    "shop",
    "revenue",
    "activity",
  ];
  if (canonicalSection && valid.includes(canonicalSection)) {
    if (canonicalSection === "orders" && extra) {
      return { kind: "admin", page: canonicalSection, selectedOrderId: extra };
    }
    return { kind: "admin", page: canonicalSection };
  }
  return { kind: "admin", page: "dashboard" };
}

type AppRoute =
  | { kind: "map" }
  | { kind: "spot"; id: string }
  | { kind: "profile"; id: string; view?: ProfileViewSection }
  | { kind: "profileHandle"; handle: string; view?: ProfileViewSection }
  | { kind: "feed" }
  | { kind: "dm"; with?: string }
  | { kind: "payment" }
  | { kind: "paymentPolicy" }
  | { kind: "legalTerms" }
  | { kind: "legal" }
  | { kind: "settings" }
  | { kind: "shop" }
  | { kind: "game" }
  | { kind: "admin"; page?: AdminPageKey; initialPlaceId?: string | null; selectedOrderId?: string | null }
  | { kind: "editHistory"; id: string }
  | { kind: "pro" }
  | { kind: "proReturn"; status: "success" | "cancel"; sessionId?: string };

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path === "/") return "/";
  return path.replace(/\/$/, "");
}

const GAME_CANONICAL_PATH = "/jeux";
const GAME_ROUTE_PREFIX = `${GAME_CANONICAL_PATH}/`;

function isGameRoutePath(path: string) {
  return path === GAME_CANONICAL_PATH || path.startsWith(GAME_ROUTE_PREFIX);
}

function resolveRouteFromLocation(pathname: string, search: string): AppRoute {
  const normalizedPath = normalizePath(pathname);
  const view = parseProfileViewFromSearch(search);

  if (
    normalizedPath.startsWith("/spot/") &&
    normalizedPath.endsWith("/edit-history")
  ) {
    const id = normalizedPath
      .replace("/spot/", "")
      .replace("/edit-history", "")
      .replace(/\/$/, "");
    return { kind: "editHistory", id };
  }

  const adminRoute = parseAdminRoute(normalizedPath);
  if (adminRoute) return adminRoute;

  if (normalizedPath.startsWith("/spot/")) {
    return { kind: "spot", id: normalizedPath.replace("/spot/", "") };
  }

  if (normalizedPath.startsWith("/u/")) {
    return {
      kind: "profileHandle",
      handle: normalizedPath.replace("/u/", "").replace(/\/$/, ""),
      view,
    };
  }

  if (normalizedPath.startsWith("/profile/")) {
    return {
      kind: "profile",
      id: normalizedPath.replace("/profile/", "").replace(/\/$/, ""),
      view,
    };
  }

  if (normalizedPath.startsWith("/feed")) {
    return { kind: "feed" };
  }
  if (normalizedPath.startsWith("/dm")) {
    const withId = normalizedPath.replace("/dm/", "");
    return { kind: "dm", with: withId || undefined };
  }
  if (normalizedPath.startsWith("/payment-security")) {
    return { kind: "payment" };
  }
  if (normalizedPath.startsWith("/payment-policy")) {
    return { kind: "paymentPolicy" };
  }
  if (normalizedPath.startsWith("/legal-terms")) {
    return { kind: "legalTerms" };
  }
  if (normalizedPath.startsWith("/legal")) {
    return { kind: "legal" };
  }
  if (normalizedPath.startsWith("/settings") || normalizedPath.startsWith("/parametres")) {
    return { kind: "settings" };
  }
  if (normalizedPath.startsWith("/pro/return")) {
    const params = new URLSearchParams(search);
    const requestedStatus = params.get("status")?.toLowerCase();
    const sessionId = params.get("session_id") ?? undefined;
    const status = requestedStatus === "success" ? "success" : "cancel";
    return { kind: "proReturn", status, sessionId };
  }
  if (normalizedPath.startsWith("/pro")) {
    return { kind: "pro" };
  }
  if (normalizedPath.startsWith("/shop")) {
    return { kind: "shop" };
  }
  if (isGameRoutePath(normalizedPath)) {
    return { kind: "game" };
  }

  return { kind: "map" };
}


const AVATAR_HINT_STORAGE_KEY = "uq_seen_avatar_hint";

type UserMenuRootUser = Pick<User, "uid" | "displayName" | "email" | "photoURL">;
type UserMenuRootProps = {
  user: UserMenuRootUser | null;
  isPro: boolean;
  isAdmin: boolean;
  requireAuth: ReturnType<typeof useAuthUI>["requireAuth"];
  goTo: (path: string) => void;
  isAccountMenuOpen: boolean;
  onToggleAccountMenu: () => void;
  onCloseAccountMenu: () => void;
};

type UserMenuButtonProps = {
  displayName: string;
  letter: string;
  avatarPhotoURL: string;
  avatarMode: "logo" | "cover";
  isPro: boolean;
  isAccountMenuOpen: boolean;
  showAvatarHint: boolean;
  accountRef: React.RefObject<HTMLButtonElement | null>;
  onToggleAccountMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onTriggerKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
};

function UserMenuButton({
  displayName,
  letter,
  avatarPhotoURL,
  avatarMode,
  isPro,
  isAccountMenuOpen,
  showAvatarHint,
  accountRef,
  onToggleAccountMenu,
  onTriggerKeyDown,
}: UserMenuButtonProps) {
  const showAvatarImage = Boolean(
    avatarPhotoURL && avatarPhotoURL.toLowerCase().startsWith("http")
  );
  return (
    <button
      type="button"
      className="topbar-account"
      ref={accountRef}
      aria-label="Compte"
      aria-expanded={isAccountMenuOpen}
      data-account-trigger="true"
      data-account-hint={showAvatarHint ? "true" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onToggleAccountMenu(event);
      }}
      onKeyDown={onTriggerKeyDown}
    >
      <div className="topbar-user-meta">
        <span className="topbar-user-greeting">Bonjour</span>
        <span className="topbar-user-name">{displayName}</span>
        {isPro && <span className="topbar-user-pro-badge">PRO</span>}
      </div>
      <span
        className={`topbar-avatar${avatarMode === "logo" ? " topbar-avatar--logo" : ""}`}
        data-monogram={letter}
      >
        {showAvatarImage ? (
          <img
            src={avatarPhotoURL}
            alt={displayName}
            className="topbar-avatar-img"
            aria-hidden="true"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <span className="topbar-avatar-monogram" aria-hidden="true">
            {letter}
          </span>
        )}
        <span className="topbar-avatar-caret" aria-hidden="true">
          <svg viewBox="0 0 8 5" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0h8L4 5z" />
          </svg>
        </span>
        <span className="topbar-avatar-tooltip" role="tooltip">
          {showAvatarHint ? "Menu du compte" : "Compte"}
        </span>
      </span>
    </button>
  );
}

function UserMenuRootBase({
  user,
  isPro,
  isAdmin,
  requireAuth,
  goTo,
  isAccountMenuOpen,
  onToggleAccountMenu,
  onCloseAccountMenu,
}: UserMenuRootProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const accountRef = useRef<HTMLButtonElement | null>(null);
  const [showAvatarHint, setShowAvatarHint] = useState(false);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setShowAvatarHint(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(AVATAR_HINT_STORAGE_KEY)) return;

    setShowAvatarHint(true);
    window.localStorage.setItem(AVATAR_HINT_STORAGE_KEY, "1");
    hintTimeoutRef.current = window.setTimeout(() => {
      setShowAvatarHint(false);
      hintTimeoutRef.current = null;
    }, 3000);

    return () => {
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
    };
  }, [user?.uid]);

  const displayNameForButton = useMemo(() => {
    return (
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Explorateur"
    );
  }, [user?.displayName, user?.email]);
  const letterForButton = useMemo(
    () => displayNameForButton[0]?.toUpperCase() ?? "U",
    [displayNameForButton]
  );
  const avatarPhotoURL = user?.photoURL?.trim() ?? "";
  const avatarMode: "logo" | "cover" = "cover";

  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseAccountMenu();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      onToggleAccountMenu();
    },
    [onCloseAccountMenu, onToggleAccountMenu]
  );

  const handleButtonToggle = useCallback(() => {
    onToggleAccountMenu();
  }, [onToggleAccountMenu]);

  return (
    <div className="topbar-user" ref={rootRef}>
      {user ? (
        <UserMenuButton
          displayName={displayNameForButton}
          letter={letterForButton}
          avatarPhotoURL={avatarPhotoURL}
          avatarMode={avatarMode}
          isPro={isPro}
          isAccountMenuOpen={isAccountMenuOpen}
          showAvatarHint={showAvatarHint}
          accountRef={accountRef}
          onToggleAccountMenu={handleButtonToggle}
          onTriggerKeyDown={handleTriggerKeyDown}
        />
      ) : (
        <div className="topbar-guest-actions">
          <button
            data-testid="auth-login"
            type="button"
            className="topbar-auth-pill topbar-auth-pill--neutral"
            onClick={() => requireAuth({ mode: "login", reason: "Se connecter" })}
          >
            Connexion
          </button>
          <button
            data-testid="auth-signup"
            type="button"
            className="topbar-auth-pill topbar-auth-pill--cta"
            onClick={() => requireAuth({ mode: "signup", reason: "Créer un compte" })}
          >
            Créer un compte
          </button>
        </div>
      )}
      {user && isAccountMenuOpen && (
        <UserMenuPanel
          user={user}
          isPro={isPro}
          isAdmin={isAdmin}
          goTo={goTo}
          onCloseAccountMenu={onCloseAccountMenu}
          accountRef={accountRef}
          rootRef={rootRef}
        />
      )}
    </div>
  );
}
type UserMenuPanelProps = {
  user: UserMenuRootUser;
  isPro: boolean;
  isAdmin: boolean;
  goTo: (path: string) => void;
  onCloseAccountMenu: () => void;
  accountRef: React.RefObject<HTMLButtonElement | null>;
  rootRef: React.RefObject<HTMLDivElement | null>;
};

function UserMenuPanel({
  user,
  isPro,
  isAdmin,
  goTo,
  onCloseAccountMenu,
  accountRef,
  rootRef,
}: UserMenuPanelProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const menuPanelInstanceRef = useRef<number | null>(null);
  if (menuPanelInstanceRef.current === null) {
    menuPanelInstanceCounterRef.current += 1;
    menuPanelInstanceRef.current = menuPanelInstanceCounterRef.current;
  }
  const menuPanelInstanceId = menuPanelInstanceRef.current;

  const liveProfile = useLiveUserProfile(user.uid);
  const displayNameSource = useMemo(() => {
    return (
      liveProfile?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Explorateur"
    );
  }, [liveProfile?.displayName, user.displayName, user.email]);
  const displayName = displayNameSource;
  const letter = useMemo(
    () => displayNameSource[0]?.toUpperCase() ?? "U",
    [displayNameSource]
  );

  const handleMenuAction = useCallback(
    (action: () => void) => {
      action();
      onCloseAccountMenu();
    },
    [onCloseAccountMenu]
  );

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed", err);
    }
    onCloseAccountMenu();
  }, [onCloseAccountMenu]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      if (dropdownRef.current?.contains(event.target as Node)) return;
      onCloseAccountMenu();
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [onCloseAccountMenu, rootRef]);

  useLayoutEffect(() => {
    if (!accountRef.current) {
      return;
    }
    const rect = accountRef.current.getBoundingClientRect();
    const dropdownWidth = 250;
    const computedTop = rect.bottom + window.scrollY + 8;
    const computedLeft = Math.max(16, rect.right - dropdownWidth);
    setDropdownPosition((current) => {
      if (current) {
        const deltaTop = Math.abs(current.top - computedTop);
        const deltaLeft = Math.abs(current.left - computedLeft);
        if (deltaTop < 1 && deltaLeft < 1) {
          return current;
        }
      }
      const next = { top: computedTop, left: computedLeft };
      if (import.meta.env.DEV) {
        console.info("[UQ] dropdown reposition", {
          prev: current,
          next,
        });
      }
      return next;
    });
  }, [accountRef]);

  useEffect(() => {
    if (!dropdownRef.current) return;
    if (import.meta.env.DEV) {
      const style = getComputedStyle(dropdownRef.current);
      console.info("[UQ] dropdown z-index", style.zIndex);
      console.info("[UQ] dropdown rect", dropdownRef.current.getBoundingClientRect());
      const header = document.querySelector(".topbar");
      if (header) {
        const headerStyle = getComputedStyle(header);
        console.info("[UQ] header z-index", headerStyle.zIndex);
      }
      const search = document.querySelector(".map-search-form");
      if (search) {
        const searchStyle = getComputedStyle(search);
        console.info("[UQ] search z-index", searchStyle.zIndex);
      }
    }
  }, [dropdownPosition]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info("[UQ][ADMIN_MENU_RENDER]", {
      uid: user.uid,
      isAdmin: liveProfile?.isAdmin,
    });
  }, [user.uid, liveProfile?.isAdmin]);

  if (!dropdownPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className="topbar-dropdown topbar-dropdown--portal topbar-dropdown--menu"
      data-account-menu="true"
      style={{
        position: "absolute",
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: 260,
      }}
    >
      <div className="topbar-dropdown-proof">
        UserMenuPanel instance: #{menuPanelInstanceId}
      </div>
      <div className="topbar-dropdown-profile">
        <div className="topbar-dropdown-profile-avatar">{letter}</div>
        <div>
          <strong>{displayName}</strong>
          <span className="topbar-dropdown-profile-handle">
            @{(user.displayName || user.email)?.replace(/\s+/g, "").toLowerCase()}
          </span>
        </div>
        {isPro && <span className="topbar-user-pro-badge">PRO</span>}
      </div>
      <div className="topbar-dropdown-menu">
        <button
          type="button"
          className="topbar-dropdown-item"
          onClick={() => handleMenuAction(() => goTo(`/profile/${user.uid}`))}
        >
          <span className="topbar-dropdown-item-icon">👤</span>
          <span>
            <strong>Mon profil</strong>
            <span className="topbar-dropdown-item-description">
              Voir mon espace public
            </span>
          </span>
        </button>
        <div className="topbar-dropdown-section">
          <div className="topbar-dropdown-section-title">Spots</div>
          <button
            type="button"
            className="topbar-dropdown-item"
            onClick={() =>
              handleMenuAction(() => dispatchSpotListView("done"))
            }
          >
            <span className="topbar-dropdown-item-icon">✅</span>
            <span>
              <strong>MES SPOTS</strong>
              <span className="topbar-dropdown-item-description">
                Faits &amp; Favoris
              </span>
            </span>
          </button>
        </div>
        <button
          type="button"
          className="topbar-dropdown-item"
          onClick={() => handleMenuAction(() => goTo("/dm"))}
        >
          <span className="topbar-dropdown-item-icon">💬</span>
          <span>Messages</span>
        </button>
        <div className="topbar-dropdown-divider" />
        <button
          type="button"
          className="topbar-dropdown-item"
          onClick={() => handleMenuAction(() => goTo("/settings"))}
        >
          <span className="topbar-dropdown-item-icon">⚙️</span>
          <span>
            <strong>Paramètres</strong>
            <span className="topbar-dropdown-item-description">
              Compte & sécurité
            </span>
          </span>
        </button>
        {isAdmin && (
          <button
            type="button"
            className="topbar-dropdown-item"
            onClick={() =>
              handleMenuAction(() => {
                if (import.meta.env.DEV) {
                  console.info('[UQ][ADMIN_NAV] click -> target="/admin"');
                }
                goTo("/admin");
              })
            }
          >
            <span className="topbar-dropdown-item-icon">🛠️</span>
            <span>
              <strong>ADMIN PANEL</strong>
              <span className="topbar-dropdown-item-description">
                Back-office
              </span>
            </span>
          </button>
        )}
        <div className="topbar-dropdown-divider" />
        <button
          type="button"
          className="topbar-dropdown-item topbar-dropdown-item--danger"
          onClick={() => handleMenuAction(handleLogout)}
        >
          <span className="topbar-dropdown-item-icon">🚪</span>
          <span>Déconnexion</span>
        </button>
      </div>
      {import.meta.env.DEV && (
        <div
          className="topbar-dropdown-admin-flag"
          style={{
            padding: "0 16px 12px",
            fontSize: 10,
            color: "rgba(0,0,0,0.45)",
          }}
        >
          ADMIN={String(isAdmin)}
        </div>
      )}
    </div>,
    document.body
  );
}
const areUserMenuRootPropsEqual = (
  prev: UserMenuRootProps,
  next: UserMenuRootProps
) => {
  const prevUser = prev.user;
  const nextUser = next.user;
  const usersEqual =
    prevUser === nextUser ||
    (!!prevUser &&
      !!nextUser &&
      prevUser.uid === nextUser.uid &&
      prevUser.displayName === nextUser.displayName &&
      prevUser.email === nextUser.email &&
      prevUser.photoURL === nextUser.photoURL);
  return (
    usersEqual &&
    prev.isPro === next.isPro &&
    prev.isAdmin === next.isAdmin &&
    prev.isAccountMenuOpen === next.isAccountMenuOpen &&
    prev.requireAuth === next.requireAuth &&
    prev.goTo === next.goTo &&
    prev.onToggleAccountMenu === next.onToggleAccountMenu &&
    prev.onCloseAccountMenu === next.onCloseAccountMenu
  );
};

const UserMenuRoot = memo(UserMenuRootBase, areUserMenuRootPropsEqual);

export default function App() {
  const layoutWatchEnabled =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_E2E_HOOKS === "1";
  const layoutShiftDebugEnabled =
    Boolean(import.meta.env.DEV) &&
    import.meta.env.VITE_UQ_DEBUG_LAYOUT_SHIFT === "true";
  const { config: adminUiConfigFromHook, loading: adminUiLoading } =
    useAdminUiConfigRuntime();
  const adminUiConfig = adminUiConfigFromHook ?? DEFAULT_ADMIN_UI_CONFIG;
  const { proLoading, proSource, proStatus } = useProStatus();
  const runtimeNodeEnv =
    (globalThis as AppGlobalWithProcessEnv).process?.env?.NODE_ENV;
  const showProDebugBadge =
    Boolean(import.meta.env.DEV) ||
    (runtimeNodeEnv !== undefined && runtimeNodeEnv !== "production");

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--marker-urbex", `url(${markerUrbexIcon})`);
    root.style.setProperty("--marker-photography", `url(${markerPhotographyIcon})`);
    root.style.setProperty("--marker-abandoned", `url(${markerAbandonedIcon})`);
    root.style.setProperty("--marker-historical", `url(${markerHistoricalIcon})`);
    root.style.setProperty("--marker-nature", `url(${markerNatureIcon})`);
    root.style.setProperty("--marker-other", `url(${markerOtherIcon})`);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const ui = adminUiConfig.ui;
    const fallbackTopbar =
      ui.topbarHeight ?? ui.headerHeight ?? DEFAULT_ADMIN_UI_CONFIG.ui.topbarHeight;
    const topbarHeight = `${fallbackTopbar}px`;
    root.style.setProperty("--topbar-h", topbarHeight);
    root.style.setProperty("--uq-topbar-h", topbarHeight);
    root.style.setProperty("--uq-header-h", topbarHeight);
    root.style.setProperty("--uq-probar-maxw", `${ui.proBarMaxWidth}px`);
    root.style.setProperty("--uq-overlay-w", `${ui.overlayPanelWidth}px`);
    root.style.setProperty("--uq-radius", `${ui.overlayRadius}px`);
    root.style.setProperty("--uq-glass-blur", `${ui.glassBlur}px`);
    root.style.setProperty("--uq-glow", `${ui.glowIntensity}`);
  }, [adminUiConfig.ui]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const themeClasses = ADMIN_UI_THEME_PRESETS.map(
      (preset) => `theme-${preset}`
    );
    themeClasses.forEach((cls) => body.classList.remove(cls));
    body.classList.add(`theme-${adminUiConfig.theme.preset}`);
  }, [adminUiConfig.theme.preset]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const dataset = document.body.dataset;
    const mapUi = adminUiConfig.mapUi ?? DEFAULT_ADMIN_UI_CONFIG.mapUi;
    dataset.uqMapControls = mapUi.showMapboxControls ? "on" : "off";
    dataset.uqMapSearch = mapUi.showSearchBar ? "on" : "off";
    dataset.uqMapProbar = mapUi.showProBar ? "on" : "off";
    dataset.uqMapLeft = mapUi.showLeftOverlay ? "on" : "off";
    dataset.uqMapRight = mapUi.showRightOverlay ? "on" : "off";
    if (import.meta.env.DEV) {
      console.log("[UQ][CFG] applied datasets", { ...document.body.dataset });
      const docStyle = getComputedStyle(document.documentElement);
      console.log("[UQ][CFG] css vars", {
        topbar: docStyle.getPropertyValue("--uq-topbar-h").trim(),
        probar: docStyle.getPropertyValue("--uq-probar-maxw").trim(),
        overlayW: docStyle.getPropertyValue("--uq-overlay-w").trim(),
      });
    }
  }, [adminUiConfig.mapUi]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const dataset = document.body.dataset;
    const overlay = adminUiConfig.overlay ?? DEFAULT_ADMIN_UI_CONFIG.overlay;
    const normalizePos = (value: string) => value.split("-")[0];
    dataset.uqOvlLeft = overlay.left.enabled ? "on" : "off";
    dataset.uqOvlLeftPos = normalizePos(overlay.left.position);
    dataset.uqOvlLeftDev = overlay.left.device ?? "all";
    dataset.uqOvlRight = overlay.right.enabled ? "on" : "off";
    dataset.uqOvlRightPos = normalizePos(overlay.right.position);
    dataset.uqOvlRightDev = overlay.right.device ?? "all";
  }, [adminUiConfig.overlay]);
  useEffect(() => {
    if (
      !layoutWatchEnabled ||
      typeof window === "undefined" ||
      !layoutShiftDebugEnabled
    ) {
      return;
    }
    const ResizeObserverClass = (window as Window & {
      ResizeObserver?: typeof ResizeObserver;
    }).ResizeObserver;
    if (!ResizeObserverClass) return;
    type LayoutTarget = { key: string; selector: string };
    const targets: LayoutTarget[] = [
      { key: "topbar", selector: ".topbar" },
      { key: "content", selector: ".content" },
      { key: "map", selector: ".map-root" },
    ];
    const prevRects = new Map<string, DOMRect>();
    const observed = new Set<Element>();
    const threshold = 0.5;
    const rectToData = (rect?: DOMRect | null) =>
      rect
        ? {
            top: Number(rect.top.toFixed(2)),
            left: Number(rect.left.toFixed(2)),
            width: Number(rect.width.toFixed(2)),
            height: Number(rect.height.toFixed(2)),
          }
        : null;
    const takeSnapshot = (shiftKey: string) => {
      const mapRoot = document.querySelector(".map-root");
      const canvas = mapRoot?.querySelector(".mapboxgl-canvas");
      const topbar = document.querySelector(".topbar");
      const content = document.querySelector(".content");
      const docStyle = window.getComputedStyle(document.documentElement);
      const bodyStyle = window.getComputedStyle(document.body);
      const mapRootStyleHeight = mapRoot
        ? window.getComputedStyle(mapRoot).height
        : null;
      const mapInstance = (window as any).__UQ_MAP_INSTANCE__;
      const mapSnapshot =
        mapInstance && typeof mapInstance.getCenter === "function"
          ? {
              center: mapInstance.getCenter().toArray(),
              zoom: mapInstance.getZoom(),
              canvas: {
                width: mapInstance.getCanvas().width,
                height: mapInstance.getCanvas().height,
              },
            }
          : null;
      console.info("[UQ][REPRO_SNAPSHOT]", {
        key: shiftKey,
        mapRootRect: rectToData(mapRoot?.getBoundingClientRect() ?? null),
        canvasRect: rectToData(canvas?.getBoundingClientRect() ?? null),
        topbarRect: rectToData(topbar?.getBoundingClientRect() ?? null),
        contentRect: rectToData(content?.getBoundingClientRect() ?? null),
        windowInnerHeight: window.innerHeight,
        visualViewportHeight: window.visualViewport?.height ?? null,
        mapRootStyleHeight,
        docOverflowY: docStyle.overflowY,
        bodyOverflowY: bodyStyle.overflowY,
        mapSnapshot,
      });
    };
    const typingInRichEditor = () => {
      const active = document.activeElement as HTMLElement | null;
      return Boolean(active?.closest(".ql-editor"));
    };

    const layoutShiftLogCooldown = 800;
    const logCooldowns = new Map<string, number>();

    const checkTargets = () => {
      if (document.hidden) return;
      targets.forEach(({ key, selector }) => {
        const el = document.querySelector(selector);
        if (!el) {
          prevRects.delete(key);
          return;
        }
        if (!observed.has(el)) {
          observed.add(el);
          observer.observe(el);
        }
        const nextRect = el.getBoundingClientRect();
        const prevRect = prevRects.get(key);
        if (prevRect) {
          const delta = Math.max(
            Math.abs(prevRect.top - nextRect.top),
            Math.abs(prevRect.left - nextRect.left),
            Math.abs(prevRect.height - nextRect.height),
            Math.abs(prevRect.width - nextRect.width)
          );
          if (delta > threshold) {
            if (key === "content" && typingInRichEditor()) return;
            const now = performance.now();
            const lastLog = logCooldowns.get(key) ?? 0;
            if (now - lastLog < layoutShiftLogCooldown) return;
            logCooldowns.set(key, now);
            console.debug("[UQ][LAYOUT_SHIFT]", {
              key,
              before: rectToData(prevRect),
              after: rectToData(nextRect),
            });
            console.trace("[UQ][LAYOUT_SHIFT_TRACE]");
            if (key === "map" || key === "topbar") {
              takeSnapshot(key);
            }
          }
        }
        prevRects.set(key, nextRect);
      });
    };
    let lastRun = 0;
    let scheduledId: number | null = null;
    const scheduleCheck = () => {
      if (document.hidden) return;
      const now = performance.now();
      const execute = () => {
        lastRun = performance.now();
        checkTargets();
      };
      if (now - lastRun >= 200) {
        execute();
        return;
      }
      if (scheduledId) return;
      scheduledId = window.setTimeout(() => {
        scheduledId = null;
        execute();
      }, 200);
    };
    const observer = new ResizeObserverClass(() => {
      if (document.hidden) return;
      window.requestAnimationFrame(scheduleCheck);
    });
    scheduleCheck();
    const onResize = () => scheduleCheck();
    window.addEventListener("resize", onResize);
    const interval = window.setInterval(scheduleCheck, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      if (scheduledId) {
        window.clearTimeout(scheduledId);
      }
    };
  }, [layoutWatchEnabled, layoutShiftDebugEnabled]);

  useEffect(() => {
    if (!layoutWatchEnabled || typeof window === "undefined") return;
    const originalScrollTo = window.scrollTo;
    const patchedScrollTo = (...args: any[]) => {
      console.warn("[UQ][SCROLL] scrollTo", args);
      console.trace("[UQ][SCROLL_TRACE]");
      return originalScrollTo(...(args as any));
    };
    window.scrollTo = patchedScrollTo;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const patchedScrollIntoView = function (this: Element, ...args: any[]) {
      console.warn("[UQ][SCROLL] scrollIntoView", { element: this });
      console.trace("[UQ][SCROLL_TRACE]");
      return originalScrollIntoView.apply(this, args as any);
    };
    Element.prototype.scrollIntoView = patchedScrollIntoView;
    return () => {
      window.scrollTo = originalScrollTo;
      Element.prototype.scrollIntoView = originalScrollIntoView;
    };
  }, [layoutWatchEnabled]);
  useSyncShopCustomer();
  const { user, isPro, isAdmin } = useCurrentUserRole();
  const authUI = useAuthUI();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [missionsPanelOpen, setMissionsPanelOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountToggleTsRef = useRef(0);
  const [notificationsPanelVisible, setNotificationsPanelVisible] = useState(false);
  const [missionsPanelVisible, setMissionsPanelVisible] = useState(false);
  const notificationsButtonRef = useRef<HTMLButtonElement>(null);
  const missionsButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);
  const missionsPanelRef = useRef<HTMLDivElement>(null);
  const [notificationsPanelPosition, setNotificationsPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const [missionsPanelPosition, setMissionsPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const logNotificationStorm = useMemo(
    () =>
      makeStormLogger<NotificationItem[]>("notificationItems", (items) => ({
        len: items?.length ?? 0,
      })),
    []
  );
  const logMissionsStorm = useMemo(
    () =>
      makeStormLogger<MissionQuest[]>("missions", (items) => ({
        len: items?.length ?? 0,
      })),
    []
  );
  const resetBodyLocks = useCallback(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = "";
    document.body.style.pointerEvents = "auto";
    document.body.classList.remove("modal-open", "overflow-hidden");
  }, []);
  const closeAccountMenu = useCallback(() => setIsAccountMenuOpen(false), [
    setIsAccountMenuOpen,
  ]);

  const handleToggleAccountMenu = useCallback(() => {
    const now = Date.now();
    if (now - accountToggleTsRef.current < 200) return;
    accountToggleTsRef.current = now;
    setIsAccountMenuOpen((open) => {
      const next = !open;
      if (next) {
        setNotificationsPanelOpen(false);
        setMissionsPanelOpen(false);
      }
      return next;
    });
  }, []);

  const [route, setRoute] = useState<AppRoute>(() =>
    resolveRouteFromLocation(window.location.pathname, window.location.search)
  );
  const logRouteStorm = useMemo(
    () =>
      makeStormLogger<AppRoute>("route", (next) => ({
        kind: next.kind,
      })),
    []
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const className = "route-map";
    const { body } = document;
    if (route.kind === "map") {
      body.classList.add(className);
    } else {
      body.classList.remove(className);
    }
    return () => {
      body.classList.remove(className);
    };
  }, [route.kind]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith("/games")) return;
    const canonicalPath = GAME_CANONICAL_PATH;
    const search = window.location.search;
    window.history.replaceState({}, "", `${canonicalPath}${search}`);
    const next = resolveRouteFromLocation(canonicalPath, search);
    logRouteStorm(next);
    setRoute(next);
  }, [logRouteStorm]);

  const { authState, closeAuthModal, requireAuth } = authUI;
  const { open: authOpen, mode: authMode, reason: authReason } = authState;
  const isGuest = !user;
  const memoizedUser = useMemo<UserMenuRootUser | null>(
    () =>
      user
        ? {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          }
        : null,
    [user]
  );
  const requireAuthRef = useRef<UserMenuRootProps["requireAuth"]>(requireAuth);
  useEffect(() => {
    requireAuthRef.current = requireAuth;
  }, [requireAuth]);
  const stableRequireAuth = useCallback(
    (options?: Parameters<UserMenuRootProps["requireAuth"]>[0]) =>
      requireAuthRef.current(options),
    []
  );

  useEffect(() => {
    if (!user?.uid) {
      setNotificationItems([]);
      setNotificationsPanelOpen(false);
      setNotificationsPanelVisible(false);
      return undefined;
    }
    if (import.meta.env.DEV) {
      setNotificationItems(createNotificationSeed());
    }
    const unsubscribe = subscribeToUserNotifications(user.uid, (items) => {
      logNotificationStorm(items);
      setNotificationItems(items);
    });
    return () => unsubscribe();
  }, [user?.uid, logNotificationStorm]);

  const [hasLegalConsent, setHasLegalConsent] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LEGAL_CONSENT_KEY) === "accepted";
    } catch {
      return false;
    }
  });
  const [nightVisionActive, setNightVisionActive] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [missions, setMissions] = useState<MissionQuest[]>(() =>
    createMissionSeed()
  );
  const computedUnreadNotifications = getUnreadCount(notificationItems);
  const unreadNotifications = user ? computedUnreadNotifications : 0;
  const unreadBadgeLabel = unreadNotifications > 9 ? "9+" : String(unreadNotifications);
  const allMissionsComplete = areMissionsComplete(missions);
  useEffect(() => {
    function syncRouteFromLocation() {
      const next = resolveRouteFromLocation(
        window.location.pathname,
        window.location.search
      );
      logRouteStorm(next);
      setRoute(next);
    }

    function handleNav(e: Event) {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (!detail?.path) return;
      window.history.pushState({}, "", detail.path);
      syncRouteFromLocation();
    }

    window.addEventListener("popstate", syncRouteFromLocation);
    window.addEventListener("urbex-nav", handleNav);
    return () => {
      window.removeEventListener("popstate", syncRouteFromLocation);
      window.removeEventListener("urbex-nav", handleNav);
    };
  }, [logRouteStorm]);

  function handleBackToMap() {
    window.history.pushState({}, "", "/");
    const next = { kind: "map" } as AppRoute;
    logRouteStorm(next);
    setRoute(next);
  }

  const goTo = useCallback(
    (path: string) => {
      const url = new URL(path, window.location.origin);
      window.history.pushState({}, "", path);
      const next = resolveRouteFromLocation(url.pathname, url.search);
      logRouteStorm(next);
      setRoute(next);
    },
    [logRouteStorm]
  );

  const handleHeaderProClick = useCallback(
    async (event?: ReactMouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      console.info("[analytics] pro_cta_click", { location: "header" });
      if (!user) {
        await requireAuth({
          mode: "login",
          reason: "Connecte-toi pour débloquer PRO",
          redirectTo: "/pro",
        });
        return;
      }
      if (!isPro) {
        goTo("/pro");
      }
    },
    [goTo, isPro, requireAuth, user]
  );

  const handleDmClick = useCallback(async () => {
    if (!isGuest) {
      goTo("/dm");
      return;
    }
    const ok = await requireAuth({
      mode: "login",
      reason: "Connecte-toi pour accéder aux messages",
      redirectTo: "/dm",
    });
    if (ok) {
      goTo("/dm");
    }
  }, [goTo, isGuest, requireAuth]);

  const handleNotificationsToggle = useCallback(
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!user) {
        const ok = await requireAuth({
          mode: "login",
          reason: "Connecte-toi pour accéder à tes notifications",
        });
        if (ok) {
          setNotificationsPanelOpen(true);
          setMissionsPanelOpen(false);
        }
        return;
      }
      setMissionsPanelOpen(false);
      setNotificationsPanelOpen((open) => {
        const next = !open;
        if (next) {
          setNotificationsPanelVisible(true);
        }
        return next;
      });
    },
    [requireAuth, user]
  );

  const handleMissionsToggle = useCallback(
    async (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!user) {
        const ok = await requireAuth({
          mode: "login",
          reason: "Connecte-toi pour récupérer tes missions quotidiennes",
        });
        if (ok) {
          setMissionsPanelOpen(true);
          setNotificationsPanelOpen(false);
        }
        return;
      }
      setNotificationsPanelOpen(false);
      setMissionsPanelOpen((open) => {
        const next = !open;
        if (next) {
          setMissionsPanelVisible(true);
        }
        return next;
      });
    },
    [requireAuth, user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    setNotificationItems((items) => markAllAsRead(items));
    if (!user?.uid) return;
    try {
      await markAllUserNotificationsRead(user.uid);
    } catch (err) {
      console.error("Failed to mark notifications read", err);
    }
  }, [user?.uid]);

  const handleNotificationRead = useCallback(
    async (notificationId: string) => {
      setNotificationItems((items) =>
        markNotificationAsRead(items, notificationId)
      );
      if (!user?.uid) return;
      try {
        await markUserNotificationRead(user.uid, notificationId);
      } catch (err) {
        console.error("Failed to mark notification read", err);
      }
    },
    [user?.uid]
  );

  useEffect(() => {
    if (!user) {
      setNotificationsPanelOpen(false);
      setMissionsPanelOpen(false);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const listener = (event: Event) => {
      const target = event.target as Node;
      if (
        notificationsPanelOpen &&
        !notificationsPanelRef.current?.contains(target) &&
        !notificationsButtonRef.current?.contains(target)
      ) {
        setNotificationsPanelOpen(false);
      }
      if (
        missionsPanelOpen &&
        !missionsPanelRef.current?.contains(target) &&
        !missionsButtonRef.current?.contains(target)
      ) {
        setMissionsPanelOpen(false);
      }
    };
    window.addEventListener("click", listener);
    return () => window.removeEventListener("click", listener);
  }, [missionsPanelOpen, notificationsPanelOpen]);

  useEffect(() => {
    if (!notificationsPanelOpen && !missionsPanelOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsPanelOpen(false);
        setMissionsPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [missionsPanelOpen, notificationsPanelOpen]);

  useEffect(() => {
    if (notificationsPanelOpen) {
      setNotificationsPanelVisible(true);
      return;
    }
    if (!notificationsPanelVisible) return;
    if (typeof window === "undefined") {
      setNotificationsPanelVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setNotificationsPanelVisible(false), 200);
    return () => window.clearTimeout(timer);
  }, [notificationsPanelOpen, notificationsPanelVisible]);

  useEffect(() => {
    if (missionsPanelOpen) {
      setMissionsPanelVisible(true);
      return;
    }
    if (!missionsPanelVisible) return;
    if (typeof window === "undefined") {
      setMissionsPanelVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setMissionsPanelVisible(false), 200);
    return () => window.clearTimeout(timer);
  }, [missionsPanelOpen, missionsPanelVisible]);

  useEffect(() => {
    if (!notificationsPanelOpen || !notificationsPanelRef.current) return;
    const focusTarget =
      notificationsPanelRef.current.querySelector<HTMLElement>(
        "button, [tabindex]"
      ) ?? notificationsPanelRef.current;
    focusTarget.focus();
  }, [notificationsPanelOpen]);

  useEffect(() => {
    if (!missionsPanelOpen || !missionsPanelRef.current) return;
    const focusTarget =
      missionsPanelRef.current.querySelector<HTMLElement>(
        "button, [tabindex]"
      ) ?? missionsPanelRef.current;
    focusTarget.focus();
  }, [missionsPanelOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ticker = window.setInterval(() => {
      setMissions((previous) => {
        const next = advanceMissionProgress(previous);
        logMissionsStorm(next);
        return next;
      });
    }, 7000);
    return () => window.clearInterval(ticker);
  }, [logMissionsStorm]);

  useLayoutEffect(() => {
    if (!notificationsPanelOpen || typeof window === "undefined") {
      setNotificationsPanelPosition(null);
      return;
    }
    if (!notificationsButtonRef.current) return;
    const rect = notificationsButtonRef.current.getBoundingClientRect();
    const panelWidth = 340;
    const top = rect.bottom + window.scrollY + 8;
    const left = Math.max(
      12,
      Math.min(
        rect.left + window.scrollX,
        Math.max(12, window.innerWidth - panelWidth - 12)
      )
    );
    setNotificationsPanelPosition({ top, left });
  }, [notificationsPanelOpen]);

  useLayoutEffect(() => {
    if (!missionsPanelOpen || typeof window === "undefined") {
      setMissionsPanelPosition(null);
      return;
    }
    if (!missionsButtonRef.current) return;
    const rect = missionsButtonRef.current.getBoundingClientRect();
    const panelWidth = 340;
    const top = rect.bottom + window.scrollY + 8;
    const left = Math.max(
      12,
      Math.min(
        rect.left + window.scrollX,
        Math.max(12, window.innerWidth - panelWidth - 12)
      )
    );
    setMissionsPanelPosition({ top, left });
  }, [missionsPanelOpen]);
  const maintenanceEnabled =
    !adminUiLoading && (adminUiConfig.maintenance.enabled ?? false);
  const maintenanceMessage =
    adminUiConfig.maintenance.message?.trim() ||
    "Maintenance en cours, merci de patienter.";
  const showMaintenanceOverlay =
    maintenanceEnabled &&
    route.kind !== "admin" &&
    route.kind !== "editHistory";
  const navActive = route.kind;

  const notificationsPanelPortal =
    notificationsPanelVisible &&
    notificationsPanelPosition &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={notificationsPanelRef}
            id="notifications-panel"
            className={`topbar-panel topbar-panel--notifications ${
              notificationsPanelOpen ? "is-open" : "is-closed"
            }`}
            role="dialog"
            aria-label="Notifications"
            aria-modal="false"
            tabIndex={-1}
            style={{
              position: "absolute",
              top: notificationsPanelPosition.top,
              left: notificationsPanelPosition.left,
              width: 340,
            }}
          >
            <div className="topbar-panel-header">
              <div>
                <strong>Notifications</strong>
                <span>
                  {unreadNotifications > 0
                    ? `${unreadNotifications} non-lu${unreadNotifications > 1 ? "s" : ""}`
                    : "Tout est lu"}
                </span>
              </div>
              {unreadNotifications > 0 && (
                <button
                  type="button"
                  className="topbar-panel-action"
                  onClick={markAllNotificationsRead}
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <div className="topbar-panel-list">
              {notificationItems.length === 0 ? (
                <div className="topbar-panel-empty">Aucune notification</div>
              ) : (
                notificationItems.map((item) => {
                  const label = notificationTypeLabels[item.type] ?? "Activité";
                  const message = getNotificationMessage(item);
                  const description =
                    item.message ||
                    item.actorSnapshot?.username ||
                    item.actorSnapshot?.displayName ||
                    "Voir le profil";
                  const relativeTime = formatRelativeTime(item.createdAt);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`topbar-panel-item ${item.isRead ? "is-read" : ""}`}
                      onClick={() => handleNotificationRead(item.id)}
                    >
                      <div className="topbar-panel-item-title-row">
                        <span className="topbar-panel-item-title">{message}</span>
                        <span className="topbar-panel-item-time">{relativeTime}</span>
                      </div>
                      <p className="topbar-panel-item-description">{description}</p>
                      <div className="topbar-panel-item-footer">
                        <span className="topbar-panel-item-badge">{label}</span>
                        {!item.isRead && (
                          <span className="topbar-panel-item-dot" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  const missionsPanelPortal =
    missionsPanelVisible &&
    missionsPanelPosition &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={missionsPanelRef}
            id="missions-panel"
            className={`topbar-panel topbar-panel--missions ${
              missionsPanelOpen ? "is-open" : "is-closed"
            }`}
            role="dialog"
            aria-label="Missions quotidiennes"
            aria-modal="false"
            tabIndex={-1}
            style={{
              position: "absolute",
              top: missionsPanelPosition.top,
              left: missionsPanelPosition.left,
              width: 340,
            }}
          >
            <div className="topbar-panel-header">
              <div>
                <strong>Missions quotidiennes</strong>
                <span>Daily quests</span>
              </div>
            </div>
            <div className="topbar-panel-list">
              {missions.length === 0 || allMissionsComplete ? (
                <div className="topbar-panel-empty">Nouvelles missions bientôt</div>
              ) : (
                missions.map((mission) => {
                  const progressPct = Math.min(
                    100,
                    Math.round((mission.progress / mission.target) * 100 || 0)
                  );
                  return (
                    <div key={mission.id} className="mission-card">
                      <div className="mission-card-top-row">
                        <span className="mission-card-title">{mission.title}</span>
                        <span className="mission-card-xp">+{mission.xp} XP</span>
                      </div>
                      <p className="mission-card-description">{mission.description}</p>
                      <div className="mission-progress">
                        <div
                          className="mission-progress-bar"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="mission-progress-meta">
                        <span>
                          {Math.min(mission.progress, mission.target)}/{mission.target}
                        </span>
                        <span>
                          {mission.progress >= mission.target
                            ? "Complétée"
                            : `${mission.target - mission.progress} à faire`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  const handleReset = useCallback(() => {
    setIsCartOpen(false);
    closeAuthModal();
    resetBodyLocks();
  }, [closeAuthModal, resetBodyLocks]);

  useEffect(() => {
    window.addEventListener("urbex_reset_ui", handleReset);
    return () => window.removeEventListener("urbex_reset_ui", handleReset);
  }, [handleReset]);

  const shouldShowLegalConsent = hasLegalConsent !== true;

  const closeAuth = useCallback(() => {
    closeAuthModal();
    resetBodyLocks();
  }, [closeAuthModal, resetBodyLocks]);

  useEffect(() => {
    if (!authOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      resetBodyLocks();
    };
  }, [authOpen, resetBodyLocks]);

  function handleAcceptLegalConsent() {
    try {
      localStorage.setItem(LEGAL_CONSENT_KEY, "accepted");
    } catch {
      // ignore storage issues but still unlock UI
    }
    setHasLegalConsent(true);
  }

  return (
    <div className={`app-shell ${shouldShowLegalConsent ? "is-gated" : ""}`}>
      <ReloadGuardBanner />
      <CrashBanner />
      {proLoading && user && (
        <div className="pro-status-loading" role="status" aria-live="polite">
          Vérification du statut PRO…
        </div>
      )}
      {showMaintenanceOverlay && (
        <div className="maintenance-overlay" role="status" aria-live="polite">
          <div className="maintenance-overlay__card">
            <strong>Maintenance</strong>
            <p>{maintenanceMessage}</p>
          </div>
        </div>
      )}
      {shouldShowLegalConsent && (
        <LegalConsentModal open onAccept={handleAcceptLegalConsent} />
      )}
      <header className="topbar header-gradient">
        <div className="topbar-left">
          <div className="topbar-logo">
            <span className="topbar-logo-mark">👑</span>
            <span className="topbar-logo-text">URBEXQUEENS MAP</span>
          </div>
          <nav className="topbar-nav">
            <button
              type="button"
              className={`nav-pill ${navActive === "map" ? "is-active" : ""}`}
              onClick={() => goTo("/")}
            >
              Carte
            </button>
            <button
              type="button"
              className={`nav-pill ${navActive === "feed" ? "is-active" : ""}`}
              onClick={() => goTo("/feed")}
            >
              Urbex Feed
            </button>
            <button
              type="button"
              className={`nav-pill ${navActive === "dm" ? "is-active" : ""}`}
              onClick={handleDmClick}
              aria-label="Messages privés"
              aria-disabled={isGuest}
            >
              Messages
            </button>
            <button
              type="button"
              className={`nav-pill ${navActive === "shop" ? "is-active" : ""}`}
              onClick={() => goTo("/shop")}
            >
              Boutique
            </button>
            <button
              type="button"
              className={`nav-pill ${navActive === "game" ? "is-active" : ""}`}
              onClick={() => (isPro ? goTo(GAME_CANONICAL_PATH) : goTo("/pro"))}
              aria-disabled={!isPro}
            >
              Espace Jeux
            </button>
            <button
              type="button"
              className={`nav-pill ${nightVisionActive ? "is-active" : ""}`}
              onClick={() => {
                if (!isPro) {
                  goTo("/pro");
                  return;
                }
                setNightVisionActive((prev) => !prev);
              }}
              aria-disabled={!isPro}
            >
              Night Vision
            </button>
          </nav>
        </div>

        <div className="topbar-right">
          <button
            type="button"
            ref={missionsButtonRef}
            className="topbar-icon"
            aria-label="Missions quotidiennes"
            aria-expanded={missionsPanelOpen}
            aria-controls="missions-panel"
            onClick={handleMissionsToggle}
          >
            🏁
          </button>
          <button
            type="button"
            ref={notificationsButtonRef}
            className="topbar-icon"
            aria-label="Notifications"
            aria-expanded={notificationsPanelOpen}
            aria-controls="notifications-panel"
            onClick={handleNotificationsToggle}
          >
            🔔
            {user && unreadNotifications > 0 && (
              <span
                className="topbar-icon-badge"
                aria-label={`${unreadNotifications} notifications non lues`}
              >
                {unreadBadgeLabel}
              </span>
            )}
          </button>
          {showProDebugBadge && (
            <div className="topbar-dev-pro-badge">
              PRO: {isPro ? "true" : "false"} | loading:{" "}
              {proLoading ? "true" : "false"} | source: {proSource} | proStatus:{" "}
              {proStatus}
            </div>
          )}
          {isPro ? (
            <span className="topbar-pro-pill topbar-pro-pill--active">PRO ✅</span>
          ) : (
            <button
              type="button"
              className="topbar-auth-pill topbar-auth-pill--cta topbar-pro-pill"
              onClick={handleHeaderProClick}
            >
              Débloquer PRO
            </button>
          )}
          <UserMenuRoot
            user={memoizedUser}
            isPro={isPro}
            isAdmin={isAdmin}
            requireAuth={stableRequireAuth}
            goTo={goTo}
            isAccountMenuOpen={isAccountMenuOpen}
            onToggleAccountMenu={handleToggleAccountMenu}
            onCloseAccountMenu={closeAccountMenu}
          />
        </div>
      </header>

      {notificationsPanelPortal}
      {missionsPanelPortal}

      <main className="content">
        <Suspense fallback={<div style={{ padding: 20 }}>Chargement…</div>}>
          {route.kind === "spot" && (
            <SpotPage spotId={route.id} onBack={handleBackToMap} />
          )}
          {route.kind === "profile" && (
            <ProfilePage
              uid={route.id}
              view={route.view}
              onBack={handleBackToMap}
            />
          )}
          {route.kind === "profileHandle" && (
            <ProfileHandlePage
              handle={route.handle}
              view={route.view}
              onBack={handleBackToMap}
            />
          )}
          {route.kind === "map" && (
            <MapRoute nightVisionActive={nightVisionActive} />
          )}
          {route.kind === "feed" && <SocialFeed />}
          {route.kind === "dm" && <DMPage partnerId={route.with} />}
          {route.kind === "shop" && <ShopPage />}
          {route.kind === "game" && <DarkEntryGame />}
          {route.kind === "payment" && <PaymentSecurity />}
          {route.kind === "paymentPolicy" && <PaymentPolicy />}
          {route.kind === "legalTerms" && <LegalClause />}
          {route.kind === "legal" && <LegalDisclaimer />}
          {route.kind === "settings" && <SettingsPage onClose={handleBackToMap} />}
          {route.kind === "proReturn" && (
            <ProReturnPage status={route.status} sessionId={route.sessionId} />
          )}
          {route.kind === "pro" && <ProLandingPage />}
          {route.kind === "proReturn" && (
            <ProReturnPage
              status={route.status}
              sessionId={route.sessionId}
            />
          )}
          {route.kind === "admin" && (
            <AdminRoute>
              <AdminDashboard
                initialPlaceId={route.initialPlaceId ?? null}
                page={route.page}
                selectedOrderId={route.selectedOrderId ?? null}
              />
            </AdminRoute>
          )}
          {route.kind === "editHistory" && (
            <AdminRoute>
              <EditHistoryView
                spotId={route.id}
                onBack={() => goTo(`/spot/${route.id}`)}
              />
            </AdminRoute>
          )}
        </Suspense>
      </main>

      <ErrorBoundary onReset={closeAuth}>
        <AuthModal
          open={authOpen}
          mode={authMode}
          onClose={closeAuth}
          reason={authReason}
        />
      </ErrorBoundary>

      <footer className="app-footer">
        <span>URBEXQUEENS — URBAN EXPLORATION MAP</span>
      </footer>
      <ErrorBoundary onReset={() => setIsCartOpen(false)}>
        <CartDrawer open={isCartOpen} onClose={() => setIsCartOpen(false)} />
      </ErrorBoundary>
    </div>
  );
}
