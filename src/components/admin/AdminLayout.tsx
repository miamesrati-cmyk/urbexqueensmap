import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { AdminUiConfig } from "../../hooks/useAdminUiConfig";

type NavItem = {
  key: AdminPageKey;
  label: string;
  path: string;
  icon?: string;
  group: "overview" | "explore" | "shop" | "analytics" | "config";
};

export type AdminPageKey =
  | "dashboard"
  | "shop"
  | "places"
  | "spotSubmissions"
  | "histories"
  | "users"
  | "products"
  | "orders"
  | "customers"
  | "stats"
  | "revenue"
  | "activity"
  | "mapUI"
  | "themes"
  | "uiConfig"
  | "overlays"
  | "settings"
  | "integrations";

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Tableau de bord admin", path: "/admin", icon: "📋", group: "overview" },
  { key: "places", label: "Lieux", path: "/admin/places", icon: "🗺", group: "explore" },
  { key: "spotSubmissions", label: "Spots proposés", path: "/admin/spots-proposes", icon: "📬", group: "explore" },
  { key: "histories", label: "Histoires des lieux", path: "/admin/place-history", icon: "📜", group: "explore" },
  { key: "users", label: "Utilisateurs", path: "/admin/users", icon: "👥", group: "explore" },
  { key: "shop", label: "Tableau de bord Boutique", path: "/admin/shop", icon: "🛍️", group: "shop" },
  { key: "products", label: "Produits", path: "/admin/shop/products", icon: "🧢", group: "shop" },
  { key: "orders", label: "Commandes", path: "/admin/shop/orders", icon: "📦", group: "shop" },
  { key: "customers", label: "Clients", path: "/admin/shop/customers", icon: "🤝", group: "shop" },
  { key: "stats", label: "Statistiques", path: "/admin/analytics", icon: "📈", group: "analytics" },
  { key: "revenue", label: "Revenus PRO", path: "/admin/revenue", icon: "💎", group: "analytics" },
  { key: "activity", label: "Activité récente", path: "/admin/activity", icon: "⚡", group: "analytics" },
  { key: "settings", label: "Paramètres admin", path: "/admin/settings", icon: "⚙️", group: "config" },
  { key: "mapUI", label: "Map UI", path: "/admin/map-ui", icon: "🧭", group: "config" },
  { key: "themes", label: "Thèmes", path: "/admin/themes", icon: "🎨", group: "config" },
  { key: "uiConfig", label: "Config UI", path: "/admin/ui-config", icon: "🧱", group: "config" },
  { key: "overlays", label: "Overlay Studio", path: "/admin/overlays", icon: "🧩", group: "config" },
  { key: "integrations", label: "Intégrations", path: "/admin/integrations", icon: "🔌", group: "config" },
];

const MODULE_NAV_MAP: Partial<
  Record<AdminPageKey, keyof AdminUiConfig["modules"]>
> = {
  settings: "adminSettings",
  mapUI: "mapUi",
  themes: "themes",
  uiConfig: "uiConfig",
  overlays: "overlayStudio",
  integrations: "integrations",
};

type AdminLayoutProps = {
  current: AdminPageKey;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  moduleStates?: AdminUiConfig["modules"];
  children: ReactNode;
};

function isModuleDisabled(
  key: AdminPageKey,
  modules?: AdminUiConfig["modules"]
) {
  const moduleKey = MODULE_NAV_MAP[key];
  if (!moduleKey || !modules) {
    return false;
  }
  return modules[moduleKey] === false;
}

export function AdminLayout({
  current,
  title,
  subtitle,
  actions,
  moduleStates,
  children,
}: AdminLayoutProps) {
  const grouped = {
    overview: NAV_ITEMS.filter((i) => i.group === "overview"),
    explore: NAV_ITEMS.filter((i) => i.group === "explore"),
    shop: NAV_ITEMS.filter((i) => i.group === "shop"),
    analytics: NAV_ITEMS.filter((i) => i.group === "analytics"),
    config: NAV_ITEMS.filter((i) => i.group === "config"),
  };
  const [disabledToast, setDisabledToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDisabledNavClick = useCallback((label: string) => {
    setDisabledToast(`${label} désactivé`);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setDisabledToast(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);
  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    },
    []
  );

  function handleNav(path: string) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new CustomEvent("urbex-nav", { detail: { path } }));
  }

  return (
    <div className="admin-shell">
      <aside className="admin-aside">
        <div className="admin-brand">
          <span className="admin-brand-kicker">UrbexQueens</span>
          <strong>Back-office</strong>
        </div>

        <NavGroup
          title="Vue globale"
          items={grouped.overview}
          current={current}
          onNavigate={handleNav}
          moduleStates={moduleStates}
          onModuleDisabled={handleDisabledNavClick}
        />
        <NavGroup
          title="Exploration"
          items={grouped.explore}
          current={current}
          onNavigate={handleNav}
          moduleStates={moduleStates}
          onModuleDisabled={handleDisabledNavClick}
        />
        <NavGroup
          title="Boutique"
          items={grouped.shop}
          current={current}
          onNavigate={handleNav}
          moduleStates={moduleStates}
          onModuleDisabled={handleDisabledNavClick}
        />
        <NavGroup
          title="Analyse"
          items={grouped.analytics}
          current={current}
          onNavigate={handleNav}
          moduleStates={moduleStates}
          onModuleDisabled={handleDisabledNavClick}
        />
        <NavGroup
          title="Configuration"
          items={grouped.config}
          current={current}
          onNavigate={handleNav}
          moduleStates={moduleStates}
          onModuleDisabled={handleDisabledNavClick}
        />
        {disabledToast && (
          <div className="admin-disabled-toast" role="status" aria-live="polite">
            {disabledToast}
          </div>
        )}
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <p className="admin-header-kicker">Panel admin</p>
            <h1>{title}</h1>
            {subtitle && <p className="admin-header-sub">{subtitle}</p>}
          </div>
          {actions && <div className="admin-header-actions">{actions}</div>}
        </header>

        <div className="admin-body">{children}</div>
      </section>
    </div>
  );
}

type NavGroupProps = {
  title: string;
  items: NavItem[];
  current: AdminPageKey;
  onNavigate: (path: string) => void;
  moduleStates?: AdminUiConfig["modules"];
  onModuleDisabled?: (label: string) => void;
};

function NavGroup({
  title,
  items,
  current,
  onNavigate,
  moduleStates,
  onModuleDisabled,
}: NavGroupProps) {
  return (
    <div className="admin-nav-group">
      <p className="admin-nav-title">{title}</p>
      <nav className="admin-nav">
        {items.map((item) => {
          const moduleDisabled = isModuleDisabled(item.key, moduleStates);
          return (
            <button
              key={item.key}
              type="button"
              className={`admin-nav-item ${
                current === item.key ? "is-active" : ""
              } ${moduleDisabled ? "is-module-disabled" : ""}`}
              onClick={() => {
                if (moduleDisabled) {
                  onModuleDisabled?.(item.label);
                  return;
                }
                onNavigate(item.path);
              }}
              aria-disabled={moduleDisabled}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              <span className="admin-nav-item__body">
                <span>{item.label}</span>
                {moduleDisabled && (
                  <span className="admin-nav-item__badge">Désactivé</span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
