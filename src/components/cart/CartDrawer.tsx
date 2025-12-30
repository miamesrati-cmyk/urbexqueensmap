import { useEffect, useState } from "react";
import { useCart } from "../../contexts/useCart";
import { createCheckout } from "../../services/stripe";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const cart = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = cart.total ?? cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const disabled = cart.items.length === 0 || total <= 0 || loading;

  useEffect(() => {
    if (
      !open ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const handlePointerDown = () => {};
    const handleWheel = () => {};

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("wheel", handleWheel);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [open, onClose]);

  const handleCheckout = async () => {
    if (cart.items.length === 0 || loading) return;
    try {
      setError(null);
      setLoading(true);
      const res = await createCheckout(cart.items);
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setError("Aucune URL de paiement retournée.");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err?.message || "Erreur lors de la création du paiement.");
    } finally {
      setLoading(false);
    }
  };
  if (!open) return null;

  return (
    <div className="cart-drawer-backdrop" onClick={onClose}>
      <aside className="cart-drawer" onClick={(event) => event.stopPropagation()}>
        <header className="cart-drawer-header">
          <h3>Mon sac urbex</h3>
          <button className="cart-close-button" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="cart-drawer-body">
          {cart.items.length === 0 ? (
            <p className="cart-empty">Ton sac est vide pour l’instant.</p>
          ) : (
            <ul className="cart-items">
              {cart.items.map((item) => (
                <li key={item.id} className="cart-item">
                  <div className="cart-item-media">
                    {item.image ? (
                      <img src={item.image} alt={item.name} loading="lazy" />
                    ) : (
                      <div className="cart-item-placeholder">?</div>
                    )}
                  </div>
                  <div className="cart-item-text">
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity} ×{" "}
                      {item.price.toFixed(2).replace(".", ",")} {item.currency}
                    </span>
                  </div>
                  <div className="cart-item-total">
                    {(item.price * item.quantity).toFixed(2).replace(".", ",")}{" "}
                    {item.currency}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="cart-drawer-footer">
          <div className="cart-summary">
            <span>Total</span>
            <strong>
              {total.toFixed(2).replace(".", ",")} CAD
            </strong>
          </div>
          <button className="cart-drawer-cta" onClick={handleCheckout} disabled={disabled}>
            {loading ? "Redirection..." : disabled ? "Montant invalide" : "Passer au paiement"}
          </button>
          {error && <p className="cart-error">{error}</p>}
          <button className="cart-clear" type="button" onClick={cart.clearCart}>
            Vider le sac
          </button>
        </footer>
      </aside>
    </div>
  );
}
