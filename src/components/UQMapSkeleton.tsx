import "./UQMapSkeleton.css";

export default function UQMapSkeleton() {
  return (
    <div
      className="uq-map-skeleton"
      role="status"
      aria-label="Carte en cours de chargement"
    >
      <div className="uq-map-skeleton__map-track">
        <div className="uq-map-skeleton__map" />
        <div className="uq-map-skeleton__pulse" />
      </div>
      <div className="uq-map-skeleton__footer">
        <div className="uq-map-skeleton__line" />
        <div className="uq-map-skeleton__line uq-map-skeleton__line--short" />
      </div>
    </div>
  );
}
