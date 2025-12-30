import "./SecurityLockOverlay.css";
import {
  getSecurityBlockReason,
  isAppCheckMissingInProd,
} from "../lib/securityGuard";

export default function SecurityLockOverlay() {
  if (!isAppCheckMissingInProd) return null;
  return (
    <div className="security-lock-overlay" role="alert">
      <div className="security-lock-content">
        <h2>Sécurité renforcée</h2>
        <p>
          Les écritures et les actions sensibles sont désactivées tant que App
          Check n’est pas configuré pour l’environnement de production.
        </p>
        {getSecurityBlockReason() && (
          <p className="security-lock-reason">
            {getSecurityBlockReason()}
          </p>
        )}
        <p>
          Contacte l’équipe technique ou configure le site key Firebase App
          Check (`VITE_FIREBASE_APP_CHECK_SITE_KEY`) pour réactiver le mode live.
        </p>
      </div>
    </div>
  );
}
