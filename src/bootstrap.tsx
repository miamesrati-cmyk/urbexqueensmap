import App from "./App";
import SecurityLockOverlay from "./components/SecurityLockOverlay";
import { CartProvider } from "./contexts/CartContext";
import { AuthUIProvider } from "./contexts/AuthUIContext";
import { ProStatusProvider } from "./contexts/ProStatusContext";
import { ToastProvider } from "./contexts/ToastContext";

export function AppShell() {
  return (
    <ToastProvider>
      <CartProvider>
        <ProStatusProvider>
          <AuthUIProvider>
            <App />
            <SecurityLockOverlay />
          </AuthUIProvider>
        </ProStatusProvider>
      </CartProvider>
    </ToastProvider>
  );
}
