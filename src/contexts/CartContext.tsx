import { useCallback, useEffect, useMemo } from "react";
import type { CartItem } from "./cartLogic";
import {
  getCartItemCount,
  getCartTotal,
  loadCartItems,
  persistCartItems,
} from "./cartLogic";
import { useOptimisticAction } from "../hooks/useOptimisticAction";
import { cartContext } from "./cartContextBase";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const {
    state: items,
    applyOptimistic: applyOptimisticCart,
    commit: commitCartAction,
  } = useOptimisticAction("cart", loadCartItems());

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      applyOptimisticCart((previous) => {
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
      void commitCartAction(Promise.resolve());
    },
    [applyOptimisticCart, commitCartAction]
  );

  const removeItem = useCallback(
    (id: string) => {
      applyOptimisticCart((previous) => previous.filter((item) => item.id !== id));
      void commitCartAction(Promise.resolve());
    },
    [applyOptimisticCart, commitCartAction]
  );

  const clearCart = useCallback(
    () => {
      applyOptimisticCart(() => []);
      void commitCartAction(Promise.resolve());
    },
    [applyOptimisticCart, commitCartAction]
  );

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
