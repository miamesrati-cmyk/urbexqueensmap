import type { UQProduct } from "../../services/printful";

type ProductCardProps = {
  product: UQProduct;
  onViewDetails?: (product: UQProduct) => void;
  onAddToCart?: () => void;
};

export default function ProductCard({
  product,
  onViewDetails,
  onAddToCart,
}: ProductCardProps) {
  const image = product.thumbnail ?? null;
  const description =
    product.shortDescription ||
    "Pièce pensée pour les runs nocturnes et les spots urbex.";
  const highlightBadge =
    product.name.toLowerCase().includes("limited") ||
    description.toLowerCase().includes("limited");

  return (
    <article className="product-card">
      <div className="product-card-media">
        <div className="product-card-image-wrapper">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="product-card-image"
            />
          ) : (
            <div className="product-card-placeholder">Image manquante</div>
          )}
          {/* Shine effect on hover */}
          <div className="product-card-shine" />
        </div>

        <div className="product-card-badges">
          <span className="product-card-badge">UrbexGear</span>
          {highlightBadge && (
            <span className="product-card-badge product-card-badge--accent">
              Édition limitée
            </span>
          )}
        </div>
      </div>

      <div className="product-card-body">
        <div>
          <h2 className="product-card-title">{product.name}</h2>
          <p className="product-card-description line-clamp-2">
            {description}
          </p>
        </div>

        <div className="product-card-footer">
          <div className="product-card-price">
            <span className="product-card-price-label">À partir de</span>
            <span className="product-card-price-value">
              {product.price.toFixed(2).replace(".", ",")} $ {product.currency}
            </span>
          </div>
          <div className="product-card-actions">
            <button
              type="button"
              className="product-card-cta"
              onClick={() => onViewDetails?.(product)}
            >
              Voir les détails
            </button>
            <button
              type="button"
              className="product-card-cta product-card-cta--ghost"
              onClick={onAddToCart}
            >
              Ajouter au sac
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
