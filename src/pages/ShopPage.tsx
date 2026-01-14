import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "../components/shop/ProductCard";
import ProductDetailsModal from "../components/shop/ProductDetailsModal";
import { useCart } from "../contexts/useCart";
import { fetchPrintfulProducts, type UQProduct } from "../services/printful";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PullToRefreshIndicator from "../components/ui/PullToRefreshIndicator";
import Skeleton from "../components/Skeleton";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import "../styles/shop-enhanced.css";

const HERO_TEXT =
  "Chaque pièce est synchronisée depuis Printful et pensée pour l'exploration urbaine. Tu restes dans l'univers dark & néons d'UrbexQueens.";

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name';

export default function ShopPage() {
  const [products, setProducts] = useState<UQProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<UQProduct | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const cart = useCart();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refreshPromiseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);
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
        if (refreshPromiseRef.current) {
          refreshPromiseRef.current();
          refreshPromiseRef.current = null;
        }
      });

    return () => {
      mounted = false;
      if (refreshPromiseRef.current) {
        refreshPromiseRef.current();
        refreshPromiseRef.current = null;
      }
    };
  }, [refreshTrigger]);

  const refreshProducts = useCallback(() => {
    if (refreshPromiseRef.current) {
      refreshPromiseRef.current();
    }
    setProducts([]);
    setError(null);
    setIsLoading(true);
    return new Promise<void>((resolve) => {
      refreshPromiseRef.current = resolve;
      setRefreshTrigger((prev) => prev + 1);
    });
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

  const {
    attachSurface: attachShopSurface,
    pullDistance: shopPullDistance,
    status: shopPullStatus,
  } = usePullToRefresh({
    onRefresh: refreshProducts,
    threshold: 70,
    minSpinnerTime: 800,
  });

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

  // Filtrage et tri optimisés avec useMemo
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products;

    // Filtrage par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.shortDescription?.toLowerCase().includes(query)
      );
    }

    // Tri
    const sorted = [...filtered];
    switch (sortBy) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default: // featured
        break;
    }

    return sorted;
  }, [products, searchQuery, sortBy]);

  // Infinite scroll pour charger progressivement
  const {
    visibleItems: visibleProducts,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll(filteredAndSortedProducts, 12, 6);

  return (
    <>
      <div className="shop-shell" ref={attachShopSurface}>
        <PullToRefreshIndicator pullDistance={shopPullDistance} status={shopPullStatus} />
        <div className="shop-inner">
          <header className="shop-hero">
            <p className="neon-title-label">Boutique</p>
            <h1 className="shop-title">Produits disponibles</h1>
            <p className="shop-subtitle">{HERO_TEXT}</p>
          </header>

          {/* Barre de recherche et filtres */}
          <div className="shop-controls">
            <div className="shop-search-wrapper">
              <input
                type="search"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="shop-search-input"
              />
              <svg className="shop-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="shop-sort-select"
            >
              <option value="featured">🔥 En vedette</option>
              <option value="price-asc">💰 Prix croissant</option>
              <option value="price-desc">💎 Prix décroissant</option>
              <option value="name">🔤 Nom (A-Z)</option>
            </select>
          </div>

          {/* Compteur de résultats */}
          {!isLoading && filteredAndSortedProducts.length > 0 && (
            <div className="shop-results-count">
              <span className="shop-results-number">{filteredAndSortedProducts.length}</span>
              {searchQuery ? (
                <span className="shop-results-text">
                  {filteredAndSortedProducts.length === 1 ? 'résultat trouvé' : 'résultats trouvés'} pour "{searchQuery}"
                </span>
              ) : (
                <span className="shop-results-text">
                  {filteredAndSortedProducts.length === 1 ? 'produit disponible' : 'produits disponibles'}
                </span>
              )}
            </div>
          )}

          {toastMessage && <div className="shop-toast">{toastMessage}</div>}

          {isLoading ? (
            <div className="shop-grid-skeleton">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`shop-skel-${idx}`} className="shop-grid-skeleton__card">
                  <Skeleton className="shop-grid-skeleton__media" rounded />
                  <Skeleton className="shop-grid-skeleton__line" />
                  <Skeleton className="shop-grid-skeleton__line" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="shop-status shop-status--error">
              <p>Erreur : {error}</p>
              <p>Réessaie d'actualiser la page plus tard.</p>
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="shop-status">
              {searchQuery ? (
                <>
                  <p className="shop-empty-icon">🔍</p>
                  <p className="shop-empty-title">Aucun résultat</p>
                  <p>Essaie de chercher un autre terme ou réinitialise la recherche.</p>
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="shop-reset-btn"
                  >
                    Effacer la recherche
                  </button>
                </>
              ) : (
                <p>Aucun produit trouvé pour l'instant.</p>
              )}
            </div>
          ) : (
            <>
              <div className="shop-grid">
                {visibleProducts.map((product) => (
                  <MemoizedProductCard
                    key={product.id}
                    product={product}
                    onViewDetails={handleViewDetails}
                    onAddToCart={() => handleAddToCart(product)}
                  />
                ))}
              </div>
              {/* Sentinel pour infinite scroll */}
              {hasMore && (
                <div 
                  ref={sentinelRef}
                  className="shop-loading-more"
                >
                  <div className="shop-spinner" />
                  <span>Chargement de plus de produits...</span>
                </div>
              )}
            </>
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

// Mémoïsation ProductCard pour éviter re-renders inutiles
const MemoizedProductCard = memo(ProductCard, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.price === next.product.price &&
    prev.product.name === next.product.name
  );
});
