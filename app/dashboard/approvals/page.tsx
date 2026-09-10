'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    Check, 
    X, 
    Search, 
    Calendar, 
    Clock, 
    AlertTriangle, 
    Briefcase, 
    RefreshCw,
    CheckCircle2,
    XCircle,
    MessageSquareText
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { apiService, API_BASE_URL, type ApprovalRequest, type AttendanceRequestPageResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';
import { format } from 'date-fns';

type ApprovalTypeValue = 'full day' | 'half day';
type ApprovalTypeState = Record<number, ApprovalTypeValue>;

interface ProcessedApprovalRequest extends ApprovalRequest {
    isDuplicate?: boolean;
    duplicateCount?: number;
    duplicateIndex?: number;
}

export default function ApprovalsPage() {
    const { token } = useAuth();
    const [requests, setRequests] = useState<ProcessedApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // UI State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [eligibleEmployees, setEligibleEmployees] = useState<{ id: number; firstName: string; lastName: string; role?: string }[]>([]);
    const [activeTab, setActiveTab] = useState<string>('pending');
    const [approvalType, setApprovalType] = useState<ApprovalTypeState>({});
    const [savingIds, setSavingIds] = useState<number[]>([]);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const requestSequence = useRef(0);
    const statusSequence = useRef(0);
    const hasLoadedRequests = useRef(false);
    
    // Cache for status counts
    const [statusCounts, setStatusCounts] = useState({
        pending: 0,
        total: 0
    });

    const selectedEmployeeName = useMemo(() => {
        const employee = eligibleEmployees.find(item => String(item.id) === selectedEmployeeId);
        return employee ? `${employee.firstName} ${employee.lastName}`.trim() : undefined;
    }, [eligibleEmployees, selectedEmployeeId]);
    const formattedStartDate = startDate ? format(startDate, 'yyyy-MM-dd') : undefined;
    const formattedEndDate = endDate ? format(endDate, 'yyyy-MM-dd') : undefined;
    const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);

    // 1. Load Employee Options
    useEffect(() => {
        if (!token) return;
        let isMounted = true;
        
        fetch(`${API_BASE_URL}/employee/getAll`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            if (!isMounted || !Array.isArray(data)) return;
            setEligibleEmployees(
                data
                    .map(emp => ({
                        id: emp.id,
                        firstName: emp.firstName || '',
                        lastName: emp.lastName || '',
                        role: emp.role || ''
                    }))
                    .sort((a, b) => {
                        const nameA = `${a.firstName} ${a.lastName}`.trim();
                        const nameB = `${b.firstName} ${b.lastName}`.trim();
                        return nameA.localeCompare(nameB);
                    })
            );
        })
        .catch(() => {
            if (isMounted) setEligibleEmployees([]);
        });

        return () => {
            isMounted = false;
        };
    }, [token]);

    // 2. Fetch Status Counts
    const fetchStatusCounts = useCallback(async () => {
        if (!token) return;
        const sequence = ++statusSequence.current;
        if (dateRangeInvalid) return;
        
        try {
            const commonFilters = {
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                employeeName: selectedEmployeeName,
            };
            const [allRes, pendingRes] = await Promise.allSettled([
                apiService.getAttendanceRequestsByFiltersPaginated(commonFilters, 0, 1, 'requestDate', 'desc'),
                apiService.getAttendanceRequestsByFiltersPaginated({ ...commonFilters, status: 'pending' }, 0, 1, 'requestDate', 'desc')
            ]);
            if (sequence !== statusSequence.current) return;
            setStatusCounts({
                total: allRes.status === 'fulfilled' ? allRes.value.totalElements : 0,
                pending: pendingRes.status === 'fulfilled' ? pendingRes.value.totalElements : 0,
            });
        } catch (err) {
            console.error('Failed to fetch status counts:', err);
        }
    }, [token, dateRangeInvalid, formattedStartDate, formattedEndDate, selectedEmployeeName]);

    // 3. Fetch Requests List
    const fetchRequests = useCallback(async () => {
        if (!token) return;
        const sequence = ++requestSequence.current;
        if (dateRangeInvalid) {
            setLoading(false);
            setIsRefreshing(false);
            return;
        }
        
        try {
            if (!hasLoadedRequests.current) setLoading(true);
            else setIsRefreshing(true);
            setError(null);

            const response: AttendanceRequestPageResponse = await apiService.getAttendanceRequestsByFiltersPaginated(
                {
                    status: activeTab === 'pending' ? 'pending' : undefined,
                    startDate: formattedStartDate,
                    endDate: formattedEndDate,
                    employeeName: selectedEmployeeName,
                },
                currentPage,
                pageSize,
                'requestDate',
                'desc'
            );
            if (sequence !== requestSequence.current) return;
            hasLoadedRequests.current = true;
            setRequests(response.content || []);
            setTotalPages(response.totalPages || 1);
            setTotalElements(response.totalElements || 0);
        } catch (err) {
            if (sequence !== requestSequence.current) return;
            setError('Failed to fetch approval requests. Please try again.');
        } finally {
            if (sequence !== requestSequence.current) return;
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [token, dateRangeInvalid, formattedStartDate, formattedEndDate, selectedEmployeeName, currentPage, pageSize, activeTab]);

    useEffect(() => {
        fetchStatusCounts();
    }, [fetchStatusCounts]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // 4. Action Handler (Approve / Reject)
    const handleAction = async (id: number, action: 'approved' | 'rejected') => {
        if (!token || savingIds.includes(id)) return;
        
        const currentReq = requests.find(r => r.id === id);
        const type = approvalType[id] || (currentReq?.requestedStatus as ApprovalTypeValue) || 'full day';
        
        setSavingIds(prev => [...prev, id]);

        try {
            const response = await fetch(
                `${API_BASE_URL}/request/updateStatus?id=${id}&status=${action}&attendance=${encodeURIComponent(type)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        requestId: id.toString()
                    }
                }
            );
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                const detail = typeof failure?.message === 'string' ? failure.message : '';
                if (response.status === 404 && /log not found/i.test(detail)) {
                    throw new Error('No attendance log exists for this date. An administrator needs to resolve the missing log before approval.');
                }
                throw new Error(`Unable to update request (HTTP ${response.status}).${detail ? ` ${detail}` : ''}`);
            }

            await fetchRequests();
            await fetchStatusCounts();
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to update attendance request.';
            setError(message);
        } finally {
            setSavingIds(prev => prev.filter(v => v !== id));
        }
    };

    // 5. Duplicate Processing & Filtered Results
    const processedRequests = useMemo(() => {
        const grouped = requests.reduce((acc, req) => {
            const key = `${req.employeeId}-${req.logDate}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(req);
            return acc;
        }, {} as Record<string, ProcessedApprovalRequest[]>);

        const flat = Object.values(grouped).flatMap(group => {
            if (group.length > 1) {
                return group.map((req, idx) => ({
                    ...req,
                    isDuplicate: true,
                    duplicateCount: group.length,
                    duplicateIndex: idx + 1
                }));
            }
            return group;
        });

        return flat.filter(req => {
            const matchesEmployee = !selectedEmployeeId || String(req.employeeId) === selectedEmployeeId;
            const status = req.status?.toLowerCase() || 'pending';
            
            if (activeTab === 'pending') {
                return matchesEmployee && status === 'pending';
            } else {
                return matchesEmployee && status !== 'pending';
            }
        }).sort((a, b) => new Date(b.requestDate || b.logDate).getTime() - new Date(a.requestDate || a.logDate).getTime());
    }, [requests, selectedEmployeeId, activeTab]);

    const employeeOptions = useMemo<SearchableOption[]>(() => eligibleEmployees.map((emp) => ({
        value: String(emp.id),
        label: `${emp.firstName} ${emp.lastName}`.trim() || `Employee ${emp.id}`,
    })), [eligibleEmployees]);

    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'EM';
    const formatDate = (dateString?: string | null) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch {
            return dateString;
        }
    };

    if (loading && requests.length === 0) return <LoadingSkeleton />;

    return (
        <div className="mx-auto w-full max-w-none py-4 space-y-4">
            <Tabs defaultValue="pending" value={activeTab} onValueChange={(val) => { setActiveTab(val); setCurrentPage(0); }} className="space-y-4">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                    <TabsList className="grid h-9 w-full shrink-0 grid-cols-2 p-1 sm:w-[300px]">
                        <TabsTrigger value="pending" className="text-xs">Pending requests</TabsTrigger>
                        <TabsTrigger value="history" className="text-xs">Request history</TabsTrigger>
                    </TabsList>

                    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap lg:justify-end">
                        <div className="w-full sm:w-[200px] sm:shrink-0">
                            <Label className="sr-only">Employee</Label>
                            <SearchableSelect
                                options={employeeOptions}
                                value={selectedEmployeeId || undefined}
                                onSelect={(option) => { setSelectedEmployeeId(option?.value ?? ''); setCurrentPage(0); }}
                                placeholder="All employees"
                                searchPlaceholder="Search employees..."
                                emptyMessage="No employees found"
                                allowClear
                                triggerClassName="h-9 w-full bg-background text-xs shadow-none"
                            />
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-9 w-[140px] shrink-0 justify-start bg-background px-3 text-xs font-normal shadow-none" aria-label="From date">
                                    <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{startDate ? format(startDate, 'MMM dd, yyyy') : 'From date'}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <SpacedCalendar
                                    initialFocus
                                    mode="single"
                                    selected={startDate}
                                    defaultMonth={startDate || endDate}
                                    onSelect={(date) => {
                                        setStartDate(date);
                                        if (date && endDate && date > endDate) setEndDate(undefined);
                                        setCurrentPage(0);
                                    }}
                                />
                            </PopoverContent>
                        </Popover>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-9 w-[140px] shrink-0 justify-start bg-background px-3 text-xs font-normal shadow-none" aria-label="To date">
                                    <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{endDate ? format(endDate, 'MMM dd, yyyy') : 'To date'}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <SpacedCalendar
                                    initialFocus
                                    mode="single"
                                    selected={endDate}
                                    defaultMonth={endDate || startDate}
                                    disabled={date => Boolean(startDate && date < startDate)}
                                    onSelect={(date) => { setEndDate(date); setCurrentPage(0); }}
                                />
                            </PopoverContent>
                        </Popover>

                        {(startDate || endDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 px-2 text-xs"
                                onClick={() => { setStartDate(undefined); setEndDate(undefined); setCurrentPage(0); }}
                            >
                                Clear dates
                            </Button>
                        )}

                        <div className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span><span className="font-semibold text-foreground">{statusCounts.pending}</span> pending</span>
                            <span className="text-border">•</span>
                            <span><span className="font-semibold text-foreground">{statusCounts.total}</span> total</span>
                        </div>

                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => { fetchRequests(); fetchStatusCounts(); }} 
                            disabled={isRefreshing}
                            className="h-9 w-9 shrink-0 shadow-none"
                            aria-label="Refresh approval requests"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>

                <DateRangeError fromDate={startDate} toDate={endDate} />

                {error && (
                    <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center justify-between">
                        <span>{error}</span>
                        <Button size="sm" variant="ghost" onClick={fetchRequests} className="h-7 text-xs">Retry</Button>
                    </div>
                )}

                <div className="w-full space-y-4">
                    <div className="w-full align-middle">
                        <div className="hidden lg:grid grid-cols-12 gap-4 border-b bg-muted/30 px-5 py-2.5 text-[11px] font-medium text-muted-foreground">
                            <div className="col-span-4">Employee</div>
                            <div className="col-span-3">Request dates</div>
                            <div className="col-span-2">Attendance</div>
                            <div className="col-span-3 text-right">Actions</div>
                        </div>

                        <div className="divide-y divide-border">
                            {processedRequests.length === 0 ? (
                                <EmptyState activeTab={activeTab} />
                            ) : (
                                processedRequests.map((req) => (
                                    <RequestRow
                                        key={req.id}
                                        req={req}
                                        saving={savingIds.includes(req.id)}
                                        activeTab={activeTab}
                                        approvalType={approvalType}
                                        setApprovalType={setApprovalType}
                                        handleAction={handleAction}
                                        formatDate={formatDate}
                                        getInitials={getInitials}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Pagination Controls */}
                {totalElements > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="pageSize" className="text-muted-foreground">Rows per page:</Label>
                            <Select
                                value={pageSize.toString()}
                                onValueChange={(val) => {
                                    setCurrentPage(0);
                                    setPageSize(parseInt(val));
                                }}
                            >
                                <SelectTrigger id="pageSize" className="w-16 h-8 text-xs shadow-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[10, 20, 50, 100].map(s => (
                                        <SelectItem key={s} value={s.toString()} className="text-xs">{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-muted-foreground">Showing {processedRequests.length} of {totalElements}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                disabled={currentPage === 0 || loading || isRefreshing || dateRangeInvalid}
                                className="h-8 text-xs shadow-none"
                            >
                                Previous
                            </Button>
                            <span className="font-medium text-muted-foreground">
                                Page {currentPage + 1} of {totalPages}
                            </span>
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={loading || isRefreshing || dateRangeInvalid || currentPage >= totalPages - 1}
                                className="h-8 text-xs shadow-none"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Tabs>
        </div>
    );
}

// --- Sub Components ---

interface RequestRowProps {
    saving: boolean;
    req: ProcessedApprovalRequest;
    activeTab: string;
    approvalType: ApprovalTypeState;
    setApprovalType: React.Dispatch<React.SetStateAction<ApprovalTypeState>>;
    handleAction: (id: number, action: 'approved' | 'rejected') => Promise<void> | void;
    formatDate: (date?: string | null) => string;
    getInitials: (name: string) => string;
}

function RequestRow({ 
    saving,
    req, 
    activeTab, 
    approvalType, 
    setApprovalType, 
    handleAction, 
    formatDate,
    getInitials 
}: RequestRowProps) {
    const isPending = activeTab === 'pending';
    const currentType = approvalType[req.id] || (req.requestedStatus as ApprovalTypeValue) || 'full day';

    const rowClass = req.isDuplicate 
        ? "bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30" 
        : "bg-card hover:bg-muted/30";

    return (
        <div
            className={`group flex flex-col gap-4 border-l-2 px-4 py-4 transition-colors lg:grid lg:grid-cols-12 lg:px-5 ${req.isDuplicate ? 'border-l-orange-500' : 'border-l-transparent'} ${rowClass}`}
        >
            {/* 1. Employee Info & Reason */}
            <div className="col-span-4 w-full">
                <div className="flex items-start gap-3">
                    <Avatar className="mt-0.5 h-10 w-10 border border-border shrink-0">
                        <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                            {getInitials(req.employeeName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-foreground">{req.employeeName}</h3>
                            {req.isDuplicate && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-100/50">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Duplicate #{req.duplicateIndex}
                                </Badge>
                            )}
                        </div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Briefcase className="h-3 w-3" />
                            <span>ID: {req.employeeId}</span>
                        </div>
                        
                        {req.description && (
                            <div className="relative rounded-md border border-border/50 bg-muted/40 p-2 mt-1">
                                <div className="flex gap-2 items-start">
                                    <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <p className="line-clamp-2 text-xs italic leading-relaxed text-foreground">
                                        <span aria-hidden="true">&ldquo;</span>
                                        {req.description}
                                        <span aria-hidden="true">&rdquo;</span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Date Info */}
            <div className="col-span-3 flex w-full justify-between gap-1 border-t border-dashed pt-3 lg:flex-col lg:justify-center lg:border-t-0 lg:pt-0">
                <div>
                    <div className="flex w-fit items-center gap-2 rounded py-1 text-xs font-semibold text-foreground lg:w-full lg:py-0">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Attendance: {formatDate(req.logDate)}
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                        <Clock className="h-3.5 w-3.5" />
                        Submitted: {formatDate(req.requestDate)}
                    </div>
                </div>
            </div>

            {/* 3. Type Selector */}
            <div className="col-span-2 flex w-full items-center">
                {isPending ? (
                    <div className="w-full">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-2 lg:hidden">Attendance Type</span>
                        <div className="flex w-full rounded-md bg-muted/60 p-1 lg:w-auto">
                            <button
                                onClick={() => setApprovalType((prev) => ({ ...prev, [req.id]: 'full day' }))}
                                disabled={saving}
                                className={`flex-1 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                                    currentType === 'full day' 
                                    ? 'bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:ring-white/10 font-semibold' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Full Day
                            </button>
                            <button
                                onClick={() => setApprovalType((prev) => ({ ...prev, [req.id]: 'half day' }))}
                                disabled={saving}
                                className={`flex-1 rounded px-2.5 py-1 text-xs font-medium transition-all ${
                                    currentType === 'half day' 
                                    ? 'bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:ring-white/10 font-semibold' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Half Day
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-2 lg:hidden">Type:</span>
                        <Badge variant="secondary" className="capitalize px-3 py-1 text-xs">
                            {req.requestedStatus || 'Full day'}
                        </Badge>
                    </div>
                )}
            </div>

            {/* 4. Actions */}
            <div className="col-span-3 flex w-full items-center lg:justify-end">
                {isPending ? (
                    <div className="flex w-full gap-2 lg:w-auto">
                        <Button 
                            onClick={() => handleAction(req.id, 'approved')}
                            disabled={saving}
                            size="sm"
                            className="h-8 flex-1 bg-emerald-600 text-xs text-white shadow-none hover:bg-emerald-700 lg:flex-none font-medium"
                        >
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Approve
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => handleAction(req.id, 'rejected')}
                            disabled={saving}
                            size="sm"
                            className="h-8 flex-1 border-destructive/25 text-xs text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive lg:flex-none font-medium"
                        >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Reject
                        </Button>
                    </div>
                ) : (
                    <div className="w-full lg:w-auto flex justify-end">
                        <StatusBadge status={req.status} />
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status?: string }) {
    const s = status?.toLowerCase();
    
    if (s === 'approved') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approved
            </div>
        );
    }
    if (s === 'rejected') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                <XCircle className="h-3.5 w-3.5" /> Rejected
            </div>
        );
    }
    return (
        <Badge variant="outline" className="capitalize text-xs">{status || 'Pending'}</Badge>
    );
}

function EmptyState({ activeTab }: { activeTab: string }) {
    return (
        <div className="flex w-full flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                {activeTab === 'pending' 
                    ? <Check className="h-6 w-6 text-muted-foreground/50" />
                    : <Search className="h-6 w-6 text-muted-foreground/50" />
                }
            </div>
            <h3 className="text-base font-semibold text-foreground">
                {activeTab === 'pending' ? "All caught up!" : "No records found"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {activeTab === 'pending' 
                    ? "There are no pending requests requiring your attention right now." 
                    : "Try adjusting your search filters to find past requests."}
            </p>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="w-full space-y-4 py-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-9 w-full sm:w-80" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-9 w-9" />
                </div>
            </div>
            <div className="border border-border/70 rounded-xl bg-card overflow-hidden">
                <div className="divide-y divide-border p-0">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="w-full flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                            <Skeleton className="h-8 w-28" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
