"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Phone, User, Package, Target, Briefcase, Filter, X, Download, Columns, Home, MoreHorizontal, Loader2, MapPin, ExternalLink } from "lucide-react";
import { API, formatStockQuantity, getStock, type StoreDto, type StoreResponse, type TeamDataDto } from "@/lib/api";
import CreateCustomerFlowModal from "@/components/CreateCustomerFlowModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function CustomerListPage() {
    return (
        <Suspense fallback={<div className="flex h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Loading...</div>}>
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

const FILTER_KEYS = ['storeName', 'primaryContact', 'ownerName', 'city', 'state', 'clientType', 'dealerSubType', 'employeeName'] as const;
const REMOVED_FILTER_QUERY_KEYS = ['startDate', 'endDate'] as const;
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
    employeeName: '',
};

const formatCityLabel = (city?: string | null) => {
    if (!city) return '—';
    return city.charAt(0).toUpperCase() + city.slice(1);
};

const formatClientTypeLabel = (type?: string | null) => {
    if (!type) return '—';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const formatDateToUserFriendly = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

function Ellipsis({ value }: { value: React.ReactNode }) {
    const title = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
    return (
        <span className="block min-w-0 truncate" title={title}>
            {value ?? '—'}
        </span>
    );
}

function CustomerListContent() {
    const { token, userData } = useAuth();
    const [selectedColumns, setSelectedColumns] = useState<string[]>([
        'shopName', 'ownerName', 'city', 'state', 'storeLocation', 'phone', 'stock',
        'fieldOfficer', 'clientType', 'totalVisits', 'lastVisitDate',
    ]);
    const [desktopFilters, setDesktopFilters] = useState<FiltersState>(() => ({ ...INITIAL_FILTERS }));
    const [mobileFilters, setMobileFilters] = useState<FiltersState>(() => ({ ...INITIAL_FILTERS }));
    const [isDesktopFilterExpanded, setIsDesktopFilterExpanded] = useState(false);
    const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
    const [expandedCards, setExpandedCards] = useState<number[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
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

    // Mock auth data
    const employeeId = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [isFiltersInitialized, setIsFiltersInitialized] = useState(false);

    const viewCustomer = (id: number | string) => {
        setIsNavigating(true);
        router.push(`/dashboard/customers/${id}`);
    };

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

        REMOVED_FILTER_QUERY_KEYS.forEach(key => {
            if (params.has(key)) {
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
                    
                    setIsManager(role === 'ROLE_MANAGER');
                    setIsAdmin(role === 'ROLE_ADMIN');
                    setIsDataManager(role === 'ROLE_DATA_MANAGER');
                    setIsFieldOfficer(role === 'ROLE_FIELD OFFICER');
                    setIsCoordinator(role === 'ROLE_COORDINATOR');
                    setIsAvp(authorities.some((auth: { authority: string }) => auth.authority === 'ROLE_AVP'));
                    
                    setIsRoleDetermined(true);
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
                setIsRoleDetermined(true);
                return;
            }
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
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
        
        if (sortColumn === mappedColumn) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(mappedColumn);
            setSortDirection('asc');
        }
    };

    const fetchFilteredCustomers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if ((isManager || isFieldOfficer) && (teamId === null || teamId === undefined)) return;
            
            let data: StoreResponse;
            
            if (isAvp) {
                let mappedSortColumn = sortColumn;
                if (mappedSortColumn === 'ownerName') mappedSortColumn = 'ownerFirstName';
                if (mappedSortColumn === 'totalVisits') mappedSortColumn = 'visitCount';

                const queryParams = new URLSearchParams();
                queryParams.append('page', (currentPage - 1).toString());
                queryParams.append('size', pageSize.toString());
                queryParams.append('sort', `${mappedSortColumn},${sortDirection}`);
                
                if (desktopFilters.storeName) queryParams.append('storeName', desktopFilters.storeName);
                if (desktopFilters.ownerName) queryParams.append('ownerName', desktopFilters.ownerName);
                if (desktopFilters.city) queryParams.append('city', desktopFilters.city);
                if (desktopFilters.state) queryParams.append('state', desktopFilters.state);
                if (desktopFilters.clientType) queryParams.append('clientType', desktopFilters.clientType);
                if (desktopFilters.dealerSubType) queryParams.append('dealerSubType', desktopFilters.dealerSubType);
                if (desktopFilters.employeeName) queryParams.append('employeeName', desktopFilters.employeeName);
                if (desktopFilters.primaryContact) {
                    const cleanedPhone = desktopFilters.primaryContact.replace(/\D/g, '');
                    if (cleanedPhone) queryParams.append('primaryContact', cleanedPhone);
                }

                const queryString = queryParams.toString().replace(/\+/g, '%20');
                const url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/filteredValues?${queryString}`;
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
            } else if (isManager || isFieldOfficer) {
                if (!teamId) {
                    setCustomers([]);
                    setTotalPages(1);
                    return;
                }
                data = await API.getStoresForTeam(teamId, currentPage - 1, pageSize);
            } else if (isCoordinator || isAdmin) {
                let mappedSortColumn = sortColumn;
                if (mappedSortColumn === 'ownerName') mappedSortColumn = 'ownerFirstName';
                if (mappedSortColumn === 'totalVisits') mappedSortColumn = 'visitCount';

                const queryParams = new URLSearchParams();
                queryParams.append('page', (currentPage - 1).toString());
                queryParams.append('size', pageSize.toString());
                queryParams.append('sort', `${mappedSortColumn},${sortDirection}`);
                
                if (desktopFilters.storeName) queryParams.append('storeName', desktopFilters.storeName);
                if (desktopFilters.ownerName) queryParams.append('ownerName', desktopFilters.ownerName);
                if (desktopFilters.city) queryParams.append('city', desktopFilters.city);
                if (desktopFilters.state) queryParams.append('state', desktopFilters.state);
                if (desktopFilters.clientType) queryParams.append('clientType', desktopFilters.clientType);
                if (desktopFilters.dealerSubType) queryParams.append('dealerSubType', desktopFilters.dealerSubType);
                if (desktopFilters.employeeName) queryParams.append('employeeName', desktopFilters.employeeName);
                if (desktopFilters.primaryContact) {
                    const cleanedPhone = desktopFilters.primaryContact.replace(/\D/g, '');
                    if (cleanedPhone) queryParams.append('primaryContact', cleanedPhone);
                }

                const queryString = queryParams.toString().replace(/\+/g, '%20');
                const url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/filteredValues?${queryString}`;
                const headers: Record<string, string> = {
                    Authorization: token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json',
                };

                const resp = await fetch(url, { headers });
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`Customers fetch failed: ${resp.status} ${text}`);
                }
                data = await resp.json();
            } else {
                data = await API.getStoresFilteredPaginated({
                    storeName: desktopFilters.storeName || undefined,
                    ownerName: desktopFilters.ownerName || undefined,
                    city: desktopFilters.city || undefined,
                    state: desktopFilters.state || undefined,
                    clientType: desktopFilters.clientType || undefined,
                    dealerSubType: desktopFilters.dealerSubType || undefined,
                    employeeName: desktopFilters.employeeName || undefined,
                    primaryContact: desktopFilters.primaryContact || undefined,
                    page: currentPage - 1,
                    size: pageSize,
                    sortBy: sortColumn,
                    sortOrder: sortDirection,
                });
            }
            
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
        if (isRoleDetermined) {
            fetchFilteredCustomers();
        }
    }, [desktopFilters, currentPage, pageSize, sortColumn, sortDirection, teamId, isRoleDetermined]);

    const openDeleteModal = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setSelectedCustomerId(null);
        setIsDeleteModalOpen(false);
    };

    const handleDesktopFilterChange = (filterName: FilterKey, value: string) => {
        setDesktopFilters((prevFilters) => ({
            ...prevFilters,
            [filterName]: value,
        }));
        setCurrentPage(1);
    };

    const handleMobileFilterChange = (filterName: FilterKey, value: string) => {
        setMobileFilters((prevFilters) => ({
            ...prevFilters,
            [filterName]: value,
        }));
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
                try {
                    await API.deleteStore(Number(selectedCustomerId));
                    fetchFilteredCustomers();
                    closeDeleteModal();
                    return;
                } catch (apiError) {
                    console.log('API service failed, trying direct fetch:', apiError);
                }
                
                const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/deleteById?id=${selectedCustomerId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    fetchFilteredCustomers();
                    closeDeleteModal();
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
            const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/export', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
    
            if (!response.ok) {
                setExportMessage('Failed to download. Please try again.');
                return;
            }
    
            const csvContent = (await response.text())
                .replace(/Monthly Sales?/g, 'Stock')
                .replace(/monthlySale/g, 'stock')
                .replace(/monthly_sales/g, 'stock');
    
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
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <div className="flex items-center space-x-2 text-xs">
                    <Label htmlFor="pageSize" className="text-xs">Rows per page:</Label>
                    <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(parseInt(value, 10)); setCurrentPage(1); }}>
                        <SelectTrigger className="h-8 w-16 text-xs shadow-none">
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
                
                <div className="flex items-center space-x-2 text-xs">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs shadow-none"
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                    </Button>
                    
                    <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs shadow-none"
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        );
    };

    const renderFilterInput = (name: keyof typeof desktopFilters, label: string, icon: React.ReactNode, isMobile: boolean) => (
        <div className={isMobile ? "space-y-1" : "min-w-0"}>
            <Label htmlFor={name} className="sr-only">{label}</Label>
            <div className="relative">
                <Input
                    id={name}
                    placeholder={label}
                    value={isMobile ? mobileFilters[name] : desktopFilters[name]}
                    onChange={(e) => isMobile ? handleMobileFilterChange(name, e.target.value) : handleDesktopFilterChange(name, e.target.value)}
                    className={isMobile
                        ? "h-10 pl-8 pr-8 text-sm"
                        : "h-8 bg-background pl-8 pr-8 text-xs shadow-none"
                    }
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    {icon}
                </div>
                {!isMobile && desktopFilters[name] && (
                    <button
                        onClick={() => handleFilterClear(name)}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="mx-auto w-full max-w-none py-4 space-y-4">
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
                <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {!(isAvp || isCoordinator || isDataManager) && (
                                <Button variant="outline" size="sm" className="h-9 shadow-none text-xs" onClick={openModal}>
                                    Add Customer
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsDesktopFilterExpanded(!isDesktopFilterExpanded)}
                                className="hidden h-9 shadow-none text-xs md:inline-flex"
                            >
                                <Filter className="mr-2 h-3.5 w-3.5" />
                                {isDesktopFilterExpanded ? 'Hide Filters' : 'Show Filters'}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-9 shadow-none text-xs">
                                        <Columns className="mr-2 h-3.5 w-3.5" />
                                        Columns
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {[
                                        { value: 'shopName', label: 'Shop Name' },
                                        { value: 'ownerName', label: 'Owner Name' },
                                        { value: 'city', label: 'City' },
                                        { value: 'state', label: 'State' },
                                        { value: 'storeLocation', label: 'Store Location' },
                                        { value: 'phone', label: 'Phone' },
                                        { value: 'stock', label: 'Stock' },
                                        { value: 'fieldOfficer', label: 'Assigned Executive' },
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
                                <Button variant="outline" size="sm" className="h-9 shadow-none text-xs" onClick={handleExport} disabled={isExporting}>
                                    {isExporting ? (
                                        <>
                                            <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />
                                            {exportMessage}
                                        </>
                                    ) : (
                                        <>
                                            <Download className="mr-2 h-3.5 w-3.5" />
                                            Export
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setIsMobileFilterExpanded(true)}
                                className="h-9 w-9 md:hidden"
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {isDesktopFilterExpanded && (
                        <div className="hidden rounded-lg border border-border/70 bg-muted/20 p-3 md:block">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-4">
                                {renderFilterInput('storeName', 'Shop Name', <User className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('ownerName', 'Owner Name', <User className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('city', 'City', <Home className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('state', 'State', <Home className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('primaryContact', 'Phone', <Phone className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('employeeName', 'Assigned Executive', <User className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('clientType', 'Client Type', <Target className="h-3.5 w-3.5" />, false)}
                                {renderFilterInput('dealerSubType', 'Dealer Sub Type', <Briefcase className="h-3.5 w-3.5" />, false)}
                            </div>
                        </div>
                    )}

                    {(isManager || isCoordinator) && (
                        <div>
                            <h3 className="text-base font-semibold text-foreground">Team Customers</h3>
                        </div>
                    )}

                    <Sheet open={isMobileFilterExpanded} onOpenChange={setIsMobileFilterExpanded}>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Customer Filters</SheetTitle>
                            </SheetHeader>
                            <div className="py-4 space-y-4">
                                {renderFilterInput('storeName', 'Shop Name', <User className="h-4 w-4" />, true)}
                                {renderFilterInput('ownerName', 'Owner Name', <User className="h-4 w-4" />, true)}
                                {renderFilterInput('city', 'City', <Home className="h-4 w-4" />, true)}
                                {renderFilterInput('state', 'State', <Home className="h-4 w-4" />, true)}
                                {renderFilterInput('primaryContact', 'Phone', <Phone className="h-4 w-4" />, true)}
                                {renderFilterInput('employeeName', 'Assigned Executive', <User className="h-4 w-4" />, true)}
                                {renderFilterInput('clientType', 'Client Type', <Target className="h-4 w-4" />, true)}
                                {renderFilterInput('dealerSubType', 'Dealer Sub Type', <Briefcase className="h-4 w-4" />, true)}
                            </div>
                            <SheetFooter className="flex gap-2">
                                <Button variant="outline" onClick={clearAllFilters}>Clear All</Button>
                                <Button onClick={applyMobileFilters}>Apply Filters</Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>

                    {error && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Mobile view - Cards */}
                    <div className="space-y-3 md:hidden">
                        {isLoading || !isRoleDetermined ? (
                            Array.from({ length: 3 }, (_, index) => (
                                <Skeleton key={index} className="h-40 w-full rounded-xl" />
                            ))
                        ) : customers.length === 0 ? (
                            <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
                                No customers match these filters.
                            </div>
                        ) : (
                            customers.map((customer: Customer, index: number) => {
                                const hasCoordinates = hasValidCoordinates(customer.latitude, customer.longitude);
                                const showCoordinates = hasCoordinates && selectedColumns.includes('storeLocation');

                                return (
                                    <Card key={`mobile-customer-${customer.storeId}-${index}`} className="overflow-hidden">
                                        <div className="p-3 border-b">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-9 w-9 bg-primary">
                                                        <AvatarFallback className="text-xs text-primary-foreground">
                                                            {getInitials(customer.clientFirstName, customer.clientLastName)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-foreground">{customer.storeName}</h4>
                                                        <p className="text-xs text-muted-foreground">{formatCityLabel(customer.city)}, {customer.state}</p>
                                                    </div>
                                                </div>
                                                {customer.clientType && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {formatClientTypeLabel(customer.clientType)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 space-y-2 text-xs">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 text-foreground">
                                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="font-medium">Owner:</span>
                                                    <span>{customer.clientFirstName} {customer.clientLastName}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0"
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
                                                <div className="flex items-center justify-between rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                                        <span>Location</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 gap-1 px-2 text-xs font-medium"
                                                        onClick={() => openInGoogleMaps(customer.latitude, customer.longitude)}
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        View Map
                                                    </Button>
                                                </div>
                                            )}

                                            {expandedCards.includes(customer.storeId) && (
                                                <div className="space-y-2 pt-1 text-xs text-muted-foreground border-t">
                                                    <div className="flex items-center space-x-2">
                                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="font-medium">Phone:</span>
                                                        <span>{customer.primaryContact || '—'}</span>
                                                    </div>
                                                    {getStock(customer) !== null && getStock(customer) !== undefined && (
                                                        <div className="flex items-center space-x-2">
                                                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="font-medium">Stock:</span>
                                                            <span>{formatStockQuantity(getStock(customer))}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center space-x-2">
                                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="font-medium">Total Visits:</span>
                                                        <span>{customer.totalVisitCount}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-2 flex justify-end items-center border-t">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop View - Table */}
                    <div className="hidden min-w-0 overflow-x-auto md:block">
                        <Table className="table-fixed text-xs font-poppins">
                            <colgroup>
                                {selectedColumns.includes('shopName') && <col className="w-[14%]" />}
                                {selectedColumns.includes('ownerName') && <col className="w-[11%]" />}
                                {selectedColumns.includes('city') && <col className="w-[8%]" />}
                                {selectedColumns.includes('state') && <col className="w-[8%]" />}
                                {selectedColumns.includes('storeLocation') && <col className="w-[10%]" />}
                                {selectedColumns.includes('phone') && <col className="w-[9%]" />}
                                {selectedColumns.includes('stock') && <col className="w-[8%]" />}
                                {selectedColumns.includes('fieldOfficer') && <col className="w-[11%]" />}
                                {selectedColumns.includes('clientType') && <col className="w-[8%]" />}
                                {selectedColumns.includes('totalVisits') && <col className="w-[5%]" />}
                                {selectedColumns.includes('lastVisitDate') && <col className="w-[8%]" />}
                                <col className="w-[4%]" />
                            </colgroup>
                            <TableHeader>
                                <TableRow>
                                    {selectedColumns.includes('shopName') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Shop Name" onClick={() => handleSort('storeName')}>
                                            Shop Name
                                            {sortColumn === 'storeName' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('ownerName') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Owner Name" onClick={() => handleSort('ownerName')}>
                                            Owner Name
                                            {sortColumn === 'ownerFirstName' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('city') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="City" onClick={() => handleSort('city')}>
                                            City
                                            {sortColumn === 'city' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('state') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="State" onClick={() => handleSort('state')}>
                                            State
                                            {sortColumn === 'state' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('storeLocation') && (
                                        <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap" title="Store Location">
                                            Location
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('phone') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Phone" onClick={() => handleSort('primaryContact')}>
                                            Phone
                                            {sortColumn === 'primaryContact' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('stock') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Stock" onClick={() => handleSort('stock')}>
                                            Stock
                                            {sortColumn === 'stock' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('fieldOfficer') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Assigned Executive" onClick={() => handleSort('employeeName')}>
                                            Executive
                                            {sortColumn === 'employeeName' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('clientType') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Client Type" onClick={() => handleSort('clientType')}>
                                            Client Type
                                            {sortColumn === 'clientType' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('totalVisits') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-center" title="Total Visits" onClick={() => handleSort('totalVisits')}>
                                            Visits
                                            {sortColumn === 'visitCount' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    {selectedColumns.includes('lastVisitDate') && (
                                        <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" title="Last Visit Date" onClick={() => handleSort('lastVisitDate')}>
                                            Last Visit
                                            {sortColumn === 'lastVisitDate' && (
                                                <span className="text-foreground text-xs">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                            )}
                                        </TableHead>
                                    )}
                                    <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap text-center" title="Actions">Actions</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {isLoading || !isRoleDetermined ? (
                                    Array.from({ length: 5 }, (_, index) => (
                                        <TableRow key={`skeleton-${index}`}>
                                            {selectedColumns.includes('shopName') && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                                            {selectedColumns.includes('ownerName') && <TableCell><Skeleton className="h-4 w-28" /></TableCell>}
                                            {selectedColumns.includes('city') && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                                            {selectedColumns.includes('state') && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                                            {selectedColumns.includes('storeLocation') && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                                            {selectedColumns.includes('phone') && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                                            {selectedColumns.includes('stock') && <TableCell><Skeleton className="h-4 w-16" /></TableCell>}
                                            {selectedColumns.includes('fieldOfficer') && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                                            {selectedColumns.includes('clientType') && <TableCell><Skeleton className="h-5 w-16" /></TableCell>}
                                            {selectedColumns.includes('totalVisits') && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
                                            {selectedColumns.includes('lastVisitDate') && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                                            <TableCell className="w-10">
                                                <Skeleton className="h-6 w-6 rounded-full mx-auto" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : customers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={selectedColumns.length + 1} className="h-24 text-center text-muted-foreground">
                                            No customers match these filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    customers.map((customer: Customer, index: number) => {
                                        const hasCoordinates = hasValidCoordinates(customer.latitude, customer.longitude);
                                        const ownerFullName = [customer.clientFirstName, customer.clientLastName].filter(Boolean).join(' ').trim();

                                        return (
                                            <TableRow key={`customer-${customer.storeId}-${index}`}>
                                                {selectedColumns.includes('shopName') && (
                                                    <TableCell className="font-medium overflow-hidden">
                                                        <Ellipsis value={customer.storeName} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('ownerName') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={ownerFullName} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('city') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={formatCityLabel(customer.city)} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('state') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={customer.state} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('storeLocation') && (
                                                    <TableCell className="overflow-hidden">
                                                        {hasCoordinates ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 gap-1 p-0 text-xs font-medium text-primary hover:underline"
                                                                onClick={() => openInGoogleMaps(customer.latitude, customer.longitude)}
                                                            >
                                                                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                <span className="truncate">View Map</span>
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                                                            </Button>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Unavailable</span>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('phone') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={customer.primaryContact} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('stock') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={formatStockQuantity(getStock(customer))} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('fieldOfficer') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={customer.employeeName} />
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('clientType') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Badge variant="outline" className="max-w-full text-[11px] py-0 px-2">
                                                            <Ellipsis value={formatClientTypeLabel(customer.clientType)} />
                                                        </Badge>
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('totalVisits') && (
                                                    <TableCell className="text-center font-medium">
                                                        {customer.totalVisitCount}
                                                    </TableCell>
                                                )}
                                                {selectedColumns.includes('lastVisitDate') && (
                                                    <TableCell className="overflow-hidden">
                                                        <Ellipsis value={formatDateToUserFriendly(customer.lastVisitDate)} />
                                                    </TableCell>
                                                )}
                                                <TableCell className="px-1 text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
                </CardContent>
            </Card>

            {/* Simple delete confirmation modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 border shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-foreground">Confirm Delete</h3>
                        <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this customer? This action cannot be undone.</p>
                        <div className="flex justify-end space-x-3">
                            <Button variant="outline" size="sm" onClick={closeDeleteModal}>
                                Cancel
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDeleteConfirm}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Customer Modal */}
            <CreateCustomerFlowModal
                isOpen={isModalOpen}
                onClose={closeModal}
                token={token || ''}
                employeeId={employeeId ? Number(employeeId) : null}
                onCustomerAdded={handleCustomerAdded}
            />

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
