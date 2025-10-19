"use client";

import { useState, useMemo, useCallback, useEffect, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isToday,
  isYesterday,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Users, Calendar, ArrowLeft, Building } from "lucide-react";
import EmployeeCard from "@/components/employee-card";
import EmployeeDetailCard from "@/components/employee-detail-card";
import { Heading, Text } from "@/components/ui/typography";
import { API, type DashboardEmployeeSummary, type DashboardEmployeeVisitPoint, type DashboardLiveLocationSummary, type DashboardOverviewResponse, type CurrentUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
});

const HRDashboard = dynamic(() => import("./hr/page").then(mod => mod.default), {
  ssr: false,
  loading: () => <HRDashboardSkeleton />,
});

const HRDashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Card key={idx}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} className="h-4 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  </div>
);

const DEFAULT_MAP_CENTER: [number, number] = [20.5937, 78.9629]; // India's geographic center
const DEFAULT_MAP_ZOOM = 5; // Appropriate zoom level to view all of India

const CITY_COORDINATES: Record<string, [number, number]> = {
  Mumbai: [19.076, 72.8777],
  Bangalore: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707],
  Hyderabad: [17.385, 78.4867],
  Kolkata: [22.5726, 88.3639],
  Delhi: [28.6139, 77.209],
};

const resolveCoordinates = (location: string): [number, number] => {
  const match = Object.entries(CITY_COORDINATES).find(([city]) =>
    location.includes(city)
  );
  return match ? match[1] : DEFAULT_MAP_CENTER;
};

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2) // Take first 2 initials
    .join('');
};

// Helper function to generate unique colors for employees
const generateEmployeeColor = (employeeId: number): string => {
  // Use a predefined palette of distinct colors (no duplicates)
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#FBBF24', // Yellow
    '#F87171', // Rose
    '#A78BFA', // Purple
    '#34D399', // Green
    '#FB923C', // Orange
    '#F472B6', // Pink
    '#818CF8', // Light Indigo
    '#22D3EE', // Sky
    '#A3E635', // Light Green
    '#FCD34D', // Light Yellow
    '#FCA5A5', // Light Red
    '#C4B5FD', // Light Purple
    '#6EE7B7', // Light Emerald
    '#FDE68A', // Light Amber
  ];
  
  // Use employee ID to consistently assign colors
  return colors[employeeId % colors.length];
};

const colorPalette = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
];

type Employee = {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
};

type ExtendedEmployee = Employee & {
  listId: string;
  visitsInRange: number;
  formattedLastUpdated?: string;
};

type StateItem = {
  id: number;
  name: string;
  activeEmployeeCount: number;
  ongoingVisitCount: number;
  completedVisitCount: number;
  color: string;
};
type SelectedState = StateItem | null;

type DateRangeValue = {
  start: Date;
  end: Date;
};

type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  timestamp?: string | null;
  storeName?: string | null;
  description?: string | null;
  variant?: "current" | "home" | "checkin" | "checkout" | "visit";
  number?: number; // For numbered visit markers
  employeeColor?: string; // For unique employee colors in live view
};

const visitPointVariantMap: Record<DashboardEmployeeVisitPoint["type"], MapMarker["variant"]> = {
  HOME: "home",
  CURRENT: "current",
  CHECKIN: "checkin",
  CHECKOUT: "checkout",
  VISIT: "visit",
};

const dateRanges = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
] as const;

