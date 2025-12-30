import "./LegalPages.css";
import {
  NeonTitle,
  PageContainer,
  SectionCard,
  UrbexButton,
} from "../components/ui/UrbexUI";

export default function PaymentPolicy() {
  const handleClose = () => {
    window.history.back();
  };

  return (
    <PageContainer>
      <div className="legal-page">
        <SectionCard className="legal-card">
          <button className="uq-close-btn" type="button" onClick={handleClose}>
            ×
          </button>
          <div className="legal-tag">Paiement</div>
          <NeonTitle label="Paiement" title="Politique de paiement" />
          <p className="legal-lead">
            Notre objectif est d’offrir une expérience PRO fluide et sécurisée. Voici les
            règles qui encadrent les abonnements et les transactions UrbexQueens.
          </p>

          <section className="legal-section">
            <h2>Mode de facturation</h2>
            <p>
              Les abonnements UrbexQueens PRO sont facturés mensuellement via Stripe.
              La résiliation peut être effectuée à tout moment depuis votre compte.
            </p>
          </section>

          <section className="legal-section">
            <h2>Remboursements</h2>
            <p>
              Les demandes légitimes de remboursement peuvent être adressées à
              support@urbexqueens.app. Chaque requête est examinée au cas par cas.
            </p>
          </section>

          <section className="legal-section">
            <h2>Taxes et conformité</h2>
            <p>
              Les prix incluent les taxes applicables selon votre région. UrbexQueens
              respecte les obligations fiscales et s’appuie sur Stripe pour la collecte
              et la répartition des taxes.
            </p>
          </section>

          <section className="legal-section">
            <h2>Sécurité</h2>
            <p>
              Stripe gère 100% des paiements : aucune donnée bancaire n’est stockée par
              UrbexQueens. Toutes les transactions sont chiffrées (TLS 1.2+).
            </p>
          </section>

          <div className="legal-actions">
            <UrbexButton variant="secondary" onClick={handleClose}>
              ← Retour
            </UrbexButton>
            <UrbexButton
              variant="primary"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("urbex-nav", {
                    detail: { path: "/payment-security" },
                  })
                )
              }
            >
              Paiement &amp; sécurité
            </UrbexButton>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
