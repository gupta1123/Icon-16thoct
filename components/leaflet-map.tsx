"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
// Custom cluster styles
import './marker-cluster.css';
import L from 'leaflet';
import { FC, memo, useEffect, useMemo, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type MarkerVariant = "current" | "home" | "checkin" | "checkout" | "visit" | undefined;

interface MarkerData {
  id: number | string;
  label?: string;
  subtitle?: string;
  timestamp?: string | null;
  storeName?: string | null;
  description?: string | null;
  variant?: MarkerVariant;
  lat: number;
  lng: number;
  number?: number; // For numbered visit markers
  employeeColor?: string; // For unique employee colors in live view
}

interface LeafletMapProps {
  center: [number, number];
  zoom: number;
  highlightedEmployee: { id?: number | string; listId?: number | string } | null;
  markers?: MarkerData[];
  onMarkerClick?: (marker: MarkerData) => void;
}

const getHighlightedId = (employee: { id?: number | string; listId?: number | string } | null) => {
  if (!employee) return null;
  const emp = employee as { id?: number | string; listId?: number | string; location?: number | string };
  if (emp.listId) return emp.listId;
  if (emp.id) return emp.id;
  if (emp.location) return emp.location;
  return String(employee);
};

// Helper component to imperatively update map view when props change
const MapController: FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    try {
      map.flyTo(center, zoom, { duration: 0.8 });
    } catch {
      // no-op
    }
  }, [center[0], center[1], zoom]);
  return null;
};


const markerColors: Record<Exclude<MarkerVariant, undefined>, string> = {
  current: '#10b981',
  home: '#64748b',
  checkin: '#2563eb',
  checkout: '#f59e0b',
  visit: '#8b5cf6',
};

const variantLabel: Record<Exclude<MarkerVariant, undefined>, string> = {
  current: 'Current',
  home: 'Home',
  checkin: 'Check-in',
  checkout: 'Checkout',
  visit: 'Scheduled Visit',
};

const formatHumanTime = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (isToday(date)) {
    return `Today ${format(date, 'hh:mm a')}`;
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'hh:mm a')}`;
  }
  return format(date, "d MMM ''yy hh:mm a");
};

const LeafletMapComponent: FC<LeafletMapProps> = ({ center, zoom, highlightedEmployee, markers = [], onMarkerClick }) => {
  const [isClient, setIsClient] = useState(false);
  const markerSignature = useMemo(
    () =>
      markers
        .map(
          (marker) =>
            `${marker.id}-${marker.lat}-${marker.lng}-${marker.variant ?? 'na'}-${marker.number ?? 'x'}`
        )
        .join('|'),
    [markers]
  );

  const svgIcons = useMemo(() => {
    return Object.entries(markerColors).reduce<Record<Exclude<MarkerVariant, undefined>, L.Icon>>((acc, [variant, color]) => {
          const svg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.667 11.379 24.289 14.819 27.915a1.6 1.6 0 0 0 2.362 0C20.621 40.289 32 27.667 32 16 32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="7" fill="#ffffff"/>
      </svg>`;
      const icon = L.icon({
        iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        iconSize: [32, 48],
        iconAnchor: [16, 48],
        popupAnchor: [0, -44],
      });
      acc[variant as keyof typeof markerColors] = icon;
      return acc;
    }, {} as Record<Exclude<MarkerVariant, undefined>, L.Icon>);
  }, []);

  // Create numbered markers for visit points
  const createNumberedMarker = (number: number, color: string) => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.667 11.379 24.289 14.819 27.915a1.6 1.6 0 0 0 2.362 0C20.621 40.289 32 27.667 32 16 32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="8" fill="#ffffff" stroke="${color}" stroke-width="2"/>
        <text x="16" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="${color}">${number}</text>
      </svg>`;
    return L.icon({
      iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      iconSize: [32, 48],
      iconAnchor: [16, 48],
      popupAnchor: [0, -44],
    });
  };

  // Create employee markers with unique colors
  const createEmployeeMarker = (color: string, variant: MarkerVariant) => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.667 11.379 24.289 14.819 27.915a1.6 1.6 0 0 0 2.362 0C20.621 40.289 32 27.667 32 16 32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="7" fill="#ffffff"/>
        ${variant === 'home' ? `<path d="M16 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 10c-3.3 0-6 2.7-6 6v2h12v-2c0-3.3-2.7-6-6-6z" fill="${color}"/>` : ''}
      </svg>`;
    return L.icon({
      iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      iconSize: [32, 48],
      iconAnchor: [16, 48],
      popupAnchor: [0, -44],
    });
  };

  const defaultIcon = useMemo(() => L.icon({
    iconUrl: L.Icon.Default.imagePath ? `${L.Icon.Default.imagePath}/marker-icon.png` : 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  }), []);

