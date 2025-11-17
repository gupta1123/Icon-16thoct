"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Users, Building, Calendar, Store, Loader2, X } from "lucide-react";
import type { ExtendedEmployee, MapMarker, StateItem } from "./types";

const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
});

interface StoreLocation {
  storeId: number;
  storeName: string;
  city?: string | null;
  state?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const parseStoreCoordinate = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeStoreLocations = (data: unknown): StoreLocation[] => {
  if (!Array.isArray(data)) {
    return [];
  }

  const result = data
    .map((item): StoreLocation | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const idRaw = record.storeId ?? record.id;
      const idValue = typeof idRaw === "number" ? idRaw : Number(idRaw);

      if (!Number.isFinite(idValue)) {
        return null;
      }

      const nameRaw = record.storeName ?? record.name;
      const storeName =
        typeof nameRaw === "string" && nameRaw.trim().length > 0
          ? nameRaw.trim()
          : `Store ${idValue}`;

      // Handle city and state - normalize empty strings to null, preserve null values
      const cityValue = record.city;
      const stateValue = record.state;
      const districtValue = record.district;
      const city = typeof cityValue === "string" && cityValue.trim().length > 0 ? cityValue.trim() : null;
      const state = typeof stateValue === "string" && stateValue.trim().length > 0 ? stateValue.trim() : null;
      const district = typeof districtValue === "string" && districtValue.trim().length > 0 ? districtValue.trim() : null;

      return {
        storeId: idValue as number,
        storeName,
        city,
        state,
        district,
        latitude: parseStoreCoordinate(record.latitude),
        longitude: parseStoreCoordinate(record.longitude),
      };
    })
    .filter((value): value is StoreLocation => value !== null);
  
  return result;
};

const STORE_FILTER_KEYS = ["storeName", "district"] as const;
type StoreFilterKey = (typeof STORE_FILTER_KEYS)[number];
type StoreFiltersState = Record<StoreFilterKey, string>;
const INITIAL_STORE_FILTERS: StoreFiltersState = {
  storeName: "",
  district: "",
};

const STORE_FILTER_QUERY_KEYS: Record<StoreFilterKey, string> = {
  storeName: "storeName",
  district: "storeDistrict",
};

const DEFAULT_STORE_PAGE_SIZE = 10;

// Default zoomed-out map view (matches dashboard default – India-wide)
const DEFAULT_MAP_CENTER: [number, number] = [20.5937, 78.9629];
const DEFAULT_MAP_ZOOM = 5;

const formatCoordinate = (value?: number | null, fractionDigits = 4) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(fractionDigits);
};

const readResponseMessage = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      if (typeof payload === "string") {
        return payload;
      }
      if (payload && typeof payload === "object") {
        if ("message" in payload && payload.message) {
          return String(payload.message);
        }
        if ("error" in payload && payload.error) {
          return String(payload.error);
        }
      }
    } catch {
      // ignore parse errors
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch {
      // ignore parse errors
    }
  }

  return `Request failed with status ${response.status}`;
};

interface DashboardKpis {
  totalVisits: number;
  activeEmployees: number;
  liveLocations: number;
}

interface DashboardLiveViewProps {
  kpis: DashboardKpis;
  states: StateItem[];
  onStateSelect: (state: StateItem) => void;
  isLoadingTrail: boolean;
  mapCenter: [number, number];
  mapZoom: number;
  onMapCenterChange: (center: [number, number]) => void;
  onMapZoomChange: (zoom: number) => void;
  highlightedEmployee: ExtendedEmployee | null;
  mapMarkers: MapMarker[];
  onResetMap: () => void;
  selectedEmployeeForMap: ExtendedEmployee | null;
  employeeSearchTerm: string;
  onEmployeeSearch: (value: string) => void;
  employeeList: ExtendedEmployee[];
  filteredEmployeeList: ExtendedEmployee[];
  onEmployeeSelect: (employee: ExtendedEmployee) => void;
  getInitials: (name: string) => string;
}

