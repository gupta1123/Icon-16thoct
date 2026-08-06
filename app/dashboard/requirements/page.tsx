'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { format, subDays } from 'date-fns';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { CalendarIcon, MoreHorizontal, PlusCircle, Filter, Clock, User, Building, MapPin, AlertTriangle, CheckCircle, Loader, Target, Trash2, Calendar as CalendarIcon2, Image } from 'lucide-react';
import RequirementCreationForm from "@/components/RequirementCreationForm";
import SearchableSelect from "@/components/searchable-select";
import {
    RequirementPhotoUploadError,
    createRequirementWithPhotos,
    loadTaskImageUrls,
    revokeTaskImageUrls,
    type RequirementCreatePayload,
} from "@/lib/requirements";

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

const FILTER_SELECT_CONTENT_CLASS = "z-[70] min-w-[var(--radix-select-trigger-width)]";
const FILTER_SELECT_CONTENT_STYLE = { maxHeight: "18rem" };

const Requirements = () => {
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
        category: 'Requirement',
        storeId: 0,
        storeName: '',
        storeCity: '',
        storeDistrict: '',
        taskType: 'requirement'
    });
    const router = useRouter();
    const searchParams = useSearchParams();
    const [initializedFromQuery, setInitializedFromQuery] = useState(false);
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
    const [teamId, setTeamId] = useState<number | null>(null);
    const [isManager, setIsManager] = useState(false);
    const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
    const [isStoresLoading, setIsStoresLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
    const [isMobileStartDatePickerOpen, setIsMobileStartDatePickerOpen] = useState(false);
    const [isMobileEndDatePickerOpen, setIsMobileEndDatePickerOpen] = useState(false);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [taskImages, setTaskImages] = useState<string[]>([]);
    const [pendingRequirementUpload, setPendingRequirementUpload] = useState<{ taskId: number; nextPhotoIndex: number } | null>(null);

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
        setFilters(newFilters);
    };

    const handleViewStore = (storeId: number) => {
        const qp = new URLSearchParams({ from: 'requirements' });
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

    const handleViewFieldOfficer = (employeeId: number) => {
        router.push(`/dashboard/employees/${employeeId}`);
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
                url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/getByTeamAndDate?id=${teamId}&start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Using MANAGER API (team+date):', url, 'Team ID:', teamId);
            } else {
                // For admins, use date-based API
                const formattedStartDate = format(new Date(filters.startDate), 'yyyy-MM-dd');
                const formattedEndDate = format(new Date(filters.endDate), 'yyyy-MM-dd');
                url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/getByDate?start=${formattedStartDate}&end=${formattedEndDate}`;
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
                .filter((task: Record<string, unknown>) => {
                    // Include tasks where taskType is 'requirement' or where taskType is missing/null
                    // (assuming missing taskType means it's a requirement based on your data)
                    const taskType = task.taskType ? String(task.taskType).toLowerCase() : 'requirement';
                    return taskType === 'requirement';
                })
                .map((task: Record<string, unknown>) => {
                    const desc = task.taskDesciption || task.taskDescription || '';
                    const title = (task.taskTitle && String(task.taskTitle).trim()) || (desc ? String(desc) : 'Requirement');
                    
                    // Try to resolve assignedToName from multiple sources
                    let assignedToName = task.assignedToName;
                    
                    // If assignedToName is missing but we have assignedToId, try to find the employee
                    if (!assignedToName && task.assignedToId && allEmployees.length > 0) {
                        const employee = allEmployees.find((emp: Employee) => emp.id === Number(task.assignedToId));
                        if (employee) {
                            assignedToName = `${employee.firstName} ${employee.lastName}`.trim();
                        }
                    }
                    
                    // If still no name, check for other possible fields
                    if (!assignedToName) {
                        assignedToName = task.assignedTo || task.assignedToFirstName || task.assignedToLastName;
                        if (task.assignedToFirstName && task.assignedToLastName) {
                            assignedToName = `${task.assignedToFirstName} ${task.assignedToLastName}`.trim();
                        }
                    }
                    
                    // Debug logging for tasks with missing names
                    if (!assignedToName) {
                        console.warn('Task with missing assignedToName:', {
                            taskId: task.id,
                            assignedToId: task.assignedToId,
                            assignedToName: task.assignedToName,
                            assignedTo: task.assignedTo,
                            taskTitle: task.taskTitle
                        });
                    }
                    const district =
                        (typeof task.storeDistrict === 'string' && task.storeDistrict.trim()) ? String(task.storeDistrict).trim() :
                        (typeof task.district === 'string' && task.district.trim()) ? String(task.district).trim() :
                        '';
                    
                    return {
                        ...task,
                        taskTitle: title,
                        taskDescription: desc, // normalize
                        assignedToName: assignedToName || 'Unknown',
                        taskType: task.taskType || 'requirement', // normalize missing taskType
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
            const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/employee/getAllFieldOfficers', {
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

    const fetchStores = useCallback(async (
        employeeId?: number,
        searchTerm: string = '',
        page: number = 0,
        size: number = 50,
        sortBy: string = 'storeName',
        sortOrder: string = 'asc'
    ) => {
        if (!token || !employeeId) return;
        
        setIsStoresLoading(true);
        try {
            const url = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/store/getStoreNamesByEmployee?employeeId=${employeeId}&searchTerm=${searchTerm}&page=${page}&size=${size}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
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

    // Initialize filters from query params (to support coming back from customer detail)
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

    // Do not auto-fetch stores; fetch when dropdown opens after selecting employee

    useEffect(() => {
        if (tasks.length > 0) {
            const uniqueEmployees = uniqBy(
                tasks
                    .filter(task => task.assignedToId != null && task.assignedToId !== 0) // Filter out null/undefined/zero IDs
                    .map(task => ({
                        id: task.assignedToId,
                        name: task.assignedToName || 'Unknown Employee'
                    })),
                'id'
            );
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
                    task.taskType === 'requirement' &&
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
                    // Apply date filters for all roles
                    (
                        (filters.startDate === '' || new Date(task.dueDate) >= new Date(filters.startDate)) &&
                        (filters.endDate === '' || new Date(task.dueDate) <= new Date(filters.endDate))
                    )
            );

        setFilteredTasks(filtered);
    };

    const createTask = async (photos: File[] = []) => {
        if (!token) return;
        
        // Validate required fields similar to Complaints fix
        const missing: string[] = [];
        if (!newTask.taskTitle?.trim()) missing.push('Title');
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
            // Resolve assignedById robustly (localStorage -> userData -> fallback)
            const localEmpIdRaw = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
            const localEmpId = localEmpIdRaw ? parseInt(localEmpIdRaw, 10) : NaN;
            const assignedById = !Number.isNaN(localEmpId)
                ? localEmpId
                : (typeof userData?.employeeId === 'number' && userData.employeeId ? userData.employeeId : (newTask.assignedToId || newTask.assignedById));

            const due = newTask.dueDate.includes('T') ? newTask.dueDate.split('T')[0] : newTask.dueDate;

            const apiPayload: RequirementCreatePayload = {
                taskTitle: newTask.taskTitle?.trim() || '',
                taskDesciption: newTask.taskDescription?.trim() || '',
                dueDate: due,
                assignedToId: Number(newTask.assignedToId),
                assignedById: Number(assignedById),
                storeId: Number(newTask.storeId),
                taskType: 'requirement',
                status: newTask.status || 'Assigned',
                priority: newTask.priority || 'low',
            };

            await createRequirementWithPhotos({
                token,
                payload: apiPayload,
                photos,
                taskId: pendingRequirementUpload?.taskId,
                startPhotoIndex: pendingRequirementUpload?.nextPhotoIndex ?? 0,
            });

            // Refresh list from server
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
                category: 'Requirement',
                storeId: 0,
                storeName: '',
                storeCity: '',
                taskType: 'requirement'
            });
            setIsModalOpen(false);
            setPendingRequirementUpload(null);
        } catch (error) {
            console.error('Error creating requirement:', error);
            if (error instanceof RequirementPhotoUploadError) {
                setPendingRequirementUpload({
                    taskId: error.taskId,
                    nextPhotoIndex: error.nextPhotoIndex,
                });
            }
            setErrorMessage(error instanceof Error ? error.message : 'Unexpected error while creating requirement');
        } finally {
            setIsCreating(false);
        }
    };

    const updateTaskStatus = async (taskId: number, newStatus: string) => {
        if (!token) return;
        
        try {
            const response = await fetch(
                `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/updateTask?taskId=${taskId}`,
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

    const updateTaskPriority = async (taskId: number, newPriority: string) => {
        if (!token) return;
        
        try {
            const response = await fetch(
                `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/updateTask?taskId=${taskId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ priority: newPriority }),
                }
            );

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.map((task) =>
                        task.id === taskId ? { ...task, priority: newPriority } : task
                    )
                );
            } else {
                console.error('Failed to update task priority');
            }
        } catch (error) {
            console.error('Error updating task priority:', error);
        }
    };

    const getPriorityBadgeStyle = (priority?: string): string => {
        switch ((priority || '').toLowerCase()) {
            case 'high':
                return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30';
            case 'medium':
                return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30';
            case 'low':
            default:
                return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
        }
    };

    const deleteTask = async (taskId: number) => {
        if (!token) return;
        
        try {
            await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/deleteById?taskId=${taskId}`, {
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

    const fetchTaskImages = async (taskId: number) => {
        if (!token) return;
        
        setIsLoadingImages(true);
        try {
            // First, fetch the task details
            const taskResponse = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/getById?id=${taskId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!taskResponse.ok) {
                throw new Error('Failed to fetch task details');
            }
            const taskData = await taskResponse.json();
            const imageUrls = await loadTaskImageUrls({
                token,
                taskId,
                attachmentResponse: taskData.attachmentResponse,
            });

            setTaskImages((previous) => {
                revokeTaskImageUrls(previous);
                return imageUrls;
            });
            setIsImagePreviewOpen(true);
        } catch (error) {
            console.error('Error fetching task images:', error);
        } finally {
            setIsLoadingImages(false);
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

  return (
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Search and Actions Row */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex-1 max-w-md flex items-center gap-2">
                    <Input
                        placeholder="Search requirements"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={() => {
                            setErrorMessage(null);
                            setPendingRequirementUpload(null);
                            setIsModalOpen(true);
                        }}
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
                    <SearchableSelect
                        value={filters.employee}
                        options={[
                            { value: 'all', label: 'All Employees' },
                            ...filterEmployees
                                .filter((employee) => employee.id != null && employee.id !== 0)
                                .map((employee) => ({
                                    value: String(employee.id),
                                    label: employee.name || 'Unknown Employee',
                                })),
                        ]}
                        onSelect={(option) => option && handleFilterChange('employee', option.value)}
                        placeholder="Filter by employee"
                        searchPlaceholder="Search employees..."
                        noResultsMessage="No employees found"
                        triggerClassName="w-[180px] text-sm bg-background border-border font-normal"
                        contentClassName="z-[70]"
                    />
                    <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                        <SelectTrigger className="w-[160px] text-sm bg-background border-border">
                            <SelectValue placeholder="Filter by priority" />
                        </SelectTrigger>
                        <SelectContent sideOffset={6} className={FILTER_SELECT_CONTENT_CLASS} style={FILTER_SELECT_CONTENT_STYLE}>
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
                        <SelectContent sideOffset={6} className={FILTER_SELECT_CONTENT_CLASS} style={FILTER_SELECT_CONTENT_STYLE}>
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
                        <SelectContent sideOffset={6} className={FILTER_SELECT_CONTENT_CLASS} style={FILTER_SELECT_CONTENT_STYLE}>
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
                    {/* Show date filters for all roles (including managers/AVP) */}
                        <>
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
                        </>
                </div>
            </div>

            {/* Mobile Filters Sheet */}
            <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle className="text-base font-medium">Requirement Filters</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="filterSearch" className="text-sm">Search</Label>
                            <Input
                                id="filterSearch"
                                placeholder="Search requirements"
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="text-sm"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">Employee</Label>
                            <SearchableSelect
                                value={filters.employee}
                                options={[
                                    { value: 'all', label: 'All Employees' },
                                    ...filterEmployees
                                        .filter((employee) => employee.id != null && employee.id !== 0)
                                        .map((employee) => ({
                                            value: String(employee.id),
                                            label: employee.name || 'Unknown Employee',
                                        })),
                                ]}
                                onSelect={(option) => option && handleFilterChange('employee', option.value)}
                                placeholder="Filter by employee"
                                searchPlaceholder="Search employees..."
                                noResultsMessage="No employees found"
                                triggerClassName="w-full text-sm bg-background border-border font-normal"
                                contentClassName="z-[70]"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm">Priority</Label>
                            <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                                <SelectTrigger className="w-full text-sm bg-background border-border">
                                    <SelectValue placeholder="Filter by priority" />
                                </SelectTrigger>
                                <SelectContent sideOffset={6} className={FILTER_SELECT_CONTENT_CLASS} style={FILTER_SELECT_CONTENT_STYLE}>
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
                                <SelectContent sideOffset={6} className={FILTER_SELECT_CONTENT_CLASS} style={FILTER_SELECT_CONTENT_STYLE}>
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
                                <SelectContent sideOffset={6} className={FILTER_SELECT_CONTENT_CLASS} style={FILTER_SELECT_CONTENT_STYLE}>
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

            <Dialog
                open={isModalOpen}
                onOpenChange={(open) => {
                    if (!isCreating) {
                        setIsModalOpen(open);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Requirement</DialogTitle>
                        <DialogDescription>Fill in the details to create a new requirement.</DialogDescription>
                    </DialogHeader>
                    <RequirementCreationForm
                        value={{
                            ...newTask,
                            taskType: 'requirement',
                        }}
                        onChange={(nextTask) => {
                            setNewTask((prev) => ({ ...prev, ...nextTask }));
                            if (nextTask.assignedToId !== newTask.assignedToId) {
                                setStores([]);
                            }
                        }}
                        employees={assignmentEmployees}
                        stores={stores}
                        storeMode="select"
                        isStoresLoading={isStoresLoading}
                        isSubmitting={isCreating}
                        error={errorMessage}
                        employeeHint={isManager && teamMembers.length > 0 ? <span className="text-xs text-muted-foreground">(Team Members Only)</span> : null}
                        onStoreOpenChange={(open) => {
                            if (open && !isStoresLoading && newTask.assignedToId && stores.length === 0) {
                                fetchStores(newTask.assignedToId);
                            }
                        }}
                        onCancel={() => setIsModalOpen(false)}
                        onSubmit={createTask}
                    />
                </DialogContent>
            </Dialog>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="text-center py-10">
                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold">No requirements found.</p>
                    <p className="text-gray-500 mt-2">Try adjusting your filters or create a new requirement.</p>
          </div>
        ) : (
                <div className="flex flex-wrap -mx-2">
                    {filteredTasks
                        .slice((currentPage - 1) * 10, currentPage * 10)
                        .map((task, index) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                className="w-full sm:w-1/2 lg:w-1/3 p-2"
                            >
                                <Card className="h-full border border-border/60 hover:border-primary/30 transition-all shadow-sm rounded-xl overflow-hidden py-0 gap-0 flex flex-col justify-between bg-card">
                                    <CardContent className="p-4 space-y-3">
                                        {/* Top Row: Title / Description & Action Menu */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                                                    {task.taskTitle || task.taskDescription || 'Requirement'}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap pt-0.5">
                                                    <span className="flex items-center gap-1 font-medium text-foreground/80">
                                                        <Building className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                                                        <span className="truncate max-w-[150px]">{task.storeName}</span>
                                                    </span>
                                                    {task.storeDistrict && (
                                                        <span className="flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-md font-medium text-muted-foreground">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            <span>{task.storeDistrict}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                {Array.isArray((task as unknown as Record<string, unknown>).attachmentResponse) && ((task as unknown as Record<string, unknown>).attachmentResponse as unknown[]).length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg shrink-0"
                                                        onClick={() => fetchTaskImages(task.id)}
                                                        title="View Images"
                                                    >
                                                        <Image className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg shrink-0">
                                                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="rounded-xl">
                                                        <DropdownMenuItem onClick={() => handleViewStore(task.storeId)}>
                                                            <Building className="mr-2 h-3.5 w-3.5" /> View Store
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleViewFieldOfficer(task.assignedToId)}>
                                                            <User className="mr-2 h-3.5 w-3.5" /> View Field Officer
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-rose-600">
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Requirement
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        {/* Metadata Block: Assignee & Due Date */}
                                        <div className="bg-muted/40 p-2.5 rounded-lg border border-border/40 text-xs flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex items-center gap-1.5 truncate">
                                                <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                <span className="text-muted-foreground text-[11px] shrink-0">Assigned:</span>
                                                <span className="font-semibold text-foreground text-xs truncate">{task.assignedToName}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                                                <CalendarIcon2 className="w-3 h-3 shrink-0" />
                                                <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                                            </div>
                                        </div>

                                        {/* Dual Editable Controls: Priority & Status */}
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            {/* Priority Selector */}
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Priority</span>
                                                <Select
                                                    value={task.priority?.toLowerCase() || 'low'}
                                                    onValueChange={(value) => updateTaskPriority(task.id, value)}
                                                >
                                                    <SelectTrigger className={`w-full h-7 text-xs font-semibold rounded-lg border-0 px-2.5 ${getPriorityBadgeStyle(task.priority)}`}>
                                                        <SelectValue placeholder="Priority" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="low" className="text-xs font-medium text-emerald-600">Low</SelectItem>
                                                        <SelectItem value="medium" className="text-xs font-medium text-amber-600">Medium</SelectItem>
                                                        <SelectItem value="high" className="text-xs font-medium text-rose-600">High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Status Selector */}
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Status</span>
                                                <Select
                                                    value={task.status}
                                                    onValueChange={(value) => updateTaskStatus(task.id, value)}
                                                >
                                                    <SelectTrigger className={`w-full h-7 text-xs font-semibold rounded-lg border-0 px-2.5 ${getStatusInfo(task.status).color}`}>
                                                        <SelectValue placeholder="Status" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="Assigned" className="text-xs font-medium">Assigned</SelectItem>
                                                        <SelectItem value="Work In Progress" className="text-xs font-medium">Work In Progress</SelectItem>
                                                        <SelectItem value="Complete" className="text-xs font-medium">Complete</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
          </div>
        )}

            {filteredTasks.length > 0 && (
                <div className="mt-8 pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground font-medium">
                        Showing <span className="font-semibold text-foreground">{Math.min((currentPage - 1) * 10 + 1, filteredTasks.length)}</span> to <span className="font-semibold text-foreground">{Math.min(currentPage * 10, filteredTasks.length)}</span> of <span className="font-semibold text-foreground">{filteredTasks.length}</span> entries
                    </p>

                    {Math.ceil(filteredTasks.length / 10) > 1 && (
                        <Pagination className="w-auto mx-0">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                                        className={currentPage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                                {Array.from({ length: Math.ceil(filteredTasks.length / 10) }, (_, i) => i + 1).map((page) => (
                                    <PaginationItem key={page}>
                                        <PaginationLink
                                            isActive={page === currentPage}
                                            onClick={() => handlePageChange(page)}
                                        >
                                            {page}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => currentPage < Math.ceil(filteredTasks.length / 10) && handlePageChange(currentPage + 1)}
                                        className={currentPage === Math.ceil(filteredTasks.length / 10) ? "pointer-events-none opacity-40" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </div>
            )}

            <Dialog
                open={isImagePreviewOpen}
                onOpenChange={(open) => {
                    setIsImagePreviewOpen(open);
                    if (!open) {
                        setTaskImages((previous) => {
                            revokeTaskImageUrls(previous);
                            return [];
                        });
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Requirement Photos</DialogTitle>
                    </DialogHeader>
                    {isLoadingImages ? (
                        <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                            <Loader className="h-5 w-5 animate-spin" />
                            Loading images...
                        </div>
                    ) : taskImages.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {taskImages.map((imageUrl, index) => (
                                <a key={`${imageUrl}-${index}`} href={imageUrl} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-lg border bg-muted">
                                    <img src={imageUrl} alt={`Requirement photo ${index + 1}`} className="h-full max-h-[420px] w-full object-contain" />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                            No requirement photos found.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

function RequirementsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <Requirements />
        </Suspense>
    );
}

export default RequirementsPage;
