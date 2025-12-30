import { useEffect, useState } from "react";
import type { UQProduct } from "../../services/printful";
import { fetchProductDetails } from "../../services/printfulDetails";

type Props = {
  product: UQProduct;
  open: boolean;
  onClose: () => void;
};

export default function ProductDetailsModal({ product, open, onClose }: Props) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    setDetails(null);

    fetchProductDetails(product.id)
      .then((response) => {
        if (!active) return;
        setDetails(response);
      })
      .catch(() => {
        if (!active) return;
        setError("Impossible de charger les détails.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product.id, open]);

  if (!open) return null;

  const payload = details?.result ?? details ?? {};
  const variants =
    payload?.sync_variants ??
    payload?.variants ??
    payload?.items ??
    [];
  const image =
    payload?.thumbnail_url ||
    payload?.sync_variants?.[0]?.files?.[0]?.preview_url ||
    payload?.variants?.[0]?.files?.[0]?.preview_url ||
    product.thumbnail;
  const description =
    payload?.description || product.shortDescription || "Description bientôt disponible.";

  return (
    <div className="product-details-backdrop" onClick={onClose}>
      <div className="product-details-modal" onClick={(event) => event.stopPropagation()}>
        <button className="product-details-close" onClick={onClose}>
          ×
        </button>
        <div className="product-details-grid">
          <div className="product-details-image">
            {image ? (
              <img src={image} alt={product.name} loading="lazy" />
            ) : (
              <div className="product-card-placeholder">Image manquante</div>
            )}
          </div>
          <div className="product-details-info">
            <p className="neon-title-label">Produit urbex</p>
            <h2>{product.name}</h2>
            <p className="product-details-price">
              {product.price.toFixed(2).replace(".", ",")} $ {product.currency}
            </p>
            {loading ? (
              <p className="product-details-description">Chargement des variantes…</p>
            ) : error ? (
              <p className="product-details-description">{error}</p>
            ) : (
              <p className="product-details-description">{description}</p>
            )}

            {!loading && !error && variants.length > 0 && (
              <div className="product-details-variants">
                <h3>Variants disponibles</h3>
                <ul>
                  {variants.map((variant: any) => (
                    <li key={variant.id ?? variant.external_id ?? variant.name}>
                      <span>{variant.name ?? `ID ${variant.id}`}</span>
                      <span>
                        {(variant.retail_price ?? variant.price ?? "").toString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="product-details-actions">
          <button type="button" className="product-details-button" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
