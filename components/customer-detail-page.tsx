"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { CalendarIcon, Edit, Trash2, Loader2, MessageCircle, Plus, X, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API, type StoreDto, type VisitDto, type Note as ApiNote, type StateDto, type DistrictDto, type SubDistrictDto, type CityDto } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import './CustomerDetail.css';

const ITEMS_PER_PAGE = 3;
const CATEGORY_SUGGESTIONS = ['Structure', 'Tiles', 'Pipes', 'Paints', 'Adhesives'];

const formatCategoryDisplay = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const parseCategoryList = (value: unknown): string[] => {
    const categories = new Set<string>();
    const addCategory = (input: string) => {
        const formatted = formatCategoryDisplay(input);
        if (formatted) categories.add(formatted);
    };

    if (!value) {
        return Array.from(categories);
    }

    if (Array.isArray(value)) {
        value.forEach((item) => {
            if (typeof item === 'string') {
                addCategory(item);
            }
        });
    } else if (typeof value === 'string') {
        value
            .split(',')
            .map((part) => part.trim())
            .forEach((part) => {
                if (part) addCategory(part);
            });
    }

    return Array.from(categories);
};

const toApiCategoryValue = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '_');

const extractCategoriesFromResponse = (data: unknown): string[] => {
    if (!data || typeof data !== 'object') return [];
    const record = data as Record<string, unknown>;
    const categories = new Set<string>();
    parseCategoryList(record.productCategory).forEach((category) => categories.add(category));
    parseCategoryList(record.productCategories).forEach((category) => categories.add(category));
    parseCategoryList(record.additionalInfo).forEach((category) => categories.add(category));
    return Array.from(categories);
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
    // Additional fields for new client types
    shopAgeYears?: number;
    ownershipType?: string;
    dealerType?: string;
    dealerSubType?: string;
    dateOfBirth?: string;
    yearsOfExperience?: string;
    contractorName?: string;
    engineerName?: string;
    projectType?: string;
    projectSizeSquareFeet?: number;
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
    assignedToName: string;
    taskType: string;
}

