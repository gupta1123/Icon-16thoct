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
import { AlertCircle, CalendarIcon, Edit, Search, Check, MessageSquare, ClipboardList, User, Mail, Phone, Store, Tag, MapPin, Building, Flag, Loader2, Cake } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { API, API_BASE_URL, type VisitBrandPurchase } from "@/lib/api";
import { useAuth } from '@/components/auth-provider';
import BrandTab from "@/components/BrandTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { useGuardedRouter, useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';

const ITEMS_PER_PAGE = 3;
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
    const [isLoadingVisits, setIsLoadingVisits] = useState(true);
    const [visitsError, setVisitsError] = useState<string | null>(null);
    const visitsRequest = useRef(0);
    const [requirementsData, setRequirementsData] = useState<Task[]>([]);
    const [complaintsData, setComplaintsData] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
    const [activeInfoTab, setActiveInfoTab] = useState('leads-info');
    const [isEditCustomerModalVisible, setIsEditCustomerModalVisible] = useState(false);
    const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
    const [customerEditError, setCustomerEditError] = useState<string | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [activeActivityTab, setActiveActivityTab] = useState('visits');
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
        priority: 'low',
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
        priority: 'low',
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
        try {
            const response = await fetch(`${API_BASE_URL}/task/getByStoreAndDate?storeId=${id}&start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch customer tasks (${response.status})`);
            }
            const data = await response.json() as Task[];
            const tasks = Array.isArray(data) ? data : [];
            setRequirementsData(tasks.filter((task) => task.taskType === 'requirement'));
            setComplaintsData(tasks.filter((task) => task.taskType === 'complaint'));
        } catch (error) {
            console.error('Error fetching customer tasks:', error);
            setRequirementsData([]);
            setComplaintsData([]);
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
            priority: 'low',
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
            priority: 'low',
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
                    priority: "Medium",
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

            const requestData = {
                clientFirstName,
                clientLastName,
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

    const allBrandPurchases = useMemo(() => {
        return visitsData.flatMap(v => v.brandPurchases || []);
    }, [visitsData]);

    if (isLoadingCustomer) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-semibold text-foreground">Customer Details</CardTitle>
                                        <p className="text-sm text-muted-foreground">Customer information and actions</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={handleBackClick}>
                                        Back
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="h-14 w-14 rounded-xl" />
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <Skeleton className="h-6 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-semibold text-foreground">Customer Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <Skeleton className="h-40 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    const customerDob = customerData ? ((customerData.dateOfBirth as string) || (customerData.dob as string)) : null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="space-y-6 pt-6">
                            <div className="flex items-start gap-4">
                                <div className="relative h-14 w-14 rounded-xl border-2 border-dashed bg-muted flex items-center justify-center shrink-0">
                                    <span className="text-lg font-semibold text-muted-foreground">
                                        {customerData ? getInitials(`${customerData.clientFirstName} ${customerData.clientLastName}`) : ''}
                                    </span>
                                    {customerData && isBirthdayToday(customerDob) && (
                                        <div className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                            <Cake className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <h3 className="text-lg font-semibold text-foreground truncate">
                                                {customerData ? `${customerData.clientFirstName} ${customerData.clientLastName}` : ''}
                                            </h3>
                                            {customerData && isBirthdayToday(customerDob) && (
                                                <Badge className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 shadow-md animate-pulse text-xs">
                                                    <Cake className="h-3 w-3 mr-1" />
                                                    Birthday Today! <span>🎉</span>
                                                </Badge>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleBackClick} className="ml-auto shrink-0 text-xs h-8">
                                            Back
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {customerData ? (customerData.storeName as string) : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    title="Edit Customer"
                                    onClick={() => {
                                        setActiveTab('basic-info');
                                        setHasUnlockedAddressTab(false);
                                        setIsEditCustomerModalVisible(true);
                                    }}
                                    className="h-10 w-10"
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    title="Log Complaint"
                                    onClick={() => {
                                        resetComplaintTaskState();
                                        setIsComplaintModalOpen(true);
                                    }}
                                    className="h-10 w-10"
                                >
                                    <MessageSquare className="h-4 w-4" />
                                </Button>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    title="Add Requirement"
                                    onClick={() => {
                                        resetRequirementTaskState();
                                        setIsRequirementModalOpen(true);
                                    }}
                                    className="h-10 w-10"
                                >
                                    <ClipboardList className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex border-b">
                                    <button
                                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeInfoTab === 'leads-info'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveInfoTab('leads-info')}
                                    >
                                        Leads Info
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeInfoTab === 'address-info'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveInfoTab('address-info')}
                                    >
                                        Address Info
                                    </button>
                                </div>

                                {activeInfoTab === 'leads-info' && customerData && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-muted-foreground">Customer Name</p>
                                                <p className="text-sm text-foreground">{(customerData.clientFirstName as string)} {(customerData.clientLastName as string)}</p>
                                            </div>
                                        </div>
                                        {(customerData.email as string) && (
                                            <div className="flex items-start gap-3">
                                                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                                                    <p className="text-sm text-foreground">{customerData.email as string}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-3">
                                            <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-muted-foreground">Phone</p>
                                                <p className="text-sm text-foreground">{customerData.primaryContact as number}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Store className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-muted-foreground">Store Name</p>
                                                <p className="text-sm text-foreground">{customerData.storeName as string}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-muted-foreground">Year of Joining</p>
                                                <p className="text-sm text-foreground">
                                                    {customerData.yearOfJoining != null
                                                        ? String(customerData.yearOfJoining)
                                                        : 'Not recorded'}
                                                </p>
                                            </div>
                                        </div>
                                        {(customerData.clientType as string) && (
                                            <div className="flex items-start gap-3">
                                                <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-muted-foreground">Client Type</p>
                                                    <p className="text-sm text-foreground capitalize">{customerData.clientType as string}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(() => {
                                            const dob = (customerData.dateOfBirth as string) || (customerData.dob as string);
                                            const formattedDob = formatDateOfBirth(dob);
                                            const isBirthday = isBirthdayToday(dob);
                                            
                                            if (!formattedDob) return null;
                                            
                                            return (
                                                <div className="flex items-start gap-3">
                                                    <CalendarIcon className={`h-4 w-4 mt-0.5 shrink-0 ${isBirthday ? 'text-pink-500' : 'text-muted-foreground'}`} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-medium text-muted-foreground">Date of Birth</p>
                                                            {isBirthday && (
                                                                <Badge variant="outline" className="bg-pink-50 text-pink-600 border-pink-200 text-xs">
                                                                    <Cake className="h-3 w-3 mr-1" />
                                                                    Birthday!
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className={`text-sm ${isBirthday ? 'font-semibold text-pink-600' : 'text-foreground'}`}>
                                                            {formattedDob}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {activeInfoTab === 'address-info' && customerData && (
                                    <div className="space-y-3">
                                        {(() => {
                                            const addressParts = [];
                                            if (customerData.addressLine1) addressParts.push(customerData.addressLine1);
                                            if (customerData.addressLine2) addressParts.push(customerData.addressLine2);
                                            if (customerData.village) addressParts.push(customerData.village);
                                            if (customerData.taluka) addressParts.push(customerData.taluka);
                                            if (customerData.city) addressParts.push(customerData.city);
                                            if (customerData.district) addressParts.push(customerData.district);
                                            if (customerData.state) addressParts.push(customerData.state);
                                            if (customerData.pincode) addressParts.push(customerData.pincode);

                                            return addressParts.length > 0 ? (
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-muted-foreground">Address</p>
                                                        <p className="text-sm text-foreground">{addressParts.join(', ')}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                        {(customerData.city as string) && (
                                            <div className="flex items-start gap-3">
                                                <Building className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-muted-foreground">City</p>
                                                    <p className="text-sm text-foreground">{customerData.city as string}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(customerData.state as string) && (
                                            <div className="flex items-start gap-3">
                                                <Flag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-muted-foreground">State</p>
                                                    <p className="text-sm text-foreground">{customerData.state as string}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-semibold text-foreground">Customer Activity</CardTitle>
                                    <p className="text-xs text-muted-foreground">View visits, notes, complaints, and requirements</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex border-b overflow-x-auto">
                                    <button
                                        className={`px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeActivityTab === 'visits'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('visits')}
                                    >
                                        Visits
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeActivityTab === 'brands'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                                }`}
                                        onClick={() => setActiveActivityTab('brands')}
                                    >
                                        Brands
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeActivityTab === 'notes'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('notes')}
                                    >
                                        Notes
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeActivityTab === 'complaints'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('complaints')}
                                    >
                                        Complaints
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeActivityTab === 'requirements'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('requirements')}
                                    >
                                        Requirements
                                    </button>
                                </div>

                                {activeActivityTab === 'visits' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <select
                                                onChange={(e) => handleStatusChange(e.target.value)}
                                                className="px-3 py-1.5 border border-input bg-background rounded-md text-xs"
                                            >
                                                <option value="All Statuses">All Statuses</option>
                                                <option value="Assigned">Assigned</option>
                                                <option value="Complete">Complete</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            {isLoadingVisits ? (
                                                <div role="status" className="py-8 text-center text-xs text-muted-foreground">Loading visits…</div>
                                            ) : visitsError ? (
                                                <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-4 text-xs">
                                                    <span>{visitsError}</span>
                                                    <Button variant="outline" size="sm" onClick={() => fetchVisitsData(getStoreIdString(), currentPage.visits)}>Retry</Button>
                                                </div>
                                            ) : filteredVisitsData.length === 0 ? (
                                                <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg">No visits found.</div>
                                            ) : (
                                                filteredVisitsData.map((visit, index) => {
                                                    const { emoji, status, color } = getOutcomeStatus(visit);
                                                    return (
                                                        <div key={index} className="rounded-lg border bg-card p-4 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-medium text-foreground">Visit scheduled by {visit.employeeName}</span>
                                                                <span className="text-xs text-muted-foreground">{formatDateToUserFriendly(visit.visit_date)}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">{visit.purpose}</p>
                                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                                                                <div className="flex items-center gap-3">
                                                                    <Badge variant="secondary" className={color}>{emoji} {status}</Badge>
                                                                    <span className="text-xs text-muted-foreground">Purpose: <span className="text-foreground">{visit.purpose}</span></span>
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => router.push(`/dashboard/visits/${visit.id}`)}
                                                                    className="text-xs h-7 px-2"
                                                                >
                                                                    View Visit
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeActivityTab === 'visits' && !visitsError && visitTotalPages > 1 && (
                                    <nav aria-label="Customer visit pages" className="flex items-center justify-between gap-2 border-t pt-3">
                                        <Button variant="outline" size="sm" disabled={isLoadingVisits || currentPage.visits <= 1} onClick={() => handlePageChange('visits', currentPage.visits - 1)}>Previous</Button>
                                        <span className="text-xs text-muted-foreground">Page {currentPage.visits} of {visitTotalPages}</span>
                                        <Button variant="outline" size="sm" disabled={isLoadingVisits || currentPage.visits >= visitTotalPages} onClick={() => handlePageChange('visits', currentPage.visits + 1)}>Next</Button>
                                    </nav>
                                )}

                                {activeActivityTab === 'brands' && (
                                    <BrandTab brandPurchases={allBrandPurchases} />
                                )}

                                {activeActivityTab === 'notes' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-sm font-semibold text-foreground">Notes</h4>
                                            <Button size="sm" onClick={() => { setIsEditMode(false); setNoteContent(''); setEditingNoteId(null); setIsModalVisible(true); }} className="h-8 text-xs">
                                                Add Note
                                            </Button>
                                        </div>
                                        <div className="space-y-3">
                                            {notesData.length === 0 ? (
                                                <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg">No notes recorded yet.</div>
                                            ) : (
                                                paginate(notesData, currentPage.notes).map((note) => (
                                                    <div key={note.id} className="rounded-lg border bg-card p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold text-foreground">{note.employeeName || 'Staff'}</span>
                                                            <span className="text-xs text-muted-foreground">{formatDateToUserFriendly(note.createdDate)}</span>
                                                        </div>
                                                        <p className="text-xs text-foreground whitespace-pre-wrap">{note.content}</p>
                                                        <div className="flex justify-end gap-2 pt-2 border-t">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditNote(note)} className="h-7 text-xs px-2">Edit</Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setNotePendingDelete(note)} className="h-7 text-xs px-2 text-destructive">Delete</Button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeActivityTab === 'complaints' && (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                        {startDate ? format(new Date(startDate), 'MMM dd, yyyy') : <span>Start Date</span>}
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
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                        {endDate ? format(new Date(endDate), 'MMM dd, yyyy') : <span>End Date</span>}
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
                                        <DateRangeError fromDate={startDate} toDate={endDate} />
                                        <div className="space-y-3">
                                            {complaintsData.length === 0 ? (
                                                <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg">No complaints found.</div>
                                            ) : (
                                                paginate(complaintsData, currentPage.complaints).map((complaint) => (
                                                    <div key={complaint.id} className="rounded-lg border bg-card p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold text-foreground">{complaint.taskTitle}</span>
                                                            <span className="text-xs text-muted-foreground">Due: {format(new Date(complaint.dueDate), 'MMM dd, yyyy')}</span>
                                                        </div>
                                                        <p className="text-xs text-foreground">{complaint.taskDescription}</p>
                                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Status:</span>
                                                                <select
                                                                    onChange={(e) => handleChangeStatus(complaint.id, e.target.value)}
                                                                    value={complaint.status}
                                                                    className="px-2 py-1 border border-input bg-background rounded text-xs"
                                                                >
                                                                    <option value="Assigned">Assigned</option>
                                                                    <option value="On Going">On Going</option>
                                                                    <option value="Complete">Complete</option>
                                                                </select>
                                                                <Badge variant="outline" className="text-xs">{complaint.priority}</Badge>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">Assigned to: {complaint.assignedToName}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeActivityTab === 'requirements' && (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                        {startDate ? format(new Date(startDate), 'MMM dd, yyyy') : <span>Start Date</span>}
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
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="h-8 text-xs font-normal">
                                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                        {endDate ? format(new Date(endDate), 'MMM dd, yyyy') : <span>End Date</span>}
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
                                        <DateRangeError fromDate={startDate} toDate={endDate} />
                                        <div className="space-y-3">
                                            {requirementsData.length === 0 ? (
                                                <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg">No requirements found.</div>
                                            ) : (
                                                paginate(requirementsData, currentPage.requirements).map((requirement) => (
                                                    <div key={requirement.id} className="rounded-lg border bg-card p-4 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold text-foreground">{requirement.taskTitle}</span>
                                                            <span className="text-xs text-muted-foreground">Due: {format(new Date(requirement.dueDate), 'MMM dd, yyyy')}</span>
                                                        </div>
                                                        <p className="text-xs text-foreground">{requirement.taskDescription}</p>
                                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Status:</span>
                                                                <select
                                                                    onChange={(e) => handleChangeStatus(requirement.id, e.target.value)}
                                                                    value={requirement.status}
                                                                    className="px-2 py-1 border border-input bg-background rounded text-xs"
                                                                >
                                                                    <option value="Assigned">Assigned</option>
                                                                    <option value="On Going">On Going</option>
                                                                    <option value="Complete">Complete</option>
                                                                </select>
                                                                <Badge variant="outline" className="text-xs">{requirement.priority}</Badge>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">Assigned to: {requirement.assignedToName}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            <Dialog
                open={isModalVisible}
                onOpenChange={(open) => {
                    if (!open) {
                        requestCloseNoteModal();
                    }
                }}
            >
                <DialogContent className="max-w-md border-0 shadow-lg">
                    <DialogHeader className="gap-1">
                        <DialogTitle>{isEditMode ? "Edit Note" : "Add Note"}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Add quick context so everyone stays aligned on this customer.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Write a note that teammates can follow up on..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="min-h-[140px] text-xs"
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={requestCloseNoteModal}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={isEditMode ? handleSaveEditNote : handleAddNote}
                            disabled={isNoteSaving || !noteContent.trim()}
                        >
                            {isNoteSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                    {isEditMode ? "Updating..." : "Adding..."}
                                </>
                            ) : (
                                isEditMode ? "Update Note" : "Add Note"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            <Dialog
                open={isEditCustomerModalVisible}
                onOpenChange={(open) => {
                    if (!open) {
                        requestCloseEditCustomerModal();
                    }
                }}
            >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="gap-1">
                        <DialogTitle>Edit Customer</DialogTitle>
                        <DialogDescription className="text-xs">
                            Update customer contact or address details.
                        </DialogDescription>
                    </DialogHeader>
                    {customerEditError && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{customerEditError}</span>
                        </div>
                    )}
                    <Tabs value={activeTab} onValueChange={handleCustomerTabChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="basic-info" className="text-xs">Basic Info</TabsTrigger>
                            <TabsTrigger
                                value="address-info"
                                className="text-xs"
                                disabled={!hasUnlockedAddressTab && activeTab !== "address-info"}
                            >
                                Address Info
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="basic-info">
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="clientFirstName" className="text-xs font-medium">First Name *</Label>
                                        <Input
                                            id="clientFirstName"
                                            name="clientFirstName"
                                            value={formData.clientFirstName}
                                            onChange={handleInputChange}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="clientLastName" className="text-xs font-medium">Last Name *</Label>
                                        <Input
                                            id="clientLastName"
                                            name="clientLastName"
                                            value={formData.clientLastName}
                                            onChange={handleInputChange}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email || ""}
                                            onChange={handleInputChange}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="primaryContact" className="text-xs font-medium">Phone</Label>
                                        <Input
                                            id="primaryContact"
                                            name="primaryContact"
                                            value={formData.primaryContact}
                                            disabled
                                            className="h-9 text-xs bg-muted cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <Button variant="ghost" size="sm" onClick={requestCloseEditCustomerModal}>
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setHasUnlockedAddressTab(true);
                                            setActiveTab("address-info");
                                        }}
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="address-info">
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="city" className="text-xs font-medium">City</Label>
                                        <Input
                                            id="city"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="state" className="text-xs font-medium">State</Label>
                                        <Input
                                            id="state"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleInputChange}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <Button variant="outline" size="sm" onClick={() => setActiveTab("basic-info")}>
                                        Back
                                    </Button>
                                    <Button size="sm" onClick={handleSubmit} disabled={isUpdatingCustomer}>
                                        {isUpdatingCustomer && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Log Complaint Modal */}
            <Dialog open={isComplaintModalOpen} onOpenChange={(open) => { if (!open) requestCloseComplaintModal(); }}>
                <DialogContent className="max-w-md border-0 shadow-lg">
                    <DialogHeader>
                        <DialogTitle>Log Complaint</DialogTitle>
                        <DialogDescription className="text-xs">Create a new complaint for this customer.</DialogDescription>
                    </DialogHeader>
                    {taskCreateError && (
                        <div className="p-2 text-xs text-destructive bg-destructive/10 rounded border border-destructive/20">{taskCreateError}</div>
                    )}
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Title</Label>
                            <Input
                                value={complaintTask.taskTitle}
                                onChange={(e) => setComplaintTask(prev => ({ ...prev, taskTitle: e.target.value }))}
                                placeholder="Complaint title"
                                className="h-9 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                                value={complaintTask.taskDesciption}
                                onChange={(e) => setComplaintTask(prev => ({ ...prev, taskDesciption: e.target.value }))}
                                placeholder="Complaint description"
                                className="min-h-[90px] text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={requestCloseComplaintModal}>Cancel</Button>
                        <Button size="sm" onClick={handleCreateComplaint} disabled={isCreatingTask || !complaintTask.taskTitle.trim()}>
                            {isCreatingTask && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Create Complaint
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Requirement Modal */}
            <Dialog open={isRequirementModalOpen} onOpenChange={(open) => { if (!open) requestCloseRequirementModal(); }}>
                <DialogContent className="max-w-md border-0 shadow-lg">
                    <DialogHeader>
                        <DialogTitle>Add Requirement</DialogTitle>
                        <DialogDescription className="text-xs">Add a new requirement for this customer.</DialogDescription>
                    </DialogHeader>
                    {taskCreateError && (
                        <div className="p-2 text-xs text-destructive bg-destructive/10 rounded border border-destructive/20">{taskCreateError}</div>
                    )}
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Title</Label>
                            <Input
                                value={requirementTask.taskTitle}
                                onChange={(e) => setRequirementTask(prev => ({ ...prev, taskTitle: e.target.value }))}
                                placeholder="Requirement title"
                                className="h-9 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                                value={requirementTask.taskDesciption}
                                onChange={(e) => setRequirementTask(prev => ({ ...prev, taskDesciption: e.target.value }))}
                                placeholder="Requirement description"
                                className="min-h-[90px] text-xs"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={requestCloseRequirementModal}>Cancel</Button>
                        <Button size="sm" onClick={handleCreateRequirement} disabled={isCreatingTask || !requirementTask.taskTitle.trim()}>
                            {isCreatingTask && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                            Add Requirement
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
