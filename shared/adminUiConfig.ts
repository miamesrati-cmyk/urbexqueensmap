export const ADMIN_UI_CONFIG_SCHEMA_VERSION = 1;

export const ADMIN_UI_OVERLAY_LEFT_POSITIONS = [
  "top-left",
  "mid-left",
  "bottom-left",
] as const;
export type OverlayLeftPosition =
  (typeof ADMIN_UI_OVERLAY_LEFT_POSITIONS)[number];

export const ADMIN_UI_OVERLAY_RIGHT_POSITIONS = [
  "top-right",
  "mid-right",
  "bottom-right",
] as const;
export type OverlayRightPosition =
  (typeof ADMIN_UI_OVERLAY_RIGHT_POSITIONS)[number];

export const ADMIN_UI_OVERLAY_DEVICE_SCOPES = ["all", "desktop", "mobile"] as const;
export type OverlayDeviceScope =
  (typeof ADMIN_UI_OVERLAY_DEVICE_SCOPES)[number];

export const ADMIN_UI_THEME_PRESETS = ["night", "violet", "satellite"] as const;
export type ThemePreset = (typeof ADMIN_UI_THEME_PRESETS)[number];

export type AdminUiConfig = {
  version: number;
  updatedAt: Date | null;
  updatedBy: string | null;
  maintenance: {
    enabled: boolean;
    message: string;
  };
  flags: {
    proBeta: boolean;
    overlayStudio: boolean;
    themesBeta: boolean;
  };
  modules: {
    adminSettings: boolean;
    mapUi: boolean;
    themes: boolean;
    uiConfig: boolean;
    overlayStudio: boolean;
    integrations: boolean;
  };
  mapUi: {
    showMapboxControls: boolean;
    showProBar: boolean;
    showSearchBar: boolean;
    showLeftOverlay: boolean;
    showRightOverlay: boolean;
  };
  ui: {
    headerHeight: number;
    topbarHeight: number;
    proBarMaxWidth: number;
    overlayPanelWidth: number;
    overlayRadius: number;
    glassBlur: number;
    glowIntensity: number;
  };
  overlay: {
    left: {
      enabled: boolean;
      position: OverlayLeftPosition;
      device: OverlayDeviceScope;
    };
    right: {
      enabled: boolean;
      position: OverlayRightPosition;
      device: OverlayDeviceScope;
    };
  };
  theme: {
    preset: ThemePreset;
  };
};

export const DEFAULT_ADMIN_UI_CONFIG: AdminUiConfig = {
  version: 1,
  updatedAt: null,
  updatedBy: null,
  maintenance: {
    enabled: false,
    message: "",
  },
  flags: {
    proBeta: false,
    overlayStudio: false,
    themesBeta: false,
  },
  modules: {
    adminSettings: true,
    mapUi: true,
    themes: true,
    uiConfig: true,
    overlayStudio: true,
    integrations: true,
  },
  mapUi: {
    showMapboxControls: true,
    showProBar: true,
    showSearchBar: true,
    showLeftOverlay: true,
    showRightOverlay: true,
  },
  ui: {
    headerHeight: 64,
    topbarHeight: 64,
    proBarMaxWidth: 560,
    overlayPanelWidth: 360,
    overlayRadius: 18,
    glassBlur: 14,
    glowIntensity: 0.65,
  },
  overlay: {
    left: {
      enabled: true,
      position: "mid-left",
      device: "all",
    },
    right: {
      enabled: true,
      position: "mid-right",
      device: "all",
    },
  },
  theme: {
    preset: "violet",
  },
};
