import React from "react";
import { UrbexMarkerShowcase } from "../components/map/UrbexMarkerShowcase";

/**
 * Page de démonstration des markers urbex personnalisés
 */
export const MarkerDemoPage: React.FC = () => {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <UrbexMarkerShowcase />
    </div>
  );
};

export default MarkerDemoPage;