export default function CustomerDetailPage({ customer }: { customer: unknown }) {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const storeId = params.id;
    
    const [customerData, setCustomerData] = useState<Record<string, unknown> | null>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
    const [notesData, setNotesData] = useState<Note[]>([]);
    const [visitsData, setVisitsData] = useState<Visit[]>([]);
    const [requirementsData, setRequirementsData] = useState<Task[]>([]);
    const [complaintsData, setComplaintsData] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<unknown[]>([]);
    const [stores, setStores] = useState<unknown[]>([]);
    const [editingTask, setEditingTask] = useState<Record<string, unknown> | null>(null);
    const [activeInfoTab, setActiveInfoTab] = useState('leads-info');
    const [productCategories, setProductCategories] = useState<string[]>([]);
    const [categoryInput, setCategoryInput] = useState('');
    const [categoryError, setCategoryError] = useState<string | null>(null);
    const [isUpdatingCategories, setIsUpdatingCategories] = useState(false);
    const [isEditCustomerModalVisible, setIsEditCustomerModalVisible] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [isDeleteNoteModalVisible, setIsDeleteNoteModalVisible] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
    const [deletingNoteContent, setDeletingNoteContent] = useState<string>('');
    const [isDeletingNote, setIsDeletingNote] = useState(false);
    const [activeActivityTab, setActiveActivityTab] = useState('visits');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [brandsData, setBrandsData] = useState<unknown[]>([]);
    const [isLoadingBrands, setIsLoadingBrands] = useState(false);
    const [sitesData, setSitesData] = useState<unknown[]>([]);
    const [isLoadingSites, setIsLoadingSites] = useState(false);
    const [activeTab, setActiveTab] = useState("basic-info");
    const [formData, setFormData] = useState<Partial<CustomerData>>({
        storeId: 0,
        storeName: '',
        clientFirstName: '',
        clientLastName: '',
        email: '',
        primaryContact: 0,
        gstNumber: '',
        clientType: '',
        addressLine1: '',
        addressLine2: '',
        village: '',
        taluka: '',
        city: '',
        state: '',
        pincode: '',
        monthlySale: null,
        // Dealer/Shop specific fields
        shopAgeYears: undefined,
        ownershipType: '',
        dealerType: '',
        dealerSubType: '',
        // Professional specific fields
        dateOfBirth: '',
        yearsOfExperience: '',
        // Site Visit specific fields
        contractorName: '',
        engineerName: '',
        projectType: '',
        projectSizeSquareFeet: undefined,
    });

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isVisitModalVisible, setIsVisitModalVisible] = useState(false);
    const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
    const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
    const [requirementTask, setRequirementTask] = useState({
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0, // Will be set to current user's ID when needed
        status: 'Assigned',
        priority: 'low',
        taskType: 'requirement',
        storeId: parseInt(storeId as string),
        category: '',
        storeName: ''
    });
    const [requirementActiveTab, setRequirementActiveTab] = useState('general');
    const [complaintTask, setComplaintTask] = useState({
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0, // Will be set to current user's ID when needed
        status: 'Assigned',
        priority: 'low',
        taskType: 'complaint',
        storeId: parseInt(storeId as string),
        category: '',
        storeName: ''
    });
    const [complaintActiveTab, setComplaintActiveTab] = useState('general');
    const [isLoadingStores, setIsLoadingStores] = useState(false);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(addDays(new Date(), 5));
    const [showSitesTab, setShowSitesTab] = useState(false);
    const [showMore, setShowMore] = useState({
        visits: false,
        notes: false,
        complaints: false,
        requirements: false,
    });

    const [currentPage, setCurrentPage] = useState({
        visits: 1,
        notes: 1,
        complaints: 1,
        requirements: 1,
    });

    // Image preview states
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [taskImages, setTaskImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isLoadingImages, setIsLoadingImages] = useState(false);

    // Location state for customer edit
    const [editStates, setEditStates] = useState<StateDto[]>([]);
    const [editDistricts, setEditDistricts] = useState<DistrictDto[]>([]);
    const [editSubDistricts, setEditSubDistricts] = useState<SubDistrictDto[]>([]);
    const [editCities, setEditCities] = useState<CityDto[]>([]);
    
    const [selectedEditStateId, setSelectedEditStateId] = useState<number | null>(null);
    const [selectedEditDistrictId, setSelectedEditDistrictId] = useState<number | null>(null);
    const [selectedEditSubDistrictId, setSelectedEditSubDistrictId] = useState<number | null>(null);
    
    // Search states for location dropdowns
    const [editStateSearch, setEditStateSearch] = useState('');
    const [editDistrictSearch, setEditDistrictSearch] = useState('');
    const [editSubDistrictSearch, setEditSubDistrictSearch] = useState('');
    const [editCitySearch, setEditCitySearch] = useState('');

    // Filtered location data based on search
    const filteredEditStates = editStates.filter(state =>
        state.stateName.toLowerCase().includes(editStateSearch.toLowerCase())
    );
    
    const filteredEditDistricts = editDistricts.filter(district =>
        district.districtName.toLowerCase().includes(editDistrictSearch.toLowerCase())
    );
    
    const filteredEditSubDistricts = editSubDistricts.filter(subDistrict =>
        subDistrict.subDistrictName.toLowerCase().includes(editSubDistrictSearch.toLowerCase())
    );
    
    const filteredEditCities = editCities.filter(city =>
        city.cityName.toLowerCase().includes(editCitySearch.toLowerCase())
    );

    const [filteredVisitsData, setFilteredVisitsData] = useState<Visit[]>([]);
    const [intentData, setIntentData] = useState<unknown[]>([]);
    const [salesData, setSalesData] = useState<unknown[]>([]);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const employeeId = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;

    const fetchIntentData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/proxy/intent-audit/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setIntentData(data);
        } catch (error) {
            console.error('Error fetching intent data:', error);
        }
    }, [token]);

    const fetchSalesData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/proxy/monthly-sale/getByStore?storeId=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setSalesData(data);
        } catch (error) {
            console.error('Error fetching sales data:', error);
        }
    }, [token]);

    const fetchCustomerData = useCallback(async (id: string) => {
        try {
            setIsLoadingCustomer(true);
            const response = await fetch(`/api/proxy/store/getById?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setCustomerData(data);

            const categories = extractCategoriesFromResponse(data);
            setProductCategories(categories);
            setCategoryError(null);

            // Set the visibility of the Sites tab based on clientType
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
            const response = await fetch(`/api/proxy/notes/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setNotesData(data);
        } catch (error) {
            console.error('Error fetching notes data:', error);
        }
    }, [token]);

    const fetchVisitsData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`/api/proxy/visit/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setVisitsData(data);
            setFilteredVisitsData(data);
        } catch (error) {
            console.error('Error fetching visits data:', error);
        }
    }, [token]);

    const fetchRequirementsData = useCallback(async (id: string, start: Date, end: Date) => {
        try {
            const response = await fetch(`/api/proxy/task/getByStoreAndDate?storeId=${id}&start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setRequirementsData(data.filter((task: { taskType?: string }) => task.taskType === 'requirement'));
        } catch (error) {
            console.error('Error fetching requirements data:', error);
        }
    }, [token]);

    const fetchComplaintsData = useCallback(async (id: string, start: Date, end: Date) => {
        try {
            const response = await fetch(`/api/proxy/task/getByStoreAndDate?storeId=${id}&start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setComplaintsData(data.filter((task: { taskType?: string }) => task.taskType === 'complaint'));
        } catch (error) {
            console.error('Error fetching complaints data:', error);
        }
    }, [token]);

    const handleAddCategory = async (rawCategory?: string) => {
        if (!token) {
            setCategoryError('Authentication token missing. Please sign in again.');
            return;
        }
        if (!storeId) {
            setCategoryError('Store identifier not available.');
            return;
        }

        const formatted = formatCategoryDisplay(rawCategory ?? categoryInput);
        if (!formatted) {
            setCategoryError('Enter a category before adding.');
            return;
        }

        if (productCategories.some((category) => category.toLowerCase() === formatted.toLowerCase())) {
            setCategoryError('Category already added.');
            return;
        }

        const numericStoreId = Array.isArray(storeId) ? Number(storeId[0]) : Number(storeId);
        if (Number.isNaN(numericStoreId)) {
            setCategoryError('Invalid store identifier.');
            return;
        }

        const apiValue = toApiCategoryValue(formatted);

        try {
            setIsUpdatingCategories(true);
            setCategoryError(null);
            const response = await fetch('/api/proxy/store/addCategories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    storeId: numericStoreId,
                    categories: [apiValue],
                }),
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to add category');
            }

            setProductCategories((prev) => {
                const updatedCategories = [...prev, formatted];
                setCustomerData((prevData) => {
                    if (!prevData) return prevData;
                    return {
                        ...prevData,
                        productCategory: updatedCategories,
                        productCategories: updatedCategories.map(toApiCategoryValue),
                    };
                });
                return updatedCategories;
            });
            setCategoryInput('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to add category';
            setCategoryError(message);
        } finally {
            setIsUpdatingCategories(false);
        }
    };

    const handleRemoveCategory = async (category: string) => {
        if (!token) {
            setCategoryError('Authentication token missing. Please sign in again.');
            return;
        }
        if (!storeId) {
            setCategoryError('Store identifier not available.');
            return;
        }

        const numericStoreId = Array.isArray(storeId) ? Number(storeId[0]) : Number(storeId);
        if (Number.isNaN(numericStoreId)) {
            setCategoryError('Invalid store identifier.');
            return;
        }

        const apiValue = toApiCategoryValue(category);

        try {
            setIsUpdatingCategories(true);
            setCategoryError(null);
            const response = await fetch('/api/proxy/store/removeCategories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    storeId: numericStoreId,
                    categories: [apiValue],
                }),
            });

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to remove category');
            }

            setProductCategories((prev) => {
                const updatedCategories = prev.filter((item) => item.toLowerCase() !== category.toLowerCase());
                setCustomerData((prevData) => {
                    if (!prevData) return prevData;
                    return {
                        ...prevData,
                        productCategory: updatedCategories,
                        productCategories: updatedCategories.map(toApiCategoryValue),
                    };
                });
                return updatedCategories;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to remove category';
            setCategoryError(message);
        } finally {
            setIsUpdatingCategories(false);
        }
    };

    const fetchEmployees = useCallback(async () => {
        setIsLoadingEmployees(true);
        try {
            // Always use the full list endpoint via proxy
            const resAll = await fetch('/api/proxy/employee/getAll', {
                headers: { Authorization: `Bearer ${token}` },
            });
            let list: unknown[] = [];
            if (resAll.ok) {
                list = await resAll.json();
            }

            const wantedCity = (customerData?.city || '').toString().trim().toLowerCase();

            // Filter only Field Officers for the same city
            const fieldOfficersByCity = (Array.isArray(list) ? list : [])
                .filter((emp) => {
                    const empRec = emp as Record<string, unknown>;
                    const role = (empRec.role || '').toString().toLowerCase();
                    if (!(role === 'field officer' || role.includes('field officer') || role.includes('field'))) return false;
                    const empCity = (empRec.city || '').toString().trim().toLowerCase();
                    return wantedCity ? empCity === wantedCity : true;
                })
                .sort((a, b) => {
                    const aRec = a as { firstName: string; lastName: string };
                    const bRec = b as { firstName: string; lastName: string };
                    return `${aRec.firstName} ${aRec.lastName}`.localeCompare(`${bRec.firstName} ${bRec.lastName}`);
                });

            setEmployees(fieldOfficersByCity);
        } catch (error) {
            console.error('Error fetching employees:', error);
            setEmployees([]);
        } finally {
            setIsLoadingEmployees(false);
        }
    }, [token, customerData?.city]);

    // If modals are open and nothing selected yet, default to first employee
    useEffect(() => {
        if (isComplaintModalOpen && employees.length > 0 && !complaintTask.assignedToId) {
            const e = employees[0] as { id: number; firstName: string; lastName: string };
            setComplaintTask((prev) => ({ ...prev, assignedToId: e.id, assignedToName: `${e.firstName} ${e.lastName}` }));
        }
    }, [isComplaintModalOpen, employees, complaintTask.assignedToId]);

    useEffect(() => {
        if (isRequirementModalOpen && employees.length > 0 && !requirementTask.assignedToId) {
            const e = employees[0] as { id: number; firstName: string; lastName: string };
            setRequirementTask((prev) => ({ ...prev, assignedToId: e.id, assignedToName: `${e.firstName} ${e.lastName}` }));
        }
    }, [isRequirementModalOpen, employees, requirementTask.assignedToId]);

    const fetchStores = useCallback(async () => {
        try {
            setIsLoadingStores(true);
            const response = await fetch('/api/proxy/store/names', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setStores(data);
        } catch (error) {
            console.error('Error fetching stores:', error);
        } finally {
            setIsLoadingStores(false);
        }
    }, [token]);

    const fetchBrandsData = useCallback(async (id: string) => {
        try {
            setIsLoadingBrands(true);
            const response = await fetch(`/api/proxy/visit/getProConsByStore?storeId=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setBrandsData(data);
        } catch (error) {
            console.error('Error fetching brands data:', error);
        } finally {
            setIsLoadingBrands(false);
        }
    }, [token]);

    const fetchSitesData = useCallback(async (id: string) => {
        try {
            setIsLoadingSites(true);
            const response = await fetch(`/api/proxy/site/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setSitesData(data);
        } catch (error) {
            console.error('Error fetching sites data:', error);
        } finally {
            setIsLoadingSites(false);
        }
    }, [token]);

    const fetchTaskImages = useCallback(async (taskId: number) => {
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
                .filter((attachment: { tag: string }) => attachment.tag === 'check-in')
                .map((attachment: { tag: string; fileName: string }) => {
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
    }, [token]);

    const getStoreId = (): string => {
        if (typeof storeId === 'string') {
            return storeId;
        }
        if (Array.isArray(storeId)) {
            return storeId[0];
        }
        return '';
    };

    const handleAddNote = async () => {
        if (!noteContent.trim() || isSavingNote) return;
        setIsSavingNote(true);
        try {
            const response = await fetch('/api/proxy/notes/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content: noteContent,
                    employeeId: employeeId,
                    storeId: parseInt(storeId as string),
                }),
            });

            if (response.ok) {
                // Refresh notes data by fetching from API
                await fetchNotesData(storeId as string);
                setNoteContent('');
                setIsModalVisible(false);
                console.log('Note added successfully!');
            }
        } catch (error) {
            console.error('Error creating note:', error);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleEditNote = (note: Note) => {
        setEditingNoteId(note.id);
        setNoteContent(note.content);
        setIsEditMode(true);
        setIsModalVisible(true);
    };

    const handleSaveEditNote = async () => {
        if (!noteContent.trim() || isSavingNote) return;
        setIsSavingNote(true);
        try {
            const response = await fetch(`/api/proxy/notes/edit?id=${editingNoteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content: noteContent,
                    employeeId: employeeId,
                    storeId: parseInt(storeId as string),
                }),
            });

            if (response.ok) {
                // Refresh notes data by fetching from API
                await fetchNotesData(storeId as string);
                setEditingNoteId(null);
                setNoteContent('');
                setIsEditMode(false);
                setIsModalVisible(false);
                console.log('Note updated successfully!');
            }
        } catch (error) {
            console.error('Error updating note:', error);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDeleteNote = async (noteId: number): Promise<boolean> => {
        try {
            const response = await fetch(`/api/proxy/notes/delete?id=${noteId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                // Refresh notes data by fetching from API
                await fetchNotesData(storeId as string);
                console.log('Note deleted successfully!');
                return true;
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
        return false;
    };

    const promptDeleteNote = (note: Note) => {
        setDeletingNoteId(note.id);
        setDeletingNoteContent(note.content);
        setIsDeleteNoteModalVisible(true);
    };

    const confirmDeleteNote = async () => {
        if (!deletingNoteId) return;
        setIsDeletingNote(true);
        try {
            const ok = await handleDeleteNote(deletingNoteId);
            if (ok) {
                setIsDeleteNoteModalVisible(false);
                setDeletingNoteId(null);
                setDeletingNoteContent('');
            }
        } finally {
            setIsDeletingNote(false);
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
        let dataLength;

        switch (tab) {
            case 'visits':
                dataLength = visitsData.length;
                break;
            case 'notes':
                dataLength = notesData.length;
                break;
            case 'complaints':
                dataLength = complaintsData.length;
                break;
            case 'requirements':
                dataLength = requirementsData.length;
                break;
            default:
                dataLength = 0;
        }

        const totalPages = Math.ceil(dataLength / ITEMS_PER_PAGE);

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
        try {
            const response = await fetch(`/api/proxy/task/getByStoreAndDate?storeId=${storeId}&start=${format(startDate, 'yyyy-MM-dd')}&end=${format(endDate, 'yyyy-MM-dd')}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setRequirementsData(data.filter((task: { taskType?: string }) => task.taskType === 'requirement'));
            setComplaintsData(data.filter((task: { taskType?: string }) => task.taskType === 'complaint'));
            console.log('Tasks refreshed successfully!');
        } catch (error) {
            console.error('Error fetching updated tasks:', error);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return '';
        const nameParts = name.split(' ');
        return nameParts.map(part => part[0]).join('');
    };

    const handleBackClick = () => {
        const from = searchParams?.get('from');
        const qp = new URLSearchParams();
        const keys = ['start', 'end', 'employee', 'priority', 'status', 'search', 'page'];
        keys.forEach(k => {
            const v = searchParams?.get(k);
            if (v) qp.set(k, v);
        });
        if (from === 'requirements') {
            const url = qp.toString() ? `/dashboard/requirements?${qp.toString()}` : '/dashboard/requirements';
            router.push(url);
            return;
        }
        if (from === 'complaints') {
            const url = qp.toString() ? `/dashboard/complaints?${qp.toString()}` : '/dashboard/complaints';
            router.push(url);
            return;
        }
        // Fallback to browser history or customers list
        try {
            router.back();
        } catch {
            router.push('/dashboard/customers');
        }
    };

    const addNote = () => {
        setIsEditMode(false);
        setNoteContent('');
        setIsModalVisible(true);
    };

    const getOutcomeStatus = (visit: Visit) => {
        if (visit.checkinTime && visit.checkoutTime) {
            return { emoji: '✅', status: 'Complete', color: 'bg-purple-100 text-purple-800' };
        } else {
            return { emoji: '📅', status: 'Assigned', color: 'bg-blue-100 text-blue-800' };
        }
    };

    const paginate = (data: unknown[], page: number) => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    };

    const handleChangeStatus = async (taskId: number, status: string) => {
        try {
            const response = await fetch(`/api/proxy/task/updateTask?taskId=${taskId}`, {
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
                console.log('Status updated successfully!');
                createTask();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleCustomerEditSubmit = async (data: Partial<CustomerData>) => {
        try {
            // Include fields backend may require on edit (latitude/longitude, employeeId)
            const requestData = {
                clientLastName: data.clientLastName,
                email: data.email,
                clientType: data.clientType,
                brandsInUse: [], // Empty array for now
                brandProsCons: [], // Empty array for now
                likes: {}, // Empty object for now
                latitude: (customerData && (customerData.latitude ?? customerData.storeLatitude)) ?? 0,
                longitude: (customerData && (customerData.longitude ?? customerData.storeLongitude)) ?? 0,
                employeeId: customerData?.employeeId ?? undefined,
            };

            console.log('Sending data:', requestData);

            const response = await fetch(`/api/proxy/store/edit?id=${storeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(requestData),
            });

            if (response.ok) {
                // Refresh customer data after successful update
                await fetchCustomerData(storeId as string);
                setIsEditCustomerModalVisible(false);
                // Reset location selections
                setSelectedEditStateId(null);
                setSelectedEditDistrictId(null);
                setSelectedEditSubDistrictId(null);
                setEditStateSearch('');
                setEditDistrictSearch('');
                setEditSubDistrictSearch('');
                setEditCitySearch('');
                console.log('Customer updated successfully!');
            } else {
                const errorText = await response.text();
                console.error('Failed to update customer:', response.status, errorText);
            }
        } catch (error) {
            console.error('Error updating customer:', error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleClientTypeChange = (value: string) => {
        setFormData((prev) => ({
            ...prev,
            clientType: value,
        }));
    };

    // Helper function to get dynamic labels based on customer type
    const getLabelForStoreName = (clientType: string): string => {
        switch (clientType) {
            case 'Dealer': return 'Shop Name';
            case 'Professional': return 'Firm Name';
            case 'Site Visit': return 'Project Name';
            default: return 'Store Name';
        }
    };

    const getLabelForOwner = (clientType: string): string => {
        return clientType === 'Site Visit' ? 'Site Owner Name' : 'Owner Name';
    };

    const handleSubmit = () => {
        handleCustomerEditSubmit(formData);
    };

    const handleComplaintNext = () => {
        setComplaintActiveTab('details');
    };

    const handleComplaintBack = () => {
        setComplaintActiveTab('general');
    };

    const [isCreatingComplaint, setIsCreatingComplaint] = useState(false);
    const [complaintError, setComplaintError] = useState<string | null>(null);

    const handleCreateComplaint = async () => {
        setComplaintError(null);
        // Validate required fields
        const missing: string[] = [];
        if (!complaintTask.taskDesciption || !complaintTask.taskDesciption.trim()) missing.push('Description');
        if (!complaintTask.dueDate) missing.push('Due Date');
        if (!complaintTask.assignedToId) missing.push('Assigned To');
        if (!complaintTask.storeId) missing.push('Store');
        if (missing.length) {
            setComplaintError(`Please provide: ${missing.join(', ')}`);
            return;
        }
        setIsCreatingComplaint(true);
        try {
            const localEmpIdRaw = employeeId;
            const localEmpId = localEmpIdRaw ? parseInt(localEmpIdRaw as string, 10) : NaN;
            
            // Validate that we have a valid assignedById
            if (Number.isNaN(localEmpId)) {
                setComplaintError('Unable to determine current user. Please refresh the page and try again.');
                return;
            }
            
            const response = await fetch('/api/proxy/task/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    taskDesciption: complaintTask.taskDesciption?.trim() || '',
                    dueDate: complaintTask.dueDate.includes('T') ? complaintTask.dueDate.split('T')[0] : complaintTask.dueDate,
                    assignedToId: Number(complaintTask.assignedToId),
                    assignedById: localEmpId, // Use current user's ID
                    storeId: Number(complaintTask.storeId),
                    taskType: 'complaint',
                    status: complaintTask.status || 'Assigned',
                    priority: complaintTask.priority || 'low',
                }),
            });

            if (response.ok) {
                console.log('Complaint created successfully!');
                await createTask();
                setIsComplaintModalOpen(false);
                // Reset form
                setComplaintTask({
                    taskTitle: '',
                    taskDesciption: '',
                    dueDate: '',
                    assignedToId: 0,
                    assignedToName: '',
                    assignedById: localEmpId,
                    status: 'Assigned',
                    priority: 'low',
                    taskType: 'complaint',
                    storeId: parseInt(storeId as string),
                    category: '',
                    storeName: ''
                });
                setComplaintActiveTab('general');
            } else {
                const errorText = await response.text();
                console.error('Failed to create complaint:', response.status, errorText);
                setComplaintError(errorText || 'Failed to create complaint');
            }
        } catch (error) {
            console.error('Error creating complaint:', error);
            setComplaintError('Unexpected error while creating complaint');
        }
        setIsCreatingComplaint(false);
    };

    const handleRequirementNext = () => {
        setRequirementActiveTab('details');
    };

    const handleRequirementBack = () => {
        setRequirementActiveTab('general');
    };

    const [isCreatingRequirement, setIsCreatingRequirement] = useState(false);
    const [requirementError, setRequirementError] = useState<string | null>(null);

    const handleCreateRequirement = async () => {
        setRequirementError(null);
        // Validate required fields
        const missing: string[] = [];
        if (!requirementTask.taskTitle || !requirementTask.taskTitle.trim()) missing.push('Title');
        if (!requirementTask.taskDesciption || !requirementTask.taskDesciption.trim()) missing.push('Description');
        if (!requirementTask.dueDate) missing.push('Due Date');
        if (!requirementTask.assignedToId) missing.push('Assigned To');
        if (!requirementTask.storeId) missing.push('Store');
        if (missing.length) {
            setRequirementError(`Please provide: ${missing.join(', ')}`);
            return;
        }
        setIsCreatingRequirement(true);
        try {
            const localEmpIdRaw = employeeId;
            const localEmpId = localEmpIdRaw ? parseInt(localEmpIdRaw as string, 10) : NaN;
            
            // Validate that we have a valid assignedById
            if (Number.isNaN(localEmpId)) {
                setRequirementError('Unable to determine current user. Please refresh the page and try again.');
                return;
            }
            
            const response = await fetch('/api/proxy/task/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    taskTitle: requirementTask.taskTitle?.trim() || '',
                    taskDesciption: requirementTask.taskDesciption?.trim() || '',
                    dueDate: requirementTask.dueDate.includes('T') ? requirementTask.dueDate.split('T')[0] : requirementTask.dueDate,
                    assignedToId: Number(requirementTask.assignedToId),
                    assignedById: localEmpId, // Use current user's ID
                    storeId: Number(requirementTask.storeId),
                    taskType: 'requirement',
                    status: requirementTask.status || 'Assigned',
                    priority: requirementTask.priority || 'low',
                }),
            });

            if (response.ok) {
                console.log('Requirement created successfully!');
                await createTask();
                setIsRequirementModalOpen(false);
                // Reset form
                setRequirementTask({
                    taskTitle: '',
                    taskDesciption: '',
                    dueDate: '',
                    assignedToId: 0,
                    assignedToName: '',
                    assignedById: localEmpId,
                    status: 'Assigned',
                    priority: 'low',
                    taskType: 'requirement',
                    storeId: parseInt(storeId as string),
                    category: '',
                    storeName: ''
                });
                setRequirementActiveTab('general');
            } else {
                const errorText = await response.text();
                console.error('Failed to create requirement:', response.status, errorText);
                setRequirementError(errorText || 'Failed to create requirement');
            }
        } catch (error) {
            console.error('Error creating requirement:', error);
            setRequirementError('Unexpected error while creating requirement');
        }
        setIsCreatingRequirement(false);
    };

    const calculateIntentTrend = () => {
        const dates = intentData.map(item => (item as Record<string, unknown>).changeDate);
        const intentLevels = intentData.map(item => (item as Record<string, unknown>).newIntentLevel);
        return { dates, intentLevels };
    };

    const calculateSalesTrend = () => {
        const dates = salesData.map(item => (item as Record<string, unknown>).visitDate);
        const salesAmounts = salesData.map(item => (item as Record<string, unknown>).newMonthlySale);
        return { dates, salesAmounts };
    };

    const { dates: intentDates, intentLevels } = calculateIntentTrend();
    const { dates: salesDates, salesAmounts } = calculateSalesTrend();

    const intentChartData = {
        labels: intentDates,
        datasets: [
            {
                label: 'Intent Level',
                data: intentLevels,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
            },
        ],
    };

    const salesChartData = {
        labels: salesDates,
        datasets: [
            {
                label: 'Monthly Sales',
                data: salesAmounts,
                borderColor: 'rgba(153, 102, 255, 1)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                fill: true,
            },
        ],
    };

    useEffect(() => {
        if (token && storeId) {
            fetchCustomerData(storeId as string);
            fetchNotesData(storeId as string);
            fetchVisitsData(storeId as string);
            fetchRequirementsData(storeId as string, startDate, endDate);
            fetchComplaintsData(storeId as string, startDate, endDate);
            fetchBrandsData(storeId as string);
            fetchSitesData(storeId as string);
            fetchEmployees();
            fetchStores();
            fetchIntentData(storeId as string);
            fetchSalesData(storeId as string);
        }
    }, [token, storeId, startDate, endDate, fetchCustomerData, fetchNotesData, fetchVisitsData, fetchRequirementsData, fetchComplaintsData, fetchBrandsData, fetchSitesData, fetchEmployees, fetchStores, fetchIntentData, fetchSalesData]);

    useEffect(() => {
        if (customerData) {
            // Map old client types to new ones
            const clientType = (typeof customerData.clientType === 'string' ? customerData.clientType : '');
            let mappedClientType = clientType;
            
            // Map old values to new ones
            if (clientType.toLowerCase() === 'shop') mappedClientType = 'Dealer';
            else if (['architect', 'engineer', 'builder'].includes(clientType.toLowerCase())) mappedClientType = 'Professional';
            else if (clientType.toLowerCase() === 'site visit') mappedClientType = 'Site Visit';
            else if (!['Dealer', 'Professional', 'Site Visit'].includes(clientType)) mappedClientType = 'Dealer'; // Default fallback

            setFormData({
                storeId: customerData.storeId as number,
                storeName: customerData.storeName as string,
                clientFirstName: customerData.clientFirstName as string,
                clientLastName: customerData.clientLastName as string,
                email: (customerData.email as string) || '',
                primaryContact: customerData.primaryContact as number,
                gstNumber: (customerData.gstNumber as string) || '',
                clientType: mappedClientType,
                addressLine1: String(customerData.addressLine1 || ''),
                addressLine2: String(customerData.addressLine2 || ''),
                village: String(customerData.district || ''),
                taluka: String(customerData.subDistrict || ''),
                city: customerData.city as string,
                state: customerData.state as string,
                pincode: String(customerData.pincode || ''),
                monthlySale: customerData.monthlySale as number | null,
                // Additional fields from customer data
                shopAgeYears: customerData.shopAgeYears as number | undefined,
                ownershipType: String(customerData.ownershipType || ''),
                dealerType: String(customerData.dealerType || ''),
                dealerSubType: String(customerData.dealerSubType || ''),
                dateOfBirth: String(customerData.dateOfBirth || ''),
                yearsOfExperience: String(customerData.yearsOfExperience || ''),
                contractorName: String(customerData.contractorName || ''),
                engineerName: String(customerData.engineerName || ''),
                projectType: String(customerData.projectType || ''),
                projectSizeSquareFeet: customerData.projectSizeSquareFeet as number | undefined,
            });
        }
    }, [customerData]);

    // Load states when edit modal opens and pre-fill if existing data
    useEffect(() => {
        const fetchEditStates = async () => {
            if (isEditCustomerModalVisible) {
                try {
                    const statesData = await API.getAllStates();
                    setEditStates(statesData);
                    
                    // Pre-fill state if exists in formData
                    if (formData.state) {
                        const matchingState = statesData.find(
                            s => s.stateName.toLowerCase() === formData.state?.toLowerCase()
                        );
                        if (matchingState) {
                            setSelectedEditStateId(matchingState.id);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching states:', error);
                    setEditStates([]);
                }
            }
        };

        fetchEditStates();
    }, [isEditCustomerModalVisible, formData.state]);

    // Load districts when state changes and pre-fill if existing data
    useEffect(() => {
        const fetchEditDistricts = async () => {
            if (!selectedEditStateId) {
                setEditDistricts([]);
                setEditSubDistricts([]);
                setEditCities([]);
                setSelectedEditDistrictId(null);
                setSelectedEditSubDistrictId(null);
                return;
            }

            try {
                const districtsData = await API.getDistrictsByStateId(selectedEditStateId);
                setEditDistricts(districtsData);
                setEditSubDistricts([]);
                setEditCities([]);
                
                // Pre-fill district if exists in formData.village
                if (formData.village && !selectedEditDistrictId) {
                    const matchingDistrict = districtsData.find(
                        d => d.districtName.toLowerCase() === formData.village?.toLowerCase()
                    );
                    if (matchingDistrict) {
                        setSelectedEditDistrictId(matchingDistrict.id);
                    } else {
                        setSelectedEditDistrictId(null);
                    }
                } else if (!formData.village) {
                    setSelectedEditDistrictId(null);
                }
                
                setSelectedEditSubDistrictId(null);
            } catch (error) {
                console.error('Error fetching districts:', error);
                setEditDistricts([]);
            }
        };

        fetchEditDistricts();
    }, [selectedEditStateId, formData.village]);

    // Load sub-districts when district changes and pre-fill if existing data
    useEffect(() => {
        const fetchEditSubDistricts = async () => {
            if (!selectedEditDistrictId) {
                setEditSubDistricts([]);
                setEditCities([]);
                setSelectedEditSubDistrictId(null);
                return;
            }

            try {
                const subDistrictsData = await API.getSubDistrictsByDistrictId(selectedEditDistrictId);
                setEditSubDistricts(subDistrictsData);
                setEditCities([]);
                
                // Pre-fill sub-district if exists in formData.taluka
                if (formData.taluka && !selectedEditSubDistrictId) {
                    const matchingSubDistrict = subDistrictsData.find(
                        sd => sd.subDistrictName.toLowerCase() === formData.taluka?.toLowerCase()
                    );
                    if (matchingSubDistrict) {
                        setSelectedEditSubDistrictId(matchingSubDistrict.id);
                    } else {
                        setSelectedEditSubDistrictId(null);
                    }
                } else if (!formData.taluka) {
                    setSelectedEditSubDistrictId(null);
                }
            } catch (error) {
                console.error('Error fetching sub-districts:', error);
                setEditSubDistricts([]);
            }
        };

        fetchEditSubDistricts();
    }, [selectedEditDistrictId, formData.taluka]);

    // Load cities when sub-district changes (city is already in formData.city, no need to set selectedId)
    useEffect(() => {
        const fetchEditCities = async () => {
            if (!selectedEditSubDistrictId) {
                setEditCities([]);
                return;
            }

            try {
                const citiesData = await API.getCitiesBySubDistrictId(selectedEditSubDistrictId);
                setEditCities(citiesData);
                // City value is already stored in formData.city, dropdown will show it automatically
            } catch (error) {
                console.error('Error fetching cities:', error);
                setEditCities([]);
            }
        };

        fetchEditCities();
    }, [selectedEditSubDistrictId]);

    useEffect(() => {
        const fetchComplaintTaskDetails = async () => {
            if (isComplaintModalOpen && storeId) {
                try {
                    // Fetch employees first
                    await fetchEmployees();
                    
                    // Then fetch task details
                    const response = await fetch(`/api/proxy/task/getByStoreAndDate?storeId=${storeId}&start=2024-06-01&end=2024-06-30`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const task = data[0];
                        setComplaintTask(prev => ({
                            ...prev,
                            assignedToId: task.assignedToId,
                            assignedToName: task.assignedToName,
                            storeName: customerData?.storeName || task.storeName
                        }));
                    }
                } catch (error) {
                    console.error('Error fetching task details:', error);
                }
            }
        };

        fetchComplaintTaskDetails();
    }, [isComplaintModalOpen, storeId, token, customerData, fetchEmployees]);

    useEffect(() => {
        const fetchRequirementTaskDetails = async () => {
            if (isRequirementModalOpen && storeId) {
                try {
                    // Fetch employees first
                    await fetchEmployees();
                    
                    // Then fetch task details
                    const response = await fetch(`/api/proxy/task/getByStoreAndDate?storeId=${storeId}&start=2024-06-01&end=2024-06-30`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const task = data[0];
                        setRequirementTask(prev => ({
                            ...prev,
                            assignedToId: task.assignedToId,
                            assignedToName: task.assignedToName,
                            storeName: customerData?.storeName || task.storeName
                        }));
                    }
                } catch (error) {
                    console.error('Error fetching requirement task details:', error);
                }
            }
        };

        fetchRequirementTaskDetails();
    }, [isRequirementModalOpen, storeId, token, customerData, fetchEmployees]);

  // Show skeleton loader while customer data is loading
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
                    <i className="fas fa-arrow-left mr-2"></i> Back
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
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-18" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                                    <CardTitle className="text-xl font-semibold text-foreground">Customer Details</CardTitle>
                                    <p className="text-sm text-muted-foreground">Customer information and actions</p>
                </div>
                                <Button variant="ghost" size="sm" onClick={handleBackClick}>
                                    <i className="fas fa-arrow-left mr-2"></i> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Exclusive Dealer Tag */}
              {customerData?.clientType === 'Dealer' && customerData?.dealerSubType === 'EXCLUSIVE' && (
                <div className="flex justify-start">
                  <Badge variant="secondary" className="bg-black text-white font-semibold px-3 py-1">
                    <i className="fas fa-crown mr-1"></i>
                    Exclusive Dealer
                  </Badge>
                </div>
              )}
              
              <div className="flex items-start gap-4">
                                <div className="h-14 w-14 rounded-xl border-2 border-dashed bg-muted flex items-center justify-center">
                                    <span className="text-lg font-semibold text-muted-foreground">
                                        {customerData ? getInitials(`${customerData.clientFirstName} ${customerData.clientLastName}`) : ''}
                                    </span>
                    </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <h3 className="text-lg font-semibold text-foreground truncate">
                                        {customerData ? `${String(customerData.clientFirstName || '')} ${String(customerData.clientLastName || '')}` : ''}
                                    </h3>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {customerData ? String(customerData.storeName || '') : ''}
                                    </p>
                  </div>
                </div>

                            <TooltipProvider>
                                <div className="flex gap-2">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                className="flex-1" 
                                                variant="outline" 
                                                onClick={() => setIsEditCustomerModalVisible(true)}
                                            >
                                                <Edit className="h-4 w-4" />
                                </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Edit Customer</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                className="flex-1" 
                                                variant="outline" 
                                                onClick={() => setIsComplaintModalOpen(true)}
                                            >
                                                <MessageCircle className="h-4 w-4" />
                                </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Log Complaint</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button 
                                                className="flex-1" 
                                                variant="outline" 
                                                onClick={() => setIsRequirementModalOpen(true)}
                                            >
                                                <Plus className="h-4 w-4" />
                                </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Add Requirement</p>
                                        </TooltipContent>
                                    </Tooltip>
              </div>
                            </TooltipProvider>

              <div className="space-y-4">
                                <div className="flex border-b">
                                    <button
                                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            activeInfoTab === 'leads-info' 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => setActiveInfoTab('leads-info')}
                                    >
                                        Leads Info
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                                            activeInfoTab === 'address-info' 
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
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                <i className="fas fa-user text-sm text-muted-foreground"></i>
                      </div>
                      <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground">Customer Name</p>
                                                <p className="text-sm text-muted-foreground">{String(customerData.clientFirstName || '')} {String(customerData.clientLastName || '')}</p>
                      </div>
                    </div>
                                        {customerData.email ? (
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                    <i className="fas fa-envelope text-sm text-muted-foreground"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground">Email</p>
                                                    <p className="text-sm text-muted-foreground">{String(customerData.email)}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                <i className="fas fa-phone text-sm text-muted-foreground"></i>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground">Phone</p>
                                                <p className="text-sm text-muted-foreground">{String(customerData.primaryContact || '')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                <i className="fas fa-store text-sm text-muted-foreground"></i>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground">Store Name</p>
                                                <p className="text-sm text-muted-foreground">{String(customerData.storeName || '')}</p>
                                            </div>
                                        </div>
                                        {customerData.clientType ? (
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                <i className="fas fa-user-tag text-sm text-muted-foreground"></i>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground">Client Type</p>
                                                <p className="text-sm text-muted-foreground">{String(customerData.clientType)}</p>
                                            </div>
                                        </div>
                                    ) : null}
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                <i className="fas fa-tags text-sm text-muted-foreground"></i>
                                            </div>
                                            <div className="min-w-0 w-full">
                                                <p className="text-sm font-medium text-foreground">Product Categories</p>
                                                {productCategories.length > 0 ? (
                                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                                        {productCategories.map((category) => (
                                                            <Badge
                                                                key={category}
                                                                variant="secondary"
                                                                className="text-xs font-medium"
                                                            >
                                                                {category}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        No categories assigned yet.
                                                    </p>
                                                )}
                                                {/* Add Category UI removed per requirements */}
                                            </div>
                                        </div>
              </div>
                                )}
                                
                                {activeInfoTab === 'address-info' && customerData && (
                                    <div className="space-y-3">
                                        {(() => {
                                            const addressParts: string[] = [];
                                            if (customerData.addressLine1) addressParts.push(String(customerData.addressLine1));
                                            if (customerData.addressLine2) addressParts.push(String(customerData.addressLine2));
                                            if (customerData.village) addressParts.push(String(customerData.village));
                                            if (customerData.taluka) addressParts.push(String(customerData.taluka));
                                            if (customerData.city) addressParts.push(String(customerData.city));
                                            if (customerData.district) addressParts.push(String(customerData.district));
                                            if (customerData.state) addressParts.push(String(customerData.state));
                                            if (customerData.pincode) addressParts.push(String(customerData.pincode));
                                            
                                            return addressParts.length > 0 ? (
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                        <i className="fas fa-map-marker-alt text-sm text-muted-foreground"></i>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground">Address</p>
                                                        <p className="text-sm text-muted-foreground">{addressParts.join(', ')}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                        {customerData.city ? (
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                    <i className="fas fa-city text-sm text-muted-foreground"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground">City</p>
                                                    <p className="text-sm text-muted-foreground">{String(customerData.city)}</p>
                                                </div>
                                            </div>
                                        ) : null}
                                        {customerData.state ? (
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                                    <i className="fas fa-flag text-sm text-muted-foreground"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground">State</p>
                                                    <p className="text-sm text-muted-foreground">{String(customerData.state)}</p>
                                                </div>
                                            </div>
                                        ) : null}
              </div>
                                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle className="text-xl font-semibold text-foreground">Customer Activity</CardTitle>
                                    <p className="text-sm text-muted-foreground">View visits, notes, complaints, and requirements</p>
                                </div>
            </div>
            </CardHeader>
            <CardContent>
                            <div className="space-y-6">
                                <div className="flex flex-wrap border-b overflow-x-auto">
                                    <button 
                                        className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                                            activeActivityTab === 'visits' 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => setActiveActivityTab('visits')}
                                    >
                                        <i className="fas fa-calendar-check text-xs sm:text-sm"></i> <span className="hidden xs:inline">Visits</span><span className="xs:hidden">Visits</span>
                                    </button>
                                    <button 
                                        className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                                            activeActivityTab === 'notes' 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => setActiveActivityTab('notes')}
                                    >
                                        <i className="fas fa-sticky-note text-xs sm:text-sm"></i> <span className="hidden xs:inline">Notes</span><span className="xs:hidden">Notes</span>
                                    </button>
                                    <button 
                                        className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                                            activeActivityTab === 'complaints' 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => setActiveActivityTab('complaints')}
                                    >
                                        <i className="fas fa-exclamation-circle text-xs sm:text-sm"></i> <span className="hidden xs:inline">Complaints</span><span className="xs:hidden">Complaints</span>
                                    </button>
                                    <button 
                                        className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                                            activeActivityTab === 'requirements' 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => setActiveActivityTab('requirements')}
                                    >
                                        <i className="fas fa-tasks text-xs sm:text-sm"></i> <span className="hidden xs:inline">Requirements</span><span className="xs:hidden">Requirements</span>
                                    </button>
                                    <button 
                                        className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                                            activeActivityTab === 'brands' 
                                                ? 'border-primary text-primary' 
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                        onClick={() => setActiveActivityTab('brands')}
                                    >
                                        <i className="fas fa-tags text-xs sm:text-sm"></i> <span className="hidden xs:inline">Brands</span><span className="xs:hidden">Brands</span>
                                    </button>
                                    {showSitesTab && (
                                        <button 
                                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                                                activeActivityTab === 'sites' 
                                                    ? 'border-primary text-primary' 
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                            onClick={() => setActiveActivityTab('sites')}
                                        >
                                            <i className="fas fa-map-marker-alt text-xs sm:text-sm"></i> <span className="hidden xs:inline">Sites</span><span className="xs:hidden">Sites</span>
                                        </button>
                                    )}
                                </div>

                                {activeActivityTab === 'visits' && (
                  <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                            <select 
                                                onChange={(e) => handleStatusChange(e.target.value)} 
                                                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                                            >
                                                <option value="All Statuses">All Statuses</option>
                                                <option value="Assigned">Assigned</option>
                                                <option value="On Going">On Going</option>
                                                <option value="Complete">Complete</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            {paginate(filteredVisitsData, currentPage.visits).map((visit, index) => {
                                                const v = visit as Visit;
                                                const { emoji, status, color } = getOutcomeStatus(v);
                                                return (
                                                    <div key={index} className="rounded-lg border bg-card p-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-calendar-alt text-muted-foreground"></i>
                                                                <span className="text-sm font-medium">Visit scheduled by {v.employeeName}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{new Date(v.visit_date).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-sm text-foreground mb-3">{v.purpose}</p>
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Status:</span>
                                                                    <Badge variant="secondary" className={color}>{emoji} {status}</Badge>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Purpose:</span>
                                                                    <span className="text-xs text-primary">{v.purpose}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                    {getInitials(v.employeeName)}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">{v.employeeName}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 flex justify-end">
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm"
                                                                onClick={() => router.push(`/dashboard/visits/${v.id}`)}
                                                                className="text-xs"
                                                            >
                                                                <i className="fas fa-eye mr-1"></i>
                                                                View Visit
                                                            </Button>
                                                        </div>
                                                    </div>
                  );
                })}
              </div>
                                        {showMore.visits && visitsData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.visits === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, visits: Math.max(prev.visits - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('visits')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.visits === Math.ceil(visitsData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, visits: Math.min(prev.visits + 1, Math.ceil(visitsData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {visitsData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, visits: !prev.visits }))}>
                                                {showMore.visits ? 'Show Less' : 'Show More'}
              </Button>
                                        )}
        </div>
                                )}

                                {activeActivityTab === 'notes' && (
                  <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                            <Button onClick={addNote}>
                                                <i className="fas fa-plus mr-2"></i> Add Note
              </Button>
            </div>
                                        <div className="space-y-3">
                                            {paginate(notesData, currentPage.notes).map((note) => {
                                                const n = note as Note;
                                                return (
                                                <div key={n.id} className="rounded-lg border bg-card p-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                                        <span className="text-xs text-muted-foreground">{new Date(n.createdDate).toLocaleDateString()}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditNote(n)}>
                                                                <Edit className="h-3 w-3 mr-1" />
                                                                Edit
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => promptDeleteNote(n)}>
                                                                <Trash2 className="h-3 w-3 mr-1" />
                                                                Delete
                                                            </Button>
                          </div>
                        </div>
                                                    <div className="text-sm text-foreground">{n.content}</div>
                      </div>
                                                );
                                            })}
                  </div>
                                        {showMore.notes && notesData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.notes === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, notes: Math.max(prev.notes - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('notes')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.notes === Math.ceil(notesData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, notes: Math.min(prev.notes + 1, Math.ceil(notesData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {notesData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, notes: !prev.notes }))}>
                                                {showMore.notes ? 'Show Less' : 'Show More'}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {activeActivityTab === 'complaints' && (
                  <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-full sm:w-[200px] justify-start text-left font-normal ${!startDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {startDate ? format(new Date(startDate), 'PPP') : <span>Start Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={(date) => {
                                                            setStartDate(date || new Date());
                                                            setEndDate(addDays(date || new Date(), 5));
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-full sm:w-[200px] justify-start text-left font-normal ${!endDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {endDate ? format(new Date(endDate), 'PPP') : <span>End Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={(date) => setEndDate(date || new Date())}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                        </div>
                                        <div className="space-y-3">
                                            {paginate(complaintsData, currentPage.complaints).map((complaint) => {
                                                const c = complaint as Task;
                                                const desc = (c as unknown as Record<string, unknown>).taskDesciption ?? (c as unknown as Record<string, unknown>).taskDescription ?? '';
                                                const images = (c as unknown as { attachments?: Array<{ id: number; url: string }> }).attachments ?? [];
                                                return (
                                                    <div key={c.id} className="rounded-lg border bg-card p-4 space-y-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-exclamation-circle text-muted-foreground"></i>
                                                                <span className="text-sm font-medium">Complaint</span>
                                                                {Array.isArray((c as unknown as Record<string, unknown>).attachmentResponse) && ((c as unknown as Record<string, unknown>).attachmentResponse as unknown[]).length > 0 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        onClick={() => fetchTaskImages(c.id)}
                                                                        title="View Images"
                                                                    >
                                                                        <Image className="h-4 w-4 text-blue-500" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">Due: {new Date(c.dueDate).toLocaleDateString()}</span>
                                                        </div>
                                                        {desc && (
                                                            <p className="text-sm text-foreground">{String(desc)}</p>
                                                        )}


                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <div className="flex items-center gap-4 flex-wrap">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Status:</span>
                                                                    <select
                                                                        onChange={(e) => handleChangeStatus(c.id, e.target.value)}
                                                                        value={c.status}
                                                                        className="px-2 py-1 border border-input bg-background rounded text-xs"
                                                                    >
                                                                        <option value="Assigned">Assigned</option>
                                                                        <option value="On Going">On Going</option>
                                                                        <option value="Complete">Complete</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Priority:</span>
                                                                    <Badge variant="outline">{c.priority}</Badge>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                    {getInitials(c.assignedToName)}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">{c.assignedToName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {showMore.complaints && complaintsData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.complaints === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, complaints: Math.max(prev.complaints - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('complaints')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.complaints === Math.ceil(complaintsData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, complaints: Math.min(prev.complaints + 1, Math.ceil(complaintsData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {complaintsData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, complaints: !prev.complaints }))}>
                                                {showMore.complaints ? 'Show Less' : 'Show More'}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {activeActivityTab === 'requirements' && (
                  <div className="space-y-4">
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-full sm:w-[200px] justify-start text-left font-normal ${!startDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {startDate ? format(new Date(startDate), 'PPP') : <span>Start Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={(date) => {
                                                            setStartDate(date || new Date());
                                                            setEndDate(addDays(date || new Date(), 5));
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-full sm:w-[200px] justify-start text-left font-normal ${!endDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {endDate ? format(new Date(endDate), 'PPP') : <span>End Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={(date) => setEndDate(date || new Date())}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                        </div>
                                        <div className="space-y-3">
                                            {paginate(requirementsData, currentPage.requirements).map((requirement) => {
                                                const r = requirement as Task;
                                                const desc = (r as unknown as Record<string, unknown>).taskDesciption ?? (r as unknown as Record<string, unknown>).taskDescription ?? '';
                                                return (
                                                    <div key={r.id} className="rounded-lg border bg-card p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-tasks text-muted-foreground"></i>
                                                                <span className="text-sm font-medium">{r.taskTitle || 'Requirement'}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">Due: {new Date(r.dueDate).toLocaleDateString()}</span>
                                                        </div>
                                                        {desc && (
                                                            <p className="text-sm text-foreground mb-3">{String(desc)}</p>
                                                        )}
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div className="flex items-center gap-4 flex-wrap">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Status:</span>
                                                                    <select
                                                                        onChange={(e) => handleChangeStatus(r.id, e.target.value)}
                                                                        value={r.status}
                                                                        className="px-2 py-1 border border-input bg-background rounded text-xs"
                                                                    >
                                                                        <option value="Assigned">Assigned</option>
                                                                        <option value="On Going">On Going</option>
                                                                        <option value="Complete">Complete</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Priority:</span>
                                                                    <Badge variant="outline">{r.priority}</Badge>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                    {getInitials(r.assignedToName)}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">{r.assignedToName}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {showMore.requirements && requirementsData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.requirements === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, requirements: Math.max(prev.requirements - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('requirements')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.requirements === Math.ceil(requirementsData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, requirements: Math.min(prev.requirements + 1, Math.ceil(requirementsData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {requirementsData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, requirements: !prev.requirements }))}>
                                                {showMore.requirements ? 'Show Less' : 'Show More'}
                        </Button>
                                        )}
                      </div>
                                )}

                                {activeActivityTab === 'brands' && (
                  <div className="space-y-4">
                                        {/* Store-level exclusive/non-exclusive badge */}
                                        {customerData && (
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-semibold text-foreground">Brands & Materials</h3>
                                                    <Badge variant={customerData.exclusive ? "default" : "secondary"} className="text-xs">
                                                        {customerData.exclusive ? 'Exclusive Store' : 'Non-Exclusive Store'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {isLoadingBrands ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                <span className="ml-2 text-sm text-muted-foreground">Loading brands...</span>
                                            </div>
                                        ) : brandsData.length > 0 ? (
                                            <div className="space-y-4">
                                                {(brandsData as { id?: number; brandName: string; status: string; pros: string[]; cons: string[]; purchasedFrom?: string }[]).map((brand, index: number) => (
                                                    <Card key={brand.id || index} className="border border-border/50">
                                                        <CardContent className="p-4">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="text-lg font-semibold text-foreground">{brand.brandName}</h3>
                                                                </div>
                                                                
                                                                {brand.purchasedFrom && (
                                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                        <i className="fas fa-store text-primary"></i>
                                                                        <span>Purchased from: <span className="font-medium text-foreground">{brand.purchasedFrom}</span></span>
                                                                    </div>
                                                                )}
                                                                
                                                                {brand.pros && brand.pros.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-medium text-foreground mb-2">Pros:</h4>
                                                                        <ul className="space-y-1">
                                                                            {brand.pros.map((pro: string, proIndex: number) => (
                                                                                <li key={proIndex} className="flex items-start gap-2 text-sm">
                                                                                    <i className="fas fa-check-circle text-green-500 mt-0.5"></i>
                                                                                    <span className="text-foreground">{pro}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                
                                                                {brand.cons && brand.cons.length > 0 && (
                                                                    <div>
                                                                        <h4 className="text-sm font-medium text-foreground mb-2">Cons:</h4>
                                                                        <ul className="space-y-1">
                                                                            {brand.cons.map((con: string, conIndex: number) => (
                                                                                <li key={conIndex} className="flex items-start gap-2 text-sm">
                                                                                    <i className="fas fa-times-circle text-red-500 mt-0.5"></i>
                                                                                    <span className="text-foreground">{con}</span>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <i className="fas fa-tags text-4xl text-muted-foreground mb-4"></i>
                                                <h3 className="text-lg font-medium text-foreground mb-2">No Brands Found</h3>
                                                <p className="text-sm text-muted-foreground">No brand information available for this customer yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeActivityTab === 'sites' && (
                  <div className="space-y-4">
                                        {isLoadingSites ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                                <span className="ml-2 text-sm text-muted-foreground">Loading sites...</span>
                                            </div>
                                        ) : sitesData.length > 0 ? (
                                            <div className="space-y-4">
                                                {(sitesData as { id?: number; siteName: string; status: string; address: string; city: string; state: string; pincode: string; startDate?: string; endDate?: string; requirement?: string; completed?: string; addressLine1?: string }[]).map((site, index: number) => (
                                                    <Card key={site.id || index} className="border border-border/50">
                                                        <CardContent className="p-4">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="text-lg font-semibold text-foreground">{site.siteName}</h3>
                                                                    <Badge variant={site.status === 'active' ? "default" : "secondary"} className="text-xs">
                                                                        {site.status === 'active' ? 'Active' : 'Inactive'}
                                                                    </Badge>
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <i className="fas fa-map-marker-alt text-primary w-4"></i>
                                                                            <span className="text-muted-foreground">City:</span>
                                                                            <span className="font-medium text-foreground">{site.city}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <i className="fas fa-calendar-alt text-primary w-4"></i>
                                                                            <span className="text-muted-foreground">Start Date:</span>
                                                                            <span className="font-medium text-foreground">{site.startDate ? new Date(site.startDate).toLocaleDateString() : 'N/A'}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <i className="fas fa-calendar-check text-primary w-4"></i>
                                                                            <span className="text-muted-foreground">End Date:</span>
                                                                            <span className="font-medium text-foreground">{site.endDate ? new Date(site.endDate).toLocaleDateString() : 'N/A'}</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <i className="fas fa-ruler-combined text-primary w-4"></i>
                                                                            <span className="text-muted-foreground">Total Area:</span>
                                                                            <span className="font-medium text-foreground">{site.requirement || 'N/A'}</span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <i className="fas fa-check-circle text-primary w-4"></i>
                                                                            <span className="text-muted-foreground">Completed Area:</span>
                                                                            <span className="font-medium text-foreground">{site.completed || 'N/A'}</span>
                                                                        </div>
                                                                        
                                                                        {site.addressLine1 && (
                                                                            <div className="flex items-start gap-2 text-sm">
                                                                                <i className="fas fa-map text-primary w-4 mt-0.5"></i>
                                                                                <span className="text-muted-foreground">Address:</span>
                                                                                <span className="font-medium text-foreground">{site.addressLine1}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {site.requirement && site.completed && (
                                                                    <div className="mt-3">
                                                                        <div className="flex items-center justify-between text-sm mb-1">
                                                                            <span className="text-muted-foreground">Progress</span>
                                                                            <span className="font-medium text-foreground">
                                                                                {Math.round((parseFloat(site.completed) / parseFloat(site.requirement)) * 100)}%
                                                                            </span>
                                                                        </div>
                                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                                            <div 
                                                                                className="bg-primary h-2 rounded-full transition-all duration-300" 
                                                                                style={{ 
                                                                                    width: `${Math.min((parseFloat(site.completed) / parseFloat(site.requirement)) * 100, 100)}%` 
                                                                                }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <i className="fas fa-map-marker-alt text-4xl text-muted-foreground mb-4"></i>
                                                <h3 className="text-lg font-medium text-foreground mb-2">No Sites Found</h3>
                                                <p className="text-sm text-muted-foreground">No site/project information available for this customer yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                  </div>
                </CardContent>
              </Card>
                </div>
            </div>

            {/* Modals */}
            {isModalVisible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-md border shadow-lg bg-background">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-semibold text-foreground">
                                {isEditMode ? 'Edit Note' : 'Add Note'}
                  </CardTitle>
                </CardHeader>
                        <CardContent className="space-y-4">
                            <textarea
                                placeholder="Enter note content"
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                rows={4}
                                disabled={isSavingNote}
                                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-60"
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsModalVisible(false)} disabled={isSavingNote}>
                                    Cancel
                                </Button>
                                <Button onClick={isEditMode ? handleSaveEditNote : handleAddNote} disabled={isSavingNote || !noteContent.trim()}>
                                    {isSavingNote ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            {isEditMode ? 'Updating…' : 'Adding…'}
                                        </>
                                    ) : (
                                        isEditMode ? 'Update' : 'Add'
                                    )}
                                </Button>
                            </div>
                </CardContent>
              </Card>
        </div>
            )}

            {isDeleteNoteModalVisible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-md border shadow-lg bg-background">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl font-semibold text-foreground">Delete Note</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">Are you sure you want to delete this note? This action cannot be undone.</p>
                            {deletingNoteContent && (
                                <div className="rounded-md border bg-muted/30 p-3 text-sm text-foreground max-h-32 overflow-auto">
                                    {deletingNoteContent}
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsDeleteNoteModalVisible(false)} disabled={isDeletingNote}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={confirmDeleteNote} disabled={isDeletingNote}>
                                    {isDeletingNote ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deleting…
                                        </>
                                    ) : (
                                        'Delete'
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Edit Customer Modal */}
            {isEditCustomerModalVisible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-2xl border shadow-lg bg-background">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-semibold text-foreground">Edit Customer</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setIsEditCustomerModalVisible(false);
                                        // Reset location selections
                                        setSelectedEditStateId(null);
                                        setSelectedEditDistrictId(null);
                                        setSelectedEditSubDistrictId(null);
                                        setEditStateSearch('');
                                        setEditDistrictSearch('');
                                        setEditSubDistrictSearch('');
                                        setEditCitySearch('');
                                    }}
                                    className="h-8 w-8 p-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                </CardHeader>
                <CardContent>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="basic-info">Basic Info</TabsTrigger>
                                    <TabsTrigger value="address-info">Address Info</TabsTrigger>
                                    <TabsTrigger value="additional-info">Additional</TabsTrigger>
                                </TabsList>
                                <TabsContent value="basic-info">
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="storeName">{getLabelForStoreName(formData.clientType || 'Dealer')}</Label>
                                                <Input
                                                    id="storeName"
                                                    name="storeName"
                                                    value={formData.storeName}
                                                    disabled
                                                    className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                                />
                        </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="gstNumber">GST Number</Label>
                                                <Input
                                                    id="gstNumber"
                                                    name="gstNumber"
                                                    value={formData.gstNumber}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="clientFirstName">{getLabelForOwner(formData.clientType || 'Dealer')} First Name</Label>
                                                <Input
                                                    id="clientFirstName"
                                                    name="clientFirstName"
                                                    value={formData.clientFirstName}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="clientLastName">{getLabelForOwner(formData.clientType || 'Dealer')} Last Name</Label>
                                                <Input
                                                    id="clientLastName"
                                                    name="clientLastName"
                                                    value={formData.clientLastName}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    value={formData.email || ''}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="primaryContact">Phone</Label>
                                                <Input
                                                    id="primaryContact"
                                                    name="primaryContact"
                                                    value={formData.primaryContact}
                                                    disabled
                                                    className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="clientType">Client Type</Label>
                                            <Select
                                                onValueChange={handleClientTypeChange}
                                                value={formData.clientType || ''}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Client Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Dealer">Dealer/Shop</SelectItem>
                                                    <SelectItem value="Professional">Engineer/Architect/Contractor</SelectItem>
                                                    <SelectItem value="Site Visit">Site Visit/Project</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            className="w-full"
                                            onClick={() => setActiveTab("address-info")}
                                        >
                                            Next
                                        </Button>
                          </div>
                                </TabsContent>
                                <TabsContent value="address-info">
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="addressLine1">Address Line 1</Label>
                                            <Input
                                                id="addressLine1"
                                                name="addressLine1"
                                                value={formData.addressLine1}
                                                onChange={handleInputChange}
                                            />
                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="addressLine2">Address Line 2</Label>
                                            <Input
                                                id="addressLine2"
                                                name="addressLine2"
                                                value={formData.addressLine2}
                                                onChange={handleInputChange}
                                            />
                                            </div>
                                        </div>
                                        {/* State Dropdown */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="state">State</Label>
                                            <Select
                                                value={selectedEditStateId?.toString() || ''}
                                                onValueChange={(value) => {
                                                    const stateId = parseInt(value);
                                                    setSelectedEditStateId(stateId);
                                                    const selectedState = editStates.find(s => s.id === stateId);
                                                    if (selectedState) {
                                                        setFormData({ ...formData, state: selectedState.stateName });
                                                    }
                                                    setEditStateSearch('');
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={formData.state || "Select state"} />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <div className="sticky top-0 bg-background p-2 border-b">
                                                        <Input
                                                            placeholder="Search state..."
                                                            value={editStateSearch}
                                                            onChange={(e) => setEditStateSearch(e.target.value)}
                                                            className="h-8"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {filteredEditStates.length > 0 ? (
                                                            filteredEditStates.map((state) => (
                                                                <SelectItem key={state.id} value={state.id.toString()}>
                                                                    {state.stateName}
                                                                </SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                                No state found
                                                            </div>
                                                        )}
                                                    </div>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* District Dropdown (Village) */}
                                        <div className="space-y-2">
                                            <Label htmlFor="village">District</Label>
                                            <Select
                                                value={selectedEditDistrictId?.toString() || ''}
                                                onValueChange={(value) => {
                                                    const districtId = parseInt(value);
                                                    setSelectedEditDistrictId(districtId);
                                                    const selectedDistrict = editDistricts.find(d => d.id === districtId);
                                                    if (selectedDistrict) {
                                                        setFormData({ ...formData, village: selectedDistrict.districtName });
                                                    }
                                                    setEditDistrictSearch('');
                                                }}
                                                disabled={!selectedEditStateId}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={!selectedEditStateId ? "Select state first" : (formData.village || "Select district")} />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <div className="sticky top-0 bg-background p-2 border-b">
                                                        <Input
                                                            placeholder="Search district..."
                                                            value={editDistrictSearch}
                                                            onChange={(e) => setEditDistrictSearch(e.target.value)}
                                                            className="h-8"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {filteredEditDistricts.length > 0 ? (
                                                            filteredEditDistricts.map((district) => (
                                                                <SelectItem key={district.id} value={district.id.toString()}>
                                                                    {district.districtName}
                                                                </SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                                No district found
                                                            </div>
                                                        )}
                                                    </div>
                                                </SelectContent>
                                            </Select>
                                            </div>
                                        </div>

                                        {/* Sub-District Dropdown (Taluka) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="taluka">Sub-District</Label>
                                            <Select
                                                value={selectedEditSubDistrictId?.toString() || ''}
                                                onValueChange={(value) => {
                                                    const subDistrictId = parseInt(value);
                                                    setSelectedEditSubDistrictId(subDistrictId);
                                                    const selectedSubDistrict = editSubDistricts.find(sd => sd.id === subDistrictId);
                                                    if (selectedSubDistrict) {
                                                        setFormData({ ...formData, taluka: selectedSubDistrict.subDistrictName });
                                                    }
                                                    setEditSubDistrictSearch('');
                                                }}
                                                disabled={!selectedEditDistrictId}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={!selectedEditDistrictId ? "Select district first" : (formData.taluka || "Select sub-district")} />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <div className="sticky top-0 bg-background p-2 border-b">
                                                        <Input
                                                            placeholder="Search sub-district..."
                                                            value={editSubDistrictSearch}
                                                            onChange={(e) => setEditSubDistrictSearch(e.target.value)}
                                                            className="h-8"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {filteredEditSubDistricts.length > 0 ? (
                                                            filteredEditSubDistricts.map((subDistrict) => (
                                                                <SelectItem key={subDistrict.id} value={subDistrict.id.toString()}>
                                                                    {subDistrict.subDistrictName}
                                                                </SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                                No sub-district found
                                                            </div>
                                                        )}
                                                    </div>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* City Dropdown */}
                                        <div className="space-y-2">
                                            <Label htmlFor="city">City</Label>
                                            <Select
                                                value={formData.city || ''}
                                                onValueChange={(value) => {
                                                    setFormData({ ...formData, city: value });
                                                    setEditCitySearch('');
                                                }}
                                                disabled={!selectedEditSubDistrictId}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={!selectedEditSubDistrictId ? "Select sub-district first" : (formData.city || "Select city")} />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    <div className="sticky top-0 bg-background p-2 border-b">
                                                        <Input
                                                            placeholder="Search city..."
                                                            value={editCitySearch}
                                                            onChange={(e) => setEditCitySearch(e.target.value)}
                                                            className="h-8"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto">
                                                        {filteredEditCities.length > 0 ? (
                                                            filteredEditCities.map((city) => (
                                                                <SelectItem key={city.id} value={city.cityName}>
                                                                    {city.cityName}
                                                                </SelectItem>
                                                            ))
                                                        ) : (
                                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                                No city found
                                                            </div>
                                                        )}
                                                    </div>
                                                </SelectContent>
                                            </Select>
                                            </div>
                                        </div>

                                        {/* Pincode */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="pincode">Pincode</Label>
                                            <Input
                                                id="pincode"
                                                name="pincode"
                                                value={formData.pincode}
                                                onChange={handleInputChange}
                                            />
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <Button
                                                variant="outline"
                                                onClick={() => setActiveTab("basic-info")}
                                            >
                                                Back
                        </Button>
                                            <Button onClick={() => setActiveTab("additional-info")}>Next</Button>
                      </div>
                  </div>
            </TabsContent>
                                <TabsContent value="additional-info">
                                    <div className="space-y-4 py-4">
                                        {/* Common Fields */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="monthlySale">Monthly Sale</Label>
                                                <Input
                                                    id="monthlySale"
                                                    name="monthlySale"
                                                    type="number"
                                                    value={formData.monthlySale || ''}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        {/* Dealer/Shop Specific Fields */}
                                        {formData.clientType === 'Dealer' && (
                                            <>
                                                <div className="border-t pt-4 mt-4">
                                                    <h4 className="text-sm font-medium mb-3">Dealer/Shop Details</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="shopAgeYears">Shop Age (Years)</Label>
                                                        <Input
                                                            id="shopAgeYears"
                                                            name="shopAgeYears"
                                                            type="number"
                                                            value={formData.shopAgeYears || ''}
                                                            onChange={handleInputChange}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="ownershipType">Ownership Type</Label>
                                                        <Select
                                                            value={formData.ownershipType || ''}
                                                            onValueChange={(value) => setFormData(prev => ({ ...prev, ownershipType: value }))}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select ownership type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="OWNED">Owned</SelectItem>
                                                                <SelectItem value="RENTED">Rented</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="dealerType">Dealer Type</Label>
                                                        <Select
                                                            value={formData.dealerType || ''}
                                                            onValueChange={(value) => {
                                                                setFormData(prev => ({ ...prev, dealerType: value }));
                                                                if (value === 'ICON') {
                                                                    setFormData(prev => ({ ...prev, dealerSubType: 'EXCLUSIVE' }));
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select dealer type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ICON">ICON</SelectItem>
                                                                <SelectItem value="NON_ICON">Non-ICON</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="dealerSubType">Dealer Sub-Type</Label>
                                                        <Select
                                                            value={formData.dealerSubType || ''}
                                                            onValueChange={(value) => setFormData(prev => ({ ...prev, dealerSubType: value }))}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select dealer sub-type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="EXCLUSIVE">Exclusive</SelectItem>
                                                                <SelectItem value="NON_EXCLUSIVE">Non-Exclusive</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Professional Specific Fields */}
                                        {formData.clientType === 'Professional' && (
                                            <>
                                                <div className="border-t pt-4 mt-4">
                                                    <h4 className="text-sm font-medium mb-3">Professional Details</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                                                        <Input
                                                            id="dateOfBirth"
                                                            name="dateOfBirth"
                                                            type="date"
                                                            value={formData.dateOfBirth}
                                                            onChange={handleInputChange}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                                                        <Input
                                                            id="yearsOfExperience"
                                                            name="yearsOfExperience"
                                                            value={formData.yearsOfExperience}
                                                            onChange={handleInputChange}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Site Visit Specific Fields */}
                                        {formData.clientType === 'Site Visit' && (
                                            <>
                                                <div className="border-t pt-4 mt-4">
                                                    <h4 className="text-sm font-medium mb-3">Site Visit Details</h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="contractorName">Contractor Name</Label>
                                                        <Input
                                                            id="contractorName"
                                                            name="contractorName"
                                                            value={formData.contractorName}
                                                            onChange={handleInputChange}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="engineerName">Engineer Name</Label>
                                                        <Input
                                                            id="engineerName"
                                                            name="engineerName"
                                                            value={formData.engineerName}
                                                            onChange={handleInputChange}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="projectType">Project Type</Label>
                                                        <Select
                                                            value={formData.projectType || ''}
                                                            onValueChange={(value) => setFormData(prev => ({ ...prev, projectType: value }))}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select project type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="HOME">Home</SelectItem>
                                                                <SelectItem value="APARTMENT">Apartment</SelectItem>
                                                                <SelectItem value="GOVT_PROJECT">Government Project</SelectItem>
                                                                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                                                                <SelectItem value="INDUSTRIAL">Industrial</SelectItem>
                                                                <SelectItem value="OTHERS">Others</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="projectSizeSquareFeet">Project Size (sq ft)</Label>
                                                        <Input
                                                            id="projectSizeSquareFeet"
                                                            name="projectSizeSquareFeet"
                                                            type="number"
                                                            value={formData.projectSizeSquareFeet || ''}
                                                            onChange={handleInputChange}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex justify-between">
                                            <Button
                                                variant="outline"
                                                onClick={() => setActiveTab("address-info")}
                                            >
                                                Back
                                </Button>
                                            <Button onClick={handleSubmit}>Update Customer</Button>
                  </div>
                                    </div>
                                </TabsContent>
          </Tabs>
                </CardContent>
              </Card>
      </div>
            )}

            {/* Log Complaint Modal */}
            {isComplaintModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-2xl border shadow-lg bg-background">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-semibold text-foreground">Create Complaint</CardTitle>
                            <p className="text-sm text-muted-foreground">Fill in the complaint details</p>
                </CardHeader>
                <CardContent>
                            <Tabs value={complaintActiveTab} onValueChange={setComplaintActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                </TabsList>
                                <TabsContent value="general">
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="complaintTitle">Complaint Title</Label>
                                            <Input
                                                id="complaintTitle"
                                                placeholder="Enter complaint title"
                                                value={complaintTask.taskTitle}
                                                onChange={(e) => setComplaintTask({ ...complaintTask, taskTitle: e.target.value })}
                                                className="w-full"
                                            />
                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="complaintDescription">Complaint Description</Label>
                                            <Input
                                                id="complaintDescription"
                                                placeholder="Enter complaint description"
                                                value={complaintTask.taskDesciption}
                                                onChange={(e) => setComplaintTask({ ...complaintTask, taskDesciption: e.target.value })}
                                                className="w-full"
                                            />
                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="complaintStoreName">Store</Label>
                                            <Input
                                                id="complaintStoreName"
                                                value={String(customerData?.storeName || 'Loading...')}
                                                disabled
                                                className="w-full bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="flex justify-between mt-4">
                                            <Button variant="outline" onClick={() => setIsComplaintModalOpen(false)}>Cancel</Button>
                                            <Button onClick={handleComplaintNext}>Next</Button>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="details">
                                    {complaintError && (
                                        <div className="mb-3 rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                            {complaintError}
                                        </div>
                                    )}
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="complaintDueDate">Due Date</Label>
                                            <Popover modal={false}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={`w-full justify-start text-left font-normal ${!complaintTask.dueDate && 'text-muted-foreground'}`}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {complaintTask.dueDate ? format(new Date(complaintTask.dueDate), 'PPP') : <span>Pick a date</span>}
                        </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={complaintTask.dueDate ? new Date(complaintTask.dueDate) : undefined}
                                                        onSelect={(date) => setComplaintTask({ ...complaintTask, dueDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="complaintPriority">Priority</Label>
                                                <Select value={complaintTask.priority} onValueChange={(value) => setComplaintTask({ ...complaintTask, priority: value })}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select a priority" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                      </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="complaintAssignedTo">Assigned To</Label>
                                            {isLoadingEmployees ? (
                                                <div className="w-full h-10 bg-gray-100 rounded-md flex items-center justify-center">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                                    <span className="ml-2 text-sm text-gray-600">Loading employees...</span>
                                                </div>
                                            ) : (
                                                <Select 
                                                    value={complaintTask.assignedToId.toString()} 
                                                    onValueChange={(value) => {
                                                        const selectedEmployee = employees.find(emp => (emp as { id: number }).id.toString() === value) as { firstName: string; lastName: string } | undefined;
                                                        setComplaintTask({ 
                                                            ...complaintTask, 
                                                            assignedToId: parseInt(value),
                                                            assignedToName: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select an employee" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {employees.map((employee) => {
                                                            const emp = employee as { id: number; firstName: string; lastName: string; employeeId?: string };
                                                            return (
                                                            <SelectItem key={emp.id} value={emp.id.toString()}>
                                                                {emp.firstName} {emp.lastName} ({emp.employeeId || ''})
                                                            </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <div className="flex justify-between mt-4">
                                            <Button variant="outline" onClick={handleComplaintBack}>Back</Button>
                                            <Button onClick={handleCreateComplaint} disabled={isCreatingComplaint}>
                                                {isCreatingComplaint ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Creating…
                                                    </>
                                                ) : (
                                                    'Create Complaint'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
            </TabsContent>
          </Tabs>
                </CardContent>
              </Card>
        </div>
            )}

            {/* Add Requirement Modal */}
            {isRequirementModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-2xl border shadow-lg bg-background">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-semibold text-foreground">Create Requirement</CardTitle>
                            <p className="text-sm text-muted-foreground">Fill in the requirement details</p>
                </CardHeader>
                <CardContent>
                            <Tabs value={requirementActiveTab} onValueChange={setRequirementActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                </TabsList>
                                <TabsContent value="general">
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="requirementTitle">Requirement Title</Label>
                                            <Input
                                                id="requirementTitle"
                                                placeholder="Enter requirement title"
                                                value={requirementTask.taskTitle}
                                                onChange={(e) => setRequirementTask({ ...requirementTask, taskTitle: e.target.value })}
                                                className="w-full"
                                            />
                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="requirementDescription">Requirement Description</Label>
                                            <Input
                                                id="requirementDescription"
                                                placeholder="Enter requirement description"
                                                value={requirementTask.taskDesciption}
                                                onChange={(e) => setRequirementTask({ ...requirementTask, taskDesciption: e.target.value })}
                                                className="w-full"
                                            />
                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="requirementStoreName">Store</Label>
                                            <Input
                                                id="requirementStoreName"
                                                value={String(customerData?.storeName || 'Loading...')}
                                                disabled
                                                className="w-full bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="flex justify-between mt-4">
                                            <Button variant="outline" onClick={() => setIsRequirementModalOpen(false)}>Cancel</Button>
                                            <Button onClick={handleRequirementNext}>Next</Button>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="details">
                                    {requirementError && (
                                        <div className="mb-3 rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                            {requirementError}
                                        </div>
                                    )}
                                    <div className="space-y-4 py-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="requirementDueDate">Due Date</Label>
                                            <Popover modal={false}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={`w-full justify-start text-left font-normal ${!requirementTask.dueDate && 'text-muted-foreground'}`}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {requirementTask.dueDate ? format(new Date(requirementTask.dueDate), 'PPP') : <span>Pick a date</span>}
                        </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar
                                                        mode="single"
                                                        selected={requirementTask.dueDate ? new Date(requirementTask.dueDate) : undefined}
                                                        onSelect={(date) => setRequirementTask({ ...requirementTask, dueDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="requirementPriority">Priority</Label>
                                                <Select value={requirementTask.priority} onValueChange={(value) => setRequirementTask({ ...requirementTask, priority: value })}>
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select a priority" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                      </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="requirementAssignedTo">Assigned To</Label>
                                            {isLoadingEmployees ? (
                                                <div className="w-full h-10 bg-gray-100 rounded-md flex items-center justify-center">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                                    <span className="ml-2 text-sm text-gray-600">Loading employees...</span>
                                                </div>
                                            ) : (
                                                <Select 
                                                    value={requirementTask.assignedToId.toString()} 
                                                    onValueChange={(value) => {
                                                        const selectedEmployee = employees.find(emp => (emp as { id: number }).id.toString() === value) as { firstName: string; lastName: string } | undefined;
                                                        setRequirementTask({ 
                                                            ...requirementTask, 
                                                            assignedToId: parseInt(value),
                                                            assignedToName: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Select an employee" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {employees.map((employee) => {
                                                            const emp = employee as { id: number; firstName: string; lastName: string; employeeId?: string };
                                                            return (
                                                            <SelectItem key={emp.id} value={emp.id.toString()}>
                                                                {emp.firstName} {emp.lastName} ({emp.employeeId || ''})
                                                            </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <div className="flex justify-between mt-4">
                                            <Button variant="outline" onClick={handleRequirementBack}>Back</Button>
                                            <Button onClick={handleCreateRequirement} disabled={isCreatingRequirement}>
                                                {isCreatingRequirement ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Creating…
                                                    </>
                                                ) : (
                                                    'Create Requirement'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
            </TabsContent>
          </Tabs>
                        </CardContent>
                    </Card>
        </div>
            )}

            {/* Image Preview Dialog */}
            {isImagePreviewOpen && (
                <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Image Preview</DialogTitle>
                        </DialogHeader>
                        {isLoadingImages ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
}