// Marker Cluster Group component
const MarkerClusterGroup: FC<{ markers: MarkerData[]; onMarkerClick?: (marker: MarkerData) => void }> = ({ markers, onMarkerClick }) => {
  const map = useMap();
  const [clusterGroup, setClusterGroup] = useState<L.MarkerClusterGroup | null>(null);
  const fallbackMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Import markercluster dynamically to avoid SSR issues
    import('leaflet.markercluster').then((MarkerClusterGroup) => {
      try {
        const cluster = new (MarkerClusterGroup as { default: new (options: { chunkedLoading: boolean; chunkProgress: (processed: number, total: number) => void; iconCreateFunction?: (cluster: L.MarkerCluster) => L.DivIcon }) => L.MarkerClusterGroup }).default({
          chunkedLoading: true,
          chunkProgress: (_processed: number, _total: number) => {
            // Optional: show loading progress
          },
          // Custom cluster icon
          iconCreateFunction: (cluster: L.MarkerCluster) => {
            const count = cluster.getChildCount();
            let className = 'marker-cluster-small';
            
            if (count < 10) {
              className = 'marker-cluster-small';
            } else if (count < 100) {
              className = 'marker-cluster-medium';
            } else {
              className = 'marker-cluster-large';
            }

            return new L.DivIcon({
              html: `<div><span>${count}</span></div>`,
              className: `marker-cluster ${className}`,
              iconSize: new L.Point(40, 40)
            });
          }
        });

        setClusterGroup(cluster);
        map.addLayer(cluster);
      } catch (_error) {
        console.warn('Marker clustering failed to load, falling back to individual markers');
        // Fallback: create individual markers without clustering
        setClusterGroup(null);
      }
    }).catch((_error) => {
      console.warn('Marker clustering library failed to load:', _error);
      // Fallback: create individual markers without clustering
      setClusterGroup(null);
    });

    return () => {
      if (clusterGroup) {
        map.removeLayer(clusterGroup);
      }
    };
  }, [map]);

  useEffect(() => {
    // Remove any fallback markers from previous render before drawing new ones
    if (fallbackMarkersRef.current.length > 0) {
      fallbackMarkersRef.current.forEach(marker => {
        try {
          map.removeLayer(marker);
        } catch {
          // Marker might already be removed – ignore
        }
      });
      fallbackMarkersRef.current = [];
    }

    if (clusterGroup) {
      // Clear existing markers
      clusterGroup.clearLayers();

      // Add new markers to cluster
      markers.forEach(marker => {
        let icon;
        
        if (marker.number) {
          // Numbered markers for visit trails
          icon = createNumberedMarker(marker.number, markerColors[marker.variant || 'visit']);
        } else if (marker.employeeColor && (marker.variant === 'current' || marker.variant === 'home')) {
          // Use employee color for live location markers
          icon = createEmployeeMarker(marker.employeeColor, marker.variant);
        } else {
          // Default variant icons
          icon = marker.variant ? svgIcons[marker.variant] ?? defaultIcon : defaultIcon;
        }

        const leafletMarker = L.marker([marker.lat, marker.lng], { icon });

        // Add popup
        const popupContent = `
          <div class="space-y-2">
            <div>
              <div class="text-sm font-semibold text-foreground">${marker.label || 'Location'}</div>
              ${marker.variant ? `
                <div class="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${markerColors[marker.variant] || '#94a3b8'}"></span>
                  ${variantLabel[marker.variant] || 'Location'}
                </div>
              ` : ''}
            </div>
            ${marker.timestamp ? `<div class="text-xs text-muted-foreground">${formatHumanTime(marker.timestamp)}</div>` : ''}
            ${marker.storeName ? `<div class="text-xs text-muted-foreground">${marker.storeName}</div>` : ''}
            ${marker.description ? `<div class="text-xs text-muted-foreground">${marker.description}</div>` : ''}
          </div>
        `;

        leafletMarker.bindPopup(popupContent, { className: 'app-leaflet-popup' });

        // Add click handler
        if (onMarkerClick) {
          leafletMarker.on('click', () => onMarkerClick(marker));
        }

        clusterGroup.addLayer(leafletMarker);
      });
    } else {
      // Fallback: add individual markers directly to map when clustering is not available
      // Clean up previously added fallback markers
      fallbackMarkersRef.current.forEach(marker => {
        try {
          map.removeLayer(marker);
        } catch {
          // ignore if already removed
        }
      });
      fallbackMarkersRef.current = [];

      markers.forEach(marker => {
        let icon;
        
        if (marker.number) {
          // Numbered markers for visit trails
          icon = createNumberedMarker(marker.number, markerColors[marker.variant || 'visit']);
        } else if (marker.employeeColor && (marker.variant === 'current' || marker.variant === 'home')) {
          // Use employee color for live location markers
          icon = createEmployeeMarker(marker.employeeColor, marker.variant);
        } else {
          // Default variant icons
          icon = marker.variant ? svgIcons[marker.variant] ?? defaultIcon : defaultIcon;
        }

        const leafletMarker = L.marker([marker.lat, marker.lng], { icon });

        // Add popup
        const popupContent = `
          <div class="space-y-2">
            <div>
              <div class="text-sm font-semibold text-foreground">${marker.label || 'Location'}</div>
              ${marker.variant ? `
                <div class="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <span class="inline-block h-2 w-2 rounded-full" style="background-color: ${markerColors[marker.variant] || '#94a3b8'}"></span>
                  ${variantLabel[marker.variant] || 'Location'}
                </div>
              ` : ''}
            </div>
            ${marker.timestamp ? `<div class="text-xs text-muted-foreground">${formatHumanTime(marker.timestamp)}</div>` : ''}
            ${marker.storeName ? `<div class="text-xs text-muted-foreground">${marker.storeName}</div>` : ''}
            ${marker.description ? `<div class="text-xs text-muted-foreground">${marker.description}</div>` : ''}
          </div>
        `;

        leafletMarker.bindPopup(popupContent, { className: 'app-leaflet-popup' });

        // Add click handler
        if (onMarkerClick) {
          leafletMarker.on('click', () => onMarkerClick(marker));
        }

        map.addLayer(leafletMarker);
        fallbackMarkersRef.current.push(leafletMarker);
      });
    }
    return () => {
      fallbackMarkersRef.current.forEach(marker => {
        try {
          map.removeLayer(marker);
        } catch {
          // ignore if already removed
        }
      });
      fallbackMarkersRef.current = [];
    };
  }, [clusterGroup, markers, onMarkerClick, map]);

  return null;
};

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="h-full w-full bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  return (
    <MapContainer 
      key={markerSignature}
      center={center} 
      zoom={zoom} 
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      {/* Keep map view in sync with incoming props */}
      <MapController center={center} zoom={zoom} />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        // attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> & OpenStreetMap contributors'
      />
      {/* Use marker clustering for better UX with overlapping markers */}
      <MarkerClusterGroup markers={markers} onMarkerClick={onMarkerClick} />
    </MapContainer>
  );
};

const LeafletMap = memo(
  LeafletMapComponent,
  (prev, next) => {
    if (prev.zoom !== next.zoom) return false;
    if (prev.center[0] !== next.center[0] || prev.center[1] !== next.center[1]) {
      return false;
    }
    if (
      getHighlightedId(prev.highlightedEmployee) !==
      getHighlightedId(next.highlightedEmployee)
    ) {
      return false;
    }
    if (prev.markers !== next.markers) {
      return false;
    }
    return true;
  }
);

LeafletMap.displayName = 'LeafletMap';

export default LeafletMap;
