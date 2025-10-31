'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { API, type TeamDataDto } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { sortBy, uniqBy } from 'lodash';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { CalendarIcon, MoreHorizontal, PlusCircle, Search, Filter, Clock, User, Building, MapPin, AlertTriangle, CheckCircle, Loader, FileText, Target, Trash2, Calendar as CalendarIcon2, X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import SearchableSelect from "@/components/searchable-select";

interface Task {
    id: number;
    taskTitle: string;
    taskDescription: string;
    dueDate: string;
    assignedToId: number;
    assignedToName: string;
    assignedById: number;
    assignedByName?: string;
    status: string;
    priority: string;
    category: string;
    storeId: number;
    storeName: string;
    storeCity: string;
    storeDistrict?: string;
    taskType: string;
    imageCount: number;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
}

interface Store {
    id: number;
    storeName: string;
    storeCity?: string;
    city?: string;
}

interface AttachmentResponse {
    fileName: string;
    fileDownloadUri: string;
    fileType: string;
    tag: string;
    size: number;
}

const Complaints = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
    const [newTask, setNewTask] = useState<Task>({
        id: 0,
        taskTitle: '',
        taskDescription: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 86,
        status: 'Assigned',
        priority: 'low',
        category: 'Complaint',
        storeId: 0,
        storeName: '',
        storeCity: '',
        storeDistrict: '',
        taskType: 'complaint',
        imageCount: 0
    });
    const router = useRouter();
    const searchParams = useSearchParams();
    const [initializedFromQuery, setInitializedFromQuery] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState({
        employee: '',
        priority: '',
        status: '',
        district: 'all',
        search: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    });
    const [isLoading, setIsLoading] = useState(true);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [filterEmployees, setFilterEmployees] = useState<{ id: number; name: string }[]>([]);
    const [filterDistricts, setFilterDistricts] = useState<string[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [taskImages, setTaskImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [isTabLoading, setIsTabLoading] = useState(false);
    const [isStoresLoading, setIsStoresLoading] = useState(false);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [isManager, setIsManager] = useState(false);
    const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
    const [isMobileStartDatePickerOpen, setIsMobileStartDatePickerOpen] = useState(false);
    const [isMobileEndDatePickerOpen, setIsMobileEndDatePickerOpen] = useState(false);
    const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);

    const { token, userRole, userData, currentUser } = useAuth();

    // Determine user role and load team data for managers
    useEffect(() => {
        const checkUserRole = () => {
            // Check both userRole and currentUser authorities
            const isManagerRole =
                userRole === 'MANAGER' ||
                userRole === 'AVP' ||
                currentUser?.authorities?.some(
                    (auth) =>
                        auth.authority === 'ROLE_MANAGER' ||
                        auth.authority === 'ROLE_AVP'
                );
            
            setIsManager(!!isManagerRole);
        };
        checkUserRole();
    }, [userRole, currentUser]);

    // Load team data for managers
    useEffect(() => {
        const loadTeamData = async () => {
            if (!isManager || !userData?.employeeId) return;
            
            try {
                console.log('Loading team data for manager with employeeId:', userData.employeeId);
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
                    if (teamData && teamData.length > 0) {
                    const team = teamData[0];
                    const teamId = team.id;
                    setTeamId(teamId);
                    console.log('Team ID loaded:', teamId);
                    
                    // Load team members for assignment dropdown
                    const teamMemberIds = team.fieldOfficers.map(fo => fo.id);
                    console.log('Team member IDs:', teamMemberIds);
                    
                    // Filter all employees to only show team members
                    const filteredTeamMembers = allEmployees.filter(emp => 
                        teamMemberIds.includes(emp.id)
                    );
                    setTeamMembers(filteredTeamMembers);
                    console.log('Team members loaded:', filteredTeamMembers.length);
                    } else {
                    console.warn('No team data found for manager');
                    setErrorMessage('No team data found for this manager');
                }
            } catch (err: unknown) {
                console.error('Failed to load team data:', err);
                setErrorMessage('Failed to load team data');
            }
        };
        
        if (isManager && userData?.employeeId && allEmployees.length > 0) {
            loadTeamData();
        }
    }, [isManager, userData?.employeeId, allEmployees]);

    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                setErrorMessage(null);
            }, 20000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    const handleDateChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value };

        if (newFilters.startDate && newFilters.endDate) {
            const startDate = new Date(newFilters.startDate);
            const endDate = new Date(newFilters.endDate);

            if (differenceInDays(endDate, startDate) > 30) {
                setErrorMessage('Date range should not exceed 30 days');
                // Still update the filters, but show the error message
                setFilters(newFilters);
                return;
            }
        }

        setFilters(newFilters);
        // Clear any previous error messages when date range is valid
        if (errorMessage && errorMessage.includes('Date range should not exceed 30 days')) {
            setErrorMessage(null);
        }
    };

    const handleNext = () => {
        setIsTabLoading(true);
   
        setTimeout(() => {
            setActiveTab('details');
            setIsTabLoading(false);
        }, 500);
    };

    const handleBack = () => {
        setActiveTab('general');
    };

    const handleViewStore = (storeId: number) => {
        const qp = new URLSearchParams({ from: 'complaints' });
        qp.set('start', filters.startDate || '');
        qp.set('end', filters.endDate || '');
        if (filters.employee) qp.set('employee', filters.employee);
        if (filters.priority) qp.set('priority', filters.priority);
        if (filters.status) qp.set('status', filters.status);
        if (filters.district && filters.district !== 'all') qp.set('district', filters.district);
        if (filters.search) qp.set('search', filters.search);
        qp.set('page', String(currentPage));
        router.push(`/dashboard/customers/${storeId}?${qp.toString()}`);
    };

    const fetchTasks = useCallback(async () => {
        if (!token) return;

        // For managers, wait until we have teamId
        if (isManager && !teamId) {
            console.log('⏳ Manager detected but no teamId yet - waiting for team data');
            return;
        }
        
        console.log('Fetching tasks with:', { userRole, userData, isManager, teamId, token: token ? 'present' : 'missing' });
        
        setIsLoading(true);
        try {
            let url: string;
            
            // Use different API endpoints based on user role
            if (isManager && teamId) {
                // For managers (Regional Manager/AVP), use team + date range API
                const formattedStartDate = format(new Date(filters.startDate), 'yyyy-MM-dd');
                const formattedEndDate = format(new Date(filters.endDate), 'yyyy-MM-dd');
                url = `/api/proxy/task/getByTeamAndDate?id=${teamId}&start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Using MANAGER API (team+date):', url, 'Team ID:', teamId);
            } else {
                // For admins, use date-based API
            const formattedStartDate = format(new Date(filters.startDate), 'yyyy-MM-dd');
            const formattedEndDate = format(new Date(filters.endDate), 'yyyy-MM-dd');
                url = `/api/proxy/task/getByDate?start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Using ADMIN API:', url, 'User Role:', userRole);
            }

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`API request failed: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Ensure data is an array
            const tasksArray = Array.isArray(data) ? data : [];
            
            const filteredTasks = tasksArray
                .filter((task: Record<string, unknown>) => task.taskType === 'complaint')
                .map((task: Record<string, unknown>) => {
                    const desc = task.taskDesciption || task.taskDescription || '';
                    const title = (task.taskTitle && String(task.taskTitle).trim()) || (desc ? String(desc) : 'Complaint');
                    const district =
                        (typeof task.storeDistrict === 'string' && task.storeDistrict.trim()) ? String(task.storeDistrict).trim() :
                        (typeof task.district === 'string' && task.district.trim()) ? String(task.district).trim() :
                        '';
                    return {
                        ...task,
                        taskTitle: title, // Ensure a meaningful title for display
                        taskDescription: desc, // Normalize description field
                        assignedToName: task.assignedToName || 'Unknown',
                        storeDistrict: district,
                    } as Task;
                })
                .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

            setTasks(filteredTasks);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setIsLoading(false);
        }
    }, [filters, token, userRole, userData, isManager, teamId]);

    const fetchEmployees = useCallback(async () => {
        if (!token) return;
        
        try {
            const response = await fetch('/api/proxy/employee/getAllFieldOfficers', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch field officers: ${response.status}`);
            }

            const data = await response.json();
            const sortedEmployees = sortBy(data, (emp: { firstName: string; lastName: string }) => `${emp.firstName} ${emp.lastName}`);
            setAllEmployees(sortedEmployees);
        } catch (error) {
            console.error('Error fetching field officers:', error);
        }
    }, [token]);

    const fetchStores = useCallback(async (employeeId?: number, searchTerm: string = '', page: number = 0, size: number = 50, sortBy: string = 'storeName', sortOrder: string = 'asc') => {
        if (!token || !employeeId) return;
        
        setIsStoresLoading(true);
        try {
            const url = `/api/proxy/store/getStoreNamesByEmployee?employeeId=${employeeId}&searchTerm=${searchTerm}&page=${page}&size=${size}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
            
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setStores(data.content || []);
        } catch (error) {
            console.error('Error fetching stores:', error);
        } finally {
            setIsStoresLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!initializedFromQuery) return;
        fetchTasks();
    }, [fetchTasks, teamId, initializedFromQuery]);

    // Initialize filters from query params (to support returning from customer detail)
    useEffect(() => {
        if (initializedFromQuery) return;
        const sp = searchParams;
        if (!sp) return;
        const start = sp.get('start');
        const end = sp.get('end');
        const employee = sp.get('employee');
        const priority = sp.get('priority');
        const status = sp.get('status');
        const search = sp.get('search');
        const districtParam = sp.get('district');
        const page = sp.get('page');
        if (start || end || employee || priority || status || search || districtParam || page) {
            setFilters(prev => ({
                ...prev,
                startDate: start || prev.startDate,
                endDate: end || prev.endDate,
                employee: employee ?? prev.employee,
                priority: priority ?? prev.priority,
                status: status ?? prev.status,
                district: districtParam ?? prev.district,
                search: search ?? prev.search,
            }));
            if (page) {
                const p = parseInt(page, 10);
                if (!Number.isNaN(p) && p >= 1) setCurrentPage(p);
            }
        }
        setInitializedFromQuery(true);
    }, [searchParams, initializedFromQuery]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Get employees for assignment dropdown based on user role
    const assignmentEmployees = isManager && teamMembers.length > 0 ? teamMembers : allEmployees;

    // Remove automatic store fetching - now only fetches when dropdown is clicked

    useEffect(() => {
        if (tasks.length > 0) {
            const uniqueEmployees = uniqBy(tasks.map(task => ({
                id: task.assignedToId,
                name: task.assignedToName
            })), 'id');
            const sortedEmployees = sortBy(uniqueEmployees, 'name');
            setFilterEmployees(sortedEmployees);

            const districtSet = new Set<string>();
            tasks.forEach((task) => {
                if (task.storeDistrict) {
                    districtSet.add(task.storeDistrict);
                }
            });
            const districtList = Array.from(districtSet).sort((a, b) => a.localeCompare(b));
            setFilterDistricts(districtList);
            if (filters.district !== 'all' && !districtList.includes(filters.district)) {
                setFilters((prev) => ({
                    ...prev,
                    district: 'all',
                }));
            }
        } else {
            setFilterDistricts([]);
            if (filters.district !== 'all') {
                setFilters((prev) => ({
                    ...prev,
                    district: 'all',
                }));
            }
        }
    }, [tasks, filters.district]);

    useEffect(() => {
        applyFilters();
    }, [tasks, filters]);

    // Ensure current page is within bounds when filteredTasks changes
    useEffect(() => {
        const total = Math.max(1, Math.ceil(filteredTasks.length / 10));
        if (currentPage > total) {
            setCurrentPage(total);
        } else if (currentPage < 1) {
            setCurrentPage(1);
        }
    }, [filteredTasks, currentPage]);

    const applyFilters = () => {
        const searchLower = filters.search.toLowerCase();
        const filtered = tasks
            .filter(
                (task) =>
                    task.taskType === 'complaint' &&
                    (
                        (task.taskTitle?.toLowerCase() || '').includes(searchLower) ||
                        (task.taskDescription?.toLowerCase() || '').includes(searchLower) ||
                        (task.storeName?.toLowerCase() || '').includes(searchLower) ||
                        (task.assignedToName?.toLowerCase() || '').includes(searchLower)
                    ) &&
                    (filters.employee === '' || filters.employee === 'all' ? true : task.assignedToId === parseInt(filters.employee)) &&
                    (filters.priority === '' || filters.priority === 'all' ? true : task.priority === filters.priority) &&
                    ((filters.status === '' || filters.status === 'all') ? true : task.status === filters.status) &&
                    (
                        filters.district === 'all' ||
                        (task.storeDistrict ? task.storeDistrict.toLowerCase() : '') === filters.district.toLowerCase()
                    ) &&
                    // Apply date filters for all users
                    (filters.startDate === '' || new Date(task.dueDate) >= new Date(filters.startDate)) &&
                    (filters.endDate === '' || new Date(task.dueDate) <= new Date(filters.endDate))
            );

        setFilteredTasks(filtered);
    };

    const [isCreating, setIsCreating] = useState(false);
    const createTask = async () => {
        if (!token) return;

        // Basic validation
        const missing: string[] = [];
        if (!newTask.taskDescription?.trim()) missing.push('Description');
        if (!newTask.dueDate) missing.push('Due Date');
        if (!newTask.assignedToId) missing.push('Assigned To');
        if (!newTask.storeId) missing.push('Store');
        if (missing.length) {
            setErrorMessage(`Please provide: ${missing.join(', ')}`);
            return;
        }

        setIsCreating(true);
        try {
            // Resolve assignedById robustly
            const localEmpIdRaw = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
            const localEmpId = localEmpIdRaw ? parseInt(localEmpIdRaw, 10) : NaN;
            const assignedById = !Number.isNaN(localEmpId)
                ? localEmpId
                : (typeof userData?.employeeId === 'number' && userData.employeeId ? userData.employeeId
                    : (newTask.assignedToId || newTask.assignedById));
            const due = newTask.dueDate.includes('T') ? newTask.dueDate.split('T')[0] : newTask.dueDate;

            const apiPayload = {
                taskDesciption: newTask.taskDescription?.trim() || '',
                dueDate: due,
                assignedToId: Number(newTask.assignedToId),
                assignedById: Number(assignedById),
                storeId: Number(newTask.storeId),
                taskType: 'complaint',
                status: newTask.status || 'Assigned',
                priority: newTask.priority || 'low',
            };

            const response = await fetch('/api/proxy/task/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(apiPayload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Failed to create complaint:', response.status, errorText);
                setErrorMessage(errorText || 'Failed to create complaint');
                return;
            }

            // Refresh list reliably from server
            await fetchTasks();

            // Reset form and close modal
            setNewTask({
                id: 0,
                taskTitle: '',
                taskDescription: '',
                dueDate: '',
                assignedToId: 0,
                assignedToName: '',
                assignedById: assignedById,
                status: 'Assigned',
                priority: 'low',
                category: 'Complaint',
                storeId: 0,
                storeName: '',
                storeCity: '',
                taskType: 'complaint',
                imageCount: 0
            });
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error creating task:', error);
            setErrorMessage('Unexpected error while creating complaint');
        } finally {
            setIsCreating(false);
        }
    };

    const updateTaskStatus = async (taskId: number, newStatus: string) => {
        if (!token) return;
        
        try {
            const response = await fetch(
                `/api/proxy/task/updateTask?taskId=${taskId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ status: newStatus }),
                }
            );

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.map((task) =>
                        task.id === taskId ? { ...task, status: newStatus } : task
                    )
                );
            } else {
                console.error('Failed to update task status');
            }
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const deleteTask = async (taskId: number) => {
        if (!token) return;
        
        try {
            await fetch(`/api/proxy/task/deleteById?taskId=${taskId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            fetchTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prevFilters) => ({
            ...prevFilters,
            [key]: value,
        }));
        applyFilters();
    };

    const getStatusInfo = (status: string): { icon: React.ReactNode; color: string } => {
        switch (status.toLowerCase()) {
            case 'assigned':
                return { icon: <Clock className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' };
            case 'work in progress':
                return { icon: <Loader className="w-4 h-4 animate-spin" />, color: 'bg-blue-100 text-blue-800' };
            case 'complete':
                return { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-800' };
            default:
                return { icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-gray-100 text-gray-800' };
        }
    };

    const fetchTaskImages = async (taskId: number) => {
        setIsLoadingImages(true);
        try {
            // First, fetch the task details
            const taskResponse = await fetch(`/api/proxy/task/getById?id=${taskId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!taskResponse.ok) {
                throw new Error('Failed to fetch task details');
            }
            const taskData = await taskResponse.json();
    
            // Extract fileDownloadUri from the attachmentResponse
            const imageUrls = taskData.attachmentResponse
                .filter((attachment: AttachmentResponse) => attachment.tag === 'check-in')
                .map((attachment: AttachmentResponse) => {
                    try {
                        // Use the correct backend endpoint pattern: /task/downloadFile/{taskId}/{tag}/{fileName}
                        return `/api/proxy/task/downloadFile/${taskId}/${attachment.tag}/${attachment.fileName}`;
                    } catch {
                        // Fallback: use fileName to construct URL
                        return `/api/proxy/task/downloadFile/${taskId}/${attachment.tag}/${attachment.fileName}`;
                    }
                });
    
            setTaskImages(imageUrls);
            setIsImagePreviewOpen(true);
        } catch (error) {
            console.error('Error fetching task images:', error);
        } finally {
            setIsLoadingImages(false);
        }
  };

  return (
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Search and Actions Row */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex-1 max-w-md flex items-center gap-2">
                    <Input
                        placeholder="Search complaints"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={() => setIsModalOpen(true)}
                        size="sm"
                        className="text-sm"
                    >
                        <PlusCircle className="w-4 h-4 mr-1" /> New
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="lg:hidden text-sm"
                        onClick={() => setIsFilterDrawerOpen(true)}
                    >
                        <Filter className="w-4 h-4 mr-1" />
                        Filters
                    </Button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="mb-6 hidden lg:flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                    <Select value={filters.employee} onValueChange={(value) => handleFilterChange('employee', value)}>
                        <SelectTrigger className="w-[180px] text-sm bg-background border-border">
                            <SelectValue placeholder="Filter by employee" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Employees</SelectItem>
                            {filterEmployees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id.toString()}>
                                    {employee.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                        <SelectTrigger className="w-[160px] text-sm bg-background border-border">
                            <SelectValue placeholder="Filter by priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                    </Select>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger className="w-[160px] text-sm bg-background border-border">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Assigned">Assigned</SelectItem>
                        <SelectItem value="Work In Progress">Work In Progress</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.district} onValueChange={(value) => handleFilterChange('district', value)}>
                    <SelectTrigger className="w-[180px] text-sm bg-background border-border">
                        <SelectValue placeholder="Filter by district" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {filterDistricts.map((district) => (
                            <SelectItem key={district} value={district}>
                                {district}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
                {/* Date Filters */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="startDate" className="text-sm text-muted-foreground">From:</Label>
                        <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`w-[130px] justify-start text-left font-normal text-sm bg-background border-border ${!filters.startDate && 'text-muted-foreground'}`}
                                >
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {filters.startDate ? format(new Date(filters.startDate + 'T00:00:00'), 'MMM d, yyyy') : <span>Start date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : undefined}
                                    onSelect={(date) => {
                                        if (date) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            handleDateChange('startDate', `${year}-${month}-${day}`);
                                            setIsStartDatePickerOpen(false);
                                        } else {
                                            handleDateChange('startDate', '');
                                        }
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="endDate" className="text-sm text-muted-foreground">To:</Label>
                        <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={`w-[130px] justify-start text-left font-normal text-sm bg-background border-border ${!filters.endDate && 'text-muted-foreground'}`}
                                >
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {filters.endDate ? format(new Date(filters.endDate + 'T00:00:00'), 'MMM d, yyyy') : <span>End date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : undefined}
                                    onSelect={(date) => {
                                        if (date) {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            handleDateChange('endDate', `${year}-${month}-${day}`);
                                            setIsEndDatePickerOpen(false);
                                        } else {
                                            handleDateChange('endDate', '');
                                        }
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            {/* Mobile Filters Sheet */}
            <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle className="text-base font-medium">Complaint Filters</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="filterSearch" className="text-sm">Search</Label>
                            <Input
                                id="filterSearch"
                                placeholder="Search complaints"
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="text-sm"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">Employee</Label>
                            <Select value={filters.employee} onValueChange={(value) => handleFilterChange('employee', value)}>
                                <SelectTrigger className="w-full text-sm bg-background border-border">
                                    <SelectValue placeholder="Filter by employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Employees</SelectItem>
                                    {filterEmployees.map((employee) => (
                                        <SelectItem key={employee.id} value={employee.id.toString()}>
                                            {employee.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">Priority</Label>
                            <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                                <SelectTrigger className="w-full text-sm bg-background border-border">
                                    <SelectValue placeholder="Filter by priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priorities</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">Status</Label>
                            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                                <SelectTrigger className="w-full bg-background border-border">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Open Statuses</SelectItem>
                                    <SelectItem value="Assigned">Assigned</SelectItem>
                                    <SelectItem value="Work In Progress">Work In Progress</SelectItem>
                                    <SelectItem value="Complete">Complete</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">District</Label>
                            <Select value={filters.district} onValueChange={(value) => handleFilterChange('district', value)}>
                                <SelectTrigger className="w-full bg-background border-border">
                                    <SelectValue placeholder="Filter by district" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Districts</SelectItem>
                                    {filterDistricts.map((district) => (
                                        <SelectItem key={district} value={district}>
                                            {district}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>From</Label>
                                <Popover open={isMobileStartDatePickerOpen} onOpenChange={setIsMobileStartDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`w-full justify-start text-left font-normal ${!filters.startDate && 'text-muted-foreground'}`}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.startDate ? format(new Date(filters.startDate + 'T00:00:00'), 'MMM d, yyyy') : <span>Pick start date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={filters.startDate ? new Date(filters.startDate + 'T00:00:00') : undefined}
                                            onSelect={(date) => {
                                                if (date) {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    handleDateChange('startDate', `${year}-${month}-${day}`);
                                                    setIsMobileStartDatePickerOpen(false);
                                                } else {
                                                    handleDateChange('startDate', '');
                                                }
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="grid gap-2">
                                <Label>To</Label>
                                <Popover open={isMobileEndDatePickerOpen} onOpenChange={setIsMobileEndDatePickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`w-full justify-start text-left font-normal ${!filters.endDate && 'text-muted-foreground'}`}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.endDate ? format(new Date(filters.endDate + 'T00:00:00'), 'MMM d, yyyy') : <span>Pick end date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={filters.endDate ? new Date(filters.endDate + 'T00:00:00') : undefined}
                                            onSelect={(date) => {
                                                if (date) {
                                                    const year = date.getFullYear();
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    handleDateChange('endDate', `${year}-${month}-${day}`);
                                                    setIsMobileEndDatePickerOpen(false);
                                                } else {
                                                    handleDateChange('endDate', '');
                                                }
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                    <SheetFooter className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                const today = format(new Date(), 'yyyy-MM-dd');
                                setFilters({
                                    search: '',
                                    employee: '',
                                    priority: '',
                                    status: '',
                                    district: 'all',
                                    startDate: today,
                                    endDate: today,
                                });
                            }}
                        >
                            Clear All
                        </Button>
                        <Button onClick={() => setIsFilterDrawerOpen(false)}>Apply Filters</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Complaint</DialogTitle>
                        <DialogDescription>Fill in the details to create a new complaint.</DialogDescription>
                    </DialogHeader>
                    <Tabs value={activeTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="general" disabled={activeTab === 'details'}>General</TabsTrigger>
                            <TabsTrigger value="details" disabled={activeTab === 'general'}>Details</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="taskTitle">Complaint Title</Label>
                                    <Input
                                        id="taskTitle"
                                        placeholder="Enter complaint title"
                                        value={newTask.taskTitle}
                                        onChange={(e) => setNewTask({ ...newTask, taskTitle: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="taskDescription">Complaint Description</Label>
                                    <Input
                                        id="taskDescription"
                                        placeholder="Enter complaint description"
                                        value={newTask.taskDescription}
                                        onChange={(e) => setNewTask({ ...newTask, taskDescription: e.target.value })}
                                    />
          </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={newTask.category} onValueChange={(value) => setNewTask({ ...newTask, category: value })}>
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                                            <SelectItem value="Complaint">Complaint</SelectItem>
              </SelectContent>
            </Select>
          </div>
                                <div className="flex justify-between mt-4">
                                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                    <Button onClick={handleNext} disabled={isTabLoading}>
                                        {isTabLoading ? (
                                            <>
                                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            'Next'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="details">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="dueDate">Due Date</Label>
                                    <Popover open={isDueDatePickerOpen} onOpenChange={setIsDueDatePickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={`w-[280px] justify-start text-left font-normal ${!newTask.dueDate && 'text-muted-foreground'}`}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {newTask.dueDate ? format(new Date(newTask.dueDate + 'T00:00:00'), 'PPP') : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={newTask.dueDate ? new Date(newTask.dueDate + 'T00:00:00') : undefined}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        const year = date.getFullYear();
                                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                                        const day = String(date.getDate()).padStart(2, '0');
                                                        setNewTask({ ...newTask, dueDate: `${year}-${month}-${day}` });
                                                        setIsDueDatePickerOpen(false);
                                                    } else {
                                                        setNewTask({ ...newTask, dueDate: '' });
                                                    }
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="assignedToId">
                                        Assigned To {isManager && teamMembers.length > 0 && <span className="text-xs text-muted-foreground">(Team Members Only)</span>}
                                    </Label>
                                    <SearchableSelect<Employee>
                                        options={assignmentEmployees.map((employee) => ({
                                            value: employee.id.toString(),
                                            label: `${employee.firstName} ${employee.lastName}`.trim(),
                                            data: employee,
                                        }))}
                                        value={newTask.assignedToId ? newTask.assignedToId.toString() : undefined}
                                        onSelect={(option) => {
                                            if (!option) {
                                                setNewTask({
                                                    ...newTask,
                                                    assignedToId: 0,
                                                    assignedToName: '',
                                                    storeId: 0,
                                                    storeName: ''
                                                });
                                                setStores([]);
                                                return;
                                            }

                                            const selectedEmployee = option.data ?? assignmentEmployees.find(emp => emp.id === parseInt(option.value, 10));
                                            if (!selectedEmployee) {
                                                return;
                                            }

                                            setNewTask({
                                                ...newTask,
                                                assignedToId: parseInt(option.value, 10),
                                                assignedToName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim(),
                                                storeId: 0,
                                                storeName: ''
                                            });
                                            setStores([]);
                                        }}
                                        placeholder={
                                            assignmentEmployees.length === 0
                                                ? (isManager ? "No team members available" : "No employees available")
                                                : "Select an employee"
                                        }
                                        emptyMessage={isManager ? "No team members available" : "No employees available"}
                                        noResultsMessage="No employees match your search"
                                        searchPlaceholder="Search employees..."
                                        disabled={assignmentEmployees.length === 0}
                                        allowClear={newTask.assignedToId > 0}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Select a priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="storeId">Store</Label>
                                    <SearchableSelect<Store>
                                        options={stores.map((store) => ({
                                            value: store.id.toString(),
                                            label: (store.storeCity || store.city)
                                                ? `${store.storeName} (${store.storeCity || store.city})`
                                                : store.storeName,
                                            data: store,
                                        }))}
                                        value={newTask.storeId ? newTask.storeId.toString() : undefined}
                                        onSelect={(option) => {
                                            if (!option) {
                                                setNewTask({
                                                    ...newTask,
                                                    storeId: 0,
                                                    storeName: ''
                                                });
                                                return;
                                            }

                                            const selectedStore = option.data ?? stores.find(store => store.id === parseInt(option.value, 10));
                                            if (!selectedStore) {
                                                return;
                                            }

                                            setNewTask({
                                                ...newTask,
                                                storeId: parseInt(option.value, 10),
                                                storeName: selectedStore.storeName
                                            });
                                        }}
                                        placeholder={
                                            !newTask.assignedToId
                                                ? "Select employee first"
                                                : stores.length === 0
                                                ? "Search stores..."
                                                : "Select a store"
                                        }
                                        emptyMessage="No stores available for this employee"
                                        noResultsMessage="No stores match your search"
                                        searchPlaceholder="Search stores..."
                                        disabled={!newTask.assignedToId}
                                        allowClear={newTask.storeId > 0}
                                        loading={isStoresLoading}
                                        loadingMessage="Loading stores..."
                                        onOpenChange={(open) => {
                                            if (open && !isStoresLoading && newTask.assignedToId && stores.length === 0) {
                                                fetchStores(newTask.assignedToId);
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between mt-4">
                                    <Button variant="outline" onClick={handleBack}>Back</Button>
                                    <Button onClick={createTask} disabled={isCreating}>
                                        {isCreating ? (
                                            <>
                                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            'Create Complaint'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-10">
                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold">No complaints found.</p>
                    <p className="text-gray-500 mt-2">Try adjusting your filters or create a new complaint.</p>
                </div>
            ) : (
                <div className="flex flex-wrap -mx-2">
                    {filteredTasks
                        .slice((currentPage - 1) * 10, currentPage * 10)
                        .map((task, index) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                className="w-full sm:w-1/2 lg:w-1/3 p-2"
                            >
                                <Card className="h-full overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Badge className={`${getStatusInfo(task.status).color} px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1`}>
                                                    {getStatusInfo(task.status).icon} <span>{task.status}</span>
                                                </Badge>
                                                {Array.isArray((task as unknown as Record<string, unknown>).attachmentResponse) && ((task as unknown as Record<string, unknown>).attachmentResponse as unknown[]).length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => fetchTaskImages(task.id)}
                                                        title="View Images"
                                                    >
                                                        <ImageIcon className="h-4 w-4 text-blue-500" />
                                                    </Button>
                                                )}
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleViewStore(task.storeId)}>
                                                        <Building className="mr-2 h-4 w-4" /> View Store
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-red-600">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Complaint
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="text-base font-medium mt-2">{task.taskTitle || 'Untitled Complaint'}</CardTitle>
                                        <CardDescription className="flex items-center mt-1 text-sm text-muted-foreground">
                                            <Building className="w-3 h-3 mr-1" />
                                            {task.storeName}
                                        </CardDescription>
                                        {task.storeDistrict && (
                                            <CardDescription className="flex items-center mt-1 text-sm text-muted-foreground">
                                                <MapPin className="w-3 h-3 mr-1" />
                                                {task.storeDistrict}
                                            </CardDescription>
                                        )}
                                        {task.taskDescription && (
                                            <div className="mt-2">
                                                <div 
                                                    className="text-sm text-muted-foreground line-clamp-2 cursor-help"
                                                    title={task.taskDescription}
                                                >
                                                    {task.taskDescription}
                                                </div>
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent className="py-2">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3 h-3 text-indigo-500" />
                                                    <span className="text-xs text-muted-foreground">Assigned to</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Target className="w-3 h-3 text-purple-500" />
                                                    <span className="text-xs text-muted-foreground">Priority</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{task.assignedToName}</span>
                                                <span className="text-sm font-medium capitalize">{task.priority}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <CalendarIcon2 className="w-3 h-3" />
                                                <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-end items-center py-2">
                                        <Select
                                            value={task.status}
                                            onValueChange={(value) => updateTaskStatus(task.id, value)}
                                        >
                                            <SelectTrigger className="w-[160px] text-sm h-8 bg-background border-border">
                                                <SelectValue placeholder="Change status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Assigned">Assigned</SelectItem>
                                                <SelectItem value="Work In Progress">Work In Progress</SelectItem>
                                                <SelectItem value="Complete">Complete</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        ))}
                </div>
            )}

            <div className="mt-8 flex justify-center">
                <Pagination>
                    <PaginationContent>
                        {currentPage !== 1 && <PaginationPrevious size="sm" onClick={() => handlePageChange(currentPage - 1)} />}
                        {Array.from({ length: Math.ceil(filteredTasks.length / 10) }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                                <PaginationLink size="sm" isActive={page === currentPage} onClick={() => handlePageChange(page)}>
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        ))}
                        {currentPage !== Math.ceil(filteredTasks.length / 10) && <PaginationNext size="sm" onClick={() => handlePageChange(currentPage + 1)} />}
                    </PaginationContent>
                </Pagination>
            </div>

            {isImagePreviewOpen && (
                <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Image Preview</DialogTitle>
                        </DialogHeader>
                        {isLoadingImages ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                                <span className="ml-2">Loading images...</span>
          </div>
        ) : (
                            <>
                                <div className="relative">
                                    <img
                                        src={taskImages[currentImageIndex]}
                                        alt={`Image ${currentImageIndex + 1}`}
                                        className="w-full h-auto"
                                    />
                                    {taskImages.length > 1 && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="absolute left-2 top-1/2 transform -translate-y-1/2"
                                                onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? taskImages.length - 1 : prev - 1))}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                                onClick={() => setCurrentImageIndex((prev) => (prev === taskImages.length - 1 ? 0 : prev + 1))}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
          </div>
                                <p className="text-center mt-2">
                                    Image {currentImageIndex + 1} of {taskImages.length}
                                </p>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

function ComplaintsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <Complaints />
        </Suspense>
    );
}

export default ComplaintsPage;
