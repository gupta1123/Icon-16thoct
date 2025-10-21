"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Users, Calendar, ArrowLeft, Building } from "lucide-react";
import { Heading, Text } from "@/components/ui/typography";
import PricingCheckModal from "@/components/pricing-check-modal";
import { API, type DashboardEmployeeSummary, type DashboardEmployeeVisitPoint, type DashboardLiveLocationSummary, type DashboardOverviewResponse, type CurrentUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLiveView } from "@/components/dashboard/live-view";
import { DashboardStateView } from "@/components/dashboard/state-view";
import { DashboardEmployeeDetailView } from "@/components/dashboard/employee-detail-view";
import type {
  Employee,
  ExtendedEmployee,
  MapMarker,
  SelectedState,
  StateItem,
  DateRangeValue,
  DateRangeKey,
} from "@/components/dashboard/types";

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

const validDateRangeValues = new Set<DateRangeKey>(dateRanges.map((range) => range.value));
const isValidDateRangeKey = (value: string | null): value is DateRangeKey =>
  Boolean(value && validDateRangeValues.has(value as DateRangeKey));

function DashboardPageContent() {
  const { token } = useAuth();
  // Default to "today" for immediate daily insights
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeKey>("today");
  const [view, setView] = useState<"dashboard" | "state" | "employeeDetail">(() => {
    if (typeof window === "undefined") {
      return "dashboard";
    }
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    if (viewParam === "state" || viewParam === "employeeDetail") {
      return viewParam;
    }
    return "dashboard";
  });
  const [selectedState, setSelectedState] = useState<SelectedState>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pendingEmployeeId, setPendingEmployeeId] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("employeeId");
    if (!idParam) {
      return null;
    }
    const parsed = Number(idParam);
    return Number.isFinite(parsed) ? parsed : null;
  });
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isLoadingTrail, setIsLoadingTrail] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [hasCheckedPricing, setHasCheckedPricing] = useState(false);
  const lastUrlRef = useRef<string>("");
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suppressUrlSyncRef = useRef<boolean>(false);
  const [navigationHistory, setNavigationHistory] = useState<Array<"dashboard" | "state" | "employeeDetail">>([]);
  const [previousView, setPreviousView] = useState<"dashboard" | "state" | "employeeDetail">("dashboard");

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
        
        // Update overview state
        setOverview(data);
        setError(null);
        
        // Update map markers for dashboard view
        if (view === "dashboard") {
          setMapMarkers(buildLiveMarkers(data.liveLocations));
        }
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
    // Only depend on date range changes and role determination
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start, dateRange.end, isRoleDetermined]);

  // Separate effect to update map markers when view changes back to dashboard
  useEffect(() => {
    if (view === "dashboard" && overview && !isLoadingOverview) {
      setMapMarkers(buildLiveMarkers(overview.liveLocations));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Check pricing for Icon Steel on login (Admin only)
  const checkPricingForToday = useCallback(async () => {
    if (!token || !isAdmin) return;
    
    // Check if pricing modal has been shown and closed in this session
    const pricingModalShown = sessionStorage.getItem('pricingModalShown');
    if (pricingModalShown === 'true') {
      console.log('Pricing modal already shown and closed in this session');
      return;
    }
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetch(`/api/proxy/brand/getByDateRange?start=${today}&end=${today}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to check pricing:', response.status);
        return;
      }

      const pricingData = await response.json();
      console.log('Pricing data for today:', pricingData);
      
      // Check if Icon Steel pricing exists for today
      const iconSteelPricing = pricingData.find((item: { brandName?: string }) => 
        item.brandName && item.brandName.toLowerCase().includes('icon steel')
      );
      
      if (!iconSteelPricing) {
        console.log('No Icon Steel pricing found for today, showing modal to admin');
        setIsPricingModalOpen(true);
      }
      
      setHasCheckedPricing(true);
    } catch (error) {
      console.error('Error checking pricing:', error);
      setHasCheckedPricing(true); // Don't retry on error
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isRoleDetermined && token && isAdmin) {
      checkPricingForToday();
    }
  }, [isRoleDetermined, token, isAdmin, checkPricingForToday]);

  useEffect(() => {
    if (view !== "employeeDetail" || pendingEmployeeId == null) {
      return;
    }

    if (!overview) {
      return;
    }

    const summary = summaryByEmployeeId.get(pendingEmployeeId);
    if (summary) {
      if (!selectedEmployee || selectedEmployee.id !== pendingEmployeeId) {
        setSelectedEmployee(mapSummaryToEmployee(summary));
      }

      const stateName = summary.state ?? "Unknown";
      const hasStateMatch = selectedState?.name === stateName;
      if (!hasStateMatch && Array.isArray(overview.states)) {
        const stateIndex = overview.states.findIndex(
          (state) => (state.stateName ?? "Unknown") === stateName
        );
        if (stateIndex >= 0) {
          const overviewState = overview.states[stateIndex];
          setSelectedState({
            id: stateIndex + 1,
            name: stateName,
            activeEmployeeCount: overviewState.activeEmployeeCount,
            ongoingVisitCount: overviewState.ongoingVisitCount,
            completedVisitCount: overviewState.completedVisitCount,
            color: colorPalette[stateIndex % colorPalette.length],
          });
        }
      }

      setPendingEmployeeId(null);
      return;
    }

    // If the employee is not present in the overview data, fallback to dashboard view
    setPendingEmployeeId(null);
    setView("dashboard");
  }, [view, pendingEmployeeId, overview, summaryByEmployeeId, mapSummaryToEmployee, selectedEmployee, selectedState]);

  useEffect(() => {
    const viewParam = searchParams.get("view");
    const employeeIdParam = searchParams.get("employeeId");

    // Prevent URL-driven view changes while we are handling an explicit back navigation
    if (suppressUrlSyncRef.current) {
      return;
    }

    if (!viewParam && !employeeIdParam) {
      return;
    }

    if (viewParam === "employeeDetail") {
      if (view !== "employeeDetail") {
        setPreviousView("dashboard"); // Set dashboard as previous view for direct navigation
        setView("employeeDetail");
        // If navigating directly to employee detail (e.g., from visit detail page),
        // don't add to navigation history as we don't know the previous context
        // The navigation history will be empty, so back will go to dashboard
      }

      if (employeeIdParam) {
        const parsed = Number(employeeIdParam);
        if (Number.isFinite(parsed)) {
          const targetId = parsed;
          const alreadySelected = selectedEmployee?.id === targetId;
          const alreadyPending = pendingEmployeeId === targetId;
          if (!alreadySelected && !alreadyPending) {
            setPendingEmployeeId(targetId);
          }
        }
      }
    } else if (viewParam === "state" && view !== "state") {
      setView("state");
    } else if (viewParam === "dashboard" && view !== "dashboard") {
      setView("dashboard");
    }

    if (!employeeIdParam && pendingEmployeeId !== null) {
      setPendingEmployeeId(null);
    }
  }, [searchParams, view, pendingEmployeeId, selectedEmployee]);

  useEffect(() => {
    const dateRangeParam = searchParams.get("dateRange");
    if (isValidDateRangeKey(dateRangeParam) && dateRangeParam !== selectedDateRange) {
      setSelectedDateRange(dateRangeParam);
    }
  }, [searchParams, selectedDateRange]);

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
    console.log("Back button clicked. Current view:", view, "Previous view:", previousView);
    
    if (view === "employeeDetail") {
      // Suppress URL-driven effects during back navigation to avoid bounce
      suppressUrlSyncRef.current = true;
      // Immediately clear view-related URL params to avoid debounce race
      if (pathname) {
        const currentParams = new URLSearchParams(searchParams.toString());
        if (currentParams.has("view")) currentParams.delete("view");
        if (currentParams.has("employeeId")) currentParams.delete("employeeId");
        if (currentParams.get("dateRange") !== selectedDateRange) {
          currentParams.set("dateRange", selectedDateRange);
        }
        const nextQuery = currentParams.toString();
        const newUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
        lastUrlRef.current = newUrl;
        router.replace(newUrl, { scroll: false });
      }
      // Prefer returning to state view when available
      if (selectedState) {
        console.log("Going back to state view");
        setView("state");
        // Keep selectedState as it should already be set
        setSelectedEmployee(null);
        setHighlightedEmployee(null);
        setPendingEmployeeId(null);
        setSelectedEmployeeForMap(null);
        setMapCenter(DEFAULT_MAP_CENTER);
        setMapZoom(DEFAULT_MAP_ZOOM);
        if (overview) {
          setMapMarkers(buildLiveMarkers(overview.liveLocations));
        }
      } else {
        console.log("Going back to dashboard view");
        setView("dashboard");
        setSelectedEmployee(null);
        setHighlightedEmployee(null);
        setPendingEmployeeId(null);
        setSelectedState(null);
        setSelectedEmployeeForMap(null);
        setMapCenter(DEFAULT_MAP_CENTER);
        setMapZoom(DEFAULT_MAP_ZOOM);
        if (overview) {
          setMapMarkers(buildLiveMarkers(overview.liveLocations));
        }
      }
      // Re-enable URL-driven effects shortly after navigation settles
      setTimeout(() => {
        suppressUrlSyncRef.current = false;
      }, 150);
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
      setNavigationHistory(prev => prev.slice(0, -1));
    }
  }, [view, previousView, overview, buildLiveMarkers, selectedState, pathname, router, searchParams, selectedDateRange]);

  const handleStateSelect = useCallback((state: SelectedState) => {
    if (!state) return;
    setSelectedState(state);
    setPreviousView(view); // Set current view as previous before changing
    setNavigationHistory(prev => {
      const newHistory: Array<"dashboard" | "state" | "employeeDetail"> = [...prev, "state"];
      console.log("Adding state to navigation history:", newHistory);
      return newHistory;
    });
    setView("state");
  }, [view]);

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
    setPendingEmployeeId(employee.id);
    setPreviousView(view); // Set current view as previous before changing
    setNavigationHistory(prev => {
      const newHistory: Array<"dashboard" | "state" | "employeeDetail"> = [...prev, "employeeDetail"];
      console.log("Adding employeeDetail to navigation history:", newHistory);
      return newHistory;
    });
    setView("employeeDetail");
  }, [view]);

  const handlePricingModalClose = useCallback(() => {
    setIsPricingModalOpen(false);
    // Mark that the pricing modal has been shown and closed in this session
    sessionStorage.setItem('pricingModalShown', 'true');
  }, []);

  const handlePricingModalSuccess = useCallback(() => {
    console.log('Pricing created successfully');
    setIsPricingModalOpen(false);
    // Mark that the pricing modal has been shown and closed in this session
    sessionStorage.setItem('pricingModalShown', 'true');
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const currentParams = new URLSearchParams(searchParams.toString());
    const targetEmployeeId = selectedEmployee?.id ?? pendingEmployeeId ?? null;
    let shouldUpdate = false;

    if (view === "employeeDetail" && targetEmployeeId) {
      if (currentParams.get("view") !== "employeeDetail") {
        currentParams.set("view", "employeeDetail");
        shouldUpdate = true;
      }
      if (currentParams.get("employeeId") !== String(targetEmployeeId)) {
        currentParams.set("employeeId", String(targetEmployeeId));
        shouldUpdate = true;
      }
    } else {
      if (currentParams.has("view")) {
        currentParams.delete("view");
        shouldUpdate = true;
      }
      if (currentParams.has("employeeId")) {
        currentParams.delete("employeeId");
        shouldUpdate = true;
      }
    }

    if (currentParams.get("dateRange") !== selectedDateRange) {
      currentParams.set("dateRange", selectedDateRange);
      shouldUpdate = true;
    }

    if (!shouldUpdate) {
      return;
    }

    const nextQuery = currentParams.toString();
    const newUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    
    // Prevent infinite loop by checking if URL actually changed
    if (lastUrlRef.current !== newUrl) {
      lastUrlRef.current = newUrl;
      
      // Clear any existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Debounce URL updates to prevent rapid successive calls
      debounceTimeoutRef.current = setTimeout(() => {
        router.replace(newUrl, { scroll: false });
      }, 100);
    }
  }, [view, selectedEmployee, pendingEmployeeId, pathname, router, selectedDateRange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
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
          <Select
            value={selectedDateRange}
            onValueChange={(value) => setSelectedDateRange(value as DateRangeKey)}
          >
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
            <DashboardLiveView
              kpis={kpis}
              states={states}
              onStateSelect={handleStateSelect}
              isLoadingTrail={isLoadingTrail}
              mapCenter={mapCenter}
              mapZoom={mapZoom}
              highlightedEmployee={highlightedEmployee}
              mapMarkers={mapMarkers}
              onResetMap={handleResetMap}
              selectedEmployeeForMap={selectedEmployeeForMap}
              employeeSearchTerm={employeeSearchTerm}
              onEmployeeSearch={(value: string) => setEmployeeSearchTerm(value)}
              employeeList={employeeList}
              filteredEmployeeList={filteredEmployeeList}
              onEmployeeSelect={handleEmployeeSelect}
              getInitials={getInitials}
            />
          )}

          {view === "state" && selectedState && (
            <DashboardStateView
              employees={stateEmployees}
              onEmployeeSelect={handleEmployeeDetailSelect}
            />
          )}

          {view === "employeeDetail" && selectedEmployee && (
            <DashboardEmployeeDetailView
              employee={selectedEmployee}
              dateRange={dateRange}
              selectedDateRangeKey={selectedDateRange}
            />
          )}
        </>
      )}

      {/* Pricing Check Modal */}
      <PricingCheckModal
        isOpen={isPricingModalOpen}
        onClose={handlePricingModalClose}
        onSuccess={handlePricingModalSuccess}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPageContent />
    </Suspense>
  );
}
