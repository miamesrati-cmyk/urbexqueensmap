import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "../styles.css";
import { captureMapboxError } from "../lib/monitoring";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

export default function MapBase(){
  const ref = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-73.561668, 45.508888],
      zoom: 10
    });

    const handleError = (
      e: mapboxgl.ErrorEvent | (mapboxgl.MapboxEvent & { error?: unknown })
    ) => {
      const errorPayload = (e as any)?.error || e;
      captureMapboxError(errorPayload);
      console.error("❌ Mapbox minimal error:", errorPayload);
    };
    map.on("error", handleError);
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    return () => {
      map.off("error", handleError);
      map.remove();
    };
  }, []);

  return <div ref={ref} className="map-container" style={{outline:"2px solid #444"}}/>;
}