export function DashboardLiveView({
  kpis,
  states,
  onStateSelect,
  isLoadingTrail,
  mapCenter,
  mapZoom,
  onMapCenterChange,
  onMapZoomChange,
  highlightedEmployee,
  mapMarkers,
  onResetMap,
  selectedEmployeeForMap,
  employeeSearchTerm,
  onEmployeeSearch,
  employeeList,
  filteredEmployeeList,
  onEmployeeSelect,
  getInitials,
}: DashboardLiveViewProps) {
  const [showStores, setShowStores] = useState(false);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [isStoresLoading, setIsStoresLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [originalMapCenter, setOriginalMapCenter] = useState<[number, number] | null>(null);
  const [originalMapZoom, setOriginalMapZoom] = useState<number | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [storeFilters, setStoreFilters] = useState<StoreFiltersState>(() => ({ ...INITIAL_STORE_FILTERS }));
  const [currentStoreFilters, setCurrentStoreFilters] = useState<StoreFiltersState>(() => ({
    ...INITIAL_STORE_FILTERS,
  }));
  const [currentStorePage, setCurrentStorePage] = useState(0);
  const [storePageSize, setStorePageSize] = useState(DEFAULT_STORE_PAGE_SIZE);
  const [storeTotalElements, setStoreTotalElements] = useState(0);
  const [storeTotalPages, setStoreTotalPages] = useState(0);
  const [isStoreFiltersInitialized, setIsStoreFiltersInitialized] = useState(false);
  const latestStoreRequestRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fetchStoreLocations = useCallback(
    async ({
      page = currentStorePage,
      size = storePageSize,
      filters = currentStoreFilters,
    }: {
      page?: number;
      size?: number;
      filters?: { storeName?: string; district?: string };
    } = {}) => {
      const authToken =
        typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

      if (!authToken) {
        setStoreError("Authentication token not found. Please log in.");
        setStores([]);
        setStoreTotalElements(0);
        setStoreTotalPages(0);
        return;
      }

      const safePage =
        typeof page === "number" && Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0;
      const safeSize =
        typeof size === "number" && Number.isFinite(size) ? Math.max(1, Math.floor(size)) : storePageSize;
      const trimmedFilters = {
        storeName: filters?.storeName?.trim() ?? "",
        district: filters?.district?.trim() ?? "",
      };

      const requestId = latestStoreRequestRef.current + 1;
      latestStoreRequestRef.current = requestId;
      setIsStoresLoading(true);
      setStoreError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", safePage.toString());
        params.set("pae", safePage.toString());
        params.set("size", safeSize.toString());
        if (trimmedFilters.storeName) {
          params.set("storeName", trimmedFilters.storeName);
        }
        if (trimmedFilters.district) {
          params.set("district", trimmedFilters.district);
        }

        const response = await fetch(`/api/proxy/store/summary?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const message = await readResponseMessage(response);
          throw new Error(message);
        }

        const payload = (await response.json()) as unknown;
        const isValidPayload =
          payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { content?: unknown[] }).content);

        if (!isValidPayload) {
          throw new Error("Unexpected response format while fetching store locations.");
        }

        const pageData = payload as {
          content: unknown[];
          number?: number;
          size?: number;
          totalElements?: number;
          totalPages?: number;
        };

        const normalized = normalizeStoreLocations(pageData.content);

        if (latestStoreRequestRef.current !== requestId) {
          return;
        }

        const resolvedPage =
          typeof pageData.number === "number" && pageData.number >= 0 ? pageData.number : safePage;
        const resolvedSize =
          typeof pageData.size === "number" && pageData.size > 0 ? pageData.size : safeSize;
        const resolvedTotalElements =
          typeof pageData.totalElements === "number" && pageData.totalElements >= 0
            ? pageData.totalElements
            : normalized.length;
        const resolvedTotalPages =
          typeof pageData.totalPages === "number" && pageData.totalPages >= 0
            ? pageData.totalPages
            : resolvedTotalElements > 0
            ? Math.ceil(resolvedTotalElements / resolvedSize)
            : 0;

        setStores(normalized);
        setCurrentStorePage(resolvedPage);
        setStorePageSize(resolvedSize);
        setStoreTotalElements(resolvedTotalElements);
        setStoreTotalPages(resolvedTotalPages);
        setCurrentStoreFilters(trimmedFilters);
        setStoreFilters(trimmedFilters);
      } catch (err) {
        console.error("Dashboard - Error loading store locations:", err);
        if (latestStoreRequestRef.current === requestId) {
          setStores([]);
          setStoreTotalElements(0);
          setStoreTotalPages(0);
          setStoreError(
            err instanceof Error ? err.message : "Unable to load store locations right now."
          );
        }
      } finally {
        if (latestStoreRequestRef.current === requestId) {
          setIsStoresLoading(false);
        }
      }
    },
    [currentStoreFilters, currentStorePage, latestStoreRequestRef, storePageSize]
  );

  const handleStoreFilterSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      setCurrentStoreFilters(storeFilters);
      void fetchStoreLocations({
        page: 0,
        size: storePageSize,
        filters: storeFilters,
      });
    },
    [fetchStoreLocations, storeFilters, storePageSize]
  );

  const handleClearStoreFilters = useCallback(() => {
    const clearedFilters = { ...INITIAL_STORE_FILTERS };
    setStoreFilters(clearedFilters);
    setCurrentStoreFilters(clearedFilters);
    void fetchStoreLocations({
      page: 0,
      size: storePageSize,
      filters: clearedFilters,
    });
  }, [fetchStoreLocations, storePageSize]);

  const handleStorePageChange = useCallback(
    (direction: "previous" | "next") => {
      if (direction === "previous" && currentStorePage > 0) {
        void fetchStoreLocations({ page: currentStorePage - 1 });
        return;
      }

      if (direction === "next" && currentStorePage + 1 < storeTotalPages) {
        void fetchStoreLocations({ page: currentStorePage + 1 });
      }
    },
    [currentStorePage, fetchStoreLocations, storeTotalPages]
  );

  const handleStorePageSizeChange = useCallback(
    (value: string) => {
      const nextSize = Number(value);
      if (!Number.isFinite(nextSize) || nextSize <= 0) {
        return;
      }
      setStorePageSize(nextSize);
      void fetchStoreLocations({ page: 0, size: nextSize });
    },
    [fetchStoreLocations]
  );

  const resolvedStores = useMemo(() => {
    return [...stores].sort((a, b) => {
      const nameA = (a.storeName ?? "").trim().toLowerCase();
      const nameB = (b.storeName ?? "").trim().toLowerCase();

      if (nameA && nameB) {
        const nameCompare = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
        if (nameCompare !== 0) {
          return nameCompare;
        }
      } else if (nameA) {
        return -1;
      } else if (nameB) {
        return 1;
      }

      const aId = Number(a.storeId);
      const bId = Number(b.storeId);

      if (Number.isFinite(aId) && Number.isFinite(bId)) {
        return aId - bId;
      }
      if (Number.isFinite(aId)) {
        return -1;
      }
      if (Number.isFinite(bId)) {
        return 1;
      }

      return 0;
    });
  }, [stores]);

  const hasActiveStoreFilters = useMemo(
    () => Boolean(currentStoreFilters.storeName || currentStoreFilters.district),
    [currentStoreFilters]
  );

  const storeRangeLabel = useMemo(() => {
    if (storeTotalElements === 0) {
      return "0 of 0";
    }
    if (resolvedStores.length === 0) {
      return `0 of ${storeTotalElements}`;
    }
    const startIndex = currentStorePage * storePageSize;
    const first = startIndex + 1;
    const last = Math.min(storeTotalElements, startIndex + resolvedStores.length);
    return `${first}-${last} of ${storeTotalElements}`;
  }, [currentStorePage, resolvedStores.length, storePageSize, storeTotalElements]);

  const canGoToPreviousStorePage = currentStorePage > 0;
  const canGoToNextStorePage = storeTotalPages > 0 && currentStorePage + 1 < storeTotalPages;
  const currentStorePageDisplay = storeTotalPages > 0 ? currentStorePage + 1 : storeTotalElements === 0 ? 0 : 1;
  const canClearStoreFilters =
    hasActiveStoreFilters ||
    storeFilters.storeName.trim().length > 0 ||
    storeFilters.district.trim().length > 0;

  const storeMarkers = useMemo<MapMarker[]>(() => {
    return resolvedStores
      .filter(
        (store) =>
          typeof store.latitude === "number" &&
          Number.isFinite(store.latitude) &&
          typeof store.longitude === "number" &&
          Number.isFinite(store.longitude)
      )
      .map((store) => ({
        id: `store-${store.storeId}`,
        label: store.storeName,
        storeName: store.storeName,
        description: [store.district, store.city, store.state].filter(Boolean).join(", "),
        lat: store.latitude as number,
        lng: store.longitude as number,
        variant: "store",
      }));
  }, [resolvedStores]);

  const displayMarkers = useMemo<MapMarker[]>(() => {
    const markers = showStores ? storeMarkers : mapMarkers;
    return markers.length > 0 ? markers.slice() : markers;
  }, [mapMarkers, showStores, storeMarkers]);

  const handleLayerToggle = useCallback(
    (layer: "employees" | "stores") => {
      if (layer === "stores") {
        // Save the current map state when switching to stores view (if not already saved)
        if (!showStores && (originalMapCenter === null || originalMapZoom === null)) {
          setOriginalMapCenter(mapCenter);
          setOriginalMapZoom(mapZoom);
        }
        setShowStores(true);
        setSelectedStoreId(null);
        if (stores.length === 0 && !isStoresLoading) {
          void fetchStoreLocations();
        }
        // When switching from Employees → Stores, zoom out to give a network overview
        onMapCenterChange(DEFAULT_MAP_CENTER);
        onMapZoomChange(DEFAULT_MAP_ZOOM);
        return;
      }

      setShowStores(false);
      setStoreError(null);
      setSelectedStoreId(null);
      setOriginalMapCenter(null);
      setOriginalMapZoom(null);
      onResetMap();
    },
    [fetchStoreLocations, isStoresLoading, onResetMap, stores.length, showStores, originalMapCenter, originalMapZoom, mapCenter, mapZoom]
  );

  const handleRetryStores = useCallback(() => {
    void fetchStoreLocations();
  }, [fetchStoreLocations]);

  useEffect(() => {
    if (isStoreFiltersInitialized) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    const initialFilters: StoreFiltersState = { ...INITIAL_STORE_FILTERS };

    STORE_FILTER_KEYS.forEach((key) => {
      const queryKey = STORE_FILTER_QUERY_KEYS[key];
      const paramValue = params.get(queryKey);
      if (paramValue !== null) {
        initialFilters[key] = paramValue;
      }
    });

    const pageParam = params.get("storePage");
    const parsedPage = pageParam !== null ? Number(pageParam) - 1 : NaN;
    const isValidPage = Number.isFinite(parsedPage) && parsedPage >= 0;

    const sizeParam = params.get("storePageSize");
    const parsedSize = sizeParam !== null ? Number(sizeParam) : NaN;
    const isValidSize = Number.isFinite(parsedSize) && parsedSize > 0;

    if (isValidSize) {
      setStorePageSize(parsedSize);
    }

    if (isValidPage) {
      setCurrentStorePage(parsedPage);
    }

    setStoreFilters(initialFilters);
    setCurrentStoreFilters(initialFilters);

    const hasFilterValues = STORE_FILTER_KEYS.some((key) => initialFilters[key].trim().length > 0);
    const shouldShowStoresInitially = params.get("storeView") === "stores" || hasFilterValues;

    if (shouldShowStoresInitially) {
      setShowStores(true);
      void fetchStoreLocations({
        page: isValidPage ? parsedPage : 0,
        size: isValidSize ? parsedSize : DEFAULT_STORE_PAGE_SIZE,
        filters: initialFilters,
      });
    }

    setIsStoreFiltersInitialized(true);
  }, [
    fetchStoreLocations,
    isStoreFiltersInitialized,
    searchParams,
  ]);

  useEffect(() => {
    if (!isStoreFiltersInitialized) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    let hasUpdates = false;

    STORE_FILTER_KEYS.forEach((key) => {
      const queryKey = STORE_FILTER_QUERY_KEYS[key];
      const value = currentStoreFilters[key].trim();

      if (value) {
        if (params.get(queryKey) !== value) {
          params.set(queryKey, value);
          hasUpdates = true;
        }
      } else if (params.has(queryKey)) {
        params.delete(queryKey);
        hasUpdates = true;
      }
    });

    if (showStores) {
      if (params.get("storeView") !== "stores") {
        params.set("storeView", "stores");
        hasUpdates = true;
      }
    } else if (params.has("storeView")) {
      params.delete("storeView");
      hasUpdates = true;
    }

    if (currentStorePage > 0) {
      const pageValue = String(currentStorePage + 1);
      if (params.get("storePage") !== pageValue) {
        params.set("storePage", pageValue);
        hasUpdates = true;
      }
    } else if (params.has("storePage")) {
      params.delete("storePage");
      hasUpdates = true;
    }

    if (storePageSize !== DEFAULT_STORE_PAGE_SIZE) {
      const sizeValue = String(storePageSize);
      if (params.get("storePageSize") !== sizeValue) {
        params.set("storePageSize", sizeValue);
        hasUpdates = true;
      }
    } else if (params.has("storePageSize")) {
      params.delete("storePageSize");
      hasUpdates = true;
    }

    if (!hasUpdates) {
      return;
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [
    currentStoreFilters,
    currentStorePage,
    isStoreFiltersInitialized,
    pathname,
    router,
    searchParams,
    showStores,
    storePageSize,
  ]);

  const handleMarkerClick = useCallback(
    (marker: { variant?: string; lat: number; lng: number; id?: number | string }) => {
      if (marker.variant === "store") {
        // Save the current map state before zooming (if not already saved)
        if (originalMapCenter === null || originalMapZoom === null) {
          setOriginalMapCenter(mapCenter);
          setOriginalMapZoom(mapZoom);
        }
        // Zoom to this store marker
        const markerId = typeof marker.id === "string" ? marker.id : String(marker.id);
        const storeIdMatch = markerId?.match(/store-(\d+)/);
        if (storeIdMatch) {
          setSelectedStoreId(Number(storeIdMatch[1]));
        }
        onMapCenterChange([marker.lat, marker.lng]);
        onMapZoomChange(15);
      }
    },
    [onMapCenterChange, onMapZoomChange, originalMapCenter, originalMapZoom, mapCenter, mapZoom]
  );

  const handleStoreClick = useCallback(
    (store: StoreLocation) => {
      if (
        typeof store.latitude === "number" &&
        Number.isFinite(store.latitude) &&
        typeof store.longitude === "number" &&
        Number.isFinite(store.longitude)
      ) {
        // Save the current map state before zooming (if not already saved)
        if (originalMapCenter === null || originalMapZoom === null) {
          setOriginalMapCenter(mapCenter);
          setOriginalMapZoom(mapZoom);
        }
        setSelectedStoreId(store.storeId);
        onMapCenterChange([store.latitude, store.longitude]);
        onMapZoomChange(15);
      }
    },
    [onMapCenterChange, onMapZoomChange, originalMapCenter, originalMapZoom, mapCenter, mapZoom]
  );

  const handleResetStoreView = useCallback(() => {
    setSelectedStoreId(null);
    
    // Restore to the original view before store selection, or default if no original saved
    if (originalMapCenter !== null && originalMapZoom !== null) {
      onMapCenterChange(originalMapCenter);
      onMapZoomChange(originalMapZoom);
      setOriginalMapCenter(null);
      setOriginalMapZoom(null);
    } else {
      // Fallback to default reset behavior
      onResetMap();
    }
  }, [onResetMap, onMapCenterChange, onMapZoomChange, originalMapCenter, originalMapZoom]);

  useEffect(() => {
    if (selectedStoreId === null) {
      return;
    }

    const isVisible = resolvedStores.some((store) => store.storeId === selectedStoreId);
    if (!isVisible) {
      setSelectedStoreId(null);
    }
  }, [resolvedStores, selectedStoreId]);

  // Filter and sort stores alphabetically (matching Employees search pattern)

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Visits</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.totalVisits}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.activeEmployees}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Live Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.liveLocations}
            </Heading>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          State-wise Employee Distribution
        </Heading>
        {states.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No active states</p>
            <p className="text-sm mt-1">No states have visit activity in this date range.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {states.map((state) => (
              <Card
                key={state.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => onStateSelect(state)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>{state.name}</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Heading as="p" size="xl" weight="bold">
                    {state.activeEmployeeCount}
                  </Heading>
                  <Text size="xs" tone="muted">
                    Employees with assigned or ongoing visits
                  </Text>
                  <Text size="xs" tone="muted" className="mt-1">
                    Ongoing: {state.ongoingVisitCount} • Completed: {state.completedVisitCount}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Heading as="h2" size="2xl" weight="semibold">
            {showStores ? "Store Coverage Map" : "Live Employee Locations"}
          </Heading>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col sm:items-end">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Map focus
              </span>
              <div className="mt-2 inline-flex rounded-full border bg-background/80 p-1 shadow-sm backdrop-blur-sm dark:bg-neutral-950/80">
                <button
                  type="button"
                  onClick={() => handleLayerToggle("employees")}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    showStores
                      ? "text-muted-foreground hover:text-foreground"
                      : "bg-primary text-primary-foreground shadow"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Employees</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLayerToggle("stores")}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    showStores
                      ? "bg-blue-600 text-white shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span>Stores</span>
                  {showStores && canClearStoreFilters && (
                    <X
                      className="h-3.5 w-3.5 ml-1 hover:opacity-70 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearStoreFilters();
                      }}
                    />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              {showStores ? (
                storeError ? (
                  <>
                    <MapPin className="h-4 w-4" />
                    <span>We couldn&apos;t load store locations.</span>
                  </>
                ) : isStoresLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading store locations...</span>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs font-semibold sm:text-sm">
                      <Store className="h-3 w-3" />
                      {storeTotalElements === 0
                        ? "No store locations"
                        : `Showing ${storeRangeLabel} stores`}
                    </Badge>
                    <span>Use this view to compare coverage clusters.</span>
                  </>
                )
              ) : (
                <span>Monitor your field team&apos;s live movement.</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
          <Text tone="muted">
            {showStores
              ? "Explore store hotspots pulled directly from the stores API to plan upcoming coverage."
              : "Select an employee to jump to their latest location."}
          </Text>
          <Button variant="outline" size="sm" onClick={showStores ? handleResetStoreView : onResetMap}>
            Reset View
          </Button>
        </div>
        {showStores && storeError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Unable to show store locations</p>
              <p className="text-xs opacity-80">{storeError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetryStores}>
              Try again
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <Card className="relative h-[600px] overflow-hidden rounded-xl">
              {!showStores && isLoadingTrail && (
                <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow">
                  Loading trail...
                </div>
              )}
              {showStores && isStoresLoading && (
                <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow">
                  Loading store locations...
                </div>
              )}
              <div className="pointer-events-none absolute left-4 top-4 z-[1000]">
                <Badge
                  variant="secondary"
                  className={`font-semibold shadow-lg backdrop-blur-sm ${
                    showStores
                      ? "bg-blue-100/90 text-blue-700 border-blue-200 dark:bg-blue-950/90 dark:text-blue-200 dark:border-blue-800"
                      : "bg-primary/90 text-primary-foreground border-primary/20"
                  }`}
                >
                  {showStores ? (
                    <>
                      <Store className="mr-1.5 h-3 w-3" /> Store View
                    </>
                  ) : (
                    <>
                      <Users className="mr-1.5 h-3 w-3" /> Employee View
                    </>
                  )}
                </Badge>
              </div>
              <LeafletMap
                center={mapCenter}
                zoom={mapZoom}
                highlightedEmployee={showStores ? null : highlightedEmployee}
                markers={displayMarkers}
                onCenterChange={onMapCenterChange}
                onZoomChange={onMapZoomChange}
                onMarkerClick={handleMarkerClick}
              />
            </Card>
          </div>
          {showStores ? (
            <div className="w-full lg:w-96">
              <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
                <CardHeader className="space-y-4 border-b">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Store className="h-5 w-5" />
                      <span>Store Network</span>
                    </CardTitle>
                    {!isStoresLoading && (
                      <Badge variant="secondary" className="w-fit whitespace-nowrap">
                        {storeTotalElements === 0
                          ? "No stores"
                          : `Showing ${storeRangeLabel}`}
                      </Badge>
                    )}
                  </div>
                  <Text size="sm" tone="muted">
                    Live store coverage pulled from the stores service. Filter updates automatically as you type.
                  </Text>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={storeFilters.storeName}
                          onChange={(event) => {
                            const value = event.target.value;
                            const nextFilters = {
                              ...storeFilters,
                              storeName: value,
                            };
                            setStoreFilters(nextFilters);
                            setCurrentStoreFilters(nextFilters);
                            void fetchStoreLocations({
                              page: 0,
                              size: storePageSize,
                              filters: nextFilters,
                            });
                          }}
                          placeholder="Filter by store name..."
                          className="h-9 pr-8"
                          aria-label="Filter by store name"
                        />
                        {storeFilters.storeName && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextFilters = {
                                ...storeFilters,
                                storeName: "",
                              };
                              setStoreFilters(nextFilters);
                              setCurrentStoreFilters(nextFilters);
                              void fetchStoreLocations({
                                page: 0,
                                size: storePageSize,
                                filters: nextFilters,
                              });
                            }}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Clear store name filter"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={storeFilters.district}
                          onChange={(event) => {
                            const value = event.target.value;
                            const nextFilters = {
                              ...storeFilters,
                              district: value,
                            };
                            setStoreFilters(nextFilters);
                            setCurrentStoreFilters(nextFilters);
                            void fetchStoreLocations({
                              page: 0,
                              size: storePageSize,
                              filters: nextFilters,
                            });
                          }}
                          placeholder="Filter by district..."
                          className="h-9 pr-8"
                          aria-label="Filter by district"
                        />
                        {storeFilters.district && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextFilters = {
                                ...storeFilters,
                                district: "",
                              };
                              setStoreFilters(nextFilters);
                              setCurrentStoreFilters(nextFilters);
                              void fetchStoreLocations({
                                page: 0,
                                size: storePageSize,
                                filters: nextFilters,
                              });
                            }}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Clear district filter"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {hasActiveStoreFilters && (
                      <Badge variant="outline" className="text-xs font-semibold">
                        Active filters:{" "}
                        {[currentStoreFilters.storeName, currentStoreFilters.district]
                          .filter(Boolean)
                          .join(", ")}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0">
                  {isStoresLoading ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Loading store locations...</span>
                    </div>
                  ) : storeTotalElements === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                      <Store className="h-10 w-10 opacity-30" />
                      <p className="font-medium">
                        {hasActiveStoreFilters ? "No stores match your filters" : "No store locations yet"}
                      </p>
                      <p className="text-sm">
                        {hasActiveStoreFilters
                          ? "Try adjusting your filters or clear them to see all stores."
                          : "The stores API did not return any locations. Try refreshing to sync again."}
                      </p>
                      {hasActiveStoreFilters ? (
                        <Button variant="ghost" size="sm" onClick={handleClearStoreFilters}>
                          Clear filters
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={handleRetryStores}>
                          Refresh data
                        </Button>
                      )}
                    </div>
                  ) : resolvedStores.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                      <Store className="h-10 w-10 opacity-30" />
                      <p className="font-medium">No stores on this page</p>
                      <p className="text-sm">Use the pagination controls below to navigate to another page.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {resolvedStores.map((store) => {
                        const locationLabel = [store.district, store.city, store.state]
                          .map((part) => (typeof part === "string" ? part.trim() : ""))
                          .filter((part) => part.length > 0)
                          .join(", ");
                        const hasCoordinates =
                          typeof store.latitude === "number" &&
                          Number.isFinite(store.latitude) &&
                          typeof store.longitude === "number" &&
                          Number.isFinite(store.longitude);

                        return (
                          <div
                            key={`store-${store.storeId}`}
                            className={`cursor-pointer p-4 transition-colors ${
                              selectedStoreId === store.storeId
                                ? "border-l-4 border-primary bg-accent"
                                : hasCoordinates
                                ? "hover:bg-accent/50"
                                : "opacity-60"
                            }`}
                            onClick={() => hasCoordinates && handleStoreClick(store)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <Heading as="p" size="md" className="text-foreground">
                                  {store.storeName}
                                </Heading>
                                <Text size="sm" tone="muted">
                                  {locationLabel || "Location unavailable"}
                                </Text>
                                {store.district && (
                                  <Text size="xs" tone="muted" className="mt-1">
                                    District: {store.district}
                                  </Text>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs font-semibold">
                                ID · {store.storeId}
                              </Badge>
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {hasCoordinates
                                  ? `${formatCoordinate(store.latitude)}, ${formatCoordinate(
                                      store.longitude
                                    )}`
                                  : "Coordinates unavailable"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
                <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                  <div>
                    {storeTotalElements === 0
                      ? "No stores to display"
                      : `Showing ${storeRangeLabel} ${storeTotalElements === 1 ? "store" : "stores"}`}
                    {storeTotalPages > 0 && (
                      <span className="ml-2">
                        Page {currentStorePageDisplay} of {storeTotalPages}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                        Page size
                      </span>
                      <Select
                        value={String(storePageSize)}
                        onValueChange={handleStorePageSizeChange}
                        disabled={isStoresLoading}
                      >
                        <SelectTrigger size="sm" className="w-[90px]">
                          <SelectValue aria-label="Store page size" />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20, 50].map((option) => (
                            <SelectItem key={option} value={String(option)}>
                              {option} / page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStorePageChange("previous")}
                        disabled={!canGoToPreviousStorePage || isStoresLoading}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStorePageChange("next")}
                        disabled={!canGoToNextStorePage || isStoresLoading}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="w-full lg:w-96">
              <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
                <CardHeader className="space-y-3 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    <span>
                      {selectedEmployeeForMap
                        ? `${selectedEmployeeForMap.name}&apos;s Data`
                        : "Active Employees"}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge variant="secondary">
                        {selectedEmployeeForMap
                          ? "1 selected"
                          : employeeSearchTerm.trim()
                          ? `${filteredEmployeeList.length} of ${employeeList.length}`
                          : `${employeeList.length} active`}
                      </Badge>
                    </div>
                  </CardTitle>
                  <div className="relative">
                    <Input
                      type="text"
                      value={employeeSearchTerm}
                      onChange={(event) => onEmployeeSearch(event.target.value)}
                      placeholder="Search employees by name, role, or location..."
                      className="h-9 pr-8"
                      aria-label="Search employees"
                    />
                    {employeeSearchTerm && (
                      <button
                        type="button"
                        onClick={() => onEmployeeSearch("")}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0">
                  <div className="divide-y">
                    {employeeList.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p className="font-medium">No employees with location data</p>
                        <p className="mt-1 text-sm">
                          No employees have location information available.
                        </p>
                      </div>
                    ) : filteredEmployeeList.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p className="font-medium">No matches found</p>
                        <p className="mt-1 text-sm">
                          Try adjusting your search to find specific employees.
                        </p>
                      </div>
                    ) : (
                      filteredEmployeeList.map((employee) => (
                        <button
                          type="button"
                          key={employee.listId}
                          className={`w-full p-4 text-left transition-colors ${
                            highlightedEmployee?.listId === employee.listId
                              ? "border-l-4 border-primary bg-accent"
                              : "hover:bg-accent/50"
                          }`}
                          onClick={() => onEmployeeSelect(employee)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                                  {getInitials(employee.name)}
                                </div>
                                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                              </div>
                              <div>
                                <Heading as="p" size="md" className="text-foreground">
                                  {employee.name}
                                </Heading>
                                <Text size="sm" tone="muted">
                                  {employee.position}
                                </Text>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{employee.location}</span>
                              </div>
                              <Text as="div" size="xs" tone="muted" className="mt-1">
                                {employee.formattedLastUpdated ?? "—"}
                              </Text>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {employee.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {employee.visitsInRange} visits in range
                            </Badge>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
