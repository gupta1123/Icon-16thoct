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

type StoreCoverageTier = "Flagship" | "High Potential" | "Growth";

interface StoreLocation {
  id: string;
  storeName: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  address?: string;
  coverageTier: StoreCoverageTier;
  focus?: string;
  lastVisitDate?: string;
}

const MOCK_STORE_LOCATIONS: StoreLocation[] = [
  {
    id: "store-001",
    storeName: "Phoenix Marketcity",
    latitude: 19.086,
    longitude: 72.8896,
    city: "Mumbai",
    state: "Maharashtra",
    address: "Kurla West",
    coverageTier: "Flagship",
    focus: "High footfall mall partner",
    lastVisitDate: "2024-04-18",
  },
  {
    id: "store-002",
    storeName: "Orion World",
    latitude: 12.9842,
    longitude: 77.5561,
    city: "Bengaluru",
    state: "Karnataka",
    address: "Rajajinagar",
    coverageTier: "High Potential",
    focus: "Emerging premium catchment",
    lastVisitDate: "2024-04-12",
  },
  {
    id: "store-003",
    storeName: "Select City Hub",
    latitude: 28.5286,
    longitude: 77.2193,
    city: "New Delhi",
    state: "Delhi",
    address: "Saket",
    coverageTier: "Flagship",
    focus: "Metro anchor store",
    lastVisitDate: "2024-04-20",
  },
  {
    id: "store-004",
    storeName: "Jubilee Lifestyle",
    latitude: 17.4375,
    longitude: 78.3957,
    city: "Hyderabad",
    state: "Telangana",
    address: "Jubilee Hills",
    coverageTier: "High Potential",
    focus: "Premium residential belt",
    lastVisitDate: "2024-04-10",
  },
  {
    id: "store-005",
    storeName: "Marina Promenade",
    latitude: 13.0505,
    longitude: 80.2824,
    city: "Chennai",
    state: "Tamil Nadu",
    address: "Mylapore",
    coverageTier: "Growth",
    focus: "Lifestyle expansion cluster",
    lastVisitDate: "2024-03-28",
  },
  {
    id: "store-006",
    storeName: "Seasons Square",
    latitude: 18.5167,
    longitude: 73.8560,
    city: "Pune",
    state: "Maharashtra",
    address: "Magarpatta",
    coverageTier: "High Potential",
    focus: "IT corridor presence",
    lastVisitDate: "2024-04-16",
  },
  {
    id: "store-007",
    storeName: "Riverfront Galleria",
    latitude: 23.0336,
    longitude: 72.5850,
    city: "Ahmedabad",
    state: "Gujarat",
    address: "Sabarmati Riverfront",
    coverageTier: "Growth",
    focus: "Growing premium audience",
    lastVisitDate: "2024-03-31",
  },
  {
    id: "store-008",
    storeName: "Park Street Studio",
    latitude: 22.5521,
    longitude: 88.3525,
    city: "Kolkata",
    state: "West Bengal",
    address: "Park Street",
    coverageTier: "Flagship",
    focus: "Legacy flagship presence",
    lastVisitDate: "2024-04-08",
  },
];

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

  const fetchStoreLocations = useCallback(async () => {
    setIsStoresLoading(true);
    setStoreError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      setStores(MOCK_STORE_LOCATIONS.map((store) => ({ ...store })));
    } catch (err) {
      console.error("Dashboard - Error loading store locations:", err);
      setStoreError("Unable to load store locations right now.");
    } finally {
      setIsStoresLoading(false);
    }
  }, []);

  const storeMarkers = useMemo<MapMarker[]>(() => {
    return stores.map((store) => ({
      id: store.id,
      label: store.storeName,
      storeName: store.storeName,
      description: [store.city, store.state].filter(Boolean).join(", "),
      lat: store.latitude,
      lng: store.longitude,
      variant: "store",
    }));
  }, [stores]);

  const displayMarkers = useMemo<MapMarker[]>(() => {
    return showStores ? storeMarkers : mapMarkers;
  }, [mapMarkers, showStores, storeMarkers]);

  const storeTierSummary = useMemo(() => {
    return stores.reduce<Record<StoreCoverageTier, number>>((acc, store) => {
      acc[store.coverageTier] = (acc[store.coverageTier] ?? 0) + 1;
      return acc;
    }, { Flagship: 0, "High Potential": 0, Growth: 0 });
  }, [stores]);

  const handleLayerToggle = useCallback(
    (layer: "employees" | "stores") => {
      if (layer === "stores") {
        setShowStores(true);
        if (stores.length === 0 && !isStoresLoading) {
          void fetchStoreLocations();
        }
        return;
      }

      setShowStores(false);
      setStoreError(null);
      onResetMap();
    },
    [fetchStoreLocations, isStoresLoading, onResetMap, stores.length]
  );

  const handleRetryStores = useCallback(() => {
    void fetchStoreLocations();
  }, [fetchStoreLocations]);

  const formatStoreDate = useCallback((value?: string) => {
    if (!value) {
      return "Visit pending";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Visit pending";
    }
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

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
              ? "Explore store hotspots to plan upcoming visits while we wait for the live API."
              : "Select an employee to jump to their latest location."}
          </Text>
          {!showStores && (
            <Button variant="outline" size="sm" onClick={onResetMap}>
              Reset View
            </Button>
          )}
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
                  Loading mock stores...
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
                    Prioritize high-impact stores while the production API is being wired up.
                  </Text>
                  {!isStoresLoading && stores.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-medium">
                        Flagship · {storeTierSummary.Flagship}
                      </Badge>
                      <Badge variant="outline" className="font-medium">
                        High Potential · {storeTierSummary["High Potential"]}
                      </Badge>
                      <Badge variant="outline" className="font-medium">
                        Growth · {storeTierSummary.Growth}
                      </Badge>
                    </div>
                  )}
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
                        Plug the real API once it is ready to visualise coverage instantly.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleRetryStores}>
                        Refresh mock data
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {stores.map((store) => (
                        <div key={store.id} className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Heading as="p" size="md" className="text-foreground">
                                {store.storeName}
                              </Heading>
                              <Text size="sm" tone="muted">
                                {[store.city, store.state].filter(Boolean).join(", ")}
                              </Text>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs font-semibold ${
                                store.coverageTier === "Flagship"
                                  ? "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-300"
                                  : store.coverageTier === "High Potential"
                                  ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-300"
                                  : "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {store.coverageTier}
                            </Badge>
                          </div>
                          {store.address && (
                            <Text size="xs" tone="muted" className="mt-1">
                              {store.address}
                            </Text>
                          )}
                          {store.focus && (
                            <Text size="xs" className="mt-2 text-foreground">
                              {store.focus}
                            </Text>
                          )}
                          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {store.latitude.toFixed(2)}, {store.longitude.toFixed(2)}
                            </span>
                            <span>{formatStoreDate(store.lastVisitDate)}</span>
                          </div>
                        </div>
                      ))}
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
                      {selectedEmployeeForMap && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onResetMap}
                          className="h-7 px-2 text-xs"
                        >
                          Reset
                        </Button>
                      )}
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
