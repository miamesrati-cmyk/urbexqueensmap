const APP_CHECK_SITE_KEY = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;

export const isAppCheckConfigured = Boolean(APP_CHECK_SITE_KEY);
export const isAppCheckMissingInProd =
  import.meta.env.PROD && !isAppCheckConfigured;

export function ensureWritesAllowed() {
  if (isAppCheckMissingInProd) {
    throw new Error(
      "Déploiement non sécurisé : App Check est requis avant de permettre les écritures."
    );
  }
}

export function getSecurityBlockReason() {
  if (isAppCheckMissingInProd) {
    return "App Check prod manquant — configuration nécessaire avant déploiement.";
  }
  return null;
}
