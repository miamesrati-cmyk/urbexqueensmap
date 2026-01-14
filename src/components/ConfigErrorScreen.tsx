import { UrbexButton, UrbexGlass } from "./ui/UrbexUI";
import type { EnvValidationIssue } from "../types/envValidation";

type ConfigErrorScreenProps = {
  issueType?: "missing" | "invalid" | "general";
  missing?: string[];
  invalid?: EnvValidationIssue[];
  buildSha?: string;
  buildTime?: string;
};

export default function ConfigErrorScreen({
  issueType = "general",
  missing = [],
  invalid = [],
  buildSha,
  buildTime,
}: ConfigErrorScreenProps) {
  const showMissingDetails =
    import.meta.env.DEV && issueType === "missing" && missing.length > 0;
  const showInvalidDetails =
    import.meta.env.DEV && issueType === "invalid" && invalid.length > 0;

  const metadataEntries = [
    buildSha ? { label: "Build SHA", value: buildSha } : null,
    buildTime ? { label: "Build time", value: buildTime } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  const showMetadata = import.meta.env.DEV && metadataEntries.length > 0;

  const heading =
    issueType === "invalid"
      ? "Config invalid"
      : "Configuration du site indisponible.";
  const message =
    issueType === "invalid"
      ? "Certaines variables d’environnement ne respectent pas le format attendu."
      : "Une erreur de configuration empêche l’application de démarrer.";

  const handleReload = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.reload();
  };

  return (
    <div className="config-error-shell">
      <UrbexGlass className="config-error-card">
        <h1 className="config-error-title">{heading}</h1>
        <p className="config-error-message">{message}</p>
        {showMissingDetails && (
          <div className="config-error-details">
            <strong>Variables manquantes :</strong>
            <ul>
              {missing.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
        {showInvalidDetails && (
          <div className="config-error-details">
            <strong>Valeurs invalides :</strong>
            <ul>
              {invalid.map((issue) => (
                <li key={issue.name}>
                  <span className="config-error-detail-name">{issue.name}</span>
                  <span className="config-error-detail-reason">{issue.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {showMetadata && (
          <div className="config-error-metadata">
            {metadataEntries.map((entry) => (
              <p key={entry.label}>
                <span>{entry.label}</span>
                <code>{entry.value}</code>
              </p>
            ))}
          </div>
        )}
        <div className="config-error-actions">
          <UrbexButton onClick={handleReload}>Recharger</UrbexButton>
        </div>
      </UrbexGlass>
    </div>
  );
}
