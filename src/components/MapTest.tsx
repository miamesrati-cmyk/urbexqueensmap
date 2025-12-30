import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "../styles.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

export default function MapTest(){
  const divRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    if (!divRef.current) return;
    const map = new mapboxgl.Map({
      container: divRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-73.561668, 45.508888],
      zoom: 10,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    return () => map.remove();
  }, []);

  return <div ref={divRef} className="map-container" />;
}
