"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { API, type DashboardOverviewResponse } from "@/lib/api";
import { iconLatestMarkers, iconJourneyMarkers, type LocationMarker } from "@/lib/employee-locations";
import OverviewSection, { type LocationEmployee } from "./overview-section";
import StoreLocationView from "./store-location-view";
import type { DateRangeValue, StateItem } from "./types";

interface DashboardLiveViewProps {
  overview: DashboardOverviewResponse | null;
  kpis: { totalVisits: number; activeEmployees: number; liveLocations: number };
  states: StateItem[];
  dateRange: DateRangeValue;
  onStateSelect: (state: StateItem) => void;
  onTotalVisitsSelect: () => void;
  onActiveEmployeesSelect: () => void;
  loading: boolean;
  error: string | null;
  syncedAt: number | null;
  onRefresh: () => void;
}

export function DashboardLiveView(props: DashboardLiveViewProps) {
  const { overview, dateRange, onRefresh } = props;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [journey, setJourney] = useState<{ employeeId: number; period: string; markers: LocationMarker[]; total: number; unmapped: number; hasHome: boolean } | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [reset, setReset] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const stores = searchParams.get("storeView") === "stores";
  const setStores = (value: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("storeView", "stores");
    else {
      for (const key of ["storeView", "storeName", "storeDistrict", "storePage", "storePageSize"]) params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const start = format(dateRange.start, "yyyy-MM-dd");
  const end = format(dateRange.end, "yyyy-MM-dd");
  const period = `${start}:${end}`;
  const periodLabel = start === end ? format(dateRange.start, "d MMM yyyy") : `${format(dateRange.start, "d MMM")} – ${format(dateRange.end, "d MMM yyyy")}`;
  const markers = useMemo(() => iconLatestMarkers(overview?.liveLocations || []), [overview]);
  const roster = useMemo<LocationEmployee[]>(() => {
    const summaries = new Map((overview?.employees || []).map(employee => [employee.employeeId, employee]));
    const locations = new Map(markers.map(marker => [marker.employeeId, marker]));
    const ids = new Set([...summaries.keys(), ...(overview?.liveLocations || []).map(location => location.employeeId)]);
    return [...ids].map(id => {
      const summary = summaries.get(id);
      const marker = locations.get(id);
      return { id, listId: `employee-${id}`, name: summary?.employeeName || marker?.name || `Employee ${id}`,
        position: summary?.role?.replace(/_/g, " ") || "Employee",
        location: [summary?.city, summary?.state].filter(Boolean).join(", "),
        visits: summary?.totalVisits || 0, hasLocation: Boolean(marker), locationTimestamp: marker?.updatedAt ?? null };
    });
  }, [overview, markers]);
  const selected = roster.find(employee => employee.id === selectedId) || null;
  const selectedSummary = overview?.employees.find(employee => employee.employeeId === selectedId);
  const onReset = useCallback(() => { setSelectedId(null); setJourney(null); setJourneyError(null); setReset(value => value + 1); }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") onRefresh(); };
    const timer = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [onRefresh]);
  useEffect(() => {
    if (selectedId != null && !selected) onReset();
  }, [selectedId, selected, onReset]);
  useEffect(() => {
    if (!selected) { setJourneyLoading(false); return; }
    let active = true;
    const id = selected.id;
    const name = selected.name;
    setJourneyLoading(true); setJourneyError(null);
    // Clear old period/employee points before the request; a failed request must
    // never leave someone else's route underneath the current selection.
    setJourney(null);
    API.getEmployeeVisitTrail(id, start, end).then(points => {
      if (active) setJourney({ ...iconJourneyMarkers(points, id, name, start, end, selectedSummary), employeeId: id, period });
    }).catch(() => {
      if (active) {
        setJourney({ ...iconJourneyMarkers([], id, name, start, end, selectedSummary), employeeId: id, period });
        setJourneyError("Could not load visits. Available home and last-known locations are still shown.");
      }
    }).finally(() => { if (active) setJourneyLoading(false); });
    return () => { active = false; };
    // GPS refreshes update the roster, without reloading an unchanged journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, start, end, retry, selectedSummary?.totalVisits, selectedSummary?.homeLatitude, selectedSummary?.homeLongitude]);
  const currentJourney = journey?.employeeId === selectedId && journey?.period === period ? journey : null;
  const journeyMarkers = currentJourney?.markers || [];
  // Use the freshest fix, regardless of which Icon endpoint supplied it.
  const overviewLive = markers.find(marker => marker.employeeId === selectedId && marker.type === "live");
  const journeyLive = journeyMarkers.find(marker => marker.type === "live");
  const useJourneyLive = journeyLive && (!overviewLive || (journeyLive.updatedAt ?? -Infinity) > (overviewLive.updatedAt ?? -Infinity));
  const selectedMarkers = overviewLive && !useJourneyLive
    ? journeyMarkers.filter(marker => marker.type !== "live")
    : journeyMarkers;
  const baseMarkers = markers.filter(marker => marker.employeeId !== selectedId
    || !((marker.type === "house" && selectedMarkers.some(point => point.type === "house")) || (marker.type === "live" && useJourneyLive)));

  if (stores) return <StoreLocationView onBack={() => setStores(false)} />;
  return <OverviewSection
    kpis={props.kpis} states={props.states}
    onStateSelect={state => { const match = props.states.find(item => item.id === state.id); if (match) props.onStateSelect(match); }}
    markers={baseMarkers} highlightedEmployee={selected} selectedEmployeeMarkers={selectedMarkers}
    onResetView={onReset} mapCenter={[20.5937, 78.9629]} mapZoom={5}
    onMarkerClick={marker => { if (marker.type !== "visit" && marker.employeeId != null) setSelectedId(marker.employeeId); }}
    onEmployeeSelect={employee => setSelectedId(employee.id)} employeeList={roster}
    locationsLoading={props.loading} locationsError={props.error} locationsSyncedAt={props.syncedAt}
    onRefreshLocations={() => { onRefresh(); if (selectedId != null) setRetry(value => value + 1); }} journeyLoading={journeyLoading} journeyError={journeyError}
    journeySummary={currentJourney || { total: 0, unmapped: 0, hasHome: false }}
    onRetryJourney={() => setRetry(value => value + 1)} periodLabel={periodLabel} mapResetKey={reset}
    onTotalVisitsSelect={props.onTotalVisitsSelect} onActiveEmployeesSelect={props.onActiveEmployeesSelect}
  />;
}
