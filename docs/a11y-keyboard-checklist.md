# Accessibility Keyboard Checklist

1. Open the header menus (profil, notifications, missions) with **Enter**/**Space** on their triggers and confirm **Escape** closes them while focus is inside.
2. Toggle the EPIC/Ghost filters with the filter buttons and verify each `button` exposes an `aria-label`/`title` and announces its state to screen readers.
3. Use **Tab/Shift+Tab** inside the Add Spot modal (create a draft by dropping a marker) and ensure focus loops inside the dialog, landing on form fields, CTA buttons, and the success controls in order.
4. Trigger the Add Spot modal again and press **Escape** to close it; check that focus returns to the initiating control (the Add Spot handle) without breaking the tab sequence.
5. Navigate Icon-only controls such as the map popup close/pin buttons and the topbar icon buttons to confirm tooltips/titles are visible and that screen readers announce the `aria-label`.

