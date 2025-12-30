import { useState } from "react";

type Props = {
  open: boolean;
  onAccept: () => void;
};

export default function LegalConsentModal({ open, onAccept }: Props) {
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  return (
    <div className="legal-consent-overlay">
      <div className="legal-consent-card">
        <div className="legal-consent-header">
          <div className="legal-consent-kicker">UrbexQueens</div>
          <h2 className="legal-consent-title">
            Conditions d’utilisation &amp; Clause légale
          </h2>
          <p className="legal-consent-sub">
            Avant d’accéder à la carte et aux services, merci d’accepter nos
            conditions. Cette validation est obligatoire pour protéger la communauté.
          </p>
        </div>

        <div className="legal-consent-body">
          <p>
            En utilisant UrbexQueens, vous reconnaissez agir sous votre propre
            responsabilité lors des explorations urbaines. Respectez les lois locales,
            la propriété privée, et adoptez les bonnes pratiques de sécurité.
          </p>
          <p>
            UrbexQueens n’encourage aucune activité illégale. Les informations
            partagées par la communauté sont fournies à titre indicatif, sans garantie.
            Vous vous engagez à protéger votre compte et à respecter les autres
            explorateurs.
          </p>
        </div>

        <label className="legal-consent-checkbox">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>J’ai lu et j’accepte les conditions d’utilisation et la clause légale.</span>
        </label>

        <div className="legal-consent-actions">
          <button
            type="button"
            className="legal-consent-accept"
            disabled={!checked}
            onClick={onAccept}
          >
            J’accepte
          </button>
        </div>
      </div>
    </div>
  );
}
