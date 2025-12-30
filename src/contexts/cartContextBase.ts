import { createContext } from "react";
import type { CartContextValue } from "./cartLogic";

export const cartContext = createContext<CartContextValue | undefined>(undefined);
