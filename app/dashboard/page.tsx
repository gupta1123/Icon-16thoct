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
  differenceInDays,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import PricingCheckModal from "@/components/pricing-check-modal";
import { type DashboardEmployeeSummary, type DashboardOverviewResponse, type CurrentUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLiveView } from "@/components/dashboard/live-view";
import { DashboardStateView } from "@/components/dashboard/state-view";
import { DashboardEmployeeDetailView } from "@/components/dashboard/employee-detail-view";
import { DashboardTotalVisitsView } from "@/components/dashboard/total-visits-view";
import type {
  Employee,
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

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2) // Take first 2 initials
    .join('');
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

const normalizeStateKey = (state?: string | null): string => {
  const normalized = state?.trim().replace(/\s+/g, " ").toLowerCase();
  return !normalized || normalized === "unknown" ? "__unknown__" : normalized;
};

const getStateDisplayName = (state?: string | null): string =>
  state?.trim().replace(/\s+/g, " ") || "Unknown";

const buildStateItemsFromEmployees = (
  employees: DashboardEmployeeSummary[]
): StateItem[] => {
  const grouped = new Map<
    string,
    { name: string; employees: Map<number, DashboardEmployeeSummary> }
  >();

  employees
    .filter((employee) => employee.totalVisits > 0)
    .forEach((employee) => {
      const key = normalizeStateKey(employee.state);
      const group = grouped.get(key) ?? {
        name: getStateDisplayName(employee.state),
        employees: new Map<number, DashboardEmployeeSummary>(),
      };
      group.employees.set(employee.employeeId, employee);
      grouped.set(key, group);
    });

  return Array.from(grouped.values())
    .sort((a, b) => {
      if (a.name === "Unknown") return 1;
      if (b.name === "Unknown") return -1;
      return a.name.localeCompare(b.name);
    })
    .map((group, index) => {
      const stateEmployees = Array.from(group.employees.values());
      return {
        id: index + 1,
        name: group.name,
        employeeCount: stateEmployees.length,
        assignedVisitCount: stateEmployees.reduce(
          (total, employee) => total + employee.assignedVisits,
          0
        ),
        ongoingVisitCount: stateEmployees.reduce(
          (total, employee) => total + employee.ongoingVisits,
          0
        ),
        completedVisitCount: stateEmployees.reduce(
          (total, employee) => total + employee.completedVisits,
          0
        ),
        color: colorPalette[index % colorPalette.length],
      };
    });
};

const dateRanges = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
] as const;

const validDateRangeValues = new Set<DateRangeKey>(dateRanges.map((range) => range.value));
const isValidDateRangeKey = (value: string | null): value is DateRangeKey =>
  Boolean(value && validDateRangeValues.has(value as DateRangeKey));

