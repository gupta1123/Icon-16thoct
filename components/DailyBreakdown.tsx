"use client";

import Link from "next/link";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, User, CalendarIcon, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { API, API_BASE_URL } from "@/lib/api";
import { isAdminEmployee } from "@/lib/employee-role";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePayrollRows } from "@/components/use-payroll-rows";
import { settlePayrollUpdates } from "@/lib/payroll-data";

// --- Interfaces ---
interface DailyBreakdownData {
    date: string; // ISO string
    employeeName: string;
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
    carDistanceKm: number;
    dailyBaseSalary: number;
    baseEarned: number;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    userDto?: { roles?: string | null } | null;
}

// --- Helper Components ---

// Status Badge Component
const StatusBadge = ({ status, isSunday }: { status: string; isSunday: boolean }) => {
    let colorClass = "border-border bg-muted/50 text-muted-foreground";

    // Normalize "present" to "absent" for all checks
    const normalizedStatus = status.toLowerCase() === "present" ? "Absent" : status;
    const statusLower = normalizedStatus.toLowerCase();

    if (isSunday && statusLower !== "absent") {
        colorClass = "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/35 dark:text-violet-300";
    } else {
        switch (statusLower) {
            case "full day": colorClass = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300"; break;
            case "half day": colorClass = "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-300"; break;
            case "absent": colorClass = "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-300"; break;
        }
    }

    const label = isSunday && statusLower !== "absent" ? "Paid Leave (Sun)" : normalizedStatus;

    return (
        <Badge className={cn("capitalize whitespace-nowrap", colorClass)}>
            {label}
        </Badge>
    );
};

const DistanceIssueNote = ({ href }: { href: string }) => (
    <p className="text-xs leading-relaxed text-amber-600">
        Minus distance may be incorrect. Recalculate it from{" "}
        <Link href={href} className="font-medium underline underline-offset-2">
            Distance Recalculation
        </Link>
        .
    </p>
);