export default function DashboardPage() {
  const { token } = useAuth();
  // Default to "today" for immediate daily insights
  const [selectedDateRange, setSelectedDateRange] = useState("today");
  const [view, setView] = useState<"dashboard" | "state" | "employeeDetail">(
    "dashboard"
  );
  const [selectedState, setSelectedState] = useState<SelectedState>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_MAP_ZOOM);
  const [highlightedEmployee, setHighlightedEmployee] =
    useState<ExtendedEmployee | null>(null);
  const [selectedEmployeeForMap, setSelectedEmployeeForMap] = useState<ExtendedEmployee | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isHR, setIsHR] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isDataManager, setIsDataManager] = useState(false);
  const [isRoleDetermined, setIsRoleDetermined] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingTrail, setIsLoadingTrail] = useState(false);

  const composeLocation = useCallback((city?: string | null, state?: string | null) => {
    const parts = [city, state]
      .map((part) => (part ?? "").trim())
      .filter(Boolean);
    return parts.join(", ") || "—";
  }, []);

  const formatTimestamp = useCallback((iso?: string | null) => {
    if (!iso) return undefined;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return undefined;
    if (isToday(date)) {
      return `Today ${format(date, 'hh:mm a')}`;
    }
    if (isYesterday(date)) {
      return `Yesterday ${format(date, 'hh:mm a')}`;
    }
    return format(date, "d MMM ''yy hh:mm a");
  }, []);

  const mapSummaryToEmployee = useCallback(
    (summary: DashboardEmployeeSummary): Employee => {
      const employeeName = summary.employeeName ?? `Employee ${summary.employeeId}`;
      return {
        id: summary.employeeId,
        name: employeeName,
        position: summary.role ?? "Employee",
        avatar: getInitials(employeeName), // Use initials instead of placeholder
        lastUpdated: summary.liveLocationUpdatedAt ?? summary.lastVisitAt ?? new Date().toISOString(),
        status:
          summary.ongoingVisits > 0
            ? "ongoing"
            : summary.assignedVisits > 0
            ? "assigned"
            : "idle",
        location: composeLocation(summary.city, summary.state),
      };
    },
    [composeLocation]
  );

  const buildLiveMarkers = useCallback(
    (liveLocations: DashboardLiveLocationSummary[]): MapMarker[] =>
      liveLocations
        .map((loc) => {
          const isLive = Boolean(loc.updatedAt);
          const source = loc.source ?? (isLive ? "LIVE" : "VISIT");
          const lat = loc.latitude ?? loc.lastVisitLatitude ?? loc.fallbackLatitude ?? null;
          const lng = loc.longitude ?? loc.lastVisitLongitude ?? loc.fallbackLongitude ?? null;

          if (lat == null || lng == null) {
            return null;
          }

          const timestamp = isLive ? loc.updatedAt : loc.lastVisitAt;
          const variant = source === "HOME" ? "home"
            : source === "LIVE" ? "current"
            : source === "VISIT" ? "visit"
            : "checkin";
          const description = source === "LIVE"
            ? "Live location"
            : source === "HOME"
            ? "Home location"
            : "Last known visit";

          return {
            id: `${source.toLowerCase()}-${loc.employeeId}`,
            lat,
            lng,
            label: loc.employeeName,
            timestamp,
            storeName: loc.lastVisitStoreName ?? undefined,
            description,
            variant,
            employeeColor: generateEmployeeColor(loc.employeeId), // Add unique color for employee
          } satisfies MapMarker;
        })
        .filter(Boolean) as MapMarker[],
    []
  );

  const buildTrailMarkers = useCallback(
    (trail: DashboardEmployeeVisitPoint[]): MapMarker[] => {
      // Sort trail by timestamp to ensure proper chronological order
      const sortedTrail = [...trail].sort((a, b) => {
        // Handle null timestamps (like HOME location)
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1; // HOME goes to end
        if (!b.timestamp) return -1; // HOME goes to end
        
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      // Separate visit points from special points (HOME, CURRENT)
      const visitPoints = sortedTrail.filter(point => point.type === "VISIT" || point.type === "CHECKIN" || point.type === "CHECKOUT");
      const specialPoints = sortedTrail.filter(point => point.type === "HOME" || point.type === "CURRENT");

      // Create markers with numbers for visit points
      const visitMarkers = visitPoints.map((point, index) => ({
        id: `${point.type.toLowerCase()}-${point.visitId ?? index}`,
        lat: point.latitude,
        lng: point.longitude,
        label: `${index + 1}. ${point.label ?? point.type}`, // Add number prefix
        timestamp: point.timestamp ?? null,
        storeName: point.storeName ?? undefined,
        description: `${index + 1}. ${point.type === "VISIT" ? "Visit" : point.type === "CHECKOUT" ? "Checkout" : "Check-in"}`,
        variant: visitPointVariantMap[point.type],
        number: index + 1, // Add number for numbered marker
      }));

      // Create markers for special points (HOME, CURRENT) without numbers
      const specialMarkers = specialPoints.map((point, index) => ({
        id: `${point.type.toLowerCase()}-${point.visitId ?? index}`,
        lat: point.latitude,
        lng: point.longitude,
        label: point.label ?? point.type,
        timestamp: point.timestamp ?? null,
        storeName: point.storeName ?? undefined,
        description:
          point.type === "HOME"
            ? "Home Location"
            : point.type === "CURRENT"
            ? "Current Location"
            : point.type,
        variant: visitPointVariantMap[point.type],
      }));

      // Combine all markers
      return [...visitMarkers, ...specialMarkers];
    },
    []
  );

  const summaryByEmployeeId = useMemo(() => {
    if (!overview) {
      return new Map<number, DashboardEmployeeSummary>();
    }
    return new Map<number, DashboardEmployeeSummary>(
      overview.employees.map((summary) => [summary.employeeId, summary] as const)
    );
  }, [overview]);

  const liveLocationByEmployeeId = useMemo(() => {
    if (!overview) {
      return new Map<number, DashboardLiveLocationSummary>();
    }
    return new Map<number, DashboardLiveLocationSummary>(
      overview.liveLocations.map((location) => [location.employeeId, location] as const)
    );
  }, [overview]);

  // Fetch current user data to determine role
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setIsRoleDetermined(true);
        return;
      }
      
      try {
        const response = await fetch('/api/proxy/user/manage/current-user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        if (response.ok) {
          const currentUserDetails: CurrentUserDto = await response.json();
          
          // Extract role from authorities
          const authorities = currentUserDetails.authorities || [];
          const role = authorities.length > 0 ? authorities[0].authority : null;
          
          // Set role flags based on hierarchy: Admin > Data Manager > Coordinator > Regional Manager > Field Officer > HR
          const isAdminRole = role === 'ROLE_ADMIN';
          const isDataManagerRole = role === 'ROLE_DATA_MANAGER';
          const isCoordinatorRole = role === 'ROLE_COORDINATOR';
          const isManagerRole = role === 'ROLE_MANAGER' || role === 'ROLE_OFFICE MANAGER';
          const isHRRole = role === 'ROLE_HR';
          setIsAdmin(isAdminRole);
          setIsDataManager(isDataManagerRole);
          setIsCoordinator(isCoordinatorRole);
          setIsManager(isManagerRole);
          setIsHR(isHRRole);
          
          // Mark role as determined
          setIsRoleDetermined(true);
        } else {
          console.error('Dashboard - Failed to fetch current user data');
          // Fallback to existing logic
          setIsRoleDetermined(true);
        }
      } catch (error) {
        console.error('Dashboard - Error fetching current user:', error);
        // Fallback to existing logic
        setIsRoleDetermined(true);
      }
    };

    fetchCurrentUser();
  }, [token]);
  const dateRange = useMemo<DateRangeValue>(() => {
    const today = new Date();
    switch (selectedDateRange) {
      case "today":
        return { start: today, end: today };
      case "yesterday": {
        const yesterday = subDays(today, 1);
        return { start: yesterday, end: yesterday };
      }
      case "thisWeek":
        return { start: startOfWeek(today), end: endOfWeek(today) };
      case "thisMonth":
        return { start: startOfMonth(today), end: endOfMonth(today) };
      default:
        return { start: today, end: today };
    }
  }, [selectedDateRange]);

  useEffect(() => {
    const loadOverview = async () => {
      if (!isRoleDetermined) return;

      setIsLoadingOverview(true);
      try {
        const start = format(dateRange.start, "yyyy-MM-dd");
        const end = format(dateRange.end, "yyyy-MM-dd");
        const data = await API.getDashboardOverview(start, end);
        setOverview(data);
        
        // FIXED: Don't reset view on date change - preserve user's current page
        // Only update map markers for dashboard view
        if (view === "dashboard") {
          setMapMarkers(buildLiveMarkers(data.liveLocations));
        }
        // Note: State/employee detail views will update automatically via useMemo
        
        setError(null);
      } catch (err: unknown) {
        console.error("Dashboard - Error fetching overview:", err);
        setOverview(null);
        setMapMarkers([]);
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setIsLoadingOverview(false);
      }
    };

    loadOverview();
  }, [dateRange.start, dateRange.end, isRoleDetermined, buildLiveMarkers, view]);

  const stateEmployees = useMemo(() => {
    if (!selectedState || !overview) return [];
    return overview.employees
      .filter((employee) => {
        const stateName = employee.state ?? "Unknown";
        return stateName === selectedState.name;
      })
      // Use consistent active employee definition: assignedVisits > 0 || ongoingVisits > 0
      .filter((employee) => employee.assignedVisits > 0 || employee.ongoingVisits > 0)
      .map((employee) => mapSummaryToEmployee(employee));
  }, [selectedState, overview, mapSummaryToEmployee]);

  const employeeList = useMemo<ExtendedEmployee[]>(() => {
    if (!overview) return [];

    return overview.liveLocations
      .map((liveLocation) => {
        const summary = summaryByEmployeeId.get(liveLocation.employeeId);
        const employeeName =
          summary?.employeeName ?? liveLocation.employeeName ?? `Employee ${liveLocation.employeeId}`;
        const bestTimestamp =
          liveLocation.updatedAt ?? liveLocation.lastVisitAt ?? summary?.lastVisitAt ?? null;
        const status = summary
          ? summary.ongoingVisits > 0
            ? "ongoing"
            : summary.assignedVisits > 0
            ? "assigned"
            : liveLocation.source === "LIVE"
            ? "live"
            : "idle"
          : liveLocation.source === "LIVE"
          ? "live"
          : "idle";

        return {
          id: liveLocation.employeeId,
          name: employeeName,
          position: summary?.role ?? "Employee",
          avatar: getInitials(employeeName),
          lastUpdated: bestTimestamp ?? new Date().toISOString(),
          status,
          location: composeLocation(summary?.city ?? null, summary?.state ?? null),
          listId: `employee-${liveLocation.employeeId}`,
          visitsInRange: summary?.totalVisits ?? 0,
          formattedLastUpdated: formatTimestamp(bestTimestamp ?? undefined),
        } satisfies ExtendedEmployee;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [overview, summaryByEmployeeId, formatTimestamp, composeLocation]);

  const filteredEmployeeList = useMemo(() => {
    const term = employeeSearchTerm.trim().toLowerCase();
    if (!term) {
      return employeeList;
    }

    return employeeList.filter((employee) => {
      const name = employee.name?.toLowerCase() ?? "";
      const position = employee.position?.toLowerCase() ?? "";
      const location = employee.location?.toLowerCase() ?? "";
      return (
        name.includes(term) ||
        position.includes(term) ||
        location.includes(term)
      );
    });
  }, [employeeList, employeeSearchTerm]);

  const states = useMemo<StateItem[]>(() => {
    if (!overview) return [];
    // FIXED: Only show states with actual visit activity
    return overview.states
      .filter(state => 
        state.ongoingVisitCount > 0 || 
        state.completedVisitCount > 0 ||
        state.activeEmployeeCount > 0
      )
      .map((state, index) => ({
        id: index + 1,
        name: state.stateName ?? "Unknown",
        activeEmployeeCount: state.activeEmployeeCount,
        ongoingVisitCount: state.ongoingVisitCount,
        completedVisitCount: state.completedVisitCount,
        color: colorPalette[index % colorPalette.length],
      }));
  }, [overview]);

  const kpis = useMemo(() => ({
    totalVisits: overview?.kpi.totalVisits ?? 0,
    activeEmployees: overview?.kpi.activeEmployees ?? 0,
    liveLocations:
      overview?.kpi.liveLocations ?? (overview ? overview.liveLocations.length : 0),
  }), [overview]);

  useEffect(() => {
    if (!overview || !highlightedEmployee) return;
    const exists = overview.employees.some(
      (employee) => employee.employeeId === highlightedEmployee.id
    );
    if (!exists) {
      setHighlightedEmployee(null);
    }
  }, [overview, highlightedEmployee]);

  const handleBack = useCallback(() => {
    if (view === "employeeDetail") {
      setView("state");
      setSelectedEmployee(null);
      setHighlightedEmployee(null);
      return;
    }

    if (view === "state") {
      setView("dashboard");
      setSelectedState(null);
      setHighlightedEmployee(null);
      setSelectedEmployeeForMap(null);
      setMapCenter(DEFAULT_MAP_CENTER);
      setMapZoom(DEFAULT_MAP_ZOOM);
      if (overview) {
        setMapMarkers(buildLiveMarkers(overview.liveLocations));
      }
    }
  }, [view, overview, buildLiveMarkers]);

  const handleStateSelect = useCallback((state: SelectedState) => {
    if (!state) return;
    setSelectedState(state);
    setView("state");
  }, []);

  const handleEmployeeSelect = useCallback(
    async (employee: ExtendedEmployee) => {
      setHighlightedEmployee(employee);
      setSelectedEmployeeForMap(employee);

      const summary = summaryByEmployeeId.get(employee.id);
      const liveLocation = liveLocationByEmployeeId.get(employee.id);

      setIsLoadingTrail(true);
      try {
        const start = format(dateRange.start, "yyyy-MM-dd");
        const end = format(dateRange.end, "yyyy-MM-dd");
        const trail = await API.getEmployeeVisitTrail(employee.id, start, end);
        let markersToDisplay = buildTrailMarkers(trail);

        const hasCurrentMarker = markersToDisplay.some(
          (marker) => marker.variant === "current"
        );

        if (!hasCurrentMarker && liveLocation) {
          const fallbackLat =
            liveLocation.latitude ??
            liveLocation.lastVisitLatitude ??
            liveLocation.fallbackLatitude;
          const fallbackLng =
            liveLocation.longitude ??
            liveLocation.lastVisitLongitude ??
            liveLocation.fallbackLongitude;

          if (fallbackLat != null && fallbackLng != null) {
            const locationLabel =
              liveLocation.source === "LIVE"
                ? "Current Location"
                : "Last Known Location";

            const fallbackVariant: MapMarker["variant"] =
              liveLocation.source === "LIVE"
                ? "current"
                : liveLocation.source === "VISIT"
                ? "visit"
                : "home";

            const fallbackMarker: MapMarker = {
              id: `live-${employee.id}`,
              lat: fallbackLat,
              lng: fallbackLng,
              label: locationLabel,
              timestamp: liveLocation.updatedAt ?? liveLocation.lastVisitAt ?? null,
              storeName: liveLocation.lastVisitStoreName ?? undefined,
              description:
                liveLocation.source === "LIVE"
                  ? "Latest location update"
                  : liveLocation.source === "VISIT"
                  ? "Last recorded visit location"
                  : "Registered home location",
              variant: fallbackVariant,
            };

            if (fallbackVariant === "home") {
              const alreadyHasHome = markersToDisplay.some(
                (marker) => marker.variant === "home"
              );
              if (!alreadyHasHome) {
                markersToDisplay = [...markersToDisplay, fallbackMarker];
              }
            } else {
              markersToDisplay = [...markersToDisplay, fallbackMarker];
            }
          }
        }

        const hasHomeMarker = markersToDisplay.some(
          (marker) => marker.variant === "home"
        );

        if (
          !hasHomeMarker &&
          summary?.homeLatitude != null &&
          summary?.homeLongitude != null
        ) {
          markersToDisplay = [
            ...markersToDisplay,
            {
              id: `home-${employee.id}`,
              lat: summary.homeLatitude,
              lng: summary.homeLongitude,
              label: "Home",
              timestamp: null,
              description: "Registered home location",
              variant: "home",
            },
          ];
        }

        setMapMarkers(markersToDisplay);

        const markerCoordinates = markersToDisplay.filter(
          (marker) => typeof marker.lat === "number" && typeof marker.lng === "number"
        );

        if (markerCoordinates.length > 0) {
          const lats = markerCoordinates.map((marker) => marker.lat);
          const lngs = markerCoordinates.map((marker) => marker.lng);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);

          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;

          const latSpan = maxLat - minLat;
          const lngSpan = maxLng - minLng;
          const maxSpan = Math.max(latSpan, lngSpan);

          let zoomLevel;
          if (maxSpan === 0) {
            zoomLevel = 15;
          } else {
            const paddedSpan = maxSpan * 1.2;

            if (paddedSpan > 10) {
              zoomLevel = 4;
            } else if (paddedSpan > 5) {
              zoomLevel = 5;
            } else if (paddedSpan > 2) {
              zoomLevel = 6;
            } else if (paddedSpan > 1) {
              zoomLevel = 7;
            } else if (paddedSpan > 0.5) {
              zoomLevel = 8;
            } else if (paddedSpan > 0.2) {
              zoomLevel = 10;
            } else if (paddedSpan > 0.1) {
              zoomLevel = 12;
            } else if (paddedSpan > 0.05) {
              zoomLevel = 14;
            } else {
              zoomLevel = 16;
            }
          }

          setMapCenter([centerLat, centerLng]);
          setMapZoom(zoomLevel);
        } else {
          const fallbackLat =
            liveLocation?.latitude ??
            liveLocation?.lastVisitLatitude ??
            liveLocation?.fallbackLatitude ??
            summary?.homeLatitude ??
            null;
          const fallbackLng =
            liveLocation?.longitude ??
            liveLocation?.lastVisitLongitude ??
            liveLocation?.fallbackLongitude ??
            summary?.homeLongitude ??
            null;

          if (fallbackLat != null && fallbackLng != null) {
            setMapCenter([fallbackLat, fallbackLng]);
            setMapZoom(14);
          } else {
            setMapCenter(resolveCoordinates(employee.location));
            setMapZoom(12);
          }
        }
      } catch (err: unknown) {
        console.error("Dashboard - Error loading visit trail:", err);
        setError(err instanceof Error ? err.message : "Failed to load visit trail");
      } finally {
        setIsLoadingTrail(false);
      }
    },
    [
      summaryByEmployeeId,
      liveLocationByEmployeeId,
      dateRange.start,
      dateRange.end,
      buildTrailMarkers,
    ]
  );

  const handleResetMap = useCallback(() => {
    setSelectedEmployeeForMap(null);
    setHighlightedEmployee(null);
    if (overview) {
      setMapMarkers(buildLiveMarkers(overview.liveLocations));
      setMapCenter(DEFAULT_MAP_CENTER);
      setMapZoom(DEFAULT_MAP_ZOOM);
    }
  }, [overview, buildLiveMarkers]);

  const handleEmployeeDetailSelect = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setView("employeeDetail");
  }, []);

  if (!isRoleDetermined) {
    return <HRDashboardSkeleton />;
  }

  if (isHR) {
    return <HRDashboard />;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Failed to load dashboard data</p>
              <p className="text-sm text-destructive/80 mt-1">{error}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.reload()}
              className="border-destructive/40 text-destructive hover:bg-destructive/5"
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Heading as="h1" size="lg" weight="semibold">
            {view === "dashboard"
              ? "Dashboard"
              : view === "state" && selectedState
              ? selectedState.name
              : selectedEmployee?.name || "Employee Details"}
          </Heading>
          {view !== "dashboard" && (
            <Text tone="muted" size="sm">
              {view === "state" && selectedState
                ? "Active employees in this state"
                : view === "employeeDetail" && selectedEmployee
                ? selectedEmployee.position
                : ""}
            </Text>
          )}
        </div>
        <div className="flex items-center gap-4">
          {view !== "dashboard" && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Show skeleton loader while role is being determined or data is loading */}
      {!isRoleDetermined || isLoadingOverview ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Total Visits</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Active Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Live Locations</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-6 w-20" />
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-4 w-32 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex-1">
                <Card className="h-[600px] overflow-hidden rounded-xl">
                  <Skeleton className="h-full w-full" />
                </Card>
              </div>
              <div className="w-full lg:w-96">
                <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      <span>Active Employees</span>
                      <Skeleton className="h-6 w-12 ml-auto" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-0">
                    <div className="divide-y">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-10 rounded-xl" />
                              <div>
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-16 mt-1" />
                              </div>
                            </div>
                            <div className="text-right">
                              <Skeleton className="h-3 w-16" />
                              <Skeleton className="h-3 w-20 mt-1" />
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Skeleton className="h-5 w-16" />
                            <Skeleton className="h-5 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {view === "dashboard" && (
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
                      onClick={() => handleStateSelect(state)}
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
                <Heading as="h2" size="2xl" weight="semibold">
                  Live Employee Locations
                </Heading>
                <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
                  <Text tone="muted">
                    Click on an employee to zoom to their location
                  </Text>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMapCenter(DEFAULT_MAP_CENTER);
                      setMapZoom(DEFAULT_MAP_ZOOM);
                      setHighlightedEmployee(null);
                      if (overview) {
                        setMapMarkers(buildLiveMarkers(overview.liveLocations));
                      }
                    }}
                  >
                    Reset View
                  </Button>
                </div>
                <div className="flex flex-col gap-6 lg:flex-row">
                  <div className="flex-1">
                    <Card className="relative h-[600px] overflow-hidden rounded-xl">
                      {isLoadingTrail && (
                        <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow">
                          Loading trail...
                        </div>
                      )}
                      <LeafletMap
                        center={mapCenter}
                        zoom={mapZoom}
                        highlightedEmployee={highlightedEmployee}
                        markers={mapMarkers}
                      />
                    </Card>
                  </div>

                  <div className="w-full lg:w-96">
                    <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
                      <CardHeader className="border-b space-y-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Users className="h-5 w-5" />
                          <span>{selectedEmployeeForMap ? `${selectedEmployeeForMap.name}'s Data` : 'Active Employees'}</span>
                          <div className="ml-auto flex items-center gap-2">
                            {selectedEmployeeForMap && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetMap}
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
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            setEmployeeSearchTerm(event.target.value)
                          }
                          placeholder="Search employees by name, role, or location..."
                          className="h-9"
                          aria-label="Search employees"
                        />
                      </CardHeader>
                      <CardContent className="flex-1 overflow-y-auto p-0">
                        <div className="divide-y">
                          {employeeList.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="font-medium">No employees with location data</p>
                              <p className="text-sm mt-1">
                                No employees have location information available.
                              </p>
                            </div>
                          ) : filteredEmployeeList.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground">
                              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p className="font-medium">No matches found</p>
                              <p className="text-sm mt-1">
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
                                onClick={() => handleEmployeeSelect(employee)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="relative">
                                      <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
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
                </div>
              </div>
            </>
          )}

          {view === "state" && selectedState && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stateEmployees.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    onClick={() => handleEmployeeDetailSelect(employee)}
                    hideState={true}
                  />
                ))}
              </div>
            </div>
          )}

          {view === "employeeDetail" && selectedEmployee && (
            <EmployeeDetailCard employee={selectedEmployee} dateRange={dateRange} />
          )}
        </>
      )}
    </div>
  );
}
