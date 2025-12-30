import "./LegalPages.css";
import {
  NeonTitle,
  PageContainer,
  SectionCard,
  UrbexButton,
} from "../components/ui/UrbexUI";

export default function LegalClause() {
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
          <div className="legal-tag">Clause légale</div>
          <NeonTitle label="Légal" title="Clause légale & responsabilité" />
          <p className="legal-lead">
            Cette page rappelle les règles essentielles pour protéger les explorateurs et
            la communauté UrbexQueens. Merci de la consulter et de la respecter.
          </p>

          <section className="legal-section">
            <h2>Responsabilité individuelle</h2>
            <p>
              Les explorations urbaines comportent des risques. Vous êtes seul
              responsable de vos déplacements et de vos actions sur le terrain.
            </p>
          </section>

          <section className="legal-section">
            <h2>Respect des lois</h2>
            <p>
              UrbexQueens n’encourage aucune infraction. Respectez la propriété privée,
              les règles locales et les directives de sécurité.
            </p>
          </section>

          <section className="legal-section">
            <h2>Données et contenus</h2>
            <p>
              Les informations partagées par la communauté sont fournies à titre
              informatif. UrbexQueens ne garantit ni l’exactitude ni l’actualité de ces
              contenus.
            </p>
          </section>

          <section className="legal-section">
            <h2>Signaler un problème</h2>
            <p>
              Pour toute question ou alerte, contactez-nous à support@urbexqueens.app.
              Notre équipe pourra ajuster ou retirer un contenu signalé.
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
                    detail: { path: "/legal-terms" },
                  })
                )
              }
            >
              Voir les conditions
            </UrbexButton>
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
