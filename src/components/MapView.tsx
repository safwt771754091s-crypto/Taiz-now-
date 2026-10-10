"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type Marker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  category: string;
  description: string | null;
  confidence: number;
};

const COLORS: Record<string, string> = {
  verified: "#34d399",
  rumor: "#fb923c",
  correction: "#38bdf8",
  incident: "#f87171",
  general: "#94a3b8",
};

export default function MapView({ markers }: { markers: Marker[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current || mapRef.current) return;
      const L = (await import("leaflet")).default;

      // Default centre: Taiz, Yemen.
      const center: [number, number] = markers.length
        ? [markers[0].lat, markers[0].lng]
        : [13.5795, 44.0209];

      const map = L.map(ref.current, { zoomControl: true }).setView(center, markers.length ? 8 : 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      for (const m of markers) {
        if (cancelled) break;
        const color = COLORS[m.category] ?? COLORS.general;
        L.circleMarker([m.lat, m.lng], {
          radius: 8,
          color,
          fillColor: color,
          fillOpacity: 0.5,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(
            `<div dir="rtl" style="font-family:Tahoma,Arial"><b>${m.label}</b><br/>` +
              `${m.description ?? ""}<br/>درجة الثقة: ${m.confidence}/100</div>`,
          );
      }
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove?: () => void } | null;
      if (map?.remove) {
        map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="h-[520px] w-full overflow-hidden rounded-2xl border border-[var(--border)]" />;
}