// --- Main Component ---
const DailyBreakdown: React.FC = () => {
    // Data States
    const [revision, setRevision] = useState(0);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Selection State (Stores composite keys: "date|employeeId")
    const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

    // Loading & Error States
    const [isBulkUpdating, setIsBulkUpdating] = useState(false); // Update load
    const [updateError, setUpdateError] = useState<string | null>(null);

    // Filter States
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'));
    const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

    // UI Popover States
    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
    const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const dailyRequest = useMemo(() => {
        if (!token || !selectedEmployee || !startDate || !endDate || dateRangeInvalid) return null;
        return {
            url: `${API_BASE_URL}/salary-calculation/daily-breakdown?employeeId=${selectedEmployee}&startDate=${startDate}&endDate=${endDate}`,
            token,
            revision,
        };
    }, [token, selectedEmployee, startDate, endDate, dateRangeInvalid, revision]);
    const dailyResult = usePayrollRows<DailyBreakdownData>(dailyRequest);
    const dailyBreakdownData = dailyResult.data;
    const isLoading = dailyResult.loading;
    const error = dailyResult.error;
    const refreshDailyBreakdown = () => setRevision(value => value + 1);

    // --- Helpers ---
    const getRecordKey = (date: string, empId: number) => `${date}|${empId}`;

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

    const formatDateForFilter = (date: Date | undefined) => date ? format(date, 'yyyy-MM-dd') : '';

    // --- Fetching Logic ---
    const fetchEmployees = useCallback(async () => {
        if (!token) return;
        try {
            const data = await API.getAllEmployees();
            if (Array.isArray(data)) {
                const mapped: Employee[] = data.map(emp => ({
                    id: emp.id,
                    firstName: emp.firstName || '',
                    lastName: emp.lastName || '',
                    role: emp.role || '',
                    userDto: emp.userDto,
                }));
                const eligibleEmployees = mapped
                    .filter((employee) => !isAdminEmployee(employee))
                    .sort((a, b) => `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`.trim()));
                setEmployees(eligibleEmployees);
            }
        } catch (err) { console.error(err); }
    }, [token]);

    useEffect(() => { if (token) fetchEmployees(); }, [token, fetchEmployees]);

    useEffect(() => {
        if (!selectedEmployee && employees.length > 0) {
            setSelectedEmployee(employees[0].id.toString());
        }
    }, [selectedEmployee, employees]);

    useEffect(() => {
        setSelectedRecords(new Set());
        setIsConfirmOpen(false);
        setPendingStatus(null);
    }, [dailyRequest]);

    // --- Selection Logic ---
    const toggleRecord = (date: string, empId: number) => {
        const key = getRecordKey(date, empId);
        setSelectedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else newSet.add(key);
            return newSet;
        });
    };

    const toggleAll = () => {
        if (selectedRecords.size === dailyBreakdownData.length) {
            setSelectedRecords(new Set()); // Deselect all
        } else {
            const allKeys = dailyBreakdownData.map(d => getRecordKey(d.date, d.employeeId));
            setSelectedRecords(new Set(allKeys));
        }
    };

    // --- Bulk Update Logic ---
    const handleBulkUpdate = async (newStatus: string) => {
        if (selectedRecords.size === 0 || !token || !dailyResult.loaded || isBulkUpdating) return;
        setIsBulkUpdating(true);
        setUpdateError(null);

        try {
            const updates = Array.from(selectedRecords).map(key => {
                const [date, empIdStr] = key.split('|');
                return { date, employeeId: parseInt(empIdStr, 10), status: newStatus };
            });

            const updatePromises = updates.map(async (update) => {
                const normalizedStatus = update.status.toLowerCase();

                const response = await fetch(
                    `${API_BASE_URL}/attendance-log/updateStatus?employeeId=${update.employeeId}&date=${update.date}&status=${encodeURIComponent(normalizedStatus)}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'admin': 'true',
                        },
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to update status for employee ${update.employeeId} on ${update.date}: ${response.status} ${response.statusText}. ${errorText}`);
                }

                return response;
            });

            await settlePayrollUpdates(updatePromises, refreshDailyBreakdown);
            setSelectedRecords(new Set());
            toast.success(`Marked ${updates.length} record(s) as "${newStatus}"`);
        } catch (error) {
            console.error("Bulk update failed", error);
            const message = error instanceof Error ? error.message : "Failed to update status. Please try again.";
            setUpdateError(message);
            toast.error(message);
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const openStatusConfirmation = (status: string) => {
        setPendingStatus(status);
        setIsConfirmOpen(true);
    };

    const confirmBulkUpdate = async () => {
        if (!pendingStatus) return;
        await handleBulkUpdate(pendingStatus);
        setIsConfirmOpen(false);
        setPendingStatus(null);
    };

    const handleDialogOpenChange = (open: boolean) => {
        if (isBulkUpdating) return;
        setIsConfirmOpen(open);
        if (!open) setPendingStatus(null);
    };

    // --- Derived State for UI ---
    const employeeOptions = useMemo(() => employees.map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}` })), [employees]);
    const filteredEmployees = useMemo(() =>
        employeeOptions.filter(e => e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase())),
    [employeeOptions, employeeSearchTerm]);
    const selectedEmployeeLabel = selectedEmployee
        ? employeeOptions.find(e => e.id.toString() === selectedEmployee)?.name || "Select employee"
        : "Select employee";
    const distanceRecalculationHref = useMemo(() => {
        const params = new URLSearchParams({ tab: "distanceRecalculation" });
        if (selectedEmployee) params.set("employeeIds", selectedEmployee);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        return `/dashboard/settings?${params.toString()}`;
    }, [endDate, selectedEmployee, startDate]);
    const hasNegativeDistance = useMemo(
        () => dailyBreakdownData.some((day) => (day.carDistanceKm || 0) + (day.bikeDistanceKm || 0) < 0),
        [dailyBreakdownData]
    );
    const totals = useMemo(() => {
        return dailyBreakdownData.reduce(
            (acc, day) => {
                acc.visits += day.completedVisits || 0;
                acc.base += day.baseEarned || 0;
                acc.travel += day.travelAllowance || 0;
                acc.da += day.dailyDearnessAllowance || 0;
                acc.distance += (day.carDistanceKm || 0) + (day.bikeDistanceKm || 0);
                acc.total += day.totalDailySalary || 0;
                return acc;
            },
            { visits: 0, base: 0, travel: 0, da: 0, distance: 0, total: 0 }
        );
    }, [dailyBreakdownData]);

    return (
        <div className="relative space-y-4 pb-24">
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
                <CardContent className="space-y-4 p-4">
                    {hasNegativeDistance && (
                        <div className="rounded-md border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-left dark:border-amber-900/50 dark:bg-amber-950/25">
                            <DistanceIssueNote href={distanceRecalculationHref} />
                        </div>
                    )}

                    <fieldset disabled={isBulkUpdating} className="min-w-0 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 disabled:opacity-60">
                        <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-2">
                        {/* Employee Select */}
                        <div className="min-w-0 space-y-1.5 lg:w-[220px] lg:shrink-0">
                            <Label className="text-xs font-medium text-foreground">Employee</Label>
                            <Popover open={isEmployeePopoverOpen} onOpenChange={setIsEmployeePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-9 w-full justify-between px-3 text-sm font-normal shadow-none">
                                        <span className="flex min-w-0 items-center gap-2 truncate">
                                            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="truncate">{selectedEmployeeLabel}</span>
                                        </span>
                                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0" align="start">
                                    <div className="border-b p-3">
                                        <Input
                                            placeholder="Search employees..."
                                            value={employeeSearchTerm}
                                            onChange={e => setEmployeeSearchTerm(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {filteredEmployees.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                                No employees match your search.
                                            </div>
                                        ) : (
                                            <div className="p-1">
                                                {filteredEmployees.map(e => (
                                                    <button
                                                        key={e.id}
                                                        type="button"
                                                        onClick={() => {setSelectedEmployee(e.id.toString()); setIsEmployeePopoverOpen(false)}}
                                                        className={cn(
                                                            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50",
                                                            selectedEmployee === e.id.toString() && "bg-primary/10 font-medium text-primary"
                                                        )}
                                                    >
                                                        {e.name} {selectedEmployee === e.id.toString() && <Check className="h-3 w-3" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date Pickers */}
                        <div className="min-w-0 space-y-1.5 lg:w-[180px] lg:shrink-0">
                            <Label className="text-xs font-medium text-foreground">From date</Label>
                            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-9 w-full justify-start px-3 text-left text-sm font-normal shadow-none">
                                        <CalendarIcon className="mr-2 h-4 w-4" />{startDate ? format(new Date(startDate), 'MMM dd, yyyy') : "Select"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><SpacedCalendar mode="single" selected={startDate ? new Date(startDate) : undefined} onSelect={d => {setStartDate(formatDateForFilter(d)); setIsStartDatePopoverOpen(false)}} /></PopoverContent>
                            </Popover>
                        </div>
                        <div className="min-w-0 space-y-1.5 lg:w-[180px] lg:shrink-0">
                            <Label className="text-xs font-medium text-foreground">To date</Label>
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-9 w-full justify-start px-3 text-left text-sm font-normal shadow-none">
                                        <CalendarIcon className="mr-2 h-4 w-4" />{endDate ? format(new Date(endDate), 'MMM dd, yyyy') : "Select"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><SpacedCalendar mode="single" selected={endDate ? new Date(endDate) : undefined} onSelect={d => {setEndDate(formatDateForFilter(d)); setIsEndDatePopoverOpen(false)}} /></PopoverContent>
                            </Popover>
                        </div>
                        </div>
                        <DateRangeError fromDate={startDate} toDate={endDate} />
                    </fieldset>

                    {/* Content Area */}
                    {updateError && <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{updateError}</div>}
                    {!dailyRequest ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">Select an employee and a valid date range to load records.</div>
                    ) : isLoading ? (
                        <div role="status" className="h-64 flex items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Loading daily records…</span></div>
                    ) : error ? (
                        <div role="alert" className="space-y-3 p-4 text-destructive bg-destructive/10 rounded-lg text-center"><p>{error}</p><Button variant="outline" size="sm" onClick={refreshDailyBreakdown}>Try Again</Button></div>
                    ) : dailyBreakdownData.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">No records found.</div>
                    ) : (
                        <>
                            {/* Mobile Cards View */}
                            <div className="md:hidden space-y-4">
                                <div className="flex items-center space-x-2 px-1">
                                    <Checkbox
                                        id="select-all-mobile"
                                        checked={selectedRecords.size === dailyBreakdownData.length && dailyBreakdownData.length > 0}
                                        onCheckedChange={toggleAll}
                                    />
                                    <Label htmlFor="select-all-mobile" className="text-sm font-medium">Select all</Label>
                                </div>
                                {dailyBreakdownData.map((day) => {
                                    const key = getRecordKey(day.date, day.employeeId);
                                    const isSelected = selectedRecords.has(key);
                                    const totalDistance = (day.carDistanceKm || 0) + (day.bikeDistanceKm || 0);
                                    return (
                                        <div key={key}
                                            className={cn(
                                                "relative rounded-xl border bg-card p-4 transition-all duration-200",
                                                isSelected ? "ring-2 ring-primary border-primary bg-primary/5" : "shadow-sm"
                                            )}
                                        >
                                            <div className="absolute top-4 right-4">
                                                <Checkbox checked={isSelected} onCheckedChange={() => toggleRecord(day.date, day.employeeId)} />
                                            </div>
                                            <div className="pr-8">
                                                <div className="font-semibold text-lg">{day.employeeName}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
                                                    {format(new Date(day.date), 'MMM dd, yyyy')}
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{day.dayOfWeek}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    <StatusBadge status={day.dayType} isSunday={day.isSunday} />
                                                    <Badge variant="outline" className="font-normal">Total: {formatCurrency(day.totalDailySalary)}</Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-y-1 text-sm text-muted-foreground">
                                                    <div>Visits: <span className="text-foreground font-medium">{day.completedVisits}</span></div>
                                                    <div>Travel: <span className="text-foreground font-medium">{formatCurrency(day.travelAllowance)}</span></div>
                                                    <div className="col-span-2">
                                                        Distance:{" "}
                                                        <span className={cn("font-medium", totalDistance < 0 ? "text-amber-600" : "text-foreground")}>
                                                            {totalDistance.toFixed(1)} km
                                                        </span>
                                                    </div>
                                                    <div>DA: <span className="text-foreground font-medium">{formatCurrency(day.dailyDearnessAllowance)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block rounded-md border">
                                <Table className="table-fixed text-xs font-poppins">
                                    <colgroup>
                                        <col className="w-[40px]" />
                                        <col className="w-[18%]" />
                                        <col className="w-[14%]" />
                                        <col className="w-[12%]" />
                                        <col className="w-[8%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[10%]" />
                                        <col className="w-[8%]" />
                                        <col className="w-[10%]" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="w-[40px]">
                                                <Checkbox
                                                    checked={selectedRecords.size === dailyBreakdownData.length && dailyBreakdownData.length > 0}
                                                    onCheckedChange={toggleAll}
                                                />
                                            </TableHead>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-center">Visits</TableHead>
                                            <TableHead className="text-right">Base</TableHead>
                                            <TableHead className="text-right">Travel</TableHead>
                                            <TableHead className="text-right">DA</TableHead>
                                            <TableHead className="text-right">Dist (km)</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dailyBreakdownData.map((day) => {
                                            const key = getRecordKey(day.date, day.employeeId);
                                            const isSelected = selectedRecords.has(key);
                                            const totalDistance = (day.carDistanceKm || 0) + (day.bikeDistanceKm || 0);
                                            return (
                                                <TableRow key={key} className={cn(isSelected && "bg-primary/5")}>
                                                    <TableCell>
                                                        <Checkbox checked={isSelected} onCheckedChange={() => toggleRecord(day.date, day.employeeId)} />
                                                    </TableCell>
                                                    <TableCell className="font-medium truncate">{day.employeeName}</TableCell>
                                                    <TableCell className="truncate">{format(new Date(day.date), 'MMM dd, yyyy')} <span className="text-muted-foreground text-xs ml-1">({day.dayOfWeek.slice(0,3)})</span></TableCell>
                                                    <TableCell><StatusBadge status={day.dayType} isSunday={day.isSunday} /></TableCell>
                                                    <TableCell className="text-center">{day.completedVisits}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(day.baseEarned)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(day.travelAllowance)}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(day.dailyDearnessAllowance)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className={cn(totalDistance < 0 && "text-amber-600")}>
                                                            {totalDistance.toFixed(1)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">{formatCurrency(day.totalDailySalary)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {dailyBreakdownData.length > 0 && (
                                            <TableRow className="bg-muted/30 font-semibold">
                                                <TableCell />
                                                <TableCell colSpan={3} className="text-right">Totals</TableCell>
                                                <TableCell className="text-center">{totals.visits}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(totals.base)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(totals.travel)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(totals.da)}</TableCell>
                                                <TableCell className="text-right">{totals.distance.toFixed(1)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* --- Floating Action Bar (Shadcn floating pill for bulk actions) --- */}
            {dailyResult.loaded && selectedRecords.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-auto min-w-[350px] z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="bg-foreground text-background rounded-full shadow-xl px-6 py-3 flex items-center justify-between gap-6 ring-1 ring-border">
                        <div className="flex items-center gap-3">
                            <div className="bg-background text-foreground text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                                {selectedRecords.size}
                            </div>
                            <span className="text-sm font-medium">Selected</span>
                            <div className="h-4 w-[1px] bg-background/20" />
                            <button onClick={() => setSelectedRecords(new Set())} className="text-sm hover:text-primary-foreground/80 text-muted-foreground">
                                Clear
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="sm" className="h-8 gap-2" disabled={isBulkUpdating}>
                                        {isBulkUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                        Mark As...
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openStatusConfirmation('Full Day')} className="gap-2">
                                        <span className="h-2 w-2 rounded-full bg-green-500" /> Full Day
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openStatusConfirmation('Half Day')} className="gap-2">
                                        <span className="h-2 w-2 rounded-full bg-yellow-500" /> Half Day
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openStatusConfirmation('Absent')} className="gap-2 text-destructive focus:text-destructive">
                                        <span className="h-2 w-2 rounded-full bg-red-500" /> Absent
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={isConfirmOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Confirm status change</DialogTitle>
                        <DialogDescription>
                            {pendingStatus
                                ? `You are about to mark ${selectedRecords.size} record${selectedRecords.size === 1 ? "" : "s"} as "${pendingStatus}". This will update their daily breakdown status.`
                                : "Select a status to continue."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => handleDialogOpenChange(false)}
                            disabled={isBulkUpdating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmBulkUpdate}
                            disabled={isBulkUpdating || !pendingStatus}
                        >
                            {isBulkUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DailyBreakdown;
