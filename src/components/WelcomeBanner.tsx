import { useState } from "react";

type WelcomeBannerProps = {
  onSignup: () => void;
  onLogin: () => void;
};

export default function WelcomeBanner({ onSignup, onLogin }: WelcomeBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    // Check si l'utilisateur a déjà dismissé le banner
    return localStorage.getItem("welcome-banner-dismissed") === "true";
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("welcome-banner-dismissed", "true");
  };

  if (dismissed) return null;

  return (
    <div className="map-welcome-banner">
      <button 
        className="map-welcome-banner-close" 
        onClick={handleDismiss}
        aria-label="Fermer"
      >
        ✕
      </button>
      
      <div className="map-welcome-banner-icon">👋</div>
      
      <h3 className="map-welcome-banner-title">
        Bienvenue sur UrbexQueens !
      </h3>
      
      <p className="map-welcome-banner-text">
        Crée un compte gratuit pour sauvegarder tes spots favoris, ajouter tes découvertes 
        et rejoindre la communauté d'exploratrices urbaines.
      </p>
      
      <div className="map-welcome-banner-actions">
        <button 
          className="map-welcome-banner-btn map-welcome-banner-btn-primary"
          onClick={onSignup}
        >
          Créer un compte
        </button>
        <button 
          className="map-welcome-banner-btn map-welcome-banner-btn-secondary"
          onClick={onLogin}
        >
          Se connecter
        </button>
      </div>
    </div>
  );
}
