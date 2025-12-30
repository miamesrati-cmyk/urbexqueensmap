export type UserSettings = {
  // Sécurité / confidentialité
  profilePublic: boolean;
  showDonePublic: boolean;
  showFavoritesPublic: boolean;
  allowMessages: boolean;
  stealthMode: boolean;

  // Carte & exploration
  mapShowGhost: boolean;
  mapShowLegend: boolean;
  mapShowDone: boolean;
  autoCenterOnUser: boolean;
  lowLightMap: boolean;

  // Notifications
  notifyNewSpotsNearMe: boolean;
  notifyNewSpotsNearby?: boolean; // alias for clarity
  notifyMessages?: boolean;
  notifyComments?: boolean;
  notifyDangerousSpots: boolean;
  notifyLoginAlerts: boolean;
  notifyNewsEmail: boolean;

  // Compte & sécurité
  lastDataDownloadAt?: string | null;
};
