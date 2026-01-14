import { type FC } from "react";
import "../styles/GuestLimitModal.css";

type GuestLimitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  spotsVisible: number;
  totalSpots: number;
};

/**
 * Modal affiché aux guests pour les inciter à s'inscrire
 * quand ils ont atteint la limite de spots visibles
 */
export const GuestLimitModal: FC<GuestLimitModalProps> = ({
  isOpen,
  onClose,
  onSignUp,
  spotsVisible,
  totalSpots,
}) => {
  if (!isOpen) return null;

  return (
    <div className="guest-limit-modal-backdrop" onClick={onClose}>
      <div 
        className="guest-limit-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="guest-limit-modal-close" 
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="guest-limit-modal-icon">
          🔒
        </div>

        <h2 className="guest-limit-modal-title">
          Plus de spots à découvrir !
        </h2>

        <p className="guest-limit-modal-description">
          Vous visualisez actuellement <strong>{spotsVisible}</strong> spots sur <strong>{totalSpots}+</strong> disponibles.
        </p>

        <p className="guest-limit-modal-cta-text">
          <strong>Inscrivez-vous gratuitement</strong> pour accéder à tous les spots publics de la communauté urbex !
        </p>

        <div className="guest-limit-modal-benefits">
          <div className="guest-limit-benefit">
            <span className="benefit-icon">🗺️</span>
            <span className="benefit-text">Accès à tous les spots publics</span>
          </div>
          <div className="guest-limit-benefit">
            <span className="benefit-icon">📍</span>
            <span className="benefit-text">Soumettez vos propres découvertes</span>
          </div>
          <div className="guest-limit-benefit">
            <span className="benefit-icon">💾</span>
            <span className="benefit-text">Sauvegardez vos spots favoris</span>
          </div>
          <div className="guest-limit-benefit">
            <span className="benefit-icon">✅</span>
            <span className="benefit-text">Marquez les spots explorés</span>
          </div>
        </div>

        <div className="guest-limit-modal-actions">
          <button 
            className="guest-limit-btn-signup" 
            onClick={onSignUp}
          >
            S'inscrire gratuitement
          </button>
          <button 
            className="guest-limit-btn-later" 
            onClick={onClose}
          >
            Plus tard
          </button>
        </div>

        <p className="guest-limit-modal-pro-hint">
          💎 <strong>Version PRO</strong> : Accès illimité + spots exclusifs PRO
        </p>
      </div>
    </div>
  );
};

export default GuestLimitModal;
