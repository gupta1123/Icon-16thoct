"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Phone, User, DollarSign, Target, Briefcase, Filter, X, Download, Columns, Home, MoreHorizontal, Loader2, MapPin, ExternalLink } from "lucide-react";
import { API, type StoreDto, type StoreResponse, type TeamDataDto } from "@/lib/api";
import AddCustomerModal from "@/components/AddCustomerModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function CustomerListPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CustomerListContent />
        </Suspense>
    );
}

type Customer = StoreDto & {
    storeId: number;
    clientFirstName: string;
    clientLastName: string;
    employeeName: string;
    totalVisitCount: number;
};

const FILTER_KEYS = ['storeName', 'primaryContact', 'ownerName', 'city', 'state', 'clientType', 'dealerSubType'] as const;
const FILTER_EXPANDED_PARAM = 'filters';
type FilterKey = (typeof FILTER_KEYS)[number];
type FiltersState = Record<FilterKey, string>;
const INITIAL_FILTERS: FiltersState = {
    storeName: '',
    primaryContact: '',
    ownerName: '',
    city: '',
    state: '',
    clientType: '',
    dealerSubType: '',
};

function CustomerListContent() {
    const { token, userData } = useAuth();
    const [selectedColumns, setSelectedColumns] = useState<string[]>([
        'shopName', 'ownerName', 'city', 'state', 'storeLocation', 'phone', 'monthlySales',
        'clientType', 'totalVisits', 'lastVisitDate',
    ]);
    const [desktopFilters, setDesktopFilters] = useState<FiltersState>(() => ({ ...INITIAL_FILTERS }));
    const [mobileFilters, setMobileFilters] = useState<FiltersState>(() => ({ ...INITIAL_FILTERS }));
    const [isDesktopFilterExpanded, setIsDesktopFilterExpanded] = useState(false);
    const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
    const [expandedCards, setExpandedCards] = useState<number[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [sortColumn, setSortColumn] = useState<string>('storeName');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportMessage, setExportMessage] = useState<string>('Please wait, downloading...');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isNavigating, setIsNavigating] = useState<boolean>(false);
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isDataManager, setIsDataManager] = useState(false);
    const [isAvp, setIsAvp] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [isCoordinator, setIsCoordinator] = useState(false);
    const [userRoleFromAPI, setUserRoleFromAPI] = useState<string | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [isRoleDetermined, setIsRoleDetermined] = useState(false);

    // Mock auth data - replace with actual auth context
    const employeeId = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [isFiltersInitialized, setIsFiltersInitialized] = useState(false);

    const viewCustomer = (id: number | string) => {
        setIsNavigating(true);
        router.push(`/dashboard/customers/${id}`);
    };
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;

    const openInGoogleMaps = useCallback((latitude?: number | null, longitude?: number | null) => {
        if (latitude == null || longitude == null) {
            return;
        }
        if (typeof window === 'undefined') {
            return;
        }
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

    const hasValidCoordinates = (latitude?: number | null, longitude?: number | null) =>
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !Number.isNaN(latitude) &&
        !Number.isNaN(longitude);

    useEffect(() => {
        if (isFiltersInitialized) {
            return;
        }

        const params = new URLSearchParams(searchParams.toString());
        const filtersExpandedParam = params.get(FILTER_EXPANDED_PARAM);
        if (filtersExpandedParam === 'open') {
            setIsDesktopFilterExpanded((prev) => (prev ? prev : true));
        }
        let updatedFilters: FiltersState | null = null;

        setDesktopFilters(prev => {
            const next = { ...prev };
            let changed = false;

            FILTER_KEYS.forEach(key => {
                const paramValue = params.get(key);
                if (paramValue !== null && next[key] !== paramValue) {
                    next[key] = paramValue;
                    changed = true;
                }
            });

            if (changed) {
                updatedFilters = next;
                return next;
            }

            return prev;
        });

        if (updatedFilters) {
            setMobileFilters(updatedFilters);
        }

        const pageParam = params.get('page');
        if (pageParam) {
            const parsedPage = Number(pageParam);
            if (!Number.isNaN(parsedPage) && parsedPage > 0) {
                setCurrentPage(prev => (prev === parsedPage ? prev : parsedPage));
            }
        }

        const sortByParam = params.get('sortBy');
        if (sortByParam) {
            setSortColumn(prev => (prev === sortByParam ? prev : sortByParam));
        }

        const sortOrderParam = params.get('sortOrder');
        if (sortOrderParam === 'asc' || sortOrderParam === 'desc') {
            setSortDirection(prev => (prev === sortOrderParam ? prev : sortOrderParam));
        }

        setIsFiltersInitialized(true);
    }, [searchParams, isFiltersInitialized]);

    useEffect(() => {
        if (!isFiltersInitialized) {
            return;
        }

        const params = new URLSearchParams(searchParams.toString());
        let hasUpdates = false;

        FILTER_KEYS.forEach(key => {
            const value = desktopFilters[key];
            if (value) {
                if (params.get(key) !== value) {
                    params.set(key, value);
                    hasUpdates = true;
                }
            } else if (params.has(key)) {
                params.delete(key);
                hasUpdates = true;
            }
        });

        if (currentPage > 1) {
            if (params.get('page') !== String(currentPage)) {
                params.set('page', String(currentPage));
                hasUpdates = true;
            }
        } else if (params.has('page')) {
            params.delete('page');
            hasUpdates = true;
        }

        if (sortColumn && sortColumn !== 'storeName') {
            if (params.get('sortBy') !== sortColumn) {
                params.set('sortBy', sortColumn);
                hasUpdates = true;
            }
        } else if (params.has('sortBy')) {
            params.delete('sortBy');
            hasUpdates = true;
        }

        if (sortDirection !== 'asc') {
            if (params.get('sortOrder') !== sortDirection) {
                params.set('sortOrder', sortDirection);
                hasUpdates = true;
            }
        } else if (params.has('sortOrder')) {
            params.delete('sortOrder');
            hasUpdates = true;
        }

        if (isDesktopFilterExpanded) {
            if (params.get(FILTER_EXPANDED_PARAM) !== 'open') {
                params.set(FILTER_EXPANDED_PARAM, 'open');
                hasUpdates = true;
            }
        } else if (params.has(FILTER_EXPANDED_PARAM)) {
            params.delete(FILTER_EXPANDED_PARAM);
            hasUpdates = true;
        }

        if (!hasUpdates) {
            return;
        }

        const queryString = params.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    }, [desktopFilters, currentPage, sortColumn, sortDirection, isDesktopFilterExpanded, isFiltersInitialized, pathname, router, searchParams]);

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
                    
                // Extract role from authorities (consider all authorities)
                const authorities = userData.authorities || [];
                const role = authorities.length > 0 ? authorities[0].authority : null;
                    setUserRoleFromAPI(role);
                    
                    // Set role flags
                setIsManager(role === 'ROLE_MANAGER');
                    setIsAdmin(role === 'ROLE_ADMIN');
                    setIsDataManager(role === 'ROLE_DATA_MANAGER');
                    setIsFieldOfficer(role === 'ROLE_FIELD OFFICER');
                    setIsCoordinator(role === 'ROLE_COORDINATOR');
                setIsAvp(authorities.some((auth: { authority: string }) => auth.authority === 'ROLE_AVP'));
                    
                    console.log('Role from API:', role);
                    console.log('isManager:', role === 'ROLE_MANAGER' || role === 'ROLE_AVP');
                    console.log('isAdmin:', role === 'ROLE_ADMIN');
                    console.log('isFieldOfficer:', role === 'ROLE_FIELD OFFICER');
                    console.log('isCoordinator:', role === 'ROLE_COORDINATOR');
                    
                    // Mark role as determined
                    setIsRoleDetermined(true);
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
            if ((!isManager && !isFieldOfficer && !isCoordinator) || !userData?.employeeId) {
                // For admins or users without employeeId, mark role as determined
                setIsRoleDetermined(true);
                return;
            }
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
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
                // Mark role as determined after team data is loaded (or failed)
                setIsRoleDetermined(true);
            }
        };

        loadTeamData();
    }, [isManager, isFieldOfficer, isCoordinator, userData?.employeeId]);

    const handleSort = (column: string) => {
        let mappedColumn = column;
        if (column === 'ownerName') {
            mappedColumn = 'ownerFirstName';
        } else if (column === 'totalVisits') {
            mappedColumn = 'visitCount';
        }
        
        // If clicking the same column, toggle direction
        if (sortColumn === mappedColumn) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            // If clicking a different column, set to alphabetical (ascending) by default
            setSortColumn(mappedColumn);
            setSortDirection('asc');
        }
    };

    const fetchFilteredCustomers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // For managers and field officers, wait until teamId is available
            if ((isManager || isFieldOfficer) && (teamId === null || teamId === undefined)) return;
            
            let data: StoreResponse;
            
            if (isAvp) {
                // For AVP, use filteredValues API call with query parameters
                console.log('AVP API call');
                // Map sort to single 'sort' param as required by provided URL pattern
                let mappedSortColumn = sortColumn;
                if (mappedSortColumn === 'ownerName') mappedSortColumn = 'ownerFirstName';
                if (mappedSortColumn === 'totalVisits') mappedSortColumn = 'visitCount';

                // Build query parameters for filters
                const queryParams = new URLSearchParams();
                queryParams.append('page', (currentPage - 1).toString());
                queryParams.append('size', '10');
                queryParams.append('sort', `${mappedSortColumn},${sortDirection}`);
                
                // Add filters as query parameters
                if (desktopFilters.storeName) queryParams.append('storeName', desktopFilters.storeName);
                if (desktopFilters.ownerName) queryParams.append('clientFirstName', desktopFilters.ownerName);
                if (desktopFilters.city) queryParams.append('city', desktopFilters.city);
                if (desktopFilters.state) queryParams.append('state', desktopFilters.state);
                if (desktopFilters.clientType) queryParams.append('clientType', desktopFilters.clientType);
                if (desktopFilters.dealerSubType) queryParams.append('dealerSubType', desktopFilters.dealerSubType);
                if (desktopFilters.primaryContact) {
                    const cleanedPhone = desktopFilters.primaryContact.replace(/\D/g, '');
                    if (cleanedPhone) queryParams.append('primaryContact', cleanedPhone);
                }

                const url = `/api/proxy/store/filteredValues?${queryParams.toString()}`;
                const headers: Record<string, string> = {
                    Authorization: token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json',
                };

                const resp = await fetch(url, { headers });
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`AVP customers fetch failed: ${resp.status} ${text}`);
                }
                data = await resp.json();
                console.log('AVP API response:', data);
            } else if (isManager) {
                // For managers, use team-based API call only
                if (!teamId) {
                    console.log('Manager role detected but no teamId available, skipping API call');
                    setCustomers([]);
                    setTotalPages(1);
                    return;
                }
                console.log('Manager API call for team:', teamId);
                data = await API.getStoresForTeam(teamId, currentPage - 1, 10);
                console.log('Manager API response:', data);
            } else if (isFieldOfficer) {
                // For field officers, use team-based API call only
                if (!teamId) {
                    console.log('Field Officer role detected but no teamId available, skipping API call');
                    setCustomers([]);
                    setTotalPages(1);
                    return;
                }
                console.log('Field Officer API call for team:', teamId);
                data = await API.getStoresForTeam(teamId, currentPage - 1, 10);
                console.log('Field Officer API response:', data);
            } else if (isCoordinator) {
                // For coordinators, use general filtered endpoint (city-based filtering in backend)
                console.log('Coordinator API call');
                data = await API.getStoresFilteredPaginated({
                    storeName: desktopFilters.storeName || undefined,
                    ownerName: desktopFilters.ownerName || undefined,
                    city: desktopFilters.city || undefined,
                    state: desktopFilters.state || undefined,
                    clientType: desktopFilters.clientType || undefined,
                    primaryContact: desktopFilters.primaryContact || undefined,
                    page: currentPage - 1,
                    size: 10,
                    sortBy: sortColumn,
                    sortOrder: sortDirection,
                });
                console.log('Coordinator API response:', data);
            } else if (isAdmin) {
                // For admins, always use filteredValues endpoint with query parameters
                console.log('Admin API call (using filteredValues endpoint)');
                // Map sort to single 'sort' param as required by provided URL pattern
                let mappedSortColumn = sortColumn;
                if (mappedSortColumn === 'ownerName') mappedSortColumn = 'ownerFirstName';
                if (mappedSortColumn === 'totalVisits') mappedSortColumn = 'visitCount';

                // Build query parameters for filters
                const queryParams = new URLSearchParams();
                queryParams.append('page', (currentPage - 1).toString());
                queryParams.append('size', '10');
                queryParams.append('sort', `${mappedSortColumn},${sortDirection}`);
                
                // Add filters as query parameters
                if (desktopFilters.storeName) queryParams.append('storeName', desktopFilters.storeName);
                if (desktopFilters.ownerName) queryParams.append('clientFirstName', desktopFilters.ownerName);
                if (desktopFilters.city) queryParams.append('city', desktopFilters.city);
                if (desktopFilters.state) queryParams.append('state', desktopFilters.state);
                if (desktopFilters.clientType) queryParams.append('clientType', desktopFilters.clientType);
                if (desktopFilters.dealerSubType) queryParams.append('dealerSubType', desktopFilters.dealerSubType);
                if (desktopFilters.primaryContact) {
                    const cleanedPhone = desktopFilters.primaryContact.replace(/\D/g, '');
                    if (cleanedPhone) queryParams.append('primaryContact', cleanedPhone);
                }

                const url = `/api/proxy/store/filteredValues?${queryParams.toString()}`;
                const headers: Record<string, string> = {
                    Authorization: token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json',
                };

                const resp = await fetch(url, { headers });
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`Admin customers fetch failed: ${resp.status} ${text}`);
                }
                data = await resp.json();
                console.log('Admin API response:', data);
            } else {
                // Default to admin API call for unknown roles
                console.log('Default (Admin) API call for unknown role');
                data = await API.getStoresFilteredPaginated({
                    storeName: desktopFilters.storeName || undefined,
                    ownerName: desktopFilters.ownerName || undefined,
                    city: desktopFilters.city || undefined,
                    state: desktopFilters.state || undefined,
                    clientType: desktopFilters.clientType || undefined,
                    dealerSubType: desktopFilters.dealerSubType || undefined,
                    primaryContact: desktopFilters.primaryContact || undefined,
                    page: currentPage - 1,
                    size: 10,
                    sortBy: sortColumn,
                    sortOrder: sortDirection,
                });
            }
            
            // Transform StoreDto to Customer format
            const transformedCustomers: Customer[] = (data.content || []).map((store: StoreDto) => ({
                ...store,
                storeId: store.storeId,
                clientFirstName: store.clientFirstName || '',
                clientLastName: store.clientLastName || '',
                employeeName: store.employeeName || '',
                totalVisitCount: store.totalVisitCount || 0,
            }));
            setCustomers(transformedCustomers);
            setTotalPages(data.totalPages || 1);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load customers');
            setCustomers([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch customers after role is determined
        if (isRoleDetermined) {
            fetchFilteredCustomers();
        }
    }, [desktopFilters, currentPage, sortColumn, sortDirection, teamId, isRoleDetermined]);

    const openDeleteModal = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setSelectedCustomerId(null);
        setIsDeleteModalOpen(false);
    };

    const handleDesktopFilterChange = (filterName: FilterKey, value: string) => {
        if (filterName === 'ownerName') {
            setDesktopFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value.toLowerCase(),
            }));
        } else {
            setDesktopFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value,
            }));
        }
        setCurrentPage(1);
    };

    const handleMobileFilterChange = (filterName: FilterKey, value: string) => {
        if (filterName === 'ownerName') {
            setMobileFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value.toLowerCase(),
            }));
        } else {
            setMobileFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value,
            }));
        }
    };

    const handleFilterClear = (filterName: FilterKey) => {
        setDesktopFilters((prevFilters) => ({
            ...prevFilters,
            [filterName]: '',
        }));
        setMobileFilters((prevFilters) => ({
            ...prevFilters,
            [filterName]: '',
        }));
        setCurrentPage(1);
    };

    const toggleCardExpansion = (storeId: number) => {
        setExpandedCards(prev =>
            prev.includes(storeId)
                ? prev.filter(id => id !== storeId)
                : [...prev, storeId]
        );
    };

    const handleDeleteConfirm = async () => {
        if (selectedCustomerId) {
            try {
                console.log('Attempting to delete customer with ID:', selectedCustomerId);
                console.log('Using token:', token ? 'Token present' : 'No token');
                
                // Try using the API service first
                try {
                    await API.deleteStore(Number(selectedCustomerId));
                    console.log('Customer deleted successfully via API service');
                    fetchFilteredCustomers();
                    closeDeleteModal();
                    return;
                } catch (apiError) {
                    console.log('API service failed, trying direct fetch:', apiError);
                }
                
                // Fallback to direct fetch
                const response = await fetch(`/api/proxy/store/deleteById?id=${selectedCustomerId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                console.log('Delete response status:', response.status);
                console.log('Delete response ok:', response.ok);
                
                if (response.ok) {
                    console.log('Customer deleted successfully via direct fetch');
                    fetchFilteredCustomers();
                    closeDeleteModal();
                } else {
                    const errorText = await response.text();
                    console.error('Failed to delete customer. Status:', response.status);
                    console.error('Error response:', errorText);
                }
            } catch (error) {
                console.error('Error deleting customer:', error);
            }
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleSelectColumn = (column: string) => {
        setSelectedColumns(prev =>
            prev.includes(column)
                ? prev.filter(col => col !== column)
                : [...prev, column]
        );
    };

    const getInitials = (firstName: string, lastName: string) => {
        const firstInitial = firstName?.charAt(0) || '';
        const lastInitial = lastName?.charAt(0) || '';
        return `${firstInitial}${lastInitial}`.toUpperCase();
    };

    const handleExport = useCallback(async () => {
        if (!(isAdmin || isDataManager)) {
            return;
        }
        setIsExporting(true);
        setExportMessage('Please wait, downloading...');
        try {
            console.log('Starting export process...');
            
            const response = await fetch('/api/proxy/store/export', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
    
            console.log('Export response status:', response.status);
            console.log('Export response ok:', response.ok);
    
            if (!response.ok) {
                console.error('Failed to fetch export data');
                setExportMessage('Failed to download. Please try again.');
                return;
            }
    
            const csvContent = await response.text();
            console.log('CSV content received, length:', csvContent.length);
    
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'customers_export.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setExportMessage('Download complete!');
                console.log('Export completed successfully');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            setExportMessage('Failed to download. Please try again.');
        } finally {
            setTimeout(() => {
                setIsExporting(false);
                setExportMessage('Please wait, downloading...');
            }, 2000);
        }
    }, [token, isAdmin, isDataManager]);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleCustomerAdded = () => {
        // Refresh the customers list after adding a new customer
        fetchFilteredCustomers();
    };

    const applyMobileFilters = () => {
        setDesktopFilters({ ...mobileFilters });
        setIsMobileFilterExpanded(false);
        setCurrentPage(1);
    };

    const clearAllFilters = () => {
        setDesktopFilters({ ...INITIAL_FILTERS });
        setMobileFilters({ ...INITIAL_FILTERS });
        setCurrentPage(1);
    };

    const renderPagination = () => {
        return (
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    };

    const renderFilterInput = (name: keyof typeof desktopFilters, label: string, icon: React.ReactNode, isMobile: boolean) => (
        <div className="space-y-1">
            <Label htmlFor={name} className="sr-only">{label}</Label>
            <div className="relative">
                <Input
                    id={name}
                    placeholder={label}
                    value={isMobile ? mobileFilters[name] : desktopFilters[name]}
                    onChange={(e) => isMobile ? handleMobileFilterChange(name, e.target.value) : handleDesktopFilterChange(name, e.target.value)}
                    className="pl-8 pr-8 h-9"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    {icon}
                </div>
                {!isMobile && desktopFilters[name] && (
                    <button
                        onClick={() => handleFilterClear(name)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );

  return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        {!(isAvp || isCoordinator || isDataManager) && (
                          <Button variant="outline" size="sm" onClick={openModal}>
                              Add Customer
                          </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDesktopFilterExpanded(!isDesktopFilterExpanded)}
                            className="hidden md:inline-flex"
                        >
                            <Filter className="mr-2 h-4 w-4" />
                            {isDesktopFilterExpanded ? 'Hide Filters' : 'Show Filters'}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Columns className="mr-2 h-4 w-4" />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {[
                                    { value: 'shopName', label: 'Shop Name' },
                                    { value: 'ownerName', label: 'Owner First Name' },
                                    { value: 'city', label: 'City' },
                                    { value: 'state', label: 'State' },
                                    { value: 'storeLocation', label: 'Store Location' },
                                    { value: 'phone', label: 'Phone' },
                                    { value: 'monthlySales', label: 'Monthly Sales' },
                                    { value: 'clientType', label: 'Client Type' },
                                    { value: 'totalVisits', label: 'Total Visits' },
                                    { value: 'lastVisitDate', label: 'Last Visit Date' }
                                ].map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.value}
                                        checked={selectedColumns.includes(column.value)}
                                        onCheckedChange={() => handleSelectColumn(column.value)}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            {column.label}
                                            {selectedColumns.includes(column.value) && (
                                                <Check className="h-4 w-4" />
                                            )}
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {(isAdmin || isDataManager) && (
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                            {isExporting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                    </svg>
                                    {exportMessage}
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </>
                            )}
                        </Button>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsMobileFilterExpanded(true)}
                            className="md:hidden"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {isDesktopFilterExpanded && (
                    <Card className="mb-6 hidden md:block">
                        <CardContent className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {renderFilterInput('storeName', 'Shop Name', <User className="h-4 w-4" />, false)}
                                {renderFilterInput('ownerName', 'Owner First Name', <User className="h-4 w-4" />, false)}
                                {renderFilterInput('city', 'City', <Home className="h-4 w-4" />, false)}
                                {renderFilterInput('state', 'State', <Home className="h-4 w-4" />, false)}
                                {renderFilterInput('primaryContact', 'Phone', <Phone className="h-4 w-4" />, false)}
                                {renderFilterInput('clientType', 'Client Type', <Target className="h-4 w-4" />, false)}
                                {renderFilterInput('dealerSubType', 'Dealer Sub Type', <Briefcase className="h-4 w-4" />, false)}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {(isManager || isCoordinator) && (
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold">Team Customers</h2>
                    </div>
                )}

                <Sheet open={isMobileFilterExpanded} onOpenChange={setIsMobileFilterExpanded}>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Customer Filters</SheetTitle>
                        </SheetHeader>
                        <div className="py-4 space-y-4">
                            {renderFilterInput('storeName', 'Shop Name', <User className="h-4 w-4" />, true)}
                            {renderFilterInput('ownerName', 'Owner First Name', <User className="h-4 w-4" />, true)}
                            {renderFilterInput('city', 'City', <Home className="h-4 w-4" />, true)}
                            {renderFilterInput('state', 'State', <Home className="h-4 w-4" />, true)}
                            {renderFilterInput('primaryContact', 'Phone', <Phone className="h-4 w-4" />, true)}
                            {renderFilterInput('clientType', 'Client Type', <Target className="h-4 w-4" />, true)}
                            {renderFilterInput('dealerSubType', 'Dealer Sub Type', <Briefcase className="h-4 w-4" />, true)}
                        </div>
                        <SheetFooter className="flex gap-2">
                            <Button variant="outline" onClick={clearAllFilters}>Clear All</Button>
                            <Button onClick={applyMobileFilters}>Apply Filters</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                {/* Mobile view - Cards for managers/field officers, table for admins */}
                <div className="md:hidden space-y-4">
                    {isLoading || !isRoleDetermined ? (
                        <>
                            {[...Array(5)].map((_, index) => (
                                <Card key={`mobile-skeleton-${index}`} className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <Skeleton className="h-12 w-12 rounded-full" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                            <Skeleton className="h-6 w-16" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <div className="flex items-center justify-between">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-8 w-8" />
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <Skeleton className="h-8 w-20" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    ) : (
                        customers.map((customer: Customer, index: number) => {
                            const hasCoordinates = hasValidCoordinates(customer.latitude, customer.longitude);
                            const showCoordinates = hasCoordinates && selectedColumns.includes('storeLocation');

                            return (
                                <Card key={`mobile-customer-${customer.storeId}-${index}`} className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <Avatar>
                                                    <AvatarImage 
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(customer.clientFirstName + ' ' + customer.clientLastName)}&background=264653&color=fff&size=120&bold=true`}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                                <AvatarFallback>{getInitials(customer.clientFirstName, customer.clientLastName)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-lg">{customer.storeName}</CardTitle>
                                                <p className="text-sm text-gray-500">{customer.city}, {customer.state}</p>
                                            </div>
                                        </div>
                                        {customer.clientType && (
                                            <Badge variant="outline">
                                                {customer.clientType}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <User className="text-blue-500" />
                                            <span className="font-medium">Owner:</span>
                                            <span>{customer.clientFirstName} {customer.clientLastName}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleCardExpansion(customer.storeId)}
                                        >
                                            {expandedCards.includes(customer.storeId) ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>

                                    {showCoordinates && (
                                        <div className="mt-3 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-4 w-4 text-primary" />
                                                <span>Location available</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1"
                                                onClick={() => openInGoogleMaps(customer.latitude, customer.longitude)}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                View on Map
                                            </Button>
                                        </div>
                                    )}

                                    {expandedCards.includes(customer.storeId) && (
                                        <div className="mt-4 space-y-3 text-sm">
                                            <div className="flex items-center space-x-2">
                                                <Phone className="text-green-500" />
                                                <span className="font-medium">Phone:</span>
                                                <span>{customer.primaryContact}</span>
                                            </div>
                                            {customer.monthlySale && (
                                                <div className="flex items-center space-x-2">
                                                    <DollarSign className="text-yellow-500" />
                                                    <span className="font-medium">Monthly Sales:</span>
                                                    <span>{customer.monthlySale.toLocaleString()} tonnes</span>
                                                </div>
                                            )}
                                            {/* Intent removed */}
                                            <div className="flex items-center space-x-2">
                                                <User className="text-indigo-500" />
                                                <span className="font-medium">Total Visits:</span>
                                                <span>{customer.totalVisitCount}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 flex justify-end items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => viewCustomer(customer.storeId)}>
                                                    View
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onSelect={() => openDeleteModal(customer.storeId.toString())}>
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>

                <div className="hidden md:block">
                    <Table className="text-sm font-poppins">
                        <TableHeader>
                            <TableRow>
                                {selectedColumns.includes('shopName') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('storeName')}>
                                        Shop Name
                                        {sortColumn === 'storeName' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('ownerName') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('ownerName')}>
                                        Owner First Name
                                        {sortColumn === 'ownerFirstName' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('city') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('city')}>
                                        City
                                        {sortColumn === 'city' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('state') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('state')}>
                                        State
                                        {sortColumn === 'state' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('storeLocation') && (
                                    <TableHead>
                                        Store Location
                                    </TableHead>
                                )}
                                {selectedColumns.includes('phone') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('primaryContact')}>
                                        Phone
                                        {sortColumn === 'primaryContact' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('monthlySales') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('monthlySale')}>
                                        Monthly Sales
                                        {sortColumn === 'monthlySale' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {/* Intent Level column removed */}
                                {selectedColumns.includes('fieldOfficer') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('employeeName')}>
                                        Field Officer
                                        {sortColumn === 'employeeName' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('clientType') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('clientType')}>
                                        Client Type
                                        {sortColumn === 'clientType' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('totalVisits') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('totalVisits')}>
                                        Total Visits
                                        {sortColumn === 'visitCount' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('lastVisitDate') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('lastVisitDate')}>
                                        Last Visit Date
                                        {sortColumn === 'lastVisitDate' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('email') && (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('email')}>
                                        Email
                                        {sortColumn === 'email' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                <TableHead className="w-20">Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading || !isRoleDetermined ? (
                                <>
                                    {[...Array(5)].map((_, index) => (
                                        <TableRow key={`skeleton-${index}`}>
                                            {selectedColumns.includes('shopName') && (
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            )}
                                            {selectedColumns.includes('ownerName') && (
                                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            )}
                                            {selectedColumns.includes('city') && (
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            )}
                                            {selectedColumns.includes('state') && (
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            )}
                                            {selectedColumns.includes('storeLocation') && (
                                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            )}
                                            {selectedColumns.includes('phone') && (
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            )}
                                            {selectedColumns.includes('monthlySales') && (
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            )}
                                            {selectedColumns.includes('intentLevel') && (
                                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            )}
                                            {selectedColumns.includes('fieldOfficer') && (
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            )}
                                            {selectedColumns.includes('clientType') && (
                                                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                            )}
                                            {selectedColumns.includes('totalVisits') && (
                                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            )}
                                            {selectedColumns.includes('lastVisitDate') && (
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            )}
                                            {selectedColumns.includes('email') && (
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            )}
                                            <TableCell className="w-20">
                                                <Skeleton className="h-8 w-8" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            ) : (
                                customers.map((customer: Customer, index: number) => {
                                    const hasCoordinates = hasValidCoordinates(customer.latitude, customer.longitude);

                                    return (
                                        <TableRow key={`customer-${customer.storeId}-${index}`}>
                                            {selectedColumns.includes('shopName') && <TableCell>{customer.storeName || ''}</TableCell>}
                                            {selectedColumns.includes('ownerName') && (
                                                <TableCell>
                                                    {customer.clientFirstName || customer.clientLastName
                                                        ? `${customer.clientFirstName || ''} ${customer.clientLastName || ''}`.trim()
                                                        : ''}
                                                </TableCell>
                                            )}
                                            {selectedColumns.includes('city') && <TableCell>{customer.city || ''}</TableCell>}
                                            {selectedColumns.includes('state') && <TableCell>{customer.state || ''}</TableCell>}
                                            {selectedColumns.includes('storeLocation') && (
                                                <TableCell>
                                                    {hasCoordinates ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-1 px-0 font-medium"
                                                            onClick={() => openInGoogleMaps(customer.latitude, customer.longitude)}
                                                        >
                                                            <MapPin className="h-4 w-4 text-primary" />
                                                            View on Map
                                                            <ExternalLink className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Location unavailable</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {selectedColumns.includes('phone') && <TableCell>{customer.primaryContact || ''}</TableCell>}
                                            {selectedColumns.includes('monthlySales') && (
                                                <TableCell>
                                                    {customer.monthlySale !== null && customer.monthlySale !== undefined
                                                        ? `${customer.monthlySale.toLocaleString()} tonnes`
                                                        : ''}
                                                </TableCell>
                                            )}
                                            {/* Intent value removed */}
                                            {selectedColumns.includes('fieldOfficer') && <TableCell>{customer.employeeName || ''}</TableCell>}
                                            {selectedColumns.includes('clientType') && (
                                                <TableCell>
                                                    <Badge variant="outline">
                                                        {customer.clientType || ''}
                                                    </Badge>
                                                </TableCell>
                                            )}
                                            {selectedColumns.includes('totalVisits') && <TableCell>{customer.totalVisitCount}</TableCell>}
                                            {selectedColumns.includes('lastVisitDate') && (
                                                <TableCell>
                                                    {customer.lastVisitDate
                                                        ? new Date(customer.lastVisitDate).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                        })
                                                        : ''}
                                                </TableCell>
                                            )}
                                            {selectedColumns.includes('email') && <TableCell>{customer.email || ''}</TableCell>}
                                            <TableCell className="w-20">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => viewCustomer(customer.storeId)}>
                                                            View
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onSelect={() => openDeleteModal(customer.storeId.toString())}>
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {renderPagination()}

                {/* Simple delete confirmation modal */}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                            <p className="text-gray-600 mb-6">Are you sure you want to delete this customer? This action cannot be undone.</p>
                            <div className="flex justify-end space-x-3">
                                <Button variant="outline" onClick={closeDeleteModal}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleDeleteConfirm}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Customer Modal */}
                <AddCustomerModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    token={token || ''}
                    employeeId={employeeId ? Number(employeeId) : null}
                    onCustomerAdded={handleCustomerAdded}
                />
            </div>

            {isNavigating && (
                <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 shadow-sm">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Opening customer…</span>
                    </div>
                </div>
            )}
    </div>
  );
}
