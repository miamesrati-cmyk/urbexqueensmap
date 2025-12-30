import { useEffect, useState } from "react";
import ProductCard from "../components/shop/ProductCard";
import ProductDetailsModal from "../components/shop/ProductDetailsModal";
import { useCart } from "../contexts/useCart";
import { fetchPrintfulProducts, type UQProduct } from "../services/printful";

const HERO_TEXT =
  "Chaque pièce est synchronisée depuis Printful et pensée pour l’exploration urbaine. Tu restes dans l’univers dark & néons d’UrbexQueens.";

export default function ShopPage() {
  const [products, setProducts] = useState<UQProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<UQProduct | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const cart = useCart();

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchPrintfulProducts()
      .then((items) => {
        if (!mounted) return;
        setProducts(items);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Impossible de charger la boutique.";
        setError(message);
        setProducts([]);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timer = window.setTimeout(() => setToastMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleViewDetails = (product: UQProduct) => {
    setSelectedProduct(product);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedProduct(null);
  };

  const handleAddToCart = (product: UQProduct) => {
    const price = product.price;
    const image = product.thumbnail;
    cart.addItem(
      {
        id: String(product.id),
        name: product.name,
        price,
        currency: product.currency.toUpperCase(),
        image,
      },
      1
    );
    setToastMessage("Ajouté au sac !");
  };

  return (
    <>
      <div className="shop-shell">
        <div className="shop-inner">
          <header className="shop-hero">
            <p className="neon-title-label">Boutique</p>
            <h1 className="shop-title">Produits disponibles</h1>
            <p className="shop-subtitle">{HERO_TEXT}</p>
          </header>

          {toastMessage && <div className="shop-toast">{toastMessage}</div>}

          {isLoading ? (
            <div className="shop-status">Chargement des produits…</div>
          ) : error ? (
            <div className="shop-status shop-status--error">
              <p>Erreur : {error}</p>
              <p>Réessaie d’actualiser la page plus tard.</p>
            </div>
          ) : products.length === 0 ? (
            <div className="shop-status">
              <p>Aucun produit trouvé pour l’instant.</p>
            </div>
          ) : (
            <div className="shop-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={handleViewDetails}
                  onAddToCart={() => handleAddToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          open={isDetailsOpen}
          onClose={handleCloseDetails}
        />
      )}
    </>
  );
}
