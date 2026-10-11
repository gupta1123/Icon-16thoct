"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { useParams } from 'next/navigation';
import { AlertCircle, CalendarIcon, Edit, Search, Check, MessageSquare, ClipboardList, User, Mail, Phone, Store, Tag, MapPin, Building, Flag, Loader2, Cake, ArrowLeft, CalendarDays, StickyNote, ListChecks, LayoutDashboard, Plus, Trash2, Activity, Package, ExternalLink, Navigation, HardHat } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { SearchableSelect } from '@/components/ui/searchable-select2';
import { REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS, getRequirementComplaintCategoryLabel } from '@/lib/requirement-complaint-category';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { API, API_BASE_URL, type VisitBrandPurchase, type StateDto, type DistrictDto, type SubDistrictDto, type CityDto } from "@/lib/api";
import { useAuth } from '@/components/auth-provider';
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { useGuardedRouter, useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';
import { ActivityTimeline, DetailHero, FormField, FormGroup, FormSheet, SegmentedChoice, DetailShell, DetailSkeleton, EmptyState, Info, KpiCell, Pill, Section, type ActivityItem, type DetailTab, type Tone } from '@/components/detail-ui';

const ITEMS_PER_PAGE = 10;
const JOINING_YEAR_OPTIONS = Array.from(
    { length: 76 },
    (_, index) => new Date().getFullYear() - index,
);

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

interface CustomerData {
    storeId: number;
    storeName: string;
    clientFirstName: string;
    clientLastName: string;
    primaryContact: number;
    monthlySale: number | null;
    intent: number | null;
    employeeName: string;
    clientType: string | null;
    totalVisitCount: number;
    lastVisitDate: string | null;
    email: string | null;
    city: string;
    state: string;
    country: string | null;
    gstNumber?: string;
    secondaryContact?: number | string | null;
    landmark?: string;
    shopAgeYears?: number | string | null;
    ownershipType?: string;
    dealerType?: string;
    dealerSubType?: string;
    otherClientType?: string;
    addressLine1?: string;
    addressLine2?: string;
    village?: string;
    taluka?: string;
    pincode?: string;
    dateOfBirth?: string | null;
    dob?: string | null;
    yearOfJoining?: number | null;
}

interface Visit {
    id: number;
    purpose: string;
    visit_date: string;
    employeeId: number;
    employeeName: string;
    checkinTime?: string;
    checkoutTime?: string;
    state?: string;
    brandPurchases?: VisitBrandPurchase[];
}

interface Note {
    id: number;
    content: string;
    createdDate: string;
    employeeName?: string;
}

interface Task {
    id: number;
    taskTitle: string;
    taskDescription: string;
    dueDate: string;
    status: string;
    priority: string;
    assignedToId?: number;
    assignedToName: string;
    taskType: string;
    storeName?: string;
}

export default function CustomerDetailPage({ customer }: { customer?: Record<string, unknown> }) {
    const router = useGuardedRouter();
    const params = useParams();
    const storeId = params.id;
    const { token, userData } = useAuth();

    const [customerData, setCustomerData] = useState<Record<string, unknown> | null>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
    const [notesData, setNotesData] = useState<Note[]>([]);
    const [visitsData, setVisitsData] = useState<Visit[]>([]);
    const [visitTotalPages, setVisitTotalPages] = useState(1);
    const [visitTotalCount, setVisitTotalCount] = useState<number | null>(null);
    const [lastVisitDate, setLastVisitDate] = useState<string | null>(null);
    const [isLoadingVisits, setIsLoadingVisits] = useState(true);
    const [visitsError, setVisitsError] = useState<string | null>(null);
    const visitsRequest = useRef(0);
    const [requirementsData, setRequirementsData] = useState<Task[]>([]);
    const [complaintsData, setComplaintsData] = useState<Task[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
    const [activeInfoTab, setActiveInfoTab] = useState('leads-info');
    const [isEditCustomerModalVisible, setIsEditCustomerModalVisible] = useState(false);
    const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
    const [customerEditError, setCustomerEditError] = useState<string | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [activeActivityTab, setActiveActivityTab] = useState('overview');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState("basic-info");
    const [hasUnlockedAddressTab, setHasUnlockedAddressTab] = useState(false);
    const [formData, setFormData] = useState<Partial<CustomerData>>({
        storeId: 0,
        storeName: '',
        clientFirstName: '',
        clientLastName: '',
        email: '',
        primaryContact: 0,
        gstNumber: '',
        secondaryContact: '',
        landmark: '',
        country: '',
        shopAgeYears: '',
        ownershipType: '',
        dealerType: '',
        dealerSubType: '',
        clientType: '',
        otherClientType: '',
        addressLine1: '',
        addressLine2: '',
        village: '',
        taluka: '',
        city: '',
        state: '',
        pincode: '',
        dateOfBirth: null,
        dob: null,
        yearOfJoining: null,
    });
    const [baselineFormData, setBaselineFormData] = useState<Partial<CustomerData>>({});
    const [isOtherClientType, setIsOtherClientType] = useState(false);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
    const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
    
    const getStoreIdString = (): string => {
        if (typeof storeId === 'string') return storeId;
        if (Array.isArray(storeId)) return storeId[0];
        return '';
    };

    const [requirementTask, setRequirementTask] = useState({
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0,
        status: 'Assigned',
        priority: '',
        taskType: 'requirement',
        storeId: parseInt(getStoreIdString() || '0', 10),
        category: 'Requirement',
        storeName: ''
    });
    const [requirementActiveTab, setRequirementActiveTab] = useState('general');
    const [complaintTask, setComplaintTask] = useState({
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0,
        status: 'Assigned',
        priority: '',
        taskType: 'complaint',
        storeId: parseInt(getStoreIdString() || '0', 10),
        category: 'Complaint',
        storeName: ''
    });
    const [requirementTaskBaseline, setRequirementTaskBaseline] = useState(requirementTask);
    const [complaintTaskBaseline, setComplaintTaskBaseline] = useState(complaintTask);
    const [complaintActiveTab, setComplaintActiveTab] = useState('general');
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [complaintEmployeeSearch, setComplaintEmployeeSearch] = useState('');
    const [requirementEmployeeSearch, setRequirementEmployeeSearch] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(addDays(new Date(), 5));
    const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);
    const [showSitesTab, setShowSitesTab] = useState(false);
    const [showMore, setShowMore] = useState({
        visits: true,
        notes: false,
        complaints: false,
        requirements: false,
    });
    const [isNoteSaving, setIsNoteSaving] = useState(false);
    const [notePendingDelete, setNotePendingDelete] = useState<Note | null>(null);

    const originalNoteContent = editingNoteId === null
        ? ''
        : notesData.find((note) => note.id === editingNoteId)?.content ?? '';
    const customerFormIsDirty = isEditCustomerModalVisible &&
        JSON.stringify(formData) !== JSON.stringify(baselineFormData);
    const noteDraftIsDirty = isModalVisible && noteContent !== originalNoteContent;
    const complaintDraftIsDirty = isComplaintModalOpen &&
        JSON.stringify(complaintTask) !== JSON.stringify(complaintTaskBaseline);
    const requirementDraftIsDirty = isRequirementModalOpen &&
        JSON.stringify(requirementTask) !== JSON.stringify(requirementTaskBaseline);
    const { requestDiscard } = useUnsavedChanges(
        customerFormIsDirty || noteDraftIsDirty || complaintDraftIsDirty || requirementDraftIsDirty
    );

    const [currentPage, setCurrentPage] = useState({
        visits: 1,
        notes: 1,
        complaints: 1,
        requirements: 1,
    });

    const [filteredVisitsData, setFilteredVisitsData] = useState<Visit[]>([]);

    const employeeId = userData?.employeeId ?? null;

    const fetchCustomerData = useCallback(async (id: string) => {
        try {
            setIsLoadingCustomer(true);
            const response = await fetch(`${API_BASE_URL}/store/getById?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setCustomerData(data);

            const validClientTypes = ['builder', 'site visit', 'architect', 'engineer'];
            setShowSitesTab(validClientTypes.includes(data.clientType?.toLowerCase() || ''));
        } catch (error) {
            console.error('Error fetching customer data:', error);
        } finally {
            setIsLoadingCustomer(false);
        }
    }, [token]);

    const fetchNotesData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/notes/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setNotesData(data || []);
        } catch (error) {
            console.error('Error fetching notes data:', error);
        }
    }, [token]);

    const fetchVisitsData = useCallback(async (id: string, page = 1) => {
        const request = ++visitsRequest.current;
        setIsLoadingVisits(true);
        setVisitsError(null);
        try {
            const data = await API.getVisitsByStorePaged(Number(id), Math.max(page - 1, 0), ITEMS_PER_PAGE, 'visitDate,desc');
            if (request !== visitsRequest.current) return;
            const visits = (data.content || []) as Visit[];
            setVisitsData(visits);
            setFilteredVisitsData(visits);
            setVisitTotalPages(Math.max(data.totalPages || 1, 1));
            setVisitTotalCount(typeof data.totalElements === 'number' ? data.totalElements : visits.length);
            if (page === 1) setLastVisitDate(visits[0]?.visit_date ?? null);
        } catch (error) {
            if (request !== visitsRequest.current) return;
            setVisitsData([]);
            setFilteredVisitsData([]);
            setVisitsError(getErrorMessage(error, 'Unable to load customer visits.'));
        } finally {
            if (request === visitsRequest.current) setIsLoadingVisits(false);
        }
    }, []);

    const fetchTasksData = useCallback(async (id: string, start: Date, end: Date) => {
        if (isDateRangeInvalid(start, end)) return;
        setIsLoadingTasks(true);
        setTasksError(null);
        try {
            // WORKAROUND(BE-029): getByStoreAndDate only finds tasks saved directly on the store; tasks raised from a
            // visit are only found by getByStoreAndDate1 (via the store's visits). Ask both and merge by id.
            const query = `storeId=${id}&start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`;
            const responses = await Promise.all(['getByStoreAndDate', 'getByStoreAndDate1'].map((route) => fetch(`${API_BASE_URL}/task/${route}?${query}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })));
            const failed = responses.find((response) => !response.ok);
            if (failed) {
                throw new Error(`Failed to fetch customer tasks (${failed.status})`);
            }
            const lists = await Promise.all(responses.map((response) => response.json() as Promise<Task[]>));
            const tasks = [...new Map(lists.flatMap((data) => (Array.isArray(data) ? data : [])).map((task) => [task.id, task])).values()];
            setRequirementsData(tasks.filter((task) => task.taskType === 'requirement'));
            setComplaintsData(tasks.filter((task) => task.taskType === 'complaint'));
        } catch (error) {
            console.error('Error fetching customer tasks:', error);
            setRequirementsData([]);
            setComplaintsData([]);
            setTasksError(getErrorMessage(error, 'Unable to load tasks.'));
        } finally {
            setIsLoadingTasks(false);
        }
    }, [token]);

    const fetchEmployees = useCallback(async () => {
        try {
            setIsLoadingEmployees(true);
            const response = await fetch(`${API_BASE_URL}/employee/getFieldOfficer`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setEmployees(data || []);
        } catch (error) {
            console.error('Error fetching field officers:', error);
        } finally {
            setIsLoadingEmployees(false);
        }
    }, [token]);

    const getNumericStoreId = useCallback(() => {
        const idString = getStoreIdString();
        const parsed = parseInt(idString, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }, [storeId]);

    const handleCloseNoteModal = useCallback(() => {
        setIsModalVisible(false);
        setIsEditMode(false);
        setNoteContent('');
        setEditingNoteId(null);
        setIsNoteSaving(false);
    }, []);

    const resetComplaintTaskState = useCallback(() => {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const employeeNameStr = typeof customerData?.employeeName === 'string' ? customerData.employeeName : '';
        const employee = employees.find(emp => {
            const firstName = typeof emp.firstName === 'string' ? emp.firstName : '';
            const lastName = typeof emp.lastName === 'string' ? emp.lastName : '';
            return `${firstName} ${lastName}` === employeeNameStr || 
                (typeof firstName === 'string' && employeeNameStr.includes(firstName)) ||
                (typeof lastName === 'string' && employeeNameStr.includes(lastName));
        });
        
        const existingTask = complaintsData[0];

        const nextComplaintTask = {
            taskTitle: '',
            taskDesciption: '',
            dueDate: todayString,
            assignedToId: existingTask?.assignedToId ?? (employee ? employee.id as number : 0),
            assignedToName: existingTask?.assignedToName || employeeNameStr || '',
            assignedById: 0,
            status: 'Assigned',
            priority: '',
            taskType: 'complaint',
            storeId: getNumericStoreId(),
            category: 'Complaint',
            storeName: (customerData?.storeName as string) || existingTask?.storeName || ''
        };
        setComplaintTask(nextComplaintTask);
        setComplaintTaskBaseline(nextComplaintTask);
        setComplaintEmployeeSearch('');
        setComplaintActiveTab('general');
    }, [complaintsData, customerData?.storeName, customerData?.employeeName, getNumericStoreId, employees]);

    const resetRequirementTaskState = useCallback(() => {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const employeeNameStr = typeof customerData?.employeeName === 'string' ? customerData.employeeName : '';
        const employee = employees.find(emp => {
            const firstName = typeof emp.firstName === 'string' ? emp.firstName : '';
            const lastName = typeof emp.lastName === 'string' ? emp.lastName : '';
            return `${firstName} ${lastName}` === employeeNameStr || 
                (typeof firstName === 'string' && employeeNameStr.includes(firstName)) ||
                (typeof lastName === 'string' && employeeNameStr.includes(lastName));
        });
        
        const existingTask = requirementsData[0];

        const nextRequirementTask = {
            taskTitle: '',
            taskDesciption: '',
            dueDate: todayString,
            assignedToId: existingTask?.assignedToId ?? (employee ? employee.id as number : 0),
            assignedToName: existingTask?.assignedToName || employeeNameStr || '',
            assignedById: 0,
            status: 'Assigned',
            priority: '',
            taskType: 'requirement',
            storeId: getNumericStoreId(),
            category: 'Requirement',
            storeName: (customerData?.storeName as string) || existingTask?.storeName || ''
        };
        setRequirementTask(nextRequirementTask);
        setRequirementTaskBaseline(nextRequirementTask);
        setRequirementEmployeeSearch('');
        setRequirementActiveTab('general');
    }, [requirementsData, customerData?.storeName, customerData?.employeeName, getNumericStoreId, employees]);

    const closeComplaintModal = useCallback(() => {
        setIsComplaintModalOpen(false);
        setTaskCreateError(null);
        resetComplaintTaskState();
    }, [resetComplaintTaskState]);

    const closeRequirementModal = useCallback(() => {
        setIsRequirementModalOpen(false);
        setTaskCreateError(null);
        resetRequirementTaskState();
    }, [resetRequirementTaskState]);

    const closeEditCustomerModal = useCallback(() => {
        setIsEditCustomerModalVisible(false);
        setCustomerEditError(null);
        setActiveTab('basic-info');
        setHasUnlockedAddressTab(false);
        setFormData(baselineFormData);
        setIsOtherClientType(baselineFormData.clientType === 'others');
    }, [baselineFormData]);

    const requestCloseNoteModal = useCallback(() => {
        requestDiscard(handleCloseNoteModal, noteDraftIsDirty);
    }, [handleCloseNoteModal, noteDraftIsDirty, requestDiscard]);

    const requestCloseComplaintModal = useCallback(() => {
        requestDiscard(closeComplaintModal, complaintDraftIsDirty);
    }, [closeComplaintModal, complaintDraftIsDirty, requestDiscard]);

    const requestCloseRequirementModal = useCallback(() => {
        requestDiscard(closeRequirementModal, requirementDraftIsDirty);
    }, [closeRequirementModal, requirementDraftIsDirty, requestDiscard]);

    const requestCloseEditCustomerModal = useCallback(() => {
        requestDiscard(closeEditCustomerModal, customerFormIsDirty);
    }, [closeEditCustomerModal, customerFormIsDirty, requestDiscard]);

    const handleCustomerTabChange = useCallback((value: string) => {
        if (value === 'address-info' && !hasUnlockedAddressTab) {
            return;
        }
        setActiveTab(value);
    }, [hasUnlockedAddressTab]);

    const handleAddNote = async () => {
        if (isNoteSaving) return;
        try {
            setIsNoteSaving(true);
            const response = await fetch(`${API_BASE_URL}/notes/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content: noteContent,
                    employeeId: employeeId,
                    storeId: parseInt(getStoreIdString(), 10),
                }),
            });

            if (response.ok) {
                await fetchNotesData(getStoreIdString());
                handleCloseNoteModal();
            }
        } catch (error) {
            console.error('Error creating note:', error);
        } finally {
            setIsNoteSaving(false);
        }
    };

    const handleEditNote = (note: Note) => {
        setEditingNoteId(note.id);
        setNoteContent(note.content);
        setIsEditMode(true);
        setIsModalVisible(true);
    };

    const handleSaveEditNote = async () => {
        if (isNoteSaving) return;
        try {
            setIsNoteSaving(true);
            const response = await fetch(`${API_BASE_URL}/notes/edit?id=${editingNoteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content: noteContent,
                    employeeId: employeeId,
                    storeId: parseInt(getStoreIdString(), 10),
                }),
            });

            if (response.ok) {
                await fetchNotesData(getStoreIdString());
                handleCloseNoteModal();
            }
        } catch (error) {
            console.error('Error updating note:', error);
        } finally {
            setIsNoteSaving(false);
        }
    };

    const handleDeleteNoteConfirm = async () => {
        if (!notePendingDelete) return;
        try {
            const response = await fetch(`${API_BASE_URL}/notes/delete?id=${notePendingDelete.id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                await fetchNotesData(getStoreIdString());
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        } finally {
            setNotePendingDelete(null);
        }
    };

    const handleStatusChange = (value: string) => {
        if (value === "All Statuses") {
            setFilteredVisitsData(visitsData);
        } else {
            setFilteredVisitsData(visitsData.filter(visit => getOutcomeStatus(visit).status === value));
        }
    };

    const handlePageChange = (tab: keyof typeof currentPage, page: number) => {
        setCurrentPage(prev => ({ ...prev, [tab]: page }));
    };

    const renderPaginationItems = (tab: keyof typeof currentPage) => {
        const items = [];
        let totalPages;

        switch (tab) {
            case 'visits':
                totalPages = visitTotalPages;
                break;
            case 'notes':
                totalPages = Math.ceil(notesData.length / ITEMS_PER_PAGE);
                break;
            case 'complaints':
                totalPages = Math.ceil(complaintsData.length / ITEMS_PER_PAGE);
                break;
            case 'requirements':
                totalPages = Math.ceil(requirementsData.length / ITEMS_PER_PAGE);
                break;
            default:
                totalPages = 0;
        }

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage[tab] - 1 && i <= currentPage[tab] + 1)) {
                items.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            size="default"
                            isActive={currentPage[tab] === i}
                            onClick={() => handlePageChange(tab, i)}
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }
        }
        return items;
    };

    const createTask = async () => {
        const id = getStoreIdString();
        if (!id) return;
        await fetchTasksData(id, startDate, endDate);
    };

    const getInitials = (name: string) => {
        if (!name) return '';
        const nameParts = name.split(' ');
        return nameParts.map(part => part[0]).join('');
    };

    const isBirthdayToday = useCallback((dob: string | null | undefined): boolean => {
        if (!dob) return false;
        try {
            const birthDate = new Date(dob);
            const today = new Date();
            return birthDate.getMonth() === today.getMonth() && 
                   birthDate.getDate() === today.getDate();
        } catch {
            return false;
        }
    }, []);

    const formatDateOfBirth = useCallback((dob: string | null | undefined): string | null => {
        if (!dob) return null;
        try {
            const date = new Date(dob);
            if (isNaN(date.getTime())) return null;
            return format(date, 'MMM dd, yyyy');
        } catch {
            return null;
        }
    }, []);

    const handleBackClick = () => {
        router.push('/dashboard/customers');
    };

    const getOutcomeStatus = (visit: Visit) => {
        if (visit.checkinTime && visit.checkoutTime) {
            return { emoji: '✅', status: 'Complete', color: 'bg-purple-100 text-purple-800' };
        } else {
            return { emoji: '📅', status: 'Assigned', color: 'bg-blue-100 text-blue-800' };
        }
    };

    const paginate = <T,>(data: T[], page: number): T[] => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    };

    useEffect(() => {
        setCurrentPage(prev => {
            if (prev.visits > visitTotalPages) {
                return { ...prev, visits: visitTotalPages };
            }
            return prev;
        });
    }, [visitTotalPages]);

    useEffect(() => {
        setCurrentPage(prev => {
            const totalPages = Math.max(1, Math.ceil(notesData.length / ITEMS_PER_PAGE));
            if (prev.notes > totalPages) {
                return { ...prev, notes: totalPages };
            }
            return prev;
        });
    }, [notesData.length]);

    const handleChangeStatus = async (taskId: number, status: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/task/updateTask?taskId=${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status,
                    priority: [...complaintsData, ...requirementsData].find((t) => t.id === taskId)?.priority ?? undefined,
                }),
            });

            if (response.ok) {
                createTask();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleCustomerEditSubmit = async (data: Partial<CustomerData>) => {
        const clientFirstName = data.clientFirstName?.trim();
        const clientLastName = data.clientLastName?.trim();

        if (!clientFirstName || !clientLastName) {
            setCustomerEditError('First name and last name are required.');
            setActiveTab('basic-info');
            return;
        }

        setIsUpdatingCustomer(true);
        setCustomerEditError(null);
        try {
            const dobValue = data.dob || data.dateOfBirth || '';
            const normalizedDob = dobValue ? dobValue.replace(/\//g, '-') : undefined;

            const secondary = String(data.secondaryContact ?? '').replace(/\D/g, '');
            const shopAge = String(data.shopAgeYears ?? '').trim();
            if (secondary && secondary.length < 10) {
                setCustomerEditError('Secondary contact must be a valid phone number.');
                return;
            }
            if (shopAge && (!Number.isFinite(Number(shopAge)) || Number(shopAge) < 0)) {
                setCustomerEditError('Shop age cannot be negative.');
                return;
            }
            if (data.dealerType === 'ICON' && !data.dealerSubType) {
                setCustomerEditError('Choose Exclusive or Non-exclusive for an Icon dealer.');
                return;
            }

            const requestData = {
                clientFirstName,
                clientLastName,
                storeName: data.storeName?.trim() || null,
                secondaryContact: secondary ? Number(secondary) : null,
                landmark: data.landmark?.trim() || null,
                country: 'India',
                shopAgeYears: shopAge ? Number(shopAge) : null,
                ownershipType: data.ownershipType || null,
                dealerType: data.dealerType || null,
                dealerSubType: data.dealerType ? (data.dealerSubType || null) : null,
                email: data.email?.trim() || null,
                clientType: data.clientType,
                gstNumber: data.gstNumber?.trim() || null,
                addressLine1: data.addressLine1?.trim() || null,
                addressLine2: data.addressLine2?.trim() || null,
                district: data.village?.trim() || null,
                subDistrict: data.taluka?.trim() || null,
                city: data.city?.trim() || null,
                state: data.state?.trim() || null,
                pincode: data.pincode ? Number(data.pincode) : null,
                dob: normalizedDob,
                yearOfJoining: data.yearOfJoining == null ? null : Number(data.yearOfJoining),
            };

            const response = await fetch(`${API_BASE_URL}/store/edit?id=${getStoreIdString()}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(requestData),
            });

            if (response.ok) {
                await fetchCustomerData(getStoreIdString());
                closeEditCustomerModal();
            } else {
                throw new Error(
                    await getApiErrorMessage(response, 'Unable to update customer.')
                );
            }
        } catch (error) {
            console.error('Error updating customer:', error);
            setCustomerEditError(getErrorMessage(error, 'Unable to update customer.'));
        } finally {
            setIsUpdatingCustomer(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCustomerEditError(null);
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleClientTypeChange = (value: string) => {
        const lowercaseValue = value.toLowerCase();
        setCustomerEditError(null);
        setIsOtherClientType(lowercaseValue === 'others');
        setFormData((prev) => ({
            ...prev,
            clientType: lowercaseValue,
            otherClientType: lowercaseValue === 'others' ? prev.otherClientType : '',
        }));
    };

    const handleSubmit = () => {
        const updatedFormData = { ...formData };
        if (isOtherClientType) {
            updatedFormData.clientType = formData.otherClientType || 'Others';
        }
        handleCustomerEditSubmit(updatedFormData);
    };

    const handleCreateComplaint = async () => {
        const assignedById = userData?.employeeId;
        if (!assignedById) {
            setTaskCreateError('Unable to identify the logged-in employee. Please sign in again.');
            return;
        }

        setIsCreatingTask(true);
        setTaskCreateError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/task/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...complaintTask,
                    dueDate: complaintTask.dueDate.split('T')[0],
                    storeId: complaintTask.storeId,
                    assignedById,
                    taskType: 'complaint'
                }),
            });

            if (response.ok) {
                await createTask();
                closeComplaintModal();
            } else {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to create complaint (${response.status})`);
            }
        } catch (error) {
            console.error('Error creating complaint:', error);
            setTaskCreateError(error instanceof Error ? error.message : 'Failed to create complaint');
        } finally {
            setIsCreatingTask(false);
        }
    };

    const handleCreateRequirement = async () => {
        const assignedById = userData?.employeeId;
        if (!assignedById) {
            setTaskCreateError('Unable to identify the logged-in employee. Please sign in again.');
            return;
        }

        setIsCreatingTask(true);
        setTaskCreateError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/task/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...requirementTask,
                    dueDate: requirementTask.dueDate.split('T')[0],
                    storeId: requirementTask.storeId,
                    assignedById,
                    taskType: 'requirement'
                }),
            });

            if (response.ok) {
                await createTask();
                closeRequirementModal();
            } else {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to create requirement (${response.status})`);
            }
        } catch (error) {
            console.error('Error creating requirement:', error);
            setTaskCreateError(error instanceof Error ? error.message : 'Failed to create requirement');
        } finally {
            setIsCreatingTask(false);
        }
    };

    useEffect(() => {
        const id = getStoreIdString();
        if (token && id) {
            fetchCustomerData(id);
            fetchNotesData(id);
        }
    }, [token, storeId, fetchCustomerData, fetchNotesData]);

    useEffect(() => {
        const id = getStoreIdString();
        if (token && id && !dateRangeInvalid) {
            fetchTasksData(id, startDate, endDate);
        }
    }, [token, storeId, startDate, endDate, dateRangeInvalid, fetchTasksData]);

    useEffect(() => {
        const id = getStoreIdString();
        if (token && id) {
            fetchVisitsData(id, currentPage.visits);
        }
        return () => { visitsRequest.current += 1; };
    }, [token, storeId, currentPage.visits, fetchVisitsData]);

    useEffect(() => {
        if (customerData) {
            const clientType = (customerData.clientType as string)?.toLowerCase() || '';
            const standardClientTypes = ["shop", "site visit", "architect", "engineer"];
            const isStandardType = standardClientTypes.includes(clientType);

            const nextFormData: Partial<CustomerData> = {
                storeId: customerData.storeId as number,
                storeName: customerData.storeName as string,
                clientFirstName: customerData.clientFirstName as string,
                clientLastName: customerData.clientLastName as string,
                email: (customerData.email as string) || '',
                primaryContact: customerData.primaryContact as number,
                gstNumber: (customerData.gstNumber as string) || '',
                secondaryContact: customerData.secondaryContact != null ? String(customerData.secondaryContact) : '',
                landmark: (customerData.landmark as string) || '',
                country: (customerData.country as string) || '',
                shopAgeYears: customerData.shopAgeYears != null ? String(customerData.shopAgeYears) : '',
                ownershipType: (customerData.ownershipType as string) || '',
                dealerType: (customerData.dealerType as string) || '',
                dealerSubType: (customerData.dealerSubType as string) || '',
                clientType: isStandardType ? clientType : 'others',
                otherClientType: isStandardType ? '' : (customerData.clientType as string) || '',
                addressLine1: (customerData.addressLine1 as string) || '',
                addressLine2: (customerData.addressLine2 as string) || '',
                village: (customerData.district as string) || '',
                taluka: (customerData.subDistrict as string) || '',
                city: customerData.city as string,
                state: customerData.state as string,
                pincode: (customerData.pincode as string) || '',
                dateOfBirth: (customerData.dateOfBirth as string) || (customerData.dob as string) || null,
                dob: (customerData.dateOfBirth as string) || (customerData.dob as string) || null,
                yearOfJoining: customerData.yearOfJoining != null && Number.isInteger(Number(customerData.yearOfJoining))
                    ? Number(customerData.yearOfJoining)
                    : null,
            };
            setFormData(nextFormData);
            setBaselineFormData(nextFormData);
            setIsOtherClientType(!isStandardType);
        }
    }, [customerData]);

    useEffect(() => {
        if (
            (isComplaintModalOpen || isRequirementModalOpen) &&
            employees.length === 0 &&
            !isLoadingEmployees
        ) {
            void fetchEmployees();
        }
    }, [isComplaintModalOpen, isRequirementModalOpen, employees.length, isLoadingEmployees, fetchEmployees]);

    useEffect(() => {
        if (isComplaintModalOpen) {
            resetComplaintTaskState();
        }
    }, [isComplaintModalOpen, employees, resetComplaintTaskState]);

    useEffect(() => {
        if (isRequirementModalOpen) {
            resetRequirementTaskState();
        }
    }, [isRequirementModalOpen, employees, resetRequirementTaskState]);

    // Cascading location lists for the edit panel: State -> District -> Sub-district -> City
    const [locStates, setLocStates] = useState<StateDto[]>([]);
    const [locDistricts, setLocDistricts] = useState<DistrictDto[]>([]);
    const [locSubDistricts, setLocSubDistricts] = useState<SubDistrictDto[]>([]);
    const [locCities, setLocCities] = useState<CityDto[]>([]);
    const sameName = (a?: string | null, b?: string | null) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

    useEffect(() => {
        if (!isEditCustomerModalVisible || locStates.length > 0) return;
        let cancelled = false;
        API.getAllStates().then((list) => { if (!cancelled) setLocStates(list); }).catch(() => { if (!cancelled) setLocStates([]); });
        return () => { cancelled = true; };
    }, [isEditCustomerModalVisible, locStates.length]);

    useEffect(() => {
        const match = locStates.find((st) => sameName(st.stateName, formData.state));
        if (!isEditCustomerModalVisible || !match) { setLocDistricts([]); return; }
        let cancelled = false;
        API.getDistrictsByStateId(match.id).then((list) => { if (!cancelled) setLocDistricts(list); }).catch(() => { if (!cancelled) setLocDistricts([]); });
        return () => { cancelled = true; };
    }, [isEditCustomerModalVisible, locStates, formData.state]);

    useEffect(() => {
        const match = locDistricts.find((d) => sameName(d.districtName, formData.village));
        if (!match) { setLocSubDistricts([]); return; }
        let cancelled = false;
        API.getSubDistrictsByDistrictId(match.id).then((list) => { if (!cancelled) setLocSubDistricts(list); }).catch(() => { if (!cancelled) setLocSubDistricts([]); });
        return () => { cancelled = true; };
    }, [locDistricts, formData.village]);

    useEffect(() => {
        const match = locSubDistricts.find((d) => sameName(d.subDistrictName, formData.taluka));
        if (!match) { setLocCities([]); return; }
        let cancelled = false;
        API.getCitiesBySubDistrictId(match.id).then((list) => { if (!cancelled) setLocCities(list); }).catch(() => { if (!cancelled) setLocCities([]); });
        return () => { cancelled = true; };
    }, [locSubDistricts, formData.taluka]);

    /** Option names for a dropdown; keeps a legacy/free-text current value selectable so it isn't lost. */
    const locOptions = (names: string[], current?: string | null) => {
        const cur = (current || '').trim();
        const hit = cur ? names.find((n) => sameName(n, cur)) : undefined;
        const sorted = [...new Set(cur && !hit ? [cur, ...names] : names)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
        return { options: sorted, value: hit ?? (cur || undefined) };
    };

    const allBrandPurchases = useMemo(() => {
        return visitsData.flatMap(v => v.brandPurchases || []);
    }, [visitsData]);

    if (isLoadingCustomer) {
        return <div className="detail-page"><DetailSkeleton /></div>;
    }

    const renderTaskSheet = (kind: 'complaint' | 'requirement') => {
        const isComplaint = kind === 'complaint';
        const task = isComplaint ? complaintTask : requirementTask;
        const setTask = (patch: Partial<typeof complaintTask>) => (isComplaint ? setComplaintTask((prev) => ({ ...prev, ...patch })) : setRequirementTask((prev) => ({ ...prev, ...patch })));
        const open = isComplaint ? isComplaintModalOpen : isRequirementModalOpen;
        const noun = isComplaint ? 'complaint' : 'requirement';
        const customerLabel = `${(customerData?.clientFirstName as string) || ''} ${(customerData?.clientLastName as string) || ''}`.trim();
        const assigneeValue = task.assignedToId ? String(task.assignedToId) : undefined;
        return (
            <FormSheet
                open={open}
                onOpenChange={(next) => { if (!next) (isComplaint ? requestCloseComplaintModal() : requestCloseRequirementModal()); }}
                icon={isComplaint ? MessageSquare : ClipboardList}
                title={isComplaint ? 'Log complaint' : 'Add requirement'}
                description={customerLabel ? `For ${customerLabel}${(customerData?.storeName as string) && customerData?.storeName !== '.' ? ` · ${customerData?.storeName as string}` : ''}` : `Create a new ${noun} for this customer.`}
                errors={taskCreateError ? [taskCreateError] : undefined}
                footerNote={`Assigned employees see this ${noun} in their task list.`}
                onSubmit={isComplaint ? handleCreateComplaint : handleCreateRequirement}
                submitLabel={isComplaint ? 'Create complaint' : 'Add requirement'}
                submitting={isCreatingTask}
                submitDisabled={!task.taskTitle.trim() || !REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS.some((o) => o.value === String(task.priority).toLowerCase())}
            >
                <FormGroup title="Details">
                    <FormField label={isComplaint ? 'Complaint Title' : 'Requirement Title'} required>
                        <Input
                            autoFocus
                            value={task.taskTitle}
                            onChange={(e) => setTask({ taskTitle: e.target.value })}
                            placeholder="Enter title"
                            className="h-10 text-sm"
                        />
                    </FormField>
                    <FormField label={isComplaint ? 'Complaint Description' : 'Requirement Description'}>
                        <Textarea
                            value={task.taskDesciption}
                            onChange={(e) => setTask({ taskDesciption: e.target.value })}
                            placeholder="Enter description"
                            className="min-h-[120px] resize-none text-sm leading-relaxed"
                        />
                    </FormField>
                </FormGroup>
                <FormGroup title="Type">
                    <SegmentedChoice
                        value={String(task.priority || '').toLowerCase() as 'high' | 'medium' | 'low'}
                        onChange={(priority) => setTask({ priority })}
                        options={[
                            { value: 'high', label: 'Technical', dot: 'bg-red-500' },
                            { value: 'medium', label: 'Commercial', dot: 'bg-amber-500' },
                            { value: 'low', label: 'ADVT', dot: 'bg-slate-400' },
                        ]}
                    />
                </FormGroup>
                <FormGroup title="Assignment" columns={2}>
                    <FormField label="Assign to">
                        <SearchableSelect
                            modal
                            triggerId={`assign-${kind}`}
                            options={employees
                                .map((emp) => ({ value: String(emp.id), label: `${(emp.firstName as string) || ''} ${(emp.lastName as string) || ''}`.trim() }))
                                .sort((l, r) => l.label.localeCompare(r.label, 'en', { sensitivity: 'base' }))}
                            value={assigneeValue}
                            loading={isLoadingEmployees && employees.length === 0}
                            placeholder="Choose employee"
                            searchPlaceholder="Search employees…"
                            triggerClassName="h-10 w-full text-sm font-normal"
                            contentClassName="w-[var(--radix-popover-trigger-width)]"
                            onSelect={(option) => { if (option) setTask({ assignedToId: Number(option.value), assignedToName: option.label }); }}
                        />
                    </FormField>
                    <FormField label="Due date">
                        <Input type="date" value={(task.dueDate || '').split('T')[0]} onChange={(e) => setTask({ dueDate: e.target.value })} className="h-10 text-sm" />
                    </FormField>
                </FormGroup>
            </FormSheet>
        );
    };

    const customerDob = customerData ? ((customerData.dateOfBirth as string) || (customerData.dob as string)) : null;

    return (
        <div className="detail-page space-y-4 text-xs">
            {(() => {
                const fullName = customerData ? `${(customerData.clientFirstName as string) || ''} ${(customerData.clientLastName as string) || ''}`.trim() : '';
                const rawStoreName = ((customerData?.storeName as string) || '').trim();
                const storeLabel = rawStoreName && rawStoreName !== '.' ? rawStoreName : '';
                const clientTypeLabel = ((customerData?.clientType as string) || '').trim();
                const ct = clientTypeLabel.toLowerCase();
                const isSiteVisit = ct === 'site visit';
                const isDealerType = !isSiteVisit && (ct.includes('dealer') || ct.includes('shop'));
                const isProType = !isSiteVisit && !isDealerType && ['professional', 'engineer', 'architect', 'contractor'].some((k) => ct.includes(k));
                const kindLabel = isSiteVisit ? 'Project' : isProType ? 'Firm' : 'Store';
                const ownerLabel = isSiteVisit ? 'Site owner' : 'Owner';
                const cd = (customerData || {}) as Record<string, unknown>;
                const txt = (k: string) => { const v = cd[k]; return v == null || String(v).trim() === '' || String(v).trim() === '.' ? '' : String(v).trim(); };
                const enumLabel = (v: string) => v ? v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()) : '';
                const productCats = Array.isArray(cd.productCategories) ? (cd.productCategories as string[]).filter(Boolean).map(enumLabel).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) : [];
                const proContacts = Array.isArray(cd.professionals) ? (cd.professionals as Record<string, unknown>[]) : [];
                const sizeRaw = cd.projectSizeSquareFeet ?? cd.projectSize;
                const projectSize = sizeRaw != null && String(sizeRaw).trim() !== '' ? `${Number(sizeRaw).toLocaleString('en-IN')} sq ft` : '';
                const stockRaw = cd.stock ?? cd.monthlySale;
                const stockText = stockRaw != null && String(stockRaw).trim() !== '' ? `${stockRaw} tons` : '';
                const phone = customerData?.primaryContact ? String(customerData.primaryContact) : '';
                const email = ((customerData?.email as string) || '').trim();
                const cityState = [customerData?.city as string, customerData?.state as string].filter(Boolean).join(', ');
                const birthdayToday = !!customerData && isBirthdayToday(customerDob);
                const formattedDob = formatDateOfBirth(customerDob);
                const addressParts = customerData ? [
                    customerData.addressLine1, customerData.addressLine2, customerData.village, customerData.taluka,
                    customerData.city, customerData.district, customerData.state, customerData.pincode,
                ].filter(Boolean).map(String) : [];
                const openTasks = [...complaintsData, ...requirementsData].filter((task) => task.status !== 'Complete');
                const lat = customerData?.latitude != null ? Number(customerData.latitude) : NaN;
                const lng = customerData?.longitude != null ? Number(customerData.longitude) : NaN;
                const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
                const mapsUrl = hasCoords
                    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                    : addressParts.length
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts.join(', '))}`
                        : '';
                const directionsUrl = hasCoords ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : '';
                const managedBy = ((customerData?.employeeName as string) || '').trim();
                const brandsInUse = Array.isArray(customerData?.brandsInUse) ? [...(customerData!.brandsInUse as string[])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })) : [];
                const humanize = (v: string) => v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
                const stage = ((customerData?.constructionStage as string) || '').trim();
                const isArchived = customerData?.isArchived === true;
                const visitsThisMonth = typeof customerData?.visitThisMonth === 'number' ? (customerData.visitThisMonth as number) : null;
                const lastOutcome = ((customerData?.outcomeLastVisit as string) || '').trim();
                const createdOn = (customerData?.createdAt as string) || '';
                const updatedOn = (customerData?.updatedAt as string) || '';
                const priorityTone = (p?: string): Tone => {
                    const v = (p || '').toLowerCase();
                    return v === 'high' || v === 'urgent' ? 'danger' : v === 'medium' ? 'warning' : 'neutral';
                };
                const visitTone = (status: string): Tone => (status === 'Complete' ? 'success' : 'info');

                const brandRows = allBrandPurchases
                    .map((p, i) => ({
                        key: `${p.id ?? i}-${i}`,
                        name: (p.brandName || p.primaryBrand || p.localBrand || '').trim() || 'Unnamed brand',
                        category: p.category ? String(p.category).trim() : '',
                        from: p.purchasedFrom ? String(p.purchasedFrom).trim() : '',
                        steel: p.steelQuantity ?? p.steelQuantitySold ?? null,
                        cement: p.cementQuantitySold ?? null,
                    }))
                    .filter((r) => r.name !== 'Unnamed brand' || r.category || r.from);
                const hasQty = (v: unknown) => v != null && String(v).trim() !== '';

                const upcomingItems: ActivityItem[] = openTasks
                    .slice()
                    .sort((l, r) => String(l.dueDate).localeCompare(String(r.dueDate)))
                    .map((task) => ({
                        key: `task-${task.id}`,
                        date: task.dueDate,
                        dateLabel: `Due ${format(new Date(task.dueDate), 'dd MMM')}`,
                        icon: task.taskType === 'complaint' ? MessageSquare : ClipboardList,
                        title: task.taskTitle,
                        meta: `${task.taskType === 'complaint' ? 'Complaint' : 'Requirement'} · ${getRequirementComplaintCategoryLabel(task.priority)} · ${task.assignedToName || 'Unassigned'}`,
                        onClick: () => setActiveActivityTab(task.taskType === 'complaint' ? 'complaints' : 'requirements'),
                    }));
                const recentItems: ActivityItem[] = [
                    ...visitsData.map((v, i) => ({
                        key: `visit-${v.id ?? i}`,
                        date: v.visit_date,
                        dateLabel: formatDateToUserFriendly(v.visit_date),
                        icon: CalendarDays,
                        title: `Visit · ${v.purpose || 'Visit'}`,
                        meta: `${getOutcomeStatus(v).status} · ${v.employeeName}`,
                        onClick: () => router.push(`/dashboard/visits/${v.id}`),
                    })),
                    ...notesData.map((n) => ({
                        key: `note-${n.id}`,
                        date: n.createdDate,
                        dateLabel: formatDateToUserFriendly(n.createdDate),
                        icon: StickyNote,
                        title: `Note · ${n.employeeName || 'Staff'}`,
                        meta: n.content,
                        onClick: () => setActiveActivityTab('notes'),
                    })),
                ].filter((item) => item.date).sort((l, r) => String(r.date).localeCompare(String(l.date))).slice(0, 8);

                const dateToolbar = (
                    <div className="flex flex-wrap items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal">
                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                    {startDate ? format(new Date(startDate), 'dd MMM yyyy') : <span>Start</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <SpacedCalendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={(date: Date | undefined) => {
                                        setStartDate(date || new Date());
                                        setEndDate(addDays(date || new Date(), 5));
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <span className="text-xs text-muted-foreground">to</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs font-normal">
                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                    {endDate ? format(new Date(endDate), 'dd MMM yyyy') : <span>End</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <SpacedCalendar
                                    mode="single"
                                    selected={endDate}
                                    onSelect={(date) => setEndDate(date || new Date())}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                );

                const taskPanel = (kind: 'complaint' | 'requirement') => {
                    const isComplaints = kind === 'complaint';
                    const label = isComplaints ? 'complaint' : 'requirement';
                    const rows = isComplaints ? complaintsData : requirementsData;
                    return (
                        <div className="space-y-3">
                            <Section
                                description={isLoadingTasks ? `Loading ${label}s…` : `${rows.length} ${rows.length === 1 ? label : `${label}s`} due ${format(startDate, 'dd MMM')} – ${format(endDate, 'dd MMM yyyy')}`}
                                bodyClassName="p-0"
                                action={<>{dateToolbar}<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => { if (isComplaints) { resetComplaintTaskState(); setIsComplaintModalOpen(true); } else { resetRequirementTaskState(); setIsRequirementModalOpen(true); } }}><Plus className="mr-1.5 h-3.5 w-3.5" />Add {label}</Button></>}
                            >
                                {tasksError ? (
                                    <div role="alert" className="flex items-center justify-between gap-3 p-4 text-xs text-destructive">
                                        <span>{tasksError}</span>
                                        <Button variant="outline" size="sm" onClick={() => fetchTasksData(getStoreIdString(), startDate, endDate)}>Retry</Button>
                                    </div>
                                ) : isLoadingTasks && rows.length === 0 ? (
                                    <div className="divide-y" aria-hidden="true">
                                        {[0, 1, 2].map((i) => (
                                            <div key={i} className="space-y-2 px-4 py-3">
                                                <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
                                                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                                            </div>
                                        ))}
                                    </div>
                                ) : rows.length === 0 ? (
                                    <EmptyState compact title={`No ${label}s due in this period. Change the dates above to look elsewhere.`} />
                                ) : (
                                    <ul className={`divide-y transition-opacity ${isLoadingTasks ? 'opacity-60' : ''}`}>
                                        {rows.map((task) => (
                                            <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors hover:bg-muted/30">
                                                <div className="min-w-0 flex-1 leading-tight">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-sm font-medium">{task.taskTitle}</span>
                                                        {task.priority && <Pill tone={priorityTone(task.priority)}>{getRequirementComplaintCategoryLabel(task.priority)}</Pill>}
                                                    </div>
                                                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={task.taskDescription}>
                                                        {task.taskDescription ? `${task.taskDescription} · ` : ''}Due {format(new Date(task.dueDate), 'dd MMM yyyy')} · {task.assignedToName || 'Unassigned'}
                                                    </div>
                                                </div>
                                                <select
                                                    onChange={(e) => handleChangeStatus(task.id, e.target.value)}
                                                    value={task.status}
                                                    aria-label="Status"
                                                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                                >
                                                    <option value="Assigned">Assigned</option>
                                                    <option value="Complete">Complete</option>
                                                    <option value="On Going">On Going</option>
                                                </select>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                            <DateRangeError fromDate={startDate} toDate={endDate} />
                        </div>
                    );
                };

                const tabs: DetailTab[] = [
                    {
                        value: 'overview',
                        label: 'Overview',
                        icon: LayoutDashboard,
                        content: customerData ? (
                            <div className="grid gap-4 lg:grid-cols-2">
                                <Section icon={Activity} title="Activity" className="lg:row-span-2" bodyClassName="p-0">
                                    <ActivityTimeline
                                        groups={[
                                            ...(upcomingItems.length ? [{ label: `Open items · ${upcomingItems.length}`, items: upcomingItems }] : []),
                                            { label: 'Recent', items: recentItems, empty: 'No visits or notes recorded yet.' },
                                        ]}
                                    />
                                </Section>
                                <Section icon={User} title="Contact">
                                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                                        <Info label={ownerLabel} value={fullName} />
                                        <Info label="Phone" value={phone ? <a href={`tel:${phone}`} className="hover:underline">{phone}</a> : null} />
                                        <Info label="Email" value={email} className="sm:col-span-2" />
                                        <Info label={kindLabel === 'Store' ? 'Store / shop' : kindLabel === 'Firm' ? 'Firm name' : 'Project name'} value={storeLabel} />
                                        <Info label="Client type" value={clientTypeLabel ? <span className="capitalize">{clientTypeLabel}</span> : null} />
                                        <Info label="Managed by" value={managedBy || null} />
                                        <Info label="Year of joining" value={customerData.yearOfJoining != null ? String(customerData.yearOfJoining) : 'Not recorded'} />
                                        {brandsInUse.length > 0 && (
                                            <Info
                                                className="sm:col-span-2"
                                                label="Brands in use"
                                                value={<span className="flex flex-wrap gap-1.5">{brandsInUse.map((b) => <Pill key={b} tone="info">{b}</Pill>)}</span>}
                                            />
                                        )}
                                        {formattedDob && <Info label="Date of birth" value={<span className={birthdayToday ? 'text-pink-600' : undefined}>{formattedDob}</span>} />}
                                    </dl>
                                </Section>
                                {(isDealerType || isSiteVisit || isProType) && (
                                    <Section icon={isSiteVisit ? HardHat : Store} title={isSiteVisit ? 'Project details' : isProType ? 'Firm details' : 'Shop details'}>
                                        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                                            {isDealerType && <>
                                                <Info label="Shop age" value={txt('shopAgeYears') ? `${txt('shopAgeYears')} years` : null} />
                                                <Info label="Ownership" value={enumLabel(txt('ownershipType')) || null} />
                                                <Info label="Dealer type" value={txt('dealerType') === 'ICON' ? 'Icon' : txt('dealerType') === 'NON_ICON' ? 'Non-Icon' : null} />
                                                <Info label="Dealer subtype" value={enumLabel(txt('dealerSubType')).replace('Non Exclusive', 'Non-exclusive') || null} />
                                                <Info label="Stock" value={stockText || null} />
                                                <Info label="GST" value={txt('gstNumber') ? <span className="font-mono">{txt('gstNumber')}</span> : null} />
                                            </>}
                                            {isSiteVisit && <>
                                                <Info label="Contractor" value={txt('contractorName') || null} />
                                                <Info label="Engineer" value={txt('engineerName') || null} />
                                                <Info label="Project type" value={enumLabel(txt('projectType')) || null} />
                                                <Info label="Project size" value={projectSize || null} />
                                                <Info label="Construction stage" value={enumLabel(txt('constructionStage')) || null} />
                                                <Info label="Purchased from" value={txt('purchasedFrom') || null} />
                                            </>}
                                            {isProType && <>
                                                <Info label="Industry" value={txt('industry') || null} />
                                                <Info label="Company size" value={txt('companySize') || null} />
                                                <Info label="Experience" value={txt('yearsOfExperience') ? `${txt('yearsOfExperience')} years` : null} />
                                                <Info label="GST" value={txt('gstNumber') ? <span className="font-mono">{txt('gstNumber')}</span> : null} />
                                            </>}
                                            {productCats.length > 0 && (
                                                <Info
                                                    className="sm:col-span-2"
                                                    label={isSiteVisit ? 'Consumption' : isProType ? 'Specialisation' : 'Products'}
                                                    value={<span className="flex flex-wrap gap-1.5">{productCats.map((p) => <Pill key={p} tone="neutral">{p}</Pill>)}</span>}
                                                />
                                            )}
                                        </dl>
                                    </Section>
                                )}
                                {(isSiteVisit || isProType) && proContacts.length > 0 && (
                                    <Section icon={User} title={isSiteVisit ? `Site contacts · ${proContacts.length}` : `Professionals · ${proContacts.length}`}>
                                        <ul className="divide-y">
                                            {proContacts.map((p, i) => {
                                                const nm = String(p.name || p.professionalName || 'Unnamed contact');
                                                const ph = String(p.contact || p.primaryContact || p.contactNumber || p.phone || '');
                                                const sub = [p.role, p.firmName, p.experience, p.dateOfBirth && `DOB ${p.dateOfBirth}`].filter(Boolean).join(' · ');
                                                return (
                                                    <li key={String(p.id ?? i)} className="flex items-center justify-between gap-3 py-2">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium">{nm}</div>
                                                            {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
                                                        </div>
                                                        {ph && <a href={`tel:${ph}`} className="shrink-0 text-xs tabular-nums hover:underline">{ph}</a>}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </Section>
                                )}
                                <Section
                                    icon={MapPin}
                                    title="Address"
                                    action={mapsUrl ? (
                                        <>
                                            {directionsUrl && (
                                                <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                                    <a href={directionsUrl} target="_blank" rel="noopener noreferrer"><Navigation className="mr-1.5 h-3.5 w-3.5" />Directions</a>
                                                </Button>
                                            )}
                                            <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin className="mr-1.5 h-3.5 w-3.5" />Open in Maps</a>
                                            </Button>
                                        </>
                                    ) : undefined}
                                >
                                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                                        <Info label="Address" value={addressParts.length ? addressParts.join(', ') : null} className="sm:col-span-2" />
                                        <Info label="District" value={(customerData.district as string) || null} />
                                        <Info label="Sub-district / Taluka" value={(customerData.subDistrict as string) || null} />
                                        <Info label="City" value={(customerData.city as string) || null} />
                                        <Info label="State" value={(customerData.state as string) || null} />
                                        <Info label="Country" value={(customerData.country as string) || null} />
                                        <Info
                                            label="Pin location"
                                            value={hasCoords ? (
                                                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 tabular-nums hover:underline">
                                                    {lat.toFixed(5)}, {lng.toFixed(5)}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                                </a>
                                            ) : <span className="font-normal text-muted-foreground">Not captured yet</span>}
                                        />
                                    </dl>
                                </Section>
                                {(createdOn || updatedOn) && (
                                    <p className="px-1 text-[11px] text-muted-foreground lg:col-span-2">
                                        {createdOn && <>Customer since {formatDateToUserFriendly(createdOn)}</>}
                                        {createdOn && updatedOn && ' · '}
                                        {updatedOn && <>Last updated {formatDateToUserFriendly(updatedOn)}</>}
                                    </p>
                                )}
                            </div>
                        ) : null,
                    },
                    {
                        value: 'visits',
                        label: 'Visits',
                        icon: CalendarDays,
                        count: visitTotalCount ?? undefined,
                        content: (
                            <Section
                                description={`${visitTotalCount ?? filteredVisitsData.length} ${(visitTotalCount ?? filteredVisitsData.length) === 1 ? 'visit' : 'visits'} · newest first`}
                                bodyClassName="p-0"
                                action={
                                    <select
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        aria-label="Filter by status"
                                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                        <option value="All Statuses">All statuses</option>
                                        <option value="Assigned">Assigned</option>
                                        <option value="Complete">Complete</option>
                                    </select>
                                }
                            >
                                {isLoadingVisits ? (
                                    <div role="status" className="py-8 text-center text-xs text-muted-foreground">Loading visits…</div>
                                ) : visitsError ? (
                                    <div role="alert" className="flex items-center justify-between gap-3 p-4 text-xs text-destructive">
                                        <span>{visitsError}</span>
                                        <Button variant="outline" size="sm" onClick={() => fetchVisitsData(getStoreIdString(), currentPage.visits)}>Retry</Button>
                                    </div>
                                ) : filteredVisitsData.length === 0 ? (
                                    <EmptyState compact title="No visits found." />
                                ) : (
                                    <ul className="divide-y">
                                        {filteredVisitsData.map((visit, index) => {
                                            const { status } = getOutcomeStatus(visit);
                                            return (
                                                <li key={visit.id ?? index}>
                                                    <button type="button" onClick={() => router.push(`/dashboard/visits/${visit.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
                                                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        <span className="min-w-0 flex-1 leading-tight">
                                                            <span className="block truncate text-sm font-medium">{visit.purpose || 'Visit'}</span>
                                                            <span className="block truncate text-[11px] text-muted-foreground">{visit.employeeName}</span>
                                                        </span>
                                                        <Pill tone={visitTone(status)}>{status}</Pill>
                                                        <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{formatDateToUserFriendly(visit.visit_date)}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                {!visitsError && visitTotalPages > 1 && (
                                    <nav aria-label="Customer visit pages" className="flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isLoadingVisits || currentPage.visits <= 1} onClick={() => handlePageChange('visits', currentPage.visits - 1)}>Previous</Button>
                                        <span className="text-xs text-muted-foreground">Page {currentPage.visits} of {visitTotalPages}</span>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isLoadingVisits || currentPage.visits >= visitTotalPages} onClick={() => handlePageChange('visits', currentPage.visits + 1)}>Next</Button>
                                    </nav>
                                )}
                            </Section>
                        ),
                    },
                    {
                        value: 'brands',
                        label: 'Brands',
                        icon: Tag,
                        count: brandRows.length,
                        content: (
                            <Section description={`${brandRows.length} brand ${brandRows.length === 1 ? 'record' : 'records'} from visits`} bodyClassName="p-0">
                                {brandRows.length === 0 ? (
                                    <EmptyState compact title="No brand or material details recorded yet." />
                                ) : (
                                    <ul className="divide-y">
                                        {brandRows.map((r) => (
                                            <li key={r.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 transition-colors hover:bg-muted/30">
                                                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <div className="min-w-0 flex-1 leading-tight">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate text-sm font-medium">{r.name}</span>
                                                        {r.category && <Pill tone="info" className="uppercase">{r.category}</Pill>}
                                                    </div>
                                                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">Purchased from {r.from || '—'}</div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-4 text-[11px] text-muted-foreground">
                                                    <span>Steel <span className="ml-1 text-xs font-semibold tabular-nums text-foreground">{hasQty(r.steel) ? `${String(r.steel).trim()} t` : '—'}</span></span>
                                                    <span>Cement <span className="ml-1 text-xs font-semibold tabular-nums text-foreground">{hasQty(r.cement) ? String(r.cement).trim() : '—'}</span></span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                        ),
                    },
                    {
                        value: 'notes',
                        label: 'Notes',
                        icon: StickyNote,
                        count: notesData.length,
                        content: (
                            <div className="space-y-3">
                                <Section
                                    description={`${notesData.length} ${notesData.length === 1 ? 'note' : 'notes'} · shared with the team`}
                                    bodyClassName="p-0"
                                    action={<Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => { setIsEditMode(false); setNoteContent(''); setEditingNoteId(null); setIsModalVisible(true); }}><Plus className="mr-1.5 h-3.5 w-3.5" />Add note</Button>}
                                >
                                    {notesData.length === 0 && <EmptyState compact title="No notes yet. Add one to share context with the team." />}
                                </Section>
                                {notesData.length > 0 && (
                                    <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                        {notesData.map((note) => (
                                            <article key={note.id} className="group flex min-w-0 flex-col rounded-lg bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted/80">
                                                <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed">{note.content}</p>
                                                <footer className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                                    <span className="min-w-0 truncate"><span className="font-medium text-foreground/80">{note.employeeName || 'Staff'}</span> · {formatDateToUserFriendly(note.createdDate)}</span>
                                                    <span className="flex shrink-0 items-center gap-2 md:opacity-0 md:transition-opacity md:focus-within:opacity-100 md:group-hover:opacity-100">
                                                        <button type="button" onClick={() => handleEditNote(note)} className="font-medium hover:text-foreground">Edit</button>
                                                        <button type="button" onClick={() => setNotePendingDelete(note)} className="font-medium hover:text-destructive">Delete</button>
                                                    </span>
                                                </footer>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ),
                    },
                    { value: 'complaints', label: 'Complaints', icon: MessageSquare, count: complaintsData.length, content: taskPanel('complaint') },
                    { value: 'requirements', label: 'Requirements', icon: ClipboardList, count: requirementsData.length, content: taskPanel('requirement') },
                ];

                return (
                    <>
                        <DetailHero
                            name={fullName || 'Customer'}
                            onBack={handleBackClick}
                            backLabel="Back to customers"
                            avatarExtra={birthdayToday ? (
                                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 shadow"><Cake className="h-3 w-3 text-white" /></span>
                            ) : undefined}
                            badges={<>
                                {clientTypeLabel && <Pill tone="info" className="capitalize">{clientTypeLabel}</Pill>}
                                {birthdayToday && <Pill tone="warning"><Cake className="h-3 w-3" />Birthday today</Pill>}
                                {stage && <Pill tone={stage.toUpperCase() === 'COMPLETING' ? 'success' : 'warning'}><HardHat className="h-3 w-3" />{humanize(stage)}</Pill>}
                                {isArchived && <Pill tone="danger">Archived</Pill>}
                            </>}
                            meta={[
                                ...(storeLabel ? [{ icon: Store, label: storeLabel, title: kindLabel }] : []),
                                ...(phone ? [{ icon: Phone, label: phone, href: `tel:${phone}` }] : []),
                                ...(email ? [{ icon: Mail, label: email, href: `mailto:${email}` }] : []),
                                ...(cityState ? [{ icon: MapPin, label: cityState, ...(mapsUrl ? { href: mapsUrl, title: 'Open in Google Maps' } : {}) }] : []),
                                ...(managedBy ? [{ icon: User, label: managedBy, title: 'Assigned employee' }] : []),
                            ]}
                            actions={<>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        setActiveTab('basic-info');
                                        setHasUnlockedAddressTab(false);
                                        setIsEditCustomerModalVisible(true);
                                    }}
                                >
                                    <Edit className="mr-1.5 h-3.5 w-3.5" />Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        resetComplaintTaskState();
                                        setIsComplaintModalOpen(true);
                                    }}
                                >
                                    <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Complaint
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                        resetRequirementTaskState();
                                        setIsRequirementModalOpen(true);
                                    }}
                                >
                                    <ClipboardList className="mr-1.5 h-3.5 w-3.5" />Requirement
                                </Button>
                            </>}
                            kpis={<>
                                <KpiCell icon={CalendarDays} label="Visits" value={visitTotalCount ?? '—'} hint={visitTotalCount === 0 ? 'None yet' : visitsThisMonth != null ? `${visitsThisMonth} in last 30 days` : undefined} />
                                <KpiCell icon={CalendarIcon} label="Last visit" value={lastVisitDate ? formatDateToUserFriendly(lastVisitDate) : '—'} hint={lastOutcome ? `${humanize(lastOutcome)}${visitsData[0]?.employeeName ? ` · ${visitsData[0].employeeName}` : ''}` : visitsData[0]?.employeeName} />
                                <KpiCell icon={StickyNote} label="Notes" value={notesData.length} hint={notesData[0] ? `Latest ${formatDateToUserFriendly(notesData[0].createdDate)}` : 'None yet'} />
                                <KpiCell icon={ListChecks} label="Open items" value={openTasks.length} tone={openTasks.length ? 'warning' : undefined} hint={openTasks.length ? 'Complaints & requirements' : 'Nothing pending'} />
                            </>}
                            nextStep={openTasks.length > 0
                                ? { done: false, text: `${openTasks.length} open ${openTasks.length === 1 ? 'item needs' : 'items need'} attention in the selected dates.`, action: <Button size="sm" variant="outline" onClick={() => setActiveActivityTab(openTasks[0].taskType === 'complaint' ? 'complaints' : 'requirements')}>Review</Button> }
                                : { done: true, text: 'No open complaints or requirements in the selected dates.' }}
                        />
                        <DetailShell tabs={tabs} value={activeActivityTab} onValueChange={setActiveActivityTab} />
                    </>
                );
            })()}

            {/* Side panels */}
            <FormSheet
                open={isModalVisible}
                onOpenChange={(open) => { if (!open) requestCloseNoteModal(); }}
                icon={StickyNote}
                title={isEditMode ? 'Edit note' : 'Add note'}
                description="Quick context so everyone stays aligned on this customer."
                footerNote="Notes are visible to the whole team."
                onSubmit={isEditMode ? handleSaveEditNote : handleAddNote}
                submitLabel={isNoteSaving ? (isEditMode ? 'Updating…' : 'Adding…') : (isEditMode ? 'Update note' : 'Add note')}
                submitting={isNoteSaving}
                submitDisabled={!noteContent.trim()}
            >
                <FormGroup title="Note">
                    <FormField label="What happened?" required hint={`${noteContent.length} characters`}>
                        <Textarea
                            autoFocus
                            placeholder="Write a note that teammates can follow up on…"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="min-h-[180px] resize-none text-sm leading-relaxed"
                        />
                    </FormField>
                </FormGroup>
            </FormSheet>

            <Dialog
                open={notePendingDelete != null}
                onOpenChange={(open) => {
                    if (!open) {
                        setNotePendingDelete(null);
                    }
                }}
            >
                <DialogContent className="max-w-sm border-0 shadow-lg">
                    <DialogHeader className="gap-1">
                        <DialogTitle>Delete Note?</DialogTitle>
                        <DialogDescription className="text-xs">
                            This note will be removed permanently for everyone viewing this customer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setNotePendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteNoteConfirm}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FormSheet
                wide
                open={isEditCustomerModalVisible}
                onOpenChange={(open) => { if (!open) requestCloseEditCustomerModal(); }}
                icon={Edit}
                title="Edit customer"
                description="Update contact, business and address details."
                errors={customerEditError ? [customerEditError] : undefined}
                footerNote="Primary phone is the customer's identity and can't be changed here."
                onSubmit={handleSubmit}
                submitLabel="Save changes"
                submitting={isUpdatingCustomer}
                submitDisabled={!customerFormIsDirty}
            >
                <FormGroup title={String(customerData?.clientType || '').toLowerCase() === 'site visit' ? 'Site owner' : 'Owner'} columns={2}>
                    <FormField label="First name" required>
                        <Input name="clientFirstName" value={formData.clientFirstName || ''} onChange={handleInputChange} className="h-10 text-sm" />
                    </FormField>
                    <FormField label="Last name" required>
                        <Input name="clientLastName" value={formData.clientLastName || ''} onChange={handleInputChange} className="h-10 text-sm" />
                    </FormField>
                    <FormField label="Primary phone" hint="Locked: used to identify the customer.">
                        <Input value={String(formData.primaryContact ?? '')} disabled className="h-10 cursor-not-allowed bg-muted text-sm" />
                    </FormField>
                    <FormField label="Secondary phone">
                        <Input name="secondaryContact" inputMode="numeric" value={String(formData.secondaryContact ?? '')} onChange={handleInputChange} placeholder="Optional" className="h-10 text-sm" />
                    </FormField>
                    <FormField label="Email" className="sm:col-span-2">
                        <Input name="email" type="email" value={formData.email || ''} onChange={handleInputChange} placeholder="name@example.com" className="h-10 text-sm" />
                    </FormField>
                </FormGroup>

                <FormGroup title="Business" columns={2}>
                    <FormField label={(() => { const t = String(customerData?.clientType || '').toLowerCase(); return t === 'site visit' ? 'Project name' : ['professional', 'engineer', 'architect', 'contractor'].some((k) => t.includes(k)) ? 'Firm name' : 'Store name'; })()}>
                        <Input name="storeName" value={formData.storeName && formData.storeName !== '.' ? formData.storeName : ''} onChange={handleInputChange} placeholder="Shop or firm name" className="h-10 text-sm" />
                    </FormField>
                    <FormField label="GST number">
                        <Input name="gstNumber" value={formData.gstNumber || ''} onChange={(e) => handleInputChange({ ...e, target: { ...e.target, name: 'gstNumber', value: e.target.value.toUpperCase() } } as React.ChangeEvent<HTMLInputElement>)} maxLength={15} placeholder="15-character GSTIN" className="h-10 font-mono text-sm uppercase" />
                    </FormField>
                    {(['shop', 'dealer', 'dealer/shop'].includes(String(customerData?.clientType || '').toLowerCase()) || formData.dealerType || formData.ownershipType) && (
                        <>
                            <FormField label="Ownership">
                                <Select value={formData.ownershipType || undefined} onValueChange={(v) => { setCustomerEditError(null); setFormData((prev) => ({ ...prev, ownershipType: v })); }}>
                                    <SelectTrigger className="h-10 w-full text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OWNED">Owned</SelectItem>
                                        <SelectItem value="RENTED">Rented</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField label="Shop age (years)">
                                <Input name="shopAgeYears" type="number" min={0} value={String(formData.shopAgeYears ?? '')} onChange={handleInputChange} className="h-10 text-sm" />
                            </FormField>
                            <FormField label="Dealer type">
                                <Select
                                    value={formData.dealerType || undefined}
                                    onValueChange={(v) => { setCustomerEditError(null); setFormData((prev) => ({ ...prev, dealerType: v, dealerSubType: v === 'NON_ICON' ? 'NON_EXCLUSIVE' : prev.dealerSubType })); }}
                                >
                                    <SelectTrigger className="h-10 w-full text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ICON">Icon</SelectItem>
                                        <SelectItem value="NON_ICON">Non-Icon</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                            <FormField label="Dealer subtype" hint={formData.dealerType === 'NON_ICON' ? 'Non-Icon dealers are always non-exclusive.' : undefined}>
                                <Select
                                    value={formData.dealerSubType || undefined}
                                    onValueChange={(v) => { setCustomerEditError(null); setFormData((prev) => ({ ...prev, dealerSubType: v })); }}
                                    disabled={formData.dealerType !== 'ICON'}
                                >
                                    <SelectTrigger className="h-10 w-full text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EXCLUSIVE">Exclusive</SelectItem>
                                        <SelectItem value="NON_EXCLUSIVE">Non-exclusive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormField>
                        </>
                    )}
                </FormGroup>

                <FormGroup title="Address" description="Pick from the list so names match the territory records. Changes are checked against the owner's assigned territory." columns={2}>
                    <FormField label="Address line 1" className="sm:col-span-2">
                        <Input name="addressLine1" value={formData.addressLine1 || ''} onChange={handleInputChange} className="h-10 text-sm" />
                    </FormField>
                    <FormField label="Address line 2" className="sm:col-span-2">
                        <Input name="addressLine2" value={formData.addressLine2 || ''} onChange={handleInputChange} className="h-10 text-sm" />
                    </FormField>
                    <FormField label="Landmark" className="sm:col-span-2">
                        <Input name="landmark" value={formData.landmark || ''} onChange={handleInputChange} className="h-10 text-sm" />
                    </FormField>
                    <FormField label="State">
                        {(() => {
                            const o = locOptions(locStates.map((st) => st.stateName), formData.state);
                            return (
                                <SearchableSelect
                                    modal
                                    triggerId="edit-state"
                                    options={o.options.map((n) => ({ value: n, label: n }))}
                                    value={o.value}
                                    disabled={false}
                                    placeholder={locStates.length ? 'Select state' : 'Loading…'}
                                    searchPlaceholder="Search state…"
                                    triggerClassName="h-10 w-full text-sm font-normal"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                    onSelect={(option) => { if (!option) return; setCustomerEditError(null); setFormData((prev) => ({ ...prev, state: option.value, village: '', taluka: '', city: '' })); }}
                                />
                            );
                        })()}
                    </FormField>
                    <FormField label="District">
                        {(() => {
                            const o = locOptions(locDistricts.map((d) => d.districtName), formData.village);
                            return (
                                <SearchableSelect
                                    modal
                                    triggerId="edit-district"
                                    options={o.options.map((n) => ({ value: n, label: n }))}
                                    value={o.value}
                                    disabled={!formData.state}
                                    placeholder={formData.state ? 'Select district' : 'Choose state first'}
                                    searchPlaceholder="Search district…"
                                    triggerClassName="h-10 w-full text-sm font-normal"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                    onSelect={(option) => { if (!option) return; setCustomerEditError(null); setFormData((prev) => ({ ...prev, village: option.value, taluka: '', city: '' })); }}
                                />
                            );
                        })()}
                    </FormField>
                    <FormField label="Sub-district / Taluka">
                        {(() => {
                            const o = locOptions(locSubDistricts.map((d) => d.subDistrictName), formData.taluka);
                            return (
                                <SearchableSelect
                                    modal
                                    triggerId="edit-subdistrict"
                                    options={o.options.map((n) => ({ value: n, label: n }))}
                                    value={o.value}
                                    disabled={!formData.village}
                                    placeholder={formData.village ? 'Select sub-district' : 'Choose district first'}
                                    searchPlaceholder="Search sub-district / taluka…"
                                    triggerClassName="h-10 w-full text-sm font-normal"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                    onSelect={(option) => { if (!option) return; setCustomerEditError(null); setFormData((prev) => ({ ...prev, taluka: option.value, city: '' })); }}
                                />
                            );
                        })()}
                    </FormField>
                    <FormField label="City">
                        {(() => {
                            const o = locOptions(locCities.map((c) => c.cityName), formData.city);
                            return (
                                <SearchableSelect
                                    modal
                                    triggerId="edit-city"
                                    options={o.options.map((n) => ({ value: n, label: n }))}
                                    value={o.value}
                                    disabled={!formData.taluka}
                                    placeholder={formData.taluka ? 'Select city' : 'Choose sub-district first'}
                                    searchPlaceholder="Search city…"
                                    triggerClassName="h-10 w-full text-sm font-normal"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                    onSelect={(option) => { if (!option) return; setCustomerEditError(null); setFormData((prev) => ({ ...prev, city: option.value })); }}
                                />
                            );
                        })()}
                    </FormField>
                    <FormField label="Pincode">
                        <Input name="pincode" inputMode="numeric" maxLength={6} value={String(formData.pincode ?? '')} onChange={handleInputChange} className="h-10 text-sm" />
                    </FormField>
                    <FormField label="Country">
                        <Input value="India" disabled className="h-10 cursor-not-allowed bg-muted text-sm" />
                    </FormField>
                </FormGroup>
            </FormSheet>

            {renderTaskSheet('complaint')}
            {renderTaskSheet('requirement')}
        </div>
    );
}
