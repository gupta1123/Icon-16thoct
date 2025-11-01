'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Search, Filter, Calendar, User, Clock } from 'lucide-react';
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

// Using ApprovalRequest from API types

const ApprovalsPage = () => {
    const { token, userData } = useAuth();
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [approvalType, setApprovalType] = useState<{ [key: number]: 'full day' | 'half day' | null }>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
    
    // Handle sort changes
    const handleSortChange = (newSortBy: 'date' | 'name' | 'status') => {
        setSortBy(newSortBy);
        setCurrentPage(0); // Reset to first page when sorting
        
        // Map UI sort options to backend field names
        switch (newSortBy) {
            case 'date':
                setSortByField('requestDate');
                break;
            case 'name':
                setSortByField('employeeName');
                break;
            case 'status':
                setSortByField('status');
                break;
        }
    };
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [sortByField, setSortByField] = useState('requestDate');
    const [sortDirection, setSortDirection] = useState('desc');
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [userRoleFromAPI, setUserRoleFromAPI] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    
    // Cache for status counts to show correct counts in tabs
    const [statusCountsCache, setStatusCountsCache] = useState({
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [loadingCounts, setLoadingCounts] = useState(false);

    // Fetch current user data to determine role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            
            try {
                const response = await fetch('/api/proxy/user/manage/current-user', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    console.log('Current user data:', userData);
                    
                    // Extract role from authorities
                    const authorities = userData.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    setUserRoleFromAPI(role);
                    
                    // Set role flags
                    setIsManager(role === 'ROLE_MANAGER' || role === 'ROLE_AVP');
                    setIsAdmin(role === 'ROLE_ADMIN');
                    setIsFieldOfficer(role === 'ROLE_FIELD OFFICER');
                    
                    console.log('Role from API:', role);
                    console.log('isManager:', role === 'ROLE_MANAGER' || role === 'ROLE_AVP');
                    console.log('isAdmin:', role === 'ROLE_ADMIN');
                    console.log('isFieldOfficer:', role === 'ROLE_FIELD OFFICER');
                } else {
                    console.error('Failed to fetch current user data');
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
                
                // Get the first team ID (assuming manager/field officer has one primary team)
                if (teamData.length > 0) {
                    setTeamId(teamData[0].id);
                } else {
                    setTeamError('No team data found for this user');
                    // Fallback to hardcoded team ID
                    setTeamId(6);
                }
            } catch (err: unknown) {
                console.error('Failed to load team data:', err);
                setTeamError('Failed to load team data');
                // Fallback to hardcoded team ID if API fails
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
        
        // For managers and field officers, wait until teamId is available
        if ((isManager || isFieldOfficer) && (teamId === null || teamId === undefined)) return;
        
        try {
            setLoadingCounts(true);
            
            if (isAdmin || (!isManager && !isFieldOfficer)) {
                // For admins, fetch counts using paginated APIs
                // Use Promise.allSettled to handle individual failures gracefully
                const [allResult, pendingResult, approvedResult, rejectedResult] = await Promise.allSettled([
                    apiService.getAttendanceRequestsPaginated(0, 1, sortByField, sortDirection),
                    apiService.getAttendanceRequestsByStatusPaginated('pending', 0, 1, sortByField, sortDirection),
                    apiService.getAttendanceRequestsByStatusPaginated('approved', 0, 1, sortByField, sortDirection),
                    apiService.getAttendanceRequestsByStatusPaginated('rejected', 0, 1, sortByField, sortDirection)
                ]);
                
                // Extract results, defaulting to 0 if a request failed
                const allCount = allResult.status === 'fulfilled' ? allResult.value.totalElements : 0;
                const pendingCount = pendingResult.status === 'fulfilled' ? pendingResult.value.totalElements : 0;
                const approvedCount = approvedResult.status === 'fulfilled' ? approvedResult.value.totalElements : 0;
                const rejectedCount = rejectedResult.status === 'fulfilled' ? rejectedResult.value.totalElements : 0;
                
                // Log any failures for debugging
                if (allResult.status === 'rejected') {
                    console.error('Failed to fetch all count:', allResult.reason);
                }
                if (pendingResult.status === 'rejected') {
                    console.error('Failed to fetch pending count:', pendingResult.reason);
                }
                if (approvedResult.status === 'rejected') {
                    console.error('Failed to fetch approved count:', approvedResult.reason);
                }
                if (rejectedResult.status === 'rejected') {
                    console.error('Failed to fetch rejected count:', rejectedResult.reason);
                }
                
                setStatusCountsCache({
                    all: allCount,
                    pending: pendingCount,
                    approved: approvedCount,
                    rejected: rejectedCount
                });
            } else {
                // For managers and field officers using team-based API
                // The team API doesn't return pagination info, so we need to fetch all and count
                // This is less efficient but necessary for accurate counts
                const url = `/api/proxy/expense/getForTeam?id=${teamId}`;
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data: ApprovalRequest[] = await response.json();
                    const counts = {
                        all: data.length,
                        pending: data.filter(r => r.status?.toLowerCase() === 'pending').length,
                        approved: data.filter(r => r.status?.toLowerCase() === 'approved').length,
                        rejected: data.filter(r => r.status?.toLowerCase() === 'rejected').length
                    };
                    setStatusCountsCache(counts);
                }
            }
        } catch (err) {
            console.error('Failed to fetch status counts:', err);
            // Don't update counts on error, keep previous values
        } finally {
            setLoadingCounts(false);
        }
    }, [token, isAdmin, isManager, isFieldOfficer, teamId, sortByField, sortDirection]);

    // Function to fetch requests
    const fetchRequests = useCallback(async () => {
        if (!token) return;
        
        // For managers and field officers, wait until teamId is available
        if ((isManager || isFieldOfficer) && (teamId === null || teamId === undefined)) return;
        
        try {
            setLoading(true);
            
            let url: string;
            
            if (isManager && teamId) {
                // For managers, use team-based API call for expenses
                url = `/api/proxy/expense/getForTeam?id=${teamId}`;
                console.log('Manager API call:', url);
            } else if (isFieldOfficer && teamId) {
                // For field officers, use team-based API call (same as manager for now)
                url = `/api/proxy/expense/getForTeam?id=${teamId}`;
                console.log('Field Officer API call:', url);
            } else if (isAdmin) {
                // For admins, use paginated API call with search
                console.log('Admin API call with pagination and search');
                let response: AttendanceRequestPageResponse;
                
                if (searchTerm.trim()) {
                    // Use filtered search API
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
                return;
            } else {
                // Default to admin API call
                console.log('Default (Admin) API call with pagination and search');
                let response: AttendanceRequestPageResponse;
                
                if (searchTerm.trim()) {
                    // Use filtered search API
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
                return;
            }
            
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            const data: ApprovalRequest[] = await response.json();
            setRequests(data);
        } catch (err) {
            setError('Failed to fetch pending requests. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, [token, isManager, isFieldOfficer, teamId, isAdmin, currentPage, pageSize, statusFilter, searchTerm, sortByField, sortDirection]);

    // Debounced search effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (token) {
                setCurrentPage(0); // Reset to first page when searching
                fetchRequests();
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [searchTerm, token, fetchRequests]);

    // Fetch counts when roles and teamId are determined
    useEffect(() => {
        if (token && userRoleFromAPI !== null) {
            // For managers and field officers, wait until teamId is available
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
        
        try {
            await fetch(
                `/api/proxy/request/updateStatus?id=${id}&status=${action}&attendance=${encodeURIComponent(type)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        requestId: id.toString()
                    }
                }
            );
            await fetchRequests();
            // Refresh counts after approval action
            await fetchStatusCounts();
            setApprovalType(prev => ({ ...prev, [id]: null }));
        } catch (err) {
            setError('Failed to update request status. Please try again.');
        }
    };

    const handleTypeChange = (id: number, type: 'full day' | 'half day') => {
        setApprovalType(prev => ({ ...prev, [id]: type }));
    };

    // Server-side pagination - no client-side filtering needed
    const displayRequests = requests;

    const getStatusBadgeVariant = (status: string | null | undefined) => {
        if (!status) return 'outline';
        
        switch (status.toLowerCase()) {
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Use cached counts instead of calculating from filtered requests
    const statusCounts = statusCountsCache;

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-48" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
                <div className="grid gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-6 w-16" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="p-8 text-center">
                        <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Error Loading Requests</h3>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={fetchRequests}>Try Again</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters and Search */}
            <div className="mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by employee name..."
                                className="pl-10 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="hidden sm:flex gap-2">
                            <Button
                                variant={statusFilter === "all" ? "default" : "outline"}
                                onClick={() => setStatusFilter("all")}
                                size="sm"
                                className="text-sm"
                            >
                                <Clock className="mr-2 h-4 w-4" />
                                All ({statusCounts.all})
                            </Button>
                            <Button
                                variant={statusFilter === "pending" ? "default" : "outline"}
                                onClick={() => setStatusFilter("pending")}
                                size="sm"
                                className="text-sm"
                            >
                                <Clock className="mr-2 h-4 w-4" />
                                Pending ({statusCounts.pending})
                            </Button>
                            <Button
                                variant={statusFilter === "approved" ? "default" : "outline"}
                                onClick={() => setStatusFilter("approved")}
                                size="sm"
                                className="text-sm"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approved ({statusCounts.approved})
                            </Button>
                            <Button
                                variant={statusFilter === "rejected" ? "default" : "outline"}
                                onClick={() => setStatusFilter("rejected")}
                                size="sm"
                                className="text-sm"
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Rejected ({statusCounts.rejected})
                            </Button>
                        </div>
                        
                    </div>
                </div>
                
                {/* Team Info for Managers/Field Officers */}
                {(isManager || isFieldOfficer) && (
                    <div className="mt-4 text-sm text-muted-foreground">
                        <p>
                            {teamLoading ? 'Loading team data...' : 
                             teamError ? `Error: ${teamError} (Using fallback Team ID: ${teamId})` :
                             teamId ? `Team-based view (Team ID: ${teamId})` : 
                             'No team data available'}
                        </p>
                    </div>
                )}
            </div>

            {/* Mobile Filters Sheet */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" className="sm:hidden text-sm">
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 sm:w-80">
                    <SheetHeader>
                        <SheetTitle className="text-base font-medium">Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                        <div>
                            <h3 className="text-sm font-medium mb-2">Status</h3>
                            <div className="space-y-2">
                                <Button
                                    variant={statusFilter === "all" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("all")}
                                    className="w-full justify-between text-sm"
                                >
                                    <span>All Requests</span>
                                    <Badge variant="secondary" className="ml-2">{statusCounts.all}</Badge>
                                </Button>
                                <Button
                                    variant={statusFilter === "pending" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("pending")}
                                    className="w-full justify-between text-sm"
                                >
                                    <span>Pending</span>
                                    <Badge variant="secondary" className="ml-2">{statusCounts.pending}</Badge>
                                </Button>
                                <Button
                                    variant={statusFilter === "approved" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("approved")}
                                    className="w-full justify-between text-sm"
                                >
                                    <span>Approved</span>
                                    <Badge variant="secondary" className="ml-2">{statusCounts.approved}</Badge>
                                </Button>
                                <Button
                                    variant={statusFilter === "rejected" ? "default" : "outline"}
                                    onClick={() => setStatusFilter("rejected")}
                                    className="w-full justify-between text-sm"
                                >
                                    <span>Rejected</span>
                                    <Badge variant="secondary" className="ml-2">{statusCounts.rejected}</Badge>
                                </Button>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <Card>
                <CardContent>
                    <AnimatePresence>
                        {displayRequests.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <Card>
                                    <CardContent className="p-12 text-center">
                                        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold mb-2">No requests found</h3>
                                        <p className="text-muted-foreground">
                                            {searchTerm || statusFilter !== 'all' 
                                                ? 'Try adjusting your search or filter criteria.'
                                                : 'There are no pending requests at the moment.'
                                            }
                                        </p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ) : (
                            <div className="grid gap-4">
                                {displayRequests.map((request, index) => (
                                    <motion.div
                                        key={request.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    {/* Employee Info */}
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <div className="p-2 bg-primary/10 rounded-full">
                                                            <User className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-lg truncate">{request.employeeName}</h3>
                                                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>Request Date: {formatDate(request.requestDate)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    <span>Log Date: {formatDate(request.logDate)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span>Status: {request.requestedStatus}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Status and Actions */}
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                        <Badge variant={getStatusBadgeVariant(request.status)}>
                                                            {request.status || 'Unknown'}
                                                        </Badge>

                                                        {request.status?.toLowerCase() === 'pending' && (
                                                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                                                {/* Type Selection */}
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant={approvalType[request.id] === 'full day' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => handleTypeChange(request.id, 'full day')}
                                                                        className="text-xs"
                                                                    >
                                                                        Full Day
                                                                    </Button>
                                                                    <Button
                                                                        variant={approvalType[request.id] === 'half day' ? 'default' : 'outline'}
                                                                        size="sm"
                                                                        onClick={() => handleTypeChange(request.id, 'half day')}
                                                                        className="text-xs"
                                                                    >
                                                                        Half Day
                                                                    </Button>
                                                                </div>

                                                                {/* Action Buttons */}
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => handleApproval(request.id, 'approved')}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() => handleApproval(request.id, 'rejected')}
                                                                    >
                                                                        <XCircle className="h-4 w-4 mr-1" />
                                                                        Reject
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <Label htmlFor="pageSizeSelect" className="text-sm font-medium">
                                    Rows per page:
                                </Label>
                                <Select
                                    value={pageSize.toString()}
                                    onValueChange={(value) => {
                                        setCurrentPage(0);
                                        setPageSize(parseInt(value));
                                    }}
                                >
                                    <SelectTrigger id="pageSizeSelect" className="w-[80px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100].map(size => (
                                            <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                    disabled={currentPage === 0 || loading}
                                    className="h-10 px-4"
                                >
                                    ← Previous
                                </Button>
                                <span className="text-sm font-medium px-4 py-2 bg-muted rounded-lg">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    disabled={loading || currentPage >= totalPages - 1}
                                    className="h-10 px-4"
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ApprovalsPage;
