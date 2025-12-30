import "./PaymentSecurity.css";
import LegalDisclaimer from "../components/LegalDisclaimer";
import {
  NeonTitle,
  PageContainer,
  SectionCard,
  UrbexButton,
} from "../components/ui/UrbexUI";

export default function PaymentSecurity() {
  const sections = [
    {
      title: "Paiements gérés par Stripe",
      body: (
        <>
          <p>
            Tous les paiements sont traités via <b>Stripe</b>, leader mondial du paiement
            sécurisé. UrbexQueens n’a <b>jamais</b> accès à vos informations de carte.
          </p>
          <ul>
            <li>Cryptage complet (TLS 1.2+)</li>
            <li>Certification PCI DSS Niveau 1</li>
            <li>Aucune donnée bancaire stockée par UrbexQueens</li>
          </ul>
        </>
      ),
    },
    {
      title: "Sécurité de votre compte",
      body: (
        <p>
          Les comptes sont protégés par <b>Firebase Authentication</b> : sessions sécurisées,
          cryptage des identifiants et détection de connexions suspectes.
        </p>
      ),
    },
    {
      title: "Abonnement UrbexQueens PRO",
      body: (
        <p>
          L’abonnement PRO est facturé 12,99$ / mois via Stripe. Résiliable en tout temps.
        </p>
      ),
    },
    {
      title: "Protection contre la fraude",
      body: (
        <>
          <p>Stripe offre :</p>
          <ul>
            <li>Détection automatique de la fraude</li>
            <li>3D Secure lorsque requis</li>
            <li>Évaluation des risques transactionnels</li>
          </ul>
        </>
      ),
    },
    {
      title: "Données conservées",
      body: (
        <>
          <p>UrbexQueens ne conserve que :</p>
          <ul>
            <li>UID Firebase</li>
            <li>Email</li>
            <li>Statut PRO (true/false)</li>
          </ul>
          <p>Aucune donnée bancaire n’est stockée.</p>
        </>
      ),
    },
    {
      title: "Remboursements",
      body: (
        <p>
          Les demandes peuvent être envoyées à :
          <br />
          <b>support@urbexqueens.app</b>
        </p>
      ),
    },
  ];

  const handleBack = () => window.history.back();

  return (
    <PageContainer>
      <div className="payment-security-page">
        <SectionCard className="ps-hero">
          <NeonTitle label="Sécurité" title="Paiement & Sécurité" />
          <p className="ps-intro">
            La sécurité de nos membres est une priorité absolue. UrbexQueens utilise les
            technologies les plus robustes de l’industrie pour protéger vos données.
          </p>
          <div className="ps-actions">
            <UrbexButton variant="secondary" onClick={handleBack}>
              ← Retour
            </UrbexButton>
            <UrbexButton
              variant="primary"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("urbex-nav", {
                    detail: { path: "/payment-policy" },
                  })
                );
              }}
            >
              Politique de paiement
            </UrbexButton>
          </div>
        </SectionCard>

        <div className="ps-grid">
          {sections.map((section, idx) => (
            <SectionCard key={section.title} className="ps-section">
              <h2>
                {idx + 1}. {section.title}
              </h2>
              {section.body}
            </SectionCard>
          ))}
        </div>

        <SectionCard className="ps-summary">
          <h2>Résumé</h2>
          <ul>
            <li>Stripe gère 100% des paiements</li>
            <li>UrbexQueens ne voit jamais les cartes</li>
            <li>Sécurité maximale &amp; cryptage</li>
            <li>Annulation en tout temps</li>
            <li>Aucune donnée bancaire stockée</li>
          </ul>
        </SectionCard>

        <SectionCard className="ps-legal">
          <LegalDisclaimer />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
