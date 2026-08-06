'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    CheckCircle2, 
    XCircle, 
    Search, 
    Calendar, 
    Clock, 
    MessageSquareText, 
    Sun, 
    SunDim, 
    RefreshCw,
    SlidersHorizontal,
    Check,
    X,
    Inbox
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { apiService, type TeamDataDto, type ApprovalRequest, type AttendanceRequestPageResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

const ApprovalsPage = () => {
    const { token, userData } = useAuth();
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [approvalType, setApprovalType] = useState<{ [key: number]: 'full day' | 'half day' | null }>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [sortByField] = useState('requestDate');
    const [sortDirection] = useState('desc');
    
    // Mobile filter sheet state
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [userRoleFromAPI, setUserRoleFromAPI] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    
    // Cache for status counts
    const [statusCountsCache, setStatusCountsCache] = useState({
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });

    // Fetch current user data to determine role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            
            try {
                const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/user/manage/current-user', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    const authorities = userData.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    setUserRoleFromAPI(role);
                    
                    setIsManager(role === 'ROLE_MANAGER' || role === 'ROLE_AVP');
                    setIsAdmin(role === 'ROLE_ADMIN');
                    setIsFieldOfficer(role === 'ROLE_FIELD OFFICER');
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };

        fetchCurrentUser();
    }, [token]);

    // Fetch team data for managers and field officers
    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isManager && !isFieldOfficer) || !userData?.employeeId) return;
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await apiService.getTeamByEmployee(userData.employeeId);
                if (teamData.length > 0) {
                    setTeamId(teamData[0].id);
                } else {
                    setTeamError('No team data found for this user');
                    setTeamId(6);
                }
            } catch (err: unknown) {
                console.error('Failed to load team data:', err);
                setTeamError('Failed to load team data');
                setTeamId(6);
            } finally {
                setTeamLoading(false);
            }
        };

        loadTeamData();
    }, [isManager, isFieldOfficer, userData?.employeeId]);

    // Function to fetch counts for all statuses
    const fetchStatusCounts = useCallback(async () => {
        if (!token) return;
        if ((isManager || isFieldOfficer) && (teamId === null || teamId === undefined)) return;
        
        try {
            if (isAdmin || (!isManager && !isFieldOfficer)) {
                const [allResult, pendingResult, approvedResult, rejectedResult] = await Promise.allSettled([
                    apiService.getAttendanceRequestsPaginated(0, 1, sortByField, sortDirection),
                    apiService.getAttendanceRequestsByStatusPaginated('pending', 0, 1, sortByField, sortDirection),
                    apiService.getAttendanceRequestsByStatusPaginated('approved', 0, 1, sortByField, sortDirection),
                    apiService.getAttendanceRequestsByStatusPaginated('rejected', 0, 1, sortByField, sortDirection)
                ]);
                
                const allCount = allResult.status === 'fulfilled' ? allResult.value.totalElements : 0;
                const pendingCount = pendingResult.status === 'fulfilled' ? pendingResult.value.totalElements : 0;
                const approvedCount = approvedResult.status === 'fulfilled' ? approvedResult.value.totalElements : 0;
                const rejectedCount = rejectedResult.status === 'fulfilled' ? rejectedResult.value.totalElements : 0;
                
                setStatusCountsCache({
                    all: allCount,
                    pending: pendingCount,
                    approved: approvedCount,
                    rejected: rejectedCount
                });
            } else {
                const url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/getForTeam?id=${teamId}`;
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data: ApprovalRequest[] = await response.json();
                    setStatusCountsCache({
                        all: data.length,
                        pending: data.filter(r => r.status?.toLowerCase() === 'pending').length,
                        approved: data.filter(r => r.status?.toLowerCase() === 'approved').length,
                        rejected: data.filter(r => r.status?.toLowerCase() === 'rejected').length
                    });
                }
            }
        } catch (err) {
            console.error('Failed to fetch status counts:', err);
        }
    }, [token, isAdmin, isManager, isFieldOfficer, teamId, sortByField, sortDirection]);

    // Function to fetch requests
    const fetchRequests = useCallback(async () => {
        if (!token) return;
        if ((isManager || isFieldOfficer) && (teamId === null || teamId === undefined)) return;
        
        try {
            setLoading(true);
            setError(null);
            
            if ((isManager || isFieldOfficer) && teamId) {
                const url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/getForTeam?id=${teamId}`;
                const response = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch team requests');
                let data: ApprovalRequest[] = await response.json();
                
                if (statusFilter !== 'all') {
                    data = data.filter(r => r.status?.toLowerCase() === statusFilter.toLowerCase());
                }
                if (searchTerm.trim()) {
                    data = data.filter(r => r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()));
                }
                
                setRequests(data);
                setTotalPages(Math.ceil(data.length / pageSize) || 1);
                setTotalElements(data.length);
                return;
            } else {
                let response: AttendanceRequestPageResponse;
                if (searchTerm.trim()) {
                    response = await apiService.getAttendanceRequestsByFiltersPaginated(
                        {
                            status: statusFilter === 'all' ? undefined : statusFilter,
                            employeeName: searchTerm.trim()
                        },
                        currentPage, 
                        pageSize, 
                        sortByField, 
                        sortDirection
                    );
                } else if (statusFilter === 'all') {
                    response = await apiService.getAttendanceRequestsPaginated(
                        currentPage, 
                        pageSize, 
                        sortByField, 
                        sortDirection
                    );
                } else {
                    response = await apiService.getAttendanceRequestsByStatusPaginated(
                        statusFilter,
                        currentPage, 
                        pageSize, 
                        sortByField, 
                        sortDirection
                    );
                }
                setRequests(response.content);
                setTotalPages(response.totalPages);
                setTotalElements(response.totalElements);
            }
        } catch (err) {
            setError('Failed to fetch requests. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [token, isManager, isFieldOfficer, teamId, currentPage, pageSize, statusFilter, searchTerm, sortByField, sortDirection]);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (token) {
                setCurrentPage(0);
                fetchRequests();
            }
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, token, fetchRequests]);

    useEffect(() => {
        if (token && userRoleFromAPI !== null) {
            if ((isManager || isFieldOfficer) && teamId === null) return;
            fetchStatusCounts();
        }
    }, [token, userRoleFromAPI, teamId, isAdmin, isManager, isFieldOfficer, fetchStatusCounts]);

    useEffect(() => {
        if (token) {
            fetchRequests();
        }
    }, [token, teamId, currentPage, pageSize, statusFilter, sortByField, sortDirection, fetchRequests]);

    const handleApproval = async (id: number, action: 'approved' | 'rejected') => {
        if (!token) return;
        
        const type = approvalType[id] || requests.find(r => r.id === id)?.requestedStatus || 'full day';
        setActionLoadingId(id);
        
        try {
            const res = await fetch(
                `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/request/updateStatus?id=${id}&status=${action}&attendance=${encodeURIComponent(type)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        requestId: id.toString()
                    }
                }
            );
            if (!res.ok) throw new Error('Failed to update status');
            
            await fetchRequests();
            await fetchStatusCounts();
            setApprovalType(prev => ({ ...prev, [id]: null }));
        } catch (err) {
            setError('Failed to update request status.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleTypeChange = (id: number, type: 'full day' | 'half day') => {
        setApprovalType(prev => ({ ...prev, [id]: type }));
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const statusCounts = statusCountsCache;

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-2 sm:p-4">
            {/* Filter and Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search employee..."
                        className="pl-9 h-10 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Status Tabs for Desktop */}
                <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-lg">
                    {[
                        { key: 'all', label: 'All', count: statusCounts.all },
                        { key: 'pending', label: 'Pending', count: statusCounts.pending },
                        { key: 'approved', label: 'Approved', count: statusCounts.approved },
                        { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
                    ].map((tab) => {
                        const isActive = statusFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => {
                                    setStatusFilter(tab.key);
                                    setCurrentPage(0);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    isActive 
                                        ? 'bg-background text-foreground shadow-sm font-semibold' 
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted-foreground/15 text-muted-foreground font-semibold">
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { fetchRequests(); fetchStatusCounts(); }}
                    disabled={loading}
                    className="shrink-0 text-xs"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>

                {/* Mobile Filter Button */}
                <div className="sm:hidden">
                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="w-full justify-between text-xs h-10">
                                <span className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    Filter: <strong className="capitalize">{statusFilter}</strong>
                                </span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl">
                            <SheetHeader className="pb-3">
                                <SheetTitle className="text-base font-bold">Filter Requests</SheetTitle>
                            </SheetHeader>
                            <div className="space-y-2 py-2">
                                {[
                                    { key: 'all', label: 'All Requests', count: statusCounts.all },
                                    { key: 'pending', label: 'Pending Approvals', count: statusCounts.pending },
                                    { key: 'approved', label: 'Approved Requests', count: statusCounts.approved },
                                    { key: 'rejected', label: 'Rejected Requests', count: statusCounts.rejected },
                                ].map((tab) => (
                                    <Button
                                        key={tab.key}
                                        variant={statusFilter === tab.key ? "default" : "outline"}
                                        onClick={() => {
                                            setStatusFilter(tab.key);
                                            setCurrentPage(0);
                                            setIsFilterOpen(false);
                                        }}
                                        className="w-full justify-between h-11 text-xs"
                                    >
                                        <span>{tab.label}</span>
                                        <Badge variant="secondary">{tab.count}</Badge>
                                    </Button>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center justify-between">
                    <span>{error}</span>
                    <Button size="sm" variant="ghost" onClick={fetchRequests} className="h-7 text-xs">Retry</Button>
                </div>
            )}

            {/* Requests List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-40" />
                                        <Skeleton className="h-4 w-60" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : requests.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="p-8 text-center">
                            <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="font-semibold text-sm">No requests found</p>
                            <p className="text-xs text-muted-foreground mt-1">There are no approval requests matching your filter.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {requests.map((request) => {
                            const isPending = request.status?.toLowerCase() === 'pending';
                            const isApproved = request.status?.toLowerCase() === 'approved';
                            const isRejected = request.status?.toLowerCase() === 'rejected';
                            const currentType = approvalType[request.id] || 'full day';

                            return (
                                <motion.div
                                    key={request.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Card className="hover:border-primary/40 transition-colors shadow-none border">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                {/* Employee & Request Info */}
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex items-center justify-between sm:justify-start gap-3">
                                                        <h3 className="font-bold text-base text-foreground">
                                                            {request.employeeName}
                                                        </h3>
                                                        <Badge 
                                                            variant="outline"
                                                            className={`capitalize text-xs px-2.5 py-0.5 ${
                                                                isApproved 
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800' 
                                                                    : isRejected 
                                                                        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800' 
                                                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                                                            }`}
                                                        >
                                                            {request.status || 'Pending'}
                                                        </Badge>
                                                    </div>

                                                    {/* Date Meta Info */}
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3.5 w-3.5" />
                                                            Request Date: <strong className="text-foreground">{formatDate(request.requestDate)}</strong>
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            Submitted: <strong className="text-foreground">{formatDate(request.logDate)}</strong>
                                                        </span>
                                                        {request.requestedStatus && (
                                                            <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium text-foreground">
                                                                {request.requestedStatus}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Clean Reason Box */}
                                                    <div className="text-xs bg-muted/50 p-2.5 rounded-lg border border-border/40 text-foreground">
                                                        <span className="font-semibold text-muted-foreground">Reason: </span>
                                                        <span>{request.description?.trim() || 'No reason provided'}</span>
                                                    </div>
                                                </div>

                                                {/* Action Controls for Pending Requests */}
                                                {isPending && (
                                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 shrink-0">
                                                        {/* Full / Half Day Segment Switch */}
                                                        <div className="flex items-center bg-muted p-1 rounded-lg border">
                                                            <button
                                                                onClick={() => handleTypeChange(request.id, 'full day')}
                                                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                                                    currentType === 'full day' 
                                                                        ? 'bg-background text-foreground shadow-sm font-semibold' 
                                                                        : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            >
                                                                <Sun className="h-3 w-3 text-amber-500" />
                                                                Full Day
                                                            </button>
                                                            <button
                                                                onClick={() => handleTypeChange(request.id, 'half day')}
                                                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                                                    currentType === 'half day' 
                                                                        ? 'bg-background text-foreground shadow-sm font-semibold' 
                                                                        : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            >
                                                                <SunDim className="h-3 w-3 text-indigo-500" />
                                                                Half Day
                                                            </button>
                                                        </div>

                                                        {/* Approve & Reject Buttons */}
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleApproval(request.id, 'approved')}
                                                                disabled={actionLoadingId === request.id}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 font-semibold"
                                                            >
                                                                <Check className="h-3.5 w-3.5 mr-1" />
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleApproval(request.id, 'rejected')}
                                                                disabled={actionLoadingId === request.id}
                                                                className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs h-8 px-3 dark:border-rose-900 dark:text-rose-400"
                                                            >
                                                                <X className="h-3.5 w-3.5 mr-1" />
                                                                Reject
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
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
                            <SelectTrigger id="pageSize" className="w-16 h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 50, 100].map(s => (
                                    <SelectItem key={s} value={s.toString()} className="text-xs">{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">Total {totalElements}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                            disabled={currentPage === 0 || loading}
                            className="h-8 text-xs"
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
                            disabled={loading || currentPage >= totalPages - 1}
                            className="h-8 text-xs"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovalsPage;
