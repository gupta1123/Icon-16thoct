"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarIcon, User, DollarSign, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import SearchableSelect, { type SearchableOption } from "@/components/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { extractAuthorityRoles, hasAnyRole, normalizeRoleValue } from "@/lib/role-utils";

interface DailyBreakdownData {
    date: string;
    employeeName: string;
    daEarned: number;
    carDistanceKm: number;
    employeeId: number;
    dailyDearnessAllowance: number;
    travelAllowance: number;
    totalDailySalary: number;
    dayType: string;
    completedVisits: number;
    dayOfWeek: string;
    hasAttendance: boolean;
    isSunday: boolean;
    bikeDistanceKm: number;
    dailyBaseSalary: number;
    baseEarned: number;
    approvedExpenses: number;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
}

type AttendanceStatus = "full day" | "half day" | "absent";
const ATTENDANCE_STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
    { value: "full day", label: "Full day" },
    { value: "half day", label: "Half day" },
    { value: "absent", label: "Absent" },
];

const getRowKey = (row: Pick<DailyBreakdownData, "employeeId" | "date">) => `${row.employeeId}::${row.date}`;

const normalizeAttendanceStatus = (raw?: string | null): AttendanceStatus | null => {
    if (!raw) return null;
    const value = raw.trim().toLowerCase();
    if (value === "full day (activity)") return "full day";
    if (value === "full day") return "full day";
    if (value === "half day") return "half day";
    if (value === "absent") return "absent";
    return null;
};

