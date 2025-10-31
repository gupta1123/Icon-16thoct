"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building, Calendar, Store, Loader2 } from "lucide-react";
import type { ExtendedEmployee, MapMarker, StateItem } from "./types";

const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
});

interface StoreLocation {
  storeId: number;
  storeName: string;
  city?: string | null;
  state?: string | null;
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

      return {
        storeId: idValue as number,
        storeName,
        city: typeof record.city === "string" ? record.city : null,
        state: typeof record.state === "string" ? record.state : null,
        latitude: parseStoreCoordinate(record.latitude),
        longitude: parseStoreCoordinate(record.longitude),
      };
    })
    .filter((value): value is StoreLocation => value !== null);
  
  return result;
};

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

  const fetchStoreLocations = useCallback(async () => {
    const authToken =
      typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

    if (!authToken) {
      setStoreError("Authentication token not found. Please log in.");
      setStores([]);
      return;
    }

    setIsStoresLoading(true);
    setStoreError(null);

    try {
      const response = await fetch("/api/proxy/store/getAll", {
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

      if (!Array.isArray(payload)) {
        throw new Error("Unexpected response format while fetching store locations.");
      }

      const normalized = normalizeStoreLocations(payload);

      setStores(normalized);
    } catch (err) {
      console.error("Dashboard - Error loading store locations:", err);
      setStores([]);
      setStoreError(
        err instanceof Error ? err.message : "Unable to load store locations right now."
      );
    } finally {
      setIsStoresLoading(false);
    }
  }, []);

  const storeMarkers = useMemo<MapMarker[]>(() => {
    return stores
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
        description: [store.city, store.state].filter(Boolean).join(", "),
        lat: store.latitude as number,
        lng: store.longitude as number,
        variant: "store",
      }));
  }, [stores]);

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
                      {stores.length} store locations
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
                onMarkerClick={handleMarkerClick}
              />
            </Card>
          </div>
          {showStores ? (
            <div className="w-full lg:w-96">
              <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
                <CardHeader className="border-b space-y-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Store className="h-5 w-5" />
                    <span>Store Network</span>
                    {!isStoresLoading && (
                      <Badge variant="secondary" className="ml-auto">
                        {stores.length} locations
                      </Badge>
                    )}
                  </CardTitle>
                  <Text size="sm" tone="muted">
                    Live store coverage pulled from the stores service.
                  </Text>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0">
                  {isStoresLoading ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Loading store locations...</span>
                    </div>
                  ) : stores.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                      <Store className="h-10 w-10 opacity-30" />
                      <p className="font-medium">No store locations yet</p>
                      <p className="text-sm">
                        The stores API did not return any locations. Try refreshing to sync again.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleRetryStores}>
                        Refresh data
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {stores.map((store) => {
                        const locationLabel = [store.city, store.state]
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
                  <Input
                    type="search"
                    value={employeeSearchTerm}
                    onChange={(event) => onEmployeeSearch(event.target.value)}
                    placeholder="Search employees by name, role, or location..."
                    className="h-9"
                    aria-label="Search employees"
                  />
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
