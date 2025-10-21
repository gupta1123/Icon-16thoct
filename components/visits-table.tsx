"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, DownloadIcon, ChevronLeft, ChevronRight, Loader2, Building2, ClipboardList, Eye, Plus, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
// Removed dropdown menu imports as Actions now shows a direct link
import { API, type CombinedTimelineItem, type VisitDto, type ActivityDto, type CurrentUserDto } from "@/lib/api";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format as formatDate,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { extractAuthorityRoles, hasAnyRole, normalizeRoleValue } from "@/lib/role-utils";

const VISITS_STATE_STORAGE_KEY = "visitsTableState";

type PurposeComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  allLabel?: string;
};

const PurposeCombobox = ({
  value,
  onChange,
  options,
  triggerClassName,
  placeholder = "Select option",
  disabled,
  allLabel = "All",
}: PurposeComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  const normalizedOptions = useMemo(() => {
    const unique = Array.from(new Set(options));
    return unique.map((option) => ({
      value: option,
      label: option,
    }));
  }, [options]);

  const filteredOptions = useMemo(() => {
    const baseOptions = [
      { value: "all", label: allLabel },
      ...normalizedOptions,
    ];

    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return baseOptions;
    }

    return baseOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [normalizedOptions, searchTerm, allLabel]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const selectedLabel =
    value === "all"
      ? allLabel
      : normalizedOptions.find((item) => item.value === value)?.label || value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between", triggerClassName)}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <div className="p-2">
          <Input
            placeholder="Search purpose"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-60">
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No purposes found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted",
                    value === option.value ? "bg-muted" : undefined
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

const ExecutiveCombobox = ({
  value,
  onChange,
  options,
  triggerClassName,
  placeholder = "Select executive",
  disabled,
}: PurposeComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  const normalizedOptions = useMemo(() => {
    const unique = Array.from(new Set(options));
    return unique.map((option) => ({
      value: option,
      label: option,
    }));
  }, [options]);

  const filteredOptions = useMemo(() => {
    const baseOptions = [
      { value: "all", label: "All Executives" },
      ...normalizedOptions,
    ];

    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return baseOptions;
    }

    return baseOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [normalizedOptions, searchTerm]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const selectedLabel =
    value === "all"
      ? "All Executives"
      : normalizedOptions.find((item) => item.value === value)?.label || value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", triggerClassName)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <div className="p-2">
          <Input
            placeholder="Search executive"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-72">
          <div className="p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No executives found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted",
                    value === option.value ? "bg-muted" : undefined
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

type Row = {
  id: number;
  customerName: string;
  executive: string;
  date: string; // yyyy-MM-dd
  status?: string;
  purpose?: string;
  visitStart?: string;
  visitEnd?: string;
  intent?: number;
  lastUpdated?: string;
  priority?: string;
  outcome?: string;
  feedback?: string;
  city?: string;
  state?: string;
  checkinTime?: string;
  checkoutTime?: string;
};

type ActivityRow = {
  id: number;
  type: 'activity';
  title: string;
  description: string;
  executive: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  location?: string;
};

type CombinedDisplayRow = { type: 'VISIT'; data: Row } | { type: 'ACTIVITY'; data: ActivityRow };

// Helper function to format time to 12-hour format
const formatTime = (timeStr?: string): string => {
  if (!timeStr) return '—';
  
  try {
    // Handle different time formats (with or without milliseconds)
    const cleanTime = timeStr.split('.')[0]; // Remove milliseconds if present
    const [hours, minutes, seconds] = cleanTime.split(':');
    
    if (hours && minutes) {
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), seconds ? parseInt(seconds) : 0);
      return formatDate(date, 'h:mm a');
    }
  } catch {
    // Fallback to original format if parsing fails
    return timeStr;
  }
  
  return timeStr;
};

// Helper function to format last updated date
const formatLastUpdated = (dateStr: string, timeStr?: string): string => {
  if (!dateStr) return '—';
  
  try {
    // Parse the date and time
    const dateTimeStr = timeStr ? `${dateStr}T${timeStr}` : dateStr;
    const date = parseISO(dateTimeStr);
    
    if (isToday(date)) {
      // Today: show "today 05:45 PM"
      const timeFormat = formatDate(date, 'h:mm a');
      return `today ${timeFormat}`;
    } else if (isYesterday(date)) {
      // Yesterday: show "yesterday" or "yesterday 05:45 PM"
      if (timeStr) {
        const timeFormat = formatDate(date, 'h:mm a');
        return `yesterday ${timeFormat}`;
      }
      return 'yesterday';
    } else {
      // Other dates: show "25 Sep '25 05:00PM"
      const dateFormat = formatDate(date, "d MMM ''yy");
      const timeFormat = formatDate(date, 'h:mm a');
      return `${dateFormat} ${timeFormat}`;
    }
  } catch {
    // Fallback to original format if parsing fails
    return timeStr ? `${dateStr} ${timeStr}` : dateStr;
  }
};

export default function VisitsTable() {
  const { userRole, currentUser } = useAuth();
  const [currentUserDetails, setCurrentUserDetails] = useState<CurrentUserDto | null>(null);
  
  // Set default date range to last 7 days
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultEndDate.getDate() - 7);
  
  const [startDate, setStartDate] = useState<Date | undefined>(defaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(defaultEndDate);
  const [quickRange, setQuickRange] = useState<string>("last7Days");
  const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [customerName, setCustomerName] = useState<string>("");
  const [combinedItems, setCombinedItems] = useState<CombinedTimelineItem[]>([]);
  const [availablePurposes, setAvailablePurposes] = useState<string[]>([]);
  const [availableExecutives, setAvailableExecutives] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(true);
  const router = useRouter();
  const MAX_RANGE_DAYS = 31;
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const hasInitializedFiltersRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsRestoringState(false);
      return;
    }

    const restoreState = () => {
      try {
        const stored = window.localStorage.getItem(VISITS_STATE_STORAGE_KEY);
        if (!stored) {
          return;
        }

        const parsed = JSON.parse(stored) as {
          startDate?: string;
          endDate?: string;
          quickRange?: string;
          selectedPurpose?: string;
          selectedExecutive?: string;
          customerName?: string;
          currentPage?: number;
          pageSize?: number;
        };

        if (parsed.startDate) {
          const parsedStart = new Date(parsed.startDate);
          if (!Number.isNaN(parsedStart.getTime())) {
            setStartDate(parsedStart);
          }
        }

        if (parsed.endDate) {
          const parsedEnd = new Date(parsed.endDate);
          if (!Number.isNaN(parsedEnd.getTime())) {
            setEndDate(parsedEnd);
          }
        }

        if (parsed.quickRange) {
          setQuickRange(parsed.quickRange);
        }

        if (parsed.selectedPurpose) {
          setSelectedPurpose(parsed.selectedPurpose);
        }

        if (parsed.selectedExecutive) {
          setSelectedExecutive(parsed.selectedExecutive);
        }

        if (typeof parsed.customerName === "string") {
          setCustomerName(parsed.customerName);
        }

        if (typeof parsed.currentPage === "number" && parsed.currentPage >= 0) {
          setCurrentPage(parsed.currentPage);
        }

        if (typeof parsed.pageSize === "number" && parsed.pageSize > 0) {
          setPageSize(parsed.pageSize);
        }
      } catch (error) {
        console.error("Failed to restore visits filters:", error);
      }
    };

    restoreState();

    const finalizeRestore = () => setIsRestoringState(false);
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(finalizeRestore);
    } else {
      setTimeout(finalizeRestore, 0);
    }
  }, []);

  const endDateDisabled = useMemo(() => {
    if (!startDate) return undefined;
    const minAllowed = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const maxAllowed = addDays(minAllowed, MAX_RANGE_DAYS - 1);
    return (date: Date) => {
      const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return current < minAllowed || current > maxAllowed;
    };
  }, [startDate]);

  const QUICK_RANGES = [
    { value: "last7Days", label: "Last 7 Days" },
    { value: "last15Days", label: "Last 15 Days" },
    { value: "last30Days", label: "Last 30 Days" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
  ] as const;

  const viewDetails = (id: number) => {
    if (typeof window !== "undefined") {
      const returnContext = {
        route: "/dashboard/visits",
        timestamp: Date.now(),
      };
      try {
        window.localStorage.setItem("visitReturnContext", JSON.stringify(returnContext));
      } catch (error) {
        console.error("Failed to store return context for visits:", error);
      }
    }
    setIsNavigating(true);
    router.push(`/dashboard/visits/${id}`);
  };
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const applyQuickRange = (range: string) => {
    const today = new Date();
    let newStart: Date | undefined;
    let newEnd: Date = new Date(today);

    switch (range) {
      case "last7Days":
        newStart = subDays(newEnd, 6);
        break;
      case "last15Days":
        newStart = subDays(newEnd, 14);
        break;
      case "last30Days":
        newStart = subDays(newEnd, 29);
        break;
      case "thisMonth":
        newStart = startOfMonth(today);
        newEnd = today;
        break;
      case "lastMonth": {
        const lastMonthReference = subDays(startOfMonth(today), 1);
        newStart = startOfMonth(lastMonthReference);
        newEnd = endOfMonth(lastMonthReference);
        break;
      }
      default:
        return;
    }

    if (!newStart) return;

    if (differenceInCalendarDays(newEnd, newStart) > MAX_RANGE_DAYS - 1) {
      newStart = subDays(newEnd, MAX_RANGE_DAYS - 1);
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    setDateRangeError(null);
  };

  const handleQuickRangeChange = (value: string) => {
    if (value === "custom") {
      setQuickRange("custom");
      setDateRangeError(null);
      return;
    }
    setQuickRange(value);
    applyQuickRange(value);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setQuickRange("custom");
    if (!date) {
      setStartDate(undefined);
      setDateRangeError(null);
      return;
    }

    let adjustedEnd = endDate ? new Date(endDate) : undefined;

    if (!adjustedEnd || adjustedEnd < date) {
      adjustedEnd = date;
    }

    if (differenceInCalendarDays(adjustedEnd, date) > MAX_RANGE_DAYS - 1) {
      adjustedEnd = addDays(date, MAX_RANGE_DAYS - 1);
      setDateRangeError("Date range is limited to 31 days. End date adjusted automatically.");
    } else {
      setDateRangeError(null);
    }

    setStartDate(date);
    setEndDate(adjustedEnd);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setQuickRange("custom");
    if (!date) {
      setEndDate(undefined);
      setDateRangeError(null);
      return;
    }

    let adjustedStart = startDate ? new Date(startDate) : undefined;

    if (!adjustedStart || date < adjustedStart) {
      adjustedStart = date;
    }

    if (differenceInCalendarDays(date, adjustedStart) > MAX_RANGE_DAYS - 1) {
      adjustedStart = subDays(date, MAX_RANGE_DAYS - 1);
      setDateRangeError("Date range is limited to 31 days. Start date adjusted automatically.");
    } else {
      setDateRangeError(null);
    }

    setStartDate(adjustedStart);
    setEndDate(date);
  };
  
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await API.getCurrentUser();
        if (isMounted) {
          setCurrentUserDetails(data);
        }
      } catch (error) {
        console.error('Failed to fetch current user details for visits page:', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const {
    isAdmin,
    isDataManager,
    isCoordinator,
    isRegionalManager,
    isFieldOfficer,
    isHR,
    combinedRoles,
    normalizedContextRole,
  } = useMemo(() => {
    const normalizedContextRole = normalizeRoleValue(userRole);
    const contextAuthorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);
    const apiAuthorityRoles = extractAuthorityRoles(currentUserDetails?.authorities ?? null);
    const combinedSet = new Set<string>([...contextAuthorityRoles, ...apiAuthorityRoles]);
    if (normalizedContextRole) {
      combinedSet.add(normalizedContextRole);
    }
    const combinedArray = Array.from(combinedSet);

    return {
      normalizedContextRole,
      combinedRoles: combinedArray,
      isAdmin: hasAnyRole(normalizedContextRole, combinedArray, ['ADMIN']),
      isDataManager: hasAnyRole(normalizedContextRole, combinedArray, ['DATA_MANAGER']),
      isCoordinator: hasAnyRole(normalizedContextRole, combinedArray, ['COORDINATOR']),
      isRegionalManager: hasAnyRole(normalizedContextRole, combinedArray, ['MANAGER', 'OFFICE_MANAGER', 'REGIONAL_MANAGER']),
      isFieldOfficer: hasAnyRole(normalizedContextRole, combinedArray, ['FIELD_OFFICER']),
      isHR: hasAnyRole(normalizedContextRole, combinedArray, ['HR']),
    };
  }, [userRole, currentUser, currentUserDetails]);

  // Get display role for badge
  useEffect(() => {
    console.log('Role Detection Debug (Visits):', {
      userRole,
      normalizedContextRole,
      combinedRoles,
      isAdmin,
      isDataManager,
      isRegionalManager,
      isCoordinator,
      isFieldOfficer,
      isHR,
    });
  }, [
    userRole,
    normalizedContextRole,
    combinedRoles,
    isAdmin,
    isDataManager,
    isRegionalManager,
    isCoordinator,
    isFieldOfficer,
    isHR,
  ]);

  const getDisplayRole = useMemo(() => {
    if (isAdmin) return 'Admin View';
    if (isDataManager) return 'Data Manager View';
    if (isCoordinator) return 'Coordinator View';
    if (isRegionalManager) return 'Regional Manager View';
    if (isFieldOfficer) return 'Field Officer View';
    if (isHR) return 'HR View';
    return 'User View';
  }, [isAdmin, isDataManager, isCoordinator, isRegionalManager, isFieldOfficer, isHR]);

  const mapVisitToRow = (visit: VisitDto): Row => ({
    id: visit.id,
    customerName: visit.storeName,
    executive: visit.employeeName,
    date: visit.visit_date,
    status: visit.checkinTime ? 'Completed' : 'Scheduled',
    purpose: visit.purpose ?? undefined,
    visitStart: formatTime(visit.checkinTime),
    visitEnd: formatTime(visit.checkoutTime),
    intent: visit.intent ?? undefined,
    lastUpdated: visit.updatedAt ? formatLastUpdated(visit.updatedAt, visit.updatedTime) : undefined,
    priority: visit.priority ?? undefined,
    outcome: visit.outcome ?? undefined,
    feedback: visit.feedback ?? undefined,
    city: visit.city ?? undefined,
    state: visit.state ?? undefined,
    checkinTime: visit.checkinTime ?? undefined,
    checkoutTime: visit.checkoutTime ?? undefined,
  });

  const mapActivityToRow = (activity: ActivityDto, fallbackIndex: number): ActivityRow => ({
    id: activity.id ?? fallbackIndex,
    type: 'activity',
    title: activity.title ?? 'Activity',
    description: activity.description ?? '',
    executive: activity.employeeName ?? '',
    date: activity.activityDate ?? '',
    startTime: formatTime(activity.createdTime),
    endTime: formatTime(activity.updatedTime),
    status: undefined,
    location: undefined,
  });

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (isRestoringState) return;

    const startStr = formatDate(startDate, 'yyyy-MM-dd');
    const endStr = formatDate(endDate, 'yyyy-MM-dd');

    const fetchCombinedTimeline = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await API.getCombinedTimeline({
          start: startStr,
          end: endStr,
          page: currentPage,
          size: pageSize,
          sort: "desc",
          storeName: customerName.trim() !== "" ? customerName : undefined,
          purpose: selectedPurpose !== "all" ? selectedPurpose : undefined,
          executiveName: selectedExecutive !== "all" ? selectedExecutive : undefined,
        });

        setCombinedItems(response.items || []);
        setAvailablePurposes((response.availablePurposes || []).slice().sort((a, b) => a.localeCompare(b)));
        setAvailableExecutives((response.availableExecutives || []).slice().sort((a, b) => a.localeCompare(b)));
        setTotalPages(response.totalPages || 0);
      } catch (err: unknown) {
        console.error("Failed to load combined timeline:", err);
        setError(err instanceof Error ? err.message : "Failed to load visits");
        setCombinedItems([]);
        setAvailablePurposes([]);
        setAvailableExecutives([]);
        setTotalPages(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCombinedTimeline();
  }, [startDate, endDate, selectedPurpose, selectedExecutive, customerName, currentPage, pageSize, isRestoringState]);

  // Reset to first page when filters change
  useEffect(() => {
    if (isRestoringState) return;
    if (!hasInitializedFiltersRef.current) {
      hasInitializedFiltersRef.current = true;
      return;
    }
    setCurrentPage(0);
  }, [startDate, endDate, selectedPurpose, customerName, selectedExecutive, pageSize, isRestoringState]);

  useEffect(() => {
    if (isRestoringState) return;
    if (typeof window === "undefined") return;

    const payload = {
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
      quickRange,
      selectedPurpose,
      selectedExecutive,
      customerName,
      currentPage,
      pageSize,
    };

    try {
      window.localStorage.setItem(VISITS_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to persist visits filters:", error);
    }
  }, [startDate, endDate, quickRange, selectedPurpose, selectedExecutive, customerName, currentPage, pageSize, isRestoringState]);

  const combinedRows = useMemo<CombinedDisplayRow[]>(() => {
    const rowsList: CombinedDisplayRow[] = [];
    let activityIndex = 0;
    combinedItems.forEach((item) => {
      if (item.type === "VISIT" && item.visit) {
        rowsList.push({ type: "VISIT", data: mapVisitToRow(item.visit) });
      } else if (item.type === "ACTIVITY" && item.activity) {
        rowsList.push({ type: "ACTIVITY", data: mapActivityToRow(item.activity, activityIndex) });
        activityIndex += 1;
      }
    });
    return rowsList;
   }, [combinedItems]);

   const effectiveTotalPages = totalPages > 0 ? totalPages : 1;


  const csvEscape = (val: unknown) => {
    if (val === null || val === undefined) return '';
    let s = String(val);
    if (s.includes('"')) s = s.replace(/"/g, '""');
    if (/[",\n]/.test(s)) s = `"${s}"`;
    return s;
  };

  const buildCsvAndDownload = (rowsForCsv: Row[]) => {
    const headers = [
      'Customer Name',
      'Executive',
      'Date',
      'Status',
      'Purpose',
      'Visit Start',
      'Visit End',
      'Last Updated',
      'City',
      'State',
    ];

    const lines = [headers.map(csvEscape).join(',')];

    for (const r of rowsForCsv) {
      const status = r.checkinTime ? 'Completed' : 'Scheduled';
      // For CSV, use original date format, not the formatted version
      const lastUpdated = r.lastUpdated ?? '';
      const line = [
        r.customerName,
        r.executive,
        r.date,
        status,
        r.purpose ?? '',
        r.visitStart ?? '',
        r.visitEnd ?? '',
        lastUpdated,
        r.city ?? '',
        r.state ?? '',
      ].map(csvEscape).join(',');
      lines.push(line);
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'visits.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      if (!startDate || !endDate) return;
      const startStr = formatDate(startDate, 'yyyy-MM-dd');
      const endStr = formatDate(endDate, 'yyyy-MM-dd');
      const filters = {
        storeName: customerName.trim() !== '' ? customerName : undefined,
        purpose: selectedPurpose !== 'all' ? selectedPurpose : undefined,
        executiveName: selectedExecutive !== 'all' ? selectedExecutive : undefined,
      } as const;

      const exportRows: Row[] = [];
      let page = 0;
      let totalPagesForExport = 0;

      do {
        const response = await API.getCombinedTimeline({
          start: startStr,
          end: endStr,
          page,
          size: 500,
          sort: 'desc',
          ...filters,
        });

         const visits = response.items
           .filter((item) => item.type === 'VISIT' && item.visit)
           .map((item) => {
             const visit = item.visit as VisitDto;
             const row = mapVisitToRow(visit);
             // For CSV export, use original date and time formats
             row.lastUpdated = visit.updatedAt ? `${visit.updatedAt} ${visit.updatedTime || ''}` : undefined;
             row.visitStart = visit.checkinTime ?? undefined;
             row.visitEnd = visit.checkoutTime ?? undefined;
             return row;
           });

        exportRows.push(...visits);

        totalPagesForExport = response.totalPages ?? 0;
        if (totalPagesForExport === 0 && response.totalElements > 0) {
          totalPagesForExport = 1;
        }

        page += 1;
      } while (page < totalPagesForExport);

      if (exportRows.length === 0) {
        alert('No visits available for export with the selected filters.');
        return;
      }

      buildCsvAndDownload(exportRows);
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Visits</CardTitle>
          <div className="flex items-center gap-3">
            {userRole && (
              <Badge variant={isRegionalManager ? "secondary" : "default"} className="text-xs">
                {getDisplayRole}
              </Badge>
            )}
            {(isRegionalManager || isDataManager) && (
              <Button 
                size="sm" 
                onClick={() => router.push('/dashboard/visits/add')}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Visit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="w-full">
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
        )}
        {dateRangeError && (
          <div className="mb-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-3">
            {dateRangeError}
          </div>
        )}
        
        {/* Status indicator */}
        {!startDate || !endDate ? (
          <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-3">
            Please select both start and end dates to load visits data.
          </div>
        ) : isLoading ? (
          <div className="mb-4 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3">
            Loading visits data...
          </div>
        ) : null}
        
        {/* Mobile Filters trigger */}
        <div className="mb-4 md:hidden">
          <Button variant="outline" size="sm" onClick={() => setIsMobileFilterOpen(true)}>
            <CalendarIcon className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
          <div className="space-y-2">
            <Label>Quick Range</Label>
            <Select value={quickRange} onValueChange={handleQuickRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {QUICK_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    format(startDate, "LLL dd, y")
                  ) : (
                    <span>Select start date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="single"
                  defaultMonth={startDate}
                  selected={startDate}
                  onSelect={handleStartDateChange}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? (
                    format(endDate, "LLL dd, y")
                  ) : (
                    <span>Select end date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="single"
                  defaultMonth={endDate}
                  selected={endDate}
                  onSelect={handleEndDateChange}
                  disabled={endDateDisabled}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>Purpose</Label>
            <PurposeCombobox
              value={selectedPurpose}
              onChange={setSelectedPurpose}
              options={availablePurposes}
              allLabel="All Purposes"
              placeholder="Select purpose"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Customer Name</Label>
            <Input
              placeholder="Search customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Executive</Label>
            <ExecutiveCombobox
              value={selectedExecutive}
              onChange={setSelectedExecutive}
              options={availableExecutives}
              placeholder="Select executive"
            />
          </div>
          
          {(isAdmin || isDataManager) && (
          <div className="flex items-end">
            <Button onClick={handleExport} className="w-full" disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Export CSV
                </>
              )}
            </Button>
          </div>
          )}
        </div>

        {/* Mobile Filters Sheet */}
        <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Visit Filters</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Quick Range</Label>
                <Select value={quickRange} onValueChange={handleQuickRangeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUICK_RANGES.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal ${!startDate && 'text-muted-foreground'}`}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "LLL dd, y") : <span>Select start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="single" defaultMonth={startDate} selected={startDate} onSelect={handleStartDateChange} numberOfMonths={1} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={`w-full justify-start text-left font-normal ${!endDate && 'text-muted-foreground'}`}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "LLL dd, y") : <span>Select end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="single" defaultMonth={endDate} selected={endDate} onSelect={handleEndDateChange} numberOfMonths={1} disabled={endDateDisabled} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Purpose</Label>
                <PurposeCombobox
                  value={selectedPurpose}
                  onChange={setSelectedPurpose}
                  options={availablePurposes}
                  triggerClassName="w-full"
                  allLabel="All Purposes"
                  placeholder="Select purpose"
                />
              </div>

              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input placeholder="Search customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Executive</Label>
                <ExecutiveCombobox
                  value={selectedExecutive}
                  onChange={setSelectedExecutive}
                  options={availableExecutives}
                  placeholder="Select executive"
                  triggerClassName="w-full"
                />
              </div>
            </div>
            <SheetFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setQuickRange('last7Days');
                  applyQuickRange('last7Days');
                  setSelectedPurpose('all');
                  setSelectedExecutive('all');
                  setCustomerName('');
                  setDateRangeError(null);
                }}
              >
                Clear All
              </Button>
              <Button onClick={() => setIsMobileFilterOpen(false)}>Apply Filters</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3 mb-4">
          {!startDate || !endDate ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center bg-card">
              <CalendarIcon className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
              <p>Select both start and end dates to view data</p>
            </div>
          ) : isLoading ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center bg-card">
              <Loader2 className="mx-auto h-8 w-8 mb-2 animate-spin text-muted-foreground" />
              <p>Loading data…</p>
            </div>
          ) : combinedRows.length > 0 ? (
            <>
              {/* Activity Cards */}
              {combinedRows.filter(row => row.type === 'ACTIVITY').map((row) => {
                const activity = row.data;
                return (
              <Card key={`activity-${activity.id}`} className="overflow-hidden shadow-sm border-l-4 border-l-purple-500">
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold line-clamp-2 flex-1" title={activity.title}>
                        {activity.title}
                      </CardTitle>
                      <div className="shrink-0 p-1 rounded bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors" title="Activity">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span>{activity.date}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3 text-sm">
                    {activity.description && (
                      <div className="text-sm text-muted-foreground">
                        {activity.description}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Employee</div>
                        <div className="font-medium text-foreground truncate">{activity.executive}</div>
                      </div>
                      {activity.status && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Status</div>
                          <div className="font-medium text-foreground truncate">{activity.status}</div>
                        </div>
                      )}
                    </div>
                    
                    {(activity.startTime || activity.endTime) && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        {activity.startTime && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Start</div>
                            <div className="font-medium text-foreground text-xs">{activity.startTime}</div>
                          </div>
                        )}
                        {activity.endTime && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">End</div>
                            <div className="font-medium text-foreground text-xs">{activity.endTime}</div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {activity.location && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">Location:</span>
                          <span className="font-medium">{activity.location}</span>
                        </div>
                      </div>
                    )}
                </CardContent>
                </Card>
                );
              })}

              {/* Visit Cards */}
              {combinedRows.filter(row => row.type === 'VISIT').map((row) => {
                const visit = row.data;
                return (
              <Card key={visit.id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold line-clamp-2 flex-1" title={visit.customerName}>{visit.customerName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors" title="Visit">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <Badge className={`shrink-0 ${
                        visit.status === 'Completed'
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : visit.status === 'Scheduled'
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                          : visit.status === 'In Progress'
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                      }`}>
                        {visit.status ?? 'N/A'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>{visit.date}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Executive</div>
                      <div className="font-medium text-foreground truncate">{visit.executive}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Purpose</div>
                      <div className="font-medium text-foreground truncate">{visit.purpose ?? '—'}</div>
                    </div>
                  </div>
                  
                  {(visit.visitStart || visit.visitEnd) && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Check-in</div>
                        <div className="font-medium text-foreground text-xs">{visit.visitStart ?? '—'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Check-out</div>
                        <div className="font-medium text-foreground text-xs">{visit.visitEnd ?? '—'}</div>
                      </div>
                    </div>
                  )}
                  
                  {(visit.city || visit.state) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium">{[visit.city, visit.state].filter(Boolean).join(', ')}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2" onClick={() => viewDetails(visit.id)}>
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
            </>
          ) : (
            <div className="text-center text-sm text-muted-foreground border rounded-lg p-8 bg-card">
              <p className="font-medium mb-1">No data found</p>
              <p className="text-xs">Try adjusting your filters</p>
            </div>
          )}
        </div>

        {/* Table Container - Hidden on mobile */}
        <div className="hidden md:block rounded-md border overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Type</TableHead>
                  <TableHead className="w-48">Customer/Activity</TableHead>
                  <TableHead className="w-24">Executive</TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-40">Purpose/Description</TableHead>
                  <TableHead className="w-20">Start Time</TableHead>
                  <TableHead className="w-20">End Time</TableHead>
                  <TableHead className="w-32">Last Updated</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!startDate || !endDate ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                      Select both start and end dates to view visits
                    </TableCell>
                  </TableRow>
                ) : isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">Loading data…</TableCell>
                  </TableRow>
                ) : combinedRows.length > 0 ? (
                  combinedRows.map((row, index) => {
                    if (row.type === 'ACTIVITY') {
                      const activity = row.data;
                      return (
                        <TableRow key={`activity-${activity.id}-${index}`} className="bg-purple-50/50 hover:bg-purple-50">
                          <TableCell className="w-16">
                            <div className="flex items-center justify-center">
                              <div className="p-1 rounded bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors" title="Activity">
                                <ClipboardList className="h-4 w-4" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium w-48 truncate" title={activity.title}>
                            {activity.title}
                          </TableCell>
                          <TableCell className="w-24 truncate" title={activity.executive}>{activity.executive}</TableCell>
                          <TableCell className="w-24">{activity.date || '—'}</TableCell>
                          <TableCell className="w-20">
                            <span className="px-2 py-1 rounded-full text-xs whitespace-nowrap bg-purple-100 text-purple-800">
                              Activity
                            </span>
                          </TableCell>
                          <TableCell className="w-40 truncate" title={activity.description}>
                            {activity.description || '—'}
                          </TableCell>
                          <TableCell className="w-20">{activity.startTime || '—'}</TableCell>
                          <TableCell className="w-20">{activity.endTime || '—'}</TableCell>
                          <TableCell className="w-32">—</TableCell>
                          <TableCell className="w-24">
                            <span className="text-xs text-muted-foreground">No action</span>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const visit = row.data;
                    return (
                      <TableRow key={`visit-${visit.id}`} className="hover:bg-muted/40">
                        <TableCell className="w-16">
                          <div className="flex items-center justify-center">
                            <div className="p-1 rounded bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors" title="Visit">
                              <Building2 className="h-4 w-4" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium w-48 truncate" title={visit.customerName}>
                          {visit.customerName}
                        </TableCell>
                        <TableCell className="w-24 truncate" title={visit.executive}>{visit.executive}</TableCell>
                        <TableCell className="w-24">{visit.date}</TableCell>
                        <TableCell className="w-20">
                          <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                            visit.status === "Completed" 
                              ? "bg-green-100 text-green-800" 
                              : visit.status === "Scheduled" 
                                ? "bg-blue-100 text-blue-800" 
                                : visit.status === "In Progress" 
                                  ? "bg-yellow-100 text-yellow-800" 
                                  : "bg-red-100 text-red-800"
                          }`}>
                            {visit.status ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="w-40 truncate" title={visit.purpose}>{visit.purpose ?? '—'}</TableCell>
                        <TableCell className="w-20">{visit.visitStart ?? '—'}</TableCell>
                        <TableCell className="w-20">{visit.visitEnd ?? '—'}</TableCell>
                        <TableCell className="w-32 truncate" title={visit.lastUpdated}>{visit.lastUpdated ?? '—'}</TableCell>
                        <TableCell className="w-16">
                          <Button variant="outline" size="sm" className="p-2" onClick={() => viewDetails(visit.id)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No visits found matching the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {isNavigating && (
          <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Opening visit…</span>
            </div>
          </div>
        )}
        
        {/* Pagination Controls - Hidden on mobile */}
        {startDate && endDate && (
          <div className="hidden md:flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="pageSize">Rows per page:</Label>
            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
              <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {effectiveTotalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(effectiveTotalPages - 1, currentPage + 1))}
              disabled={currentPage >= effectiveTotalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