const DailyBreakdown: React.FC = () => {
    const [dailyBreakdownData, setDailyBreakdownData] = useState<DailyBreakdownData[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [dailyLoading, setDailyLoading] = useState(false);
    const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [endDate, setEndDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
    const [selectedEmployee, setSelectedEmployee] = useState<string>("");
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
    const [rowUpdateKey, setRowUpdateKey] = useState<string | null>(null);
    const [pendingStatus, setPendingStatus] = useState<AttendanceStatus | null>(null);
    const [pendingRows, setPendingRows] = useState<DailyBreakdownData[]>([]);
    const [pendingSkippedCount, setPendingSkippedCount] = useState(0);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmTitle, setConfirmTitle] = useState("");
    const [confirmDescription, setConfirmDescription] = useState("");
    const [isApplying, setIsApplying] = useState(false);

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const normalizedRole = typeof window !== "undefined" ? normalizeRoleValue(localStorage.getItem("userRole")) : null;
    const authorityRoles = extractAuthorityRoles(authService.getCurrentUser()?.authorities ?? null);
    const isAdmin = hasAnyRole(normalizedRole, authorityRoles, ["ADMIN"]);
    const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
    const isEditableDate = useCallback(
        (dateStr: string) => {
            // Only allow editing past dates. Disallow today and future dates.
            // Works with YYYY-MM-DD lexicographic compare.
            return dateStr < todayStr;
        },
        [todayStr]
    );

    const editableRowKeys = useMemo(() => {
        return dailyBreakdownData
            .filter((row) => !row.isSunday && isEditableDate(row.date))
            .map(getRowKey);
    }, [dailyBreakdownData, isEditableDate]);

    // "Select all" should only appear when the whole range is completed (no today/future dates in the grid)
    const allowSelectAll = useMemo(() => {
        if (!isAdmin || dailyBreakdownData.length === 0) return false;
        return dailyBreakdownData.every((row) => row.date < todayStr);
    }, [isAdmin, dailyBreakdownData, todayStr]);

    const fetchDailyBreakdown = useCallback(async (options?: { silent?: boolean }) => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        if (!options?.silent) {
            setDailyLoading(true);
        }
        setError(null);
        try {
            if (!startDate || !endDate) {
                throw new Error('Please select a valid date range');
            }
            if (!selectedEmployee) {
                throw new Error('Please select an employee to view daily breakdown');
            }
            const employeeId = selectedEmployee;
            const startDateStr = format(startDate, 'yyyy-MM-dd');
            const endDateStr = format(endDate, 'yyyy-MM-dd');

            const response = await fetch(
                `/api/proxy/salary-calculation/daily-breakdown?employeeId=${employeeId}&startDate=${startDateStr}&endDate=${endDateStr}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch daily breakdown: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data) {
                throw new Error('No daily breakdown data received');
            }

            setDailyBreakdownData(data);
            setSelectedRowKeys(new Set());
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to fetch daily breakdown data');
        } finally {
            if (!options?.silent) {
                setDailyLoading(false);
            }
        }
    }, [token, startDate, endDate, selectedEmployee]);

    const fetchEmployees = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch('/api/proxy/employee/getAll', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type") || "";
                let details = "";
                try {
                    if (contentType.includes("application/json")) {
                        const json = await response.json();
                        details = typeof json === "string" ? json : JSON.stringify(json);
                    } else {
                        details = await response.text();
                    }
                } catch {
                    // ignore parse errors
                }
                const preview = details ? ` - ${details.slice(0, 200)}` : "";
                throw new Error(`Failed to fetch employees (${response.status} ${response.statusText})${preview}`);
            }

            const data = await response.json();
            if (data) {
                // Filter only field officers and sort by name
                const fieldOfficers = data
                    .filter((emp: Employee) => emp.role === 'Field Officer')
                    .sort((a: Employee, b: Employee) => {
                        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                setEmployees(fieldOfficers);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
            toast.error(error instanceof Error ? error.message : "Failed to fetch employees");
        }
    }, [token]);

    const fetchAllData = useCallback(async () => {
        if (!token || !startDate || !endDate || !selectedEmployee) return;
        
        setError(null);
        await fetchDailyBreakdown();
    }, [token, startDate, endDate, selectedEmployee, fetchDailyBreakdown]);

    // Load employees on mount only
    useEffect(() => {
        if (token) {
            fetchEmployees();
        }
    }, [token, fetchEmployees]);

    // Prune any selected keys that are no longer editable (e.g., when month progresses)
    useEffect(() => {
        setSelectedRowKeys((prev) => {
            if (prev.size === 0) return prev;
            const allowed = new Set(editableRowKeys);
            const next = new Set<string>();
            prev.forEach((key) => {
                if (allowed.has(key)) next.add(key);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [editableRowKeys]);

    const getDayTypeColor = (dayType: string, isSunday: boolean = false) => {
        if (isSunday) return 'bg-purple-100 text-purple-800 border-purple-200';
        switch (dayType.toLowerCase()) {
            case 'full day': return 'bg-green-100 text-green-800 border-green-200';
            case 'full day (activity)': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'half day': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'present': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Format day name from "MONDAY" to "Monday" format
    const formatDayName = (dayOfWeek: string) => {
        return dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1).toLowerCase();
    };

    // Get day type display - show "paid leave" for Sunday, otherwise use dayType
    const getDayTypeDisplay = (dayType: string, isSunday: boolean = false) => {
        if (isSunday) return 'paid leave';
        if (dayType.toLowerCase() === 'full day (activity)') return 'full day (activity)';
        return dayType;
    };

    const applyAttendanceStatus = useCallback(async (rows: DailyBreakdownData[], status: AttendanceStatus) => {
        if (!token) {
            toast.error("Authentication token not found. Please log in.");
            return;
        }
        if (!rows.length) return;

        setIsApplying(true);
        // If single-row, show row-level loading state on that row
        if (rows.length === 1) {
            setRowUpdateKey(getRowKey(rows[0]));
        }

        try {
            const results = await Promise.allSettled(
                rows.map((row) =>
                    fetch(
                        `/api/proxy/attendance-log/updateStatus?employeeId=${row.employeeId}&date=${row.date}&status=${encodeURIComponent(status)}`,
                        { method: "PUT", headers: { Authorization: `Bearer ${token}` } }
                    ).then(async (res) => {
                        if (!res.ok) {
                            const text = await res.text().catch(() => "");
                            throw new Error(text || `Failed (${res.status}) for ${row.date}`);
                        }
                    })
                )
            );

            const failures = results.filter((r) => r.status === "rejected").length;
            const successes = results.length - failures;

            if (successes > 0) {
                // Optimistic UI update for the rows we attempted
                const keys = new Set(rows.map(getRowKey));
                setDailyBreakdownData((prev) =>
                    prev.map((item) => (keys.has(getRowKey(item)) ? { ...item, dayType: status, hasAttendance: true } : item))
                );
            }

            if (successes > 0 && failures === 0) {
                toast.success(
                    rows.length === 1
                        ? `Marked as "${status}"`
                        : `Marked ${successes} day(s) as "${status}"${pendingSkippedCount ? ` (skipped ${pendingSkippedCount} Sunday)` : ""}`
                );
            } else {
                if (successes > 0) {
                    toast.success(`Updated ${successes} day(s) to "${status}"`);
                }
                if (failures > 0) {
                    toast.error(`Failed to update ${failures} day(s).`);
                }
            }

            await fetchDailyBreakdown({ silent: true });
            setSelectedRowKeys(new Set());
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update day type");
        } finally {
            setIsApplying(false);
            setRowUpdateKey(null);
        }
    }, [token, fetchDailyBreakdown, pendingSkippedCount]);

    const toggleRowSelected = useCallback((key: string, selected: boolean) => {
        setSelectedRowKeys((prev) => {
            const next = new Set(prev);
            if (selected) next.add(key);
            else next.delete(key);
            return next;
        });
    }, []);

    const selectedCount = selectedRowKeys.size;
    const allSelected = editableRowKeys.length > 0 && selectedCount === editableRowKeys.length;

    const setAllSelected = useCallback((selected: boolean) => {
        setSelectedRowKeys(() => (selected ? new Set(editableRowKeys) : new Set()));
    }, [editableRowKeys]);

    const clearSelection = useCallback(() => setSelectedRowKeys(new Set()), []);

    const openConfirmForRows = useCallback((status: AttendanceStatus, rows: DailyBreakdownData[]) => {
        // Skip Sundays and non-editable dates (today/future)
        const editableRows = rows.filter((row) => !row.isSunday && isEditableDate(row.date));
        const skipped = rows.length - editableRows.length;

        if (editableRows.length === 0) {
            toast.error("Selected days are not editable (Sundays and today/future dates cannot be changed).");
            return;
        }

        setPendingStatus(status);
        setPendingRows(editableRows);
        setPendingSkippedCount(skipped);

        const isBulk = editableRows.length > 1;
        const title = isBulk ? "Confirm bulk update" : "Confirm update";
        const description = isBulk
            ? `Mark ${editableRows.length} selected day(s) as "${status}"${skipped ? ` (skipping ${skipped} non-editable day(s))` : ""}?`
            : `Mark ${format(new Date(editableRows[0].date), "d MMM yyyy")} as "${status}"?`;

        setConfirmTitle(title);
        setConfirmDescription(description);
        setConfirmOpen(true);
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const employeeOptions = useMemo<SearchableOption<Employee>[]>(() => {
        return employees.map((emp) => ({
            value: emp.id.toString(),
            label: `${emp.firstName} ${emp.lastName}`,
            data: emp,
        }));
    }, [employees]);

    // Get date range display name
    const getDateRangeDisplay = () => {
        if (!startDate || !endDate) {
            return 'Select Date Range';
        }
        return `${format(startDate, 'd MMM yyyy')} - ${format(endDate, 'd MMM yyyy')}`;
    };

    // Get selected employee display name
    const getSelectedEmployeeDisplay = () => {
        if (!selectedEmployee) return 'Select Employee';
        const selected = employeeOptions.find(e => e.value === selectedEmployee);
        return selected ? selected.label : 'Selected Employee';
    };

    const selectedRows = useMemo(() => {
        if (!selectedRowKeys.size) return [];
        return dailyBreakdownData.filter((row) => selectedRowKeys.has(getRowKey(row)));
    }, [dailyBreakdownData, selectedRowKeys]);

    const showActionBar = isAdmin && selectedCount > 0;

    return (
        <div className={`space-y-6 ${showActionBar ? "pb-24" : ""}`}>
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-foreground">Daily Breakdown</CardTitle>
                    <p className="text-sm text-muted-foreground">View detailed daily salary breakdowns for employees</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Filters Section */}
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="employee" className="text-sm font-medium text-foreground">Employee</Label>
                            <SearchableSelect<Employee>
                                options={employeeOptions}
                                value={selectedEmployee || undefined}
                                onSelect={(option) => {
                                    if (!option) {
                                        setSelectedEmployee('');
                                        return;
                                    }
                                    setSelectedEmployee(option.value);
                                }}
                                placeholder="Select employee"
                                emptyMessage="No employees available"
                                noResultsMessage="No employees match your search"
                                searchPlaceholder="Search employees..."
                                allowClear={!!selectedEmployee}
                                disabled={employeeOptions.length === 0}
                                triggerClassName="w-full"
                                contentClassName="w-[--radix-popover-trigger-width]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">From Date</Label>
                            <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={(date) => {
                                            if (date) {
                                                setStartDate(date);
                                                setIsStartDatePickerOpen(false);
                                            }
                                        }}
                                        initialFocus
                                        disabled={(date) => date > new Date()}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">To Date</Label>
                            <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={(date) => {
                                            if (date) {
                                                setEndDate(date);
                                                setIsEndDatePickerOpen(false);
                                            }
                                        }}
                                        initialFocus
                                        disabled={(date) => date > new Date() || (startDate && date < startDate)}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">&nbsp;</Label>
                            <Button onClick={fetchAllData} className="w-full" size="sm" disabled={dailyLoading || !selectedEmployee}>
                                {dailyLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    !selectedEmployee ? 'Select Employee' : 'Apply Filter'
                                )}
                            </Button>
                        </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-muted-foreground">
                            <div>{getDateRangeDisplay()}</div>
                        </div>
                    </div>

                    {dailyLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading daily breakdown data...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setError(null);
                                        fetchAllData();
                                    }}
                                    disabled={dailyLoading}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!dailyLoading && !error && (
                        <>
                            {/* Mobile view */}
                            <div className="md:hidden space-y-4">
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Daily Breakdown - {getSelectedEmployeeDisplay()}</h3>
                                        <p className="text-sm text-muted-foreground">{getDateRangeDisplay()}</p>
                                    </div>
                                    <div className="p-4">
                                        {dailyLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin" />
                                                <span className="ml-2">Loading daily data...</span>
                                            </div>
                                        ) : dailyBreakdownData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No daily breakdown data available
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {dailyBreakdownData.map((day, index) => (
                                                    <Card key={index} className="overflow-hidden shadow-sm">
                                                        <CardContent className="pt-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center space-x-2">
                                                                    {isAdmin && !day.isSunday && isEditableDate(day.date) && (
                                                                        <Checkbox
                                                                            checked={selectedRowKeys.has(getRowKey(day))}
                                                                            onCheckedChange={(checked) =>
                                                                                toggleRowSelected(getRowKey(day), Boolean(checked))
                                                                            }
                                                                            aria-label={`Select ${day.date}`}
                                                                        />
                                                                    )}
                                                                    <User className="h-5 w-5 text-primary" />
                                                                    <div>
                                                                        <div className="font-medium text-lg text-foreground">{day.employeeName}</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            {format(new Date(day.date), 'd MMM yyyy')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    {!isAdmin || day.isSunday || !isEditableDate(day.date) ? (
                                                                        <Badge className={`${getDayTypeColor(day.dayType, day.isSunday)} mb-1`}>
                                                                            {getDayTypeDisplay(day.dayType, day.isSunday)}
                                                                        </Badge>
                                                                    ) : (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <button
                                                                                    type="button"
                                                                                    className="mb-1 inline-flex items-center gap-2 disabled:opacity-60"
                                                                                    disabled={rowUpdateKey === getRowKey(day) || isApplying}
                                                                                    aria-label="Change day type"
                                                                                >
                                                                                    <Badge className={getDayTypeColor(day.dayType, day.isSunday)}>
                                                                                        {rowUpdateKey === getRowKey(day) ? (
                                                                                            <span className="inline-flex items-center gap-2">
                                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                                Updating...
                                                                                            </span>
                                                                                        ) : (
                                                                                            getDayTypeDisplay(day.dayType, day.isSunday)
                                                                                        )}
                                                                                    </Badge>
                                                                                </button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                                                                                    <DropdownMenuItem
                                                                                        key={opt.value}
                                                                                        onSelect={() => openConfirmForRows(opt.value, [day])}
                                                                                    >
                                                                                        {opt.label}
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                    <div className="font-bold text-lg text-foreground">{formatCurrency(day.totalDailySalary)}</div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Visits:</span>
                                                                        <span className="font-medium text-foreground">{day.completedVisits}</span>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Base:</span>
                                                                        <span className="font-medium text-foreground">{formatCurrency(day.baseEarned)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Travel:</span>
                                                                        <span className="font-medium text-foreground">{formatCurrency(day.travelAllowance)}</span>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">DA:</span>
                                                                        <span className="font-medium text-foreground">{formatCurrency(day.daEarned)}</span>
                                                                    </div>
                                                                    {/* <div className="flex items-center space-x-2">
                                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Car Dist:</span>
                                                                        <span className="font-medium text-foreground">{day.carDistanceKm.toFixed(2)} Km</span>
                                                                    </div> */}
                                                                    <div className="flex items-center space-x-2">
                                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Bike Dist:</span>
                                                                        <span className="font-medium text-foreground">{day.bikeDistanceKm.toFixed(2)} Km</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Desktop view */}
                            <div className="hidden md:block">
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Daily Breakdown - {getSelectedEmployeeDisplay()}</h3>
                                        <p className="text-sm text-muted-foreground">{getDateRangeDisplay()}</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {dailyLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin" />
                                                <span className="ml-2">Loading daily breakdown...</span>
                                            </div>
                                        ) : dailyBreakdownData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No daily breakdown data available
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        {isAdmin && (
                                                            <TableHead className="w-[44px]">
                                                                {allowSelectAll && (
                                                                    <Checkbox
                                                                        checked={allSelected}
                                                                        onCheckedChange={(checked) => setAllSelected(Boolean(checked))}
                                                                        aria-label="Select all days"
                                                                    />
                                                                )}
                                                            </TableHead>
                                                        )}
                                                        <TableHead>Employee</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Visits</TableHead>
                                                        <TableHead>Base</TableHead>
                                                        <TableHead>Travel</TableHead>
                                                        <TableHead>DA</TableHead>
                                                        <TableHead>Dist (km)</TableHead>
                                                        <TableHead>Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {dailyBreakdownData.map((day, index) => (
                                                        <TableRow key={index}>
                                                            {isAdmin && (
                                                                <TableCell>
                                                                    {!day.isSunday && isEditableDate(day.date) && (
                                                                        <Checkbox
                                                                            checked={selectedRowKeys.has(getRowKey(day))}
                                                                            onCheckedChange={(checked) =>
                                                                                toggleRowSelected(getRowKey(day), Boolean(checked))
                                                                            }
                                                                            disabled={isApplying}
                                                                            aria-label={`Select ${day.date}`}
                                                                        />
                                                                    )}
                                                                </TableCell>
                                                            )}
                                                            <TableCell className="font-medium">{day.employeeName}</TableCell>
                                                            <TableCell>
                                                                {format(new Date(day.date), 'dd/MM/yyyy')}{" "}
                                                                <span className="text-muted-foreground">({formatDayName(day.dayOfWeek).slice(0, 3).toUpperCase()})</span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {!isAdmin || day.isSunday || !isEditableDate(day.date) ? (
                                                                    <Badge className={getDayTypeColor(day.dayType, day.isSunday)}>
                                                                        {getDayTypeDisplay(day.dayType, day.isSunday)}
                                                                    </Badge>
                                                                ) : (
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <button
                                                                                type="button"
                                                                                className="inline-flex items-center gap-2 disabled:opacity-60"
                                                                                disabled={rowUpdateKey === getRowKey(day) || isApplying}
                                                                                aria-label="Change day type"
                                                                            >
                                                                                <Badge className={getDayTypeColor(day.dayType, day.isSunday)}>
                                                                                    {rowUpdateKey === getRowKey(day) ? (
                                                                                        <span className="inline-flex items-center gap-2">
                                                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                                            Updating...
                                                                                        </span>
                                                                                    ) : (
                                                                                        getDayTypeDisplay(day.dayType, day.isSunday)
                                                                                    )}
                                                                                </Badge>
                                                                            </button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="start">
                                                                            {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                                                                                <DropdownMenuItem
                                                                                    key={opt.value}
                                                                                    onSelect={() => openConfirmForRows(opt.value, [day])}
                                                                                >
                                                                                    {opt.label}
                                                                                </DropdownMenuItem>
                                                                            ))}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>{day.completedVisits}</TableCell>
                                                            <TableCell>{formatCurrency(day.baseEarned)}</TableCell>
                                                            <TableCell>{formatCurrency(day.travelAllowance)}</TableCell>
                                                            <TableCell>{formatCurrency(day.daEarned)}</TableCell>
                                                            <TableCell>{day.bikeDistanceKm.toFixed(1)}</TableCell>
                                                            <TableCell className="font-bold">{formatCurrency(day.totalDailySalary)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            {dailyBreakdownData.length > 0 && (
                                <Card className="bg-muted/30">
                                    <CardContent className="pt-6">
                                        <div className="flex items-start space-x-3">
                                            <CalendarIcon className="h-5 w-5 text-primary mt-0.5" />
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-foreground">Daily Breakdown Summary</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Showing {dailyBreakdownData.length} daily records for {getSelectedEmployeeDisplay()} 
                                                    from {getDateRangeDisplay()}. Each record shows the detailed breakdown of salary components 
                                                    including base salary, travel allowance, and dearness allowance.
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Floating bulk action bar (Admin) */}
            {showActionBar && (
                <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
                    <div className="rounded-2xl border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                                    <span className="font-semibold">{selectedCount}</span>
                                    <span className="text-muted-foreground">Selected</span>
                                </div>
                                <button
                                    type="button"
                                    className="text-sm text-muted-foreground hover:text-foreground"
                                    onClick={clearSelection}
                                    disabled={isApplying}
                                >
                                    Clear
                                </button>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button disabled={isApplying} className="rounded-full">
                                        Mark As…
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                                        <DropdownMenuItem
                                            key={opt.value}
                                            onSelect={() => openConfirmForRows(opt.value, selectedRows)}
                                        >
                                            {opt.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation modal (bulk + single) */}
            <ConfirmationDialog
                open={confirmOpen}
                onOpenChange={(open) => {
                    if (!isApplying) setConfirmOpen(open);
                }}
                title={confirmTitle}
                description={confirmDescription}
                confirmText="Confirm"
                cancelText="Cancel"
                onConfirm={() => {
                    if (!pendingStatus || pendingRows.length === 0) return;
                    applyAttendanceStatus(pendingRows, pendingStatus);
                }}
                isLoading={isApplying}
            />
        </div>
    );
};

export default DailyBreakdown;
