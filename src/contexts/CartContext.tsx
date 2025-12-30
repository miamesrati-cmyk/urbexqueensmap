import { useCallback, useEffect, useMemo, useState } from "react";
import type { CartItem } from "./cartLogic";
import {
  getCartItemCount,
  getCartTotal,
  loadCartItems,
  persistCartItems,
} from "./cartLogic";
import { cartContext } from "./cartContextBase";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartItems());

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((previous) => {
        const idx = previous.findIndex((candidate) => candidate.id === item.id);
        if (idx === -1) {
          return [
            ...previous,
            {
              ...item,
              quantity,
            },
          ];
        }

        const next = [...previous];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + quantity,
        };
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  useEffect(() => {
    persistCartItems(items);
  }, [items]);

  const total = useMemo(() => getCartTotal(items), [items]);
  const itemCount = useMemo(() => getCartItemCount(items), [items]);

  const contextValue = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      clearCart,
      total,
      itemCount,
    }),
    [items, addItem, removeItem, clearCart, total, itemCount]
  );

  return <cartContext.Provider value={contextValue}>{children}</cartContext.Provider>;
}
