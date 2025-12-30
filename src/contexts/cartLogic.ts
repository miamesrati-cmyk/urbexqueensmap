export type CartItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  quantity: number;
};

export const CART_STORAGE_KEY = "urbexqueens_cart";

export function loadCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CartItem[];
  } catch {
    return [];
  }
}

export function persistCartItems(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
}

export function getCartTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function getCartItemCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
};
