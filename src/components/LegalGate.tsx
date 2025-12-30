import { useEffect, useState } from "react";

type LegalGateProps = {
  onAccepted?: () => void;
};

const STORAGE_KEY = "urbex_legalAccepted_v1";

export default function LegalGate({ onAccepted }: LegalGateProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setIsVisible(true);
      }
    } catch {
      // si localStorage n'est pas dispo, on affiche quand même
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    if (!checked) return;
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (err) {
      console.warn("Storage indisponible pour sauvegarder l'accord légal", err);
    }
    setIsVisible(false);
    onAccepted?.();
  };

  if (!isVisible) return null;

  return (
    <div className="legal-gate-backdrop">
      <div className="legal-gate">
        <h2>Avant de continuer</h2>
        <p className="lg-subtitle">
          UrbexQueens est une plateforme artistique. L&apos;exploration urbaine
          comporte des risques légaux et physiques.
        </p>

        <div className="lg-box">
          <p>
            En poursuivant, je reconnais que :
          </p>
          <ul>
            <li>
              Entrer sur une propriété privée sans autorisation peut être illégal
              et entraîner des amendes ou des poursuites.
            </li>
            <li>
              Je suis seul(e) responsable de mes décisions, déplacements
              et actions.
            </li>
            <li>
              UrbexQueens ne m&apos;encourage pas à enfreindre la loi et ne peut
              être tenue responsable de mes actes.
            </li>
          </ul>

          <label className="lg-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              Je comprends les risques et j&apos;agis sous ma seule responsabilité.
            </span>
          </label>

          <button
            className="lg-accept-btn"
            onClick={handleAccept}
            disabled={!checked}
          >
            J&apos;accepte et je continue
          </button>
        </div>

        <p className="lg-note">
          Si vous n&apos;êtes pas d&apos;accord avec ces conditions,
          veuillez quitter le site.
        </p>
      </div>
    </div>
  );
}