function DashboardPageContent() {
  const { token } = useAuth();
  // Default to "today" for immediate daily insights
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeKey>(() => {
    if (typeof window === "undefined") {
      return "today";
    }
    const params = new URLSearchParams(window.location.search);
    const dr = params.get("dateRange");
    return isValidDateRangeKey(dr) ? (dr as DateRangeKey) : "today";
  });
  const [view, setView] = useState<"dashboard" | "state" | "employeeDetail" | "totalVisits" | "activeEmployees">(() => {
    if (typeof window === "undefined") {
      return "dashboard";
    }
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    if (
      viewParam === "state" ||
      viewParam === "employeeDetail" ||
      viewParam === "totalVisits" ||
      viewParam === "activeEmployees"
    ) {
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
  const [overviewRefresh, setOverviewRefresh] = useState(0);
  const [overviewSyncedAt, setOverviewSyncedAt] = useState<number | null>(null);
  const refreshOverview = useCallback(() => setOverviewRefresh(value => value + 1), []);
  const [overviewResponse, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [appliedCustomStartDate, setAppliedCustomStartDate] = useState<Date | undefined>(undefined);
  const [appliedCustomEndDate, setAppliedCustomEndDate] = useState<Date | undefined>(undefined);
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHR, setIsHR] = useState(false);
  const [isDataManager, setIsDataManager] = useState(false);
  const [isRoleDetermined, setIsRoleDetermined] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const lastUrlRef = useRef<string>("");
  const suppressUrlSyncRef = useRef<boolean>(false);

  const formatToSentenceCase = useCallback((text?: string | null) => {
    if (!text) return "";
    return text
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, []);

  const formatRole = useCallback((role?: string | null) => {
    if (!role) return "Employee";
    return role.replace(/_/g, " ");
  }, []);

  const composeLocation = useCallback((city?: string | null, state?: string | null) => {
    const parts = [city, state]
      .map((part) => formatToSentenceCase(part))
      .filter(Boolean);
    return parts.join(", ") || "—";
  }, [formatToSentenceCase]);

  const mapSummaryToEmployee = useCallback(
    (summary: DashboardEmployeeSummary): Employee => {
      const employeeName = summary.employeeName ?? `Employee ${summary.employeeId}`;
      return {
        id: summary.employeeId,
        name: employeeName,
        position: formatRole(summary.role),
        avatar: getInitials(employeeName), // Use initials instead of placeholder
        lastUpdated: summary.liveLocationUpdatedAt ?? summary.lastVisitAt ?? "",
        status:
          summary.ongoingVisits > 0
            ? "ongoing"
            : summary.assignedVisits > 0
            ? "assigned"
            : summary.completedVisits > 0
            ? "completed"
            : "idle",
        location: composeLocation(summary.city, summary.state),
        totalVisits: summary.totalVisits,
      };
    },
    [composeLocation, formatRole]
  );

  // Fetch current user data to determine role
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setIsRoleDetermined(true);
        return;
      }
      
      try {
        const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/user/manage/current-user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const currentUserDetails: CurrentUserDto = await response.json();
          
          // Extract roles from authorities (consider all authorities, not only first)
          const authorities = currentUserDetails.authorities || [];
          const roles = authorities.map((a) => a.authority);
          const hasRole = (r: string) => roles.includes(r);
          
          // Set role flags based on hierarchy: Admin > Data Manager > Coordinator > Regional Manager > Field Officer > HR
          const isAdminRole = hasRole('ROLE_ADMIN');
          const isDataManagerRole = hasRole('ROLE_DATA_MANAGER');
          const isHRRole = hasRole('ROLE_HR');
          setIsAdmin(isAdminRole);
          setIsDataManager(isDataManagerRole);
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
      case "custom":
        // Only use applied dates - don't trigger API calls until Apply is clicked
        if (appliedCustomStartDate && appliedCustomEndDate) {
          return { start: appliedCustomStartDate, end: appliedCustomEndDate };
        }
        // If custom is selected but not applied yet, keep using today's date
        // This prevents API calls until Apply is clicked
        return { start: today, end: today };
      default:
        return { start: today, end: today };
    }
  }, [selectedDateRange, appliedCustomStartDate, appliedCustomEndDate]);

  // Never label a previous period's counts as the currently selected range.
  const overview = overviewResponse?.startDate?.slice(0, 10) === format(dateRange.start, "yyyy-MM-dd")
    && overviewResponse?.endDate?.slice(0, 10) === format(dateRange.end, "yyyy-MM-dd")
    ? overviewResponse : null;

  const summaryByEmployeeId = useMemo(() => {
    if (!overview) {
      return new Map<number, DashboardEmployeeSummary>();
    }
    return new Map<number, DashboardEmployeeSummary>(
      overview.employees.map((summary) => [summary.employeeId, summary] as const)
    );
  }, [overview]);

  useEffect(() => {
    const controller = new AbortController();

    const loadOverview = async () => {
      if (!isRoleDetermined) return;
      
      // Don't make this API call for HR users
      if (isHR) {
        setIsLoadingOverview(false);
        return;
      }

      setIsLoadingOverview(true);
      try {
        const start = format(dateRange.start, "yyyy-MM-dd");
        const end = format(dateRange.end, "yyyy-MM-dd");

        // Explicitly use the in-memory auth token to avoid localStorage race/stale token issues
        const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/dashboard/overview?startDate=${start}&endDate=${end}`, {
          signal: controller.signal,
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              }
            : { Accept: "application/json" },
        });

        if (!response.ok) {
          const message = await response.text().catch(() => response.statusText);
          throw new Error(message || `Failed to load overview (${response.status})`);
        }

        const data = (await response.json()) as DashboardOverviewResponse;

        // Update overview state
        if (controller.signal.aborted) return;
        setOverview({ ...data, startDate: start, endDate: end });
        setOverviewSyncedAt(Date.now());
        setError(null);

      } catch (err: unknown) {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error("Dashboard - Error fetching overview:", err);
        // Keep the previous successful result visible if a refresh fails.
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOverview(false);
        }
      }
    };

    loadOverview();
    return () => controller.abort();
  }, [dateRange.start, dateRange.end, isRoleDetermined, isHR, token, overviewRefresh]);

  const checkPricingForToday = useCallback(async () => {
    if (!token || !(isAdmin || isDataManager)) return;
    
    // Check if pricing modal has been shown and closed in this session
    const pricingModalShown = sessionStorage.getItem('pricingModalShown');
    if (pricingModalShown === 'true') {
      console.log('Pricing modal already shown and closed in this session');
      return;
    }
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/brand/getByDateRange?start=${today}&end=${today}`, {
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
    } catch (error) {
      console.error('Error checking pricing:', error);
    }
  }, [token, isAdmin, isDataManager]);

  useEffect(() => {
    if (isRoleDetermined && token && (isAdmin || isDataManager)) {
      checkPricingForToday();
    }
  }, [isRoleDetermined, token, isAdmin, isDataManager, checkPricingForToday]);

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

      const stateName = getStateDisplayName(summary.state);
      const hasStateMatch =
        normalizeStateKey(selectedState?.name) === normalizeStateKey(stateName);
      if (!hasStateMatch) {
        const overviewState = buildStateItemsFromEmployees(overview.employees).find(
          (state) => normalizeStateKey(state.name) === normalizeStateKey(stateName)
        );
        if (overviewState) setSelectedState(overviewState);
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
    const stateNameParam = searchParams.get("stateName");

    // Prevent URL-driven view changes while we are handling an explicit back navigation
    if (suppressUrlSyncRef.current) {
      return;
    }

    // Handle navigation back to dashboard (no view params)
    if (!viewParam && !employeeIdParam) {
      if (view !== "dashboard") {
        console.log("URL change detected: navigating back to dashboard");
        setView("dashboard");
        setSelectedEmployee(null);
        setPendingEmployeeId(null);
        setSelectedState(null);
      }
      return;
    }

    if (viewParam === "employeeDetail") {
      if (view !== "employeeDetail") {
        console.log("URL change detected: navigating to employee detail");
        setView("employeeDetail");
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
    } else if (viewParam === "state") {
      if (view !== "state") {
        console.log("URL change detected: navigating to state view");
        setView("state");
        setSelectedEmployee(null);
        setPendingEmployeeId(null);
      }
      
      // Restore selected state from URL if needed
      if (stateNameParam && overview) {
        const restoredState = buildStateItemsFromEmployees(overview.employees).find(
          (state) =>
            normalizeStateKey(state.name) === normalizeStateKey(stateNameParam)
        );
        if (restoredState) {
          // Only update if it's different
          if (
            normalizeStateKey(selectedState?.name) !==
            normalizeStateKey(restoredState.name)
          ) {
            console.log("Restoring selected state from URL:", stateNameParam);
            setSelectedState(restoredState);
          }
        }
      }
    } else if (viewParam === "totalVisits" || viewParam === "activeEmployees") {
      if (view !== viewParam) {
        setView(viewParam);
        setSelectedEmployee(null);
        setPendingEmployeeId(null);
        setSelectedState(null);
      }
    } else if (viewParam === "dashboard") {
      if (view !== "dashboard") {
        console.log("URL change detected: navigating to dashboard");
        setView("dashboard");
        setSelectedEmployee(null);
        setPendingEmployeeId(null);
        setSelectedState(null);
      }
    }

    // Clean up pending employee ID if param is removed
    if (!employeeIdParam && pendingEmployeeId !== null) {
      setPendingEmployeeId(null);
    }
  }, [searchParams, view, pendingEmployeeId, selectedEmployee, selectedState, overview]);

  useEffect(() => {
    const dateRangeParam = searchParams.get("dateRange");
    if (isValidDateRangeKey(dateRangeParam)) {
      setSelectedDateRange(dateRangeParam);
    }
  }, [searchParams]);

  const stateEmployees = useMemo(() => {
    if (!selectedState || !overview) return [];
    const selectedStateKey = normalizeStateKey(selectedState.name);
    const uniqueEmployees = new Map<number, DashboardEmployeeSummary>();

    overview.employees
      .filter(
        (employee) =>
          employee.totalVisits > 0 &&
          normalizeStateKey(employee.state) === selectedStateKey
      )
      .forEach((employee) => uniqueEmployees.set(employee.employeeId, employee));

    return Array.from(uniqueEmployees.values())
      .map((employee) => mapSummaryToEmployee(employee))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedState, overview, mapSummaryToEmployee]);

  const states = useMemo<StateItem[]>(() => {
    if (!overview) return [];
    return buildStateItemsFromEmployees(overview.employees);
  }, [overview]);

  const kpis = useMemo(() => ({
    totalVisits: overview?.kpi.totalVisits ?? 0,
    activeEmployees: overview
      ? new Set(
          overview.employees
            .filter((employee) => employee.totalVisits > 0)
            .map((employee) => employee.employeeId)
        ).size
      : 0,
    liveLocations:
      overview?.kpi.liveLocations ?? (overview ? overview.liveLocations.length : 0),
  }), [overview]);

  const activeEmployees = useMemo<Employee[]>(() => {
    if (!overview) return [];
    return Array.from(
      new Map(
        overview.employees
          .filter((employee) => employee.totalVisits > 0)
          .map((employee) => [employee.employeeId, employee] as const)
      ).values()
    )
      .map(mapSummaryToEmployee)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [overview, mapSummaryToEmployee]);

  const handleBack = useCallback(() => {
    console.log("Back button clicked. Current view:", view);

    // If we don't have a pathname for some reason, fall back to browser back
    if (!pathname) {
      router.back();
      return;
    }

    const currentParams = new URLSearchParams(searchParams.toString());

    if (view === "employeeDetail") {
      // If we came from a state view, go back to that state view
      if (currentParams.get("returnView") === "activeEmployees") {
        currentParams.set("view", "activeEmployees");
        currentParams.delete("employeeId");
        currentParams.delete("stateName");
        currentParams.delete("returnView");
      } else if (selectedState) {
        currentParams.set("view", "state");
        currentParams.set("stateName", selectedState.name);
        currentParams.delete("employeeId");
        currentParams.delete("returnView");
      } else {
        // Otherwise, go back to the main dashboard view
        currentParams.delete("view");
        currentParams.delete("employeeId");
        currentParams.delete("stateName");
        currentParams.delete("returnView");
      }
    } else if (view === "state" || view === "totalVisits" || view === "activeEmployees") {
      // From state view, go back to the main dashboard view
      currentParams.delete("view");
      currentParams.delete("stateName");
      currentParams.delete("returnView");
    } else {
      // For any other unexpected state, fall back to history back
      router.back();
      return;
    }

    const nextQuery = currentParams.toString();
    const newUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    lastUrlRef.current = newUrl;
    router.push(newUrl, { scroll: false });
  }, [view, pathname, router, searchParams, selectedState]);

  const handleKpiSelect = useCallback((nextView: "totalVisits" | "activeEmployees") => {
    setSelectedState(null);
    setSelectedEmployee(null);
    setView(nextView);
    if (pathname) {
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set("view", nextView);
      currentParams.delete("stateName");
      currentParams.delete("employeeId");
      currentParams.delete("returnView");
      const newUrl = `${pathname}?${currentParams.toString()}`;
      lastUrlRef.current = newUrl;
      router.push(newUrl, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useDashboardHeader({
    heading: view === "dashboard" ? "Dashboard" : view === "state" ? selectedState?.name || "Employees" : view === "totalVisits" ? "Total Visits" : view === "activeEmployees" ? "Active Employees" : selectedEmployee?.name || "Employee details",
    subheading: view === "dashboard" ? "Sales and employee activity overview" : view === "state" ? `${stateEmployees.length} active ${stateEmployees.length === 1 ? "employee" : "employees"} in ${selectedState?.name || "this state"}` : view === "employeeDetail" ? [selectedEmployee?.position, selectedState?.name].filter(Boolean).join(" · ") : "Visit activity in the selected period",
    onBack: view === "dashboard" ? undefined : handleBack,
  });

  const handleStateSelect = useCallback((state: SelectedState) => {
    if (!state) return;
    setSelectedState(state);
    setView("state");
    
    // Update URL to include state view
    if (pathname) {
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set("view", "state");
      currentParams.set("stateName", state.name);
      const nextQuery = currentParams.toString();
      const newUrl = `${pathname}?${nextQuery}`;
      lastUrlRef.current = newUrl;
      router.push(newUrl, { scroll: false });
    }
  }, [pathname, searchParams, router]);

  const handleEmployeeDetailSelect = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setPendingEmployeeId(employee.id);
    setView("employeeDetail");
    
    // Update URL to include employee detail, preserving state name if coming from state view
    if (pathname) {
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set("view", "employeeDetail");
      currentParams.set("employeeId", String(employee.id));
      // Keep stateName parameter if we're coming from a state view
      if (view === "state" && selectedState) {
        currentParams.set("stateName", selectedState.name);
      }
      if (view === "activeEmployees") {
        currentParams.set("returnView", "activeEmployees");
      } else {
        currentParams.delete("returnView");
      }
      const nextQuery = currentParams.toString();
      const newUrl = `${pathname}?${nextQuery}`;
      lastUrlRef.current = newUrl;
      router.push(newUrl, { scroll: false });
    }
  }, [view, pathname, searchParams, router, selectedState]);

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

  if (!isRoleDetermined) {
    return <HRDashboardSkeleton />;
  }

  if (isHR) {
    return <HRDashboard />;
  }

  return (
    <div className="icon-dashboard space-y-4">
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
              onClick={refreshOverview}
              className="border-destructive/40 text-destructive hover:bg-destructive/5"
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      {(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select
            value={selectedDateRange}
            onValueChange={(value) => {
              setSelectedDateRange(value as DateRangeKey);
              const params = new URLSearchParams(searchParams.toString());
              params.set("dateRange", value);
              router.replace(`${pathname}?${params.toString()}`, { scroll: false });
              setDateRangeError(null);
              if (value !== "custom") {
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
                setAppliedCustomStartDate(undefined);
                setAppliedCustomEndDate(undefined);
              }
            }}
          >
            <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Dashboard date range">
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

          {selectedDateRange === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-[140px] justify-start text-left text-xs font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={(date) => {
                      if (date) {
                        setCustomStartDate(date);
                        setDateRangeError(null);
                        // If end date is set and the range exceeds 30 days, adjust end date
                        if (customEndDate) {
                          const daysDiff = differenceInDays(customEndDate, date);
                          if (daysDiff > 30) {
                            const newEndDate = new Date(date);
                            newEndDate.setDate(newEndDate.getDate() + 30);
                            setCustomEndDate(newEndDate);
                          }
                        }
                        setIsStartDatePickerOpen(false);
                      }
                    }}
                    initialFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>

              <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 w-[140px] justify-start text-left text-xs font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "MMM d, yyyy") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={(date) => {
                      if (date) {
                        if (customStartDate) {
                          const daysDiff = differenceInDays(date, customStartDate);
                          if (daysDiff > 30) {
                            setDateRangeError("Date range cannot exceed 30 days");
                            return;
                          }
                          if (date < customStartDate) {
                            setDateRangeError("End date cannot be before start date");
                            return;
                          }
                        }
                        setCustomEndDate(date);
                        setDateRangeError(null);
                        setIsEndDatePickerOpen(false);
                      }
                    }}
                    initialFocus
                    disabled={(date) => {
                      if (date > new Date()) return true;
                      if (customStartDate) {
                        const daysDiff = differenceInDays(date, customStartDate);
                        return daysDiff > 30;
                      }
                      return false;
                    }}
                  />
                </PopoverContent>
              </Popover>

              {dateRangeError && (
                <div className="text-xs text-red-500 basis-full">
                  {dateRangeError}
                </div>
              )}

              <Button
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    // Validate dates before applying
                    const daysDiff = differenceInDays(customEndDate, customStartDate);
                    if (daysDiff > 30) {
                      setDateRangeError("Date range cannot exceed 30 days");
                      return;
                    }
                    if (customEndDate < customStartDate) {
                      setDateRangeError("End date cannot be before start date");
                      return;
                    }
                    // Apply the dates - this will trigger API calls
                    setAppliedCustomStartDate(customStartDate);
                    setAppliedCustomEndDate(customEndDate);
                    setDateRangeError(null);
                  }
                }}
                disabled={!customStartDate || !customEndDate || !!dateRangeError}
                size="sm"
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Show skeleton loader while role is being determined or data is loading */}
      {!isRoleDetermined || (isLoadingOverview && !overview) ? (
        <div className="space-y-4" role="status" aria-label="Loading dashboard">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[0, 1, 2].map(key => <div key={key} className="rounded-lg border bg-card p-3 sm:px-4"><Skeleton className="h-3 w-24 max-w-full" /><Skeleton className="mt-2 h-6 w-12" /></div>)}
          </div>
          <Skeleton className="h-8 w-2/3" />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]"><Skeleton className="h-[55dvh] min-h-[360px]" /><Skeleton className="hidden h-[55dvh] lg:block" /></div>
        </div>
      ) : (
        <>
          {view === "dashboard" && (
            <DashboardLiveView
              overview={overview} kpis={kpis} states={states} dateRange={dateRange}
              onTotalVisitsSelect={() => handleKpiSelect("totalVisits")}
              onActiveEmployeesSelect={() => handleKpiSelect("activeEmployees")}
              onStateSelect={handleStateSelect}
              loading={isLoadingOverview} error={error} syncedAt={overviewSyncedAt}
              onRefresh={refreshOverview}
            />
          )}

          {view === "state" && selectedState && (
            <DashboardStateView
              employees={stateEmployees}
              onEmployeeSelect={handleEmployeeDetailSelect}
            />
          )}

          {view === "totalVisits" && (
            <DashboardTotalVisitsView
              startDate={dateRange.start}
              endDate={dateRange.end}
            />
          )}

          {view === "activeEmployees" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {format(dateRange.start, "d MMM yyyy") === format(dateRange.end, "d MMM yyyy")
                    ? format(dateRange.start, "d MMM yyyy")
                    : `${format(dateRange.start, "d MMM yyyy")} – ${format(dateRange.end, "d MMM yyyy")}`}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                  {activeEmployees.length} {activeEmployees.length === 1 ? "employee" : "employees"}
                </span>
              </div>
              <DashboardStateView
                employees={activeEmployees}
                onEmployeeSelect={handleEmployeeDetailSelect}
                emptyDescription="No employees had visit activity in the selected range."
              />
            </div>
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
