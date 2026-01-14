import { useEffect, useState } from "react";

export default function MapDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  useEffect(() => {
    const logs: string[] = [];

    // 1. Check Mapbox token
    const token = (import.meta as any).env?.VITE_MAPBOX_TOKEN || "";
    logs.push(`✓ Token présent: ${token ? `Oui (${token.substring(0, 10)}...)` : "NON ❌"}`);

    // 2. Check WebGL support
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    logs.push(`✓ WebGL supporté: ${gl ? "Oui ✅" : "NON ❌"}`);

    // 3. Check network
    logs.push(`✓ Navigator online: ${navigator.onLine ? "Oui ✅" : "NON ❌"}`);

    // 4. Check Mapbox GL JS loaded
    logs.push(`✓ Mapbox GL JS chargé: ${typeof (window as any).mapboxgl !== "undefined" ? "Oui ✅" : "NON ❌"}`);

    // 5. Test Mapbox API access
    if (token) {
      fetch(`https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${token}`)
        .then(res => {
          if (res.ok) {
            logs.push(`✓ API Mapbox accessible: Oui ✅ (status ${res.status})`);
          } else {
            logs.push(`✓ API Mapbox accessible: NON ❌ (status ${res.status})`);
          }
          setDiagnostics([...logs]);
        })
        .catch(err => {
          logs.push(`✓ API Mapbox accessible: ERREUR ❌ (${err.message})`);
          setDiagnostics([...logs]);
        });
    }

    setDiagnostics(logs);
  }, []);

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      right: "20px",
      background: "rgba(0, 0, 0, 0.9)",
      color: "white",
      padding: "20px",
      borderRadius: "10px",
      fontFamily: "monospace",
      fontSize: "12px",
      maxWidth: "400px",
      zIndex: 10000,
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
    }}>
      <h3 style={{ margin: "0 0 10px 0", color: "#e879f9" }}>🔍 Diagnostic Carte</h3>
      {diagnostics.map((log, i) => (
        <div key={i} style={{ marginBottom: "5px" }}>{log}</div>
      ))}
      {diagnostics.length === 0 && <div>Chargement...</div>}
    </div>
  );
}
