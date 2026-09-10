"use client";

import { useMemo } from "react";
import EmployeeLocationMap from "./employee-location-map";
import { formatLocationTime, locationTimestamp, type LocationMarker } from "@/lib/employee-locations";

interface MarkerData {
  id: number | string; label?: string; subtitle?: string; timestamp?: string | null;
  storeName?: string | null; description?: string | null;
  variant?: "current" | "home" | "checkin" | "checkout" | "visit" | "store";
  lat: number; lng: number; number?: number; employeeColor?: string;
}
interface LeafletMapProps {
  center: [number, number]; zoom: number;
  highlightedEmployee: { id?: number | string; listId?: number | string } | null;
  markers?: MarkerData[]; onMarkerClick?: (marker: MarkerData) => void;
  onCenterChange?: (center: [number, number]) => void;
  onZoomChange?: (zoom: number) => void;
}
/** Compatibility adapter: every Icon map uses the same key-free map renderer. */
export default function LeafletMap({ markers = [], onMarkerClick, ...props }: LeafletMapProps) {
  const converted = useMemo<LocationMarker[]>(() => markers.map(marker => {
    const storeId = marker.variant === "store" ? Number(String(marker.id).replace("store-", "")) : undefined;
    return { id: marker.id, lat: marker.lat, lng: marker.lng,
      name: marker.storeName || marker.label, subtitle: marker.subtitle || marker.description || formatLocationTime(locationTimestamp(marker.timestamp)),
      type: marker.variant === "home" ? "house" : marker.variant === "store" ? "store" : marker.number != null ? "visit" : "live",
      order: marker.number, updatedAt: locationTimestamp(marker.timestamp),
      storeId: Number.isFinite(storeId) ? storeId : undefined,
    };
  }), [markers]);
  return <EmployeeLocationMap center={props.center} zoom={props.zoom}
    highlightedEmployee={props.highlightedEmployee} markers={converted}
    onMarkerClick={marker => { const original = markers.find(item => item.id === marker.id); if (original) onMarkerClick?.(original); }} />;
}
