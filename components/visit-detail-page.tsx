"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import NextImage from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Building,
  Clock,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageSquare,
  FileText,
  AlertCircle,
  Image as ImageIcon,
  Navigation,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Store,
  CheckCircle,
  Loader2,
  Package,
  ExternalLink,
  ClipboardList,
  ListTodo,
  MapPin as MapMarker,
  LogIn,
  LogOut,
  Hash,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DetailHero, DetailShell, EmptyState, FormField, FormSheet, Info, KpiCell, Pill, Section, type DetailTab, type HeroNextStep, type Tone } from "@/components/detail-ui";
import TaskCreateSheet from "@/components/task-create-sheet";
import { format, parseISO } from "date-fns";
import { Heading, Text } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { API, formatStockQuantity, getStock, IntentAuditLog, MonthlySaleChange as StockChange, Task, Note as ApiNote, VisitDto, VisitBrandPurchase, type StoreDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useGuardedRouter, useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { normalizeRoleValue, extractAuthorityRoles, hasAnyRole } from "@/lib/role-utils";
import {
  REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS,
  getRequirementComplaintCategoryLabel,
} from "@/lib/requirement-complaint-category";
import BrandTab from './BrandTab';
import VisitTasksTab from './visit-tasks-tab';
import { normalizeVisitTask, filterVisitHistory, calculateDuration } from '@/lib/visit-detail';

type Priority = 'low' | 'medium' | 'high';

type Metric = {
  title: string;
  value: string;
};

type AttachmentResponse = {
  id?: number | null;
  tag: string;
  fileName: string;
  fileDownloadUri?: string;
  fileType?: string;
  size?: number | null;
};

interface RawTaskData {
  id: number;
  taskTitle?: string;
  taskDesciption?: string;
  status?: string;
  priority?: string;
  assignedToName?: string;
  dueDate?: string;
  taskType?: string;
  visitId?: number;
  attachmentResponse?: AttachmentResponse[];
}

interface TaskWithAttachments extends Task {
  attachmentResponse?: AttachmentResponse[];
}

const ALLOWED_EMPLOYEE_VISIT_FILTERS = new Set([
  'today',
  'yesterday',
  'last-2-days',
  'this-week',
  'this-month',
  'last-month',
]);

const ALLOWED_DASHBOARD_DATE_RANGES = new Set([
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
]);
type VisitDetail = {
  id: number;
  storeName: string;
  employeeName: string;
  visit_date: string;
  purpose: string;
  priority: string;
  outcome: string | null;
  brandsInUse: string[];
  purchasedFrom?: string | null;
  constructionStage?: string | null;
  steelStockAvailable?: number | null;
  steelStockRequired?: number | null;
  cementStockAvailable?: number | null;
  cementStockRequired?: number | null;
  brandPurchases: VisitBrandPurchase[];
  createdAt: string;
  updatedAt: string;
  storeId: number;
  employeeId: number;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkinTime?: string;
  checkinDate?: string;
  checkoutTime?: string;
  checkoutDate?: string;
  rating?: number;
  status?: string;
  storeLatitude?: number;
  storeLongitude?: number;
};

interface Visit {
  id: number;
  date: string;
  time: string;
  duration: string;
  visitor: string;
  customer: string;
  customerOwner: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  location: {
    lat: number;
    lng: number;
  };
  purpose?: string;
  outcome?: string;
  feedback?: string;
  priority?: string;
  intent?: number;
  stock?: number;
  monthlySale?: number;
  brandsInUse?: string[];
  attachmentResponse?: unknown[];
  intentAuditLogDto?: unknown;
  storeId?: number;
  employeeId?: number;
}

interface Brand {
  id: number;
  name: string;
  product: string;
  interestLevel: "High" | "Medium" | "Low";
}

interface Requirement {
  id: number;
  title: string;
  date: string;
  status: "new" | "in-progress" | "completed";
  value: string;
}

interface Complaint {
  id: number;
  date: string;
  title: string;
  status: "open" | "in-progress" | "resolved";
  assignedTo: string;
}

interface PreviousVisit {
  id: number;
  date: string;
  visitor: string;
  purpose: string;
  outcome: string;
  duration: string;
}

interface Note {
  id: number;
  author: string;
  date: string;
  content: string;
  priority: "low" | "medium" | "high";
}

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
};

type Store = {
  id: number;
  storeName: string;
};

type NewTask = {
  id: number;
  taskTitle: string;
  taskDesciption: string;
  taskType: string;
  dueDate: string;
  assignedToId: number;
  assignedToName: string;
  assignedById: number;
  assignedByName: string;
  storeId: number;
  storeName: string;
  storeCity: string;
  visitId: number;
  visitDate: string;
  status: string;
  priority: Priority;
  attachment: unknown[];
  attachmentResponse: unknown[];
  createdAt: string;
  updatedAt: string;
  createdTime: string;
  updatedTime: string;
};

interface CheckinImage {
  id: number;
  url: string;
  caption: string;
  timestamp: string;
}

const mockBrands: Brand[] = [
  {
    id: 1,
    name: "Brand A",
    product: "Product X",
    interestLevel: "High"
  },
  {
    id: 2,
    name: "Brand B",
    product: "Product Y",
    interestLevel: "Medium"
  },
  {
    id: 3,
    name: "Brand C",
    product: "Product Z",
    interestLevel: "Low"
  }
];

const mockRequirements: Requirement[] = [
  {
    id: 1,
    title: "Custom integration with existing system",
    date: "2023-06-15",
    status: "in-progress",
    value: "$15,000"
  },
  {
    id: 2,
    title: "Training for 10 employees",
    date: "2023-06-10",
    status: "completed",
    value: "$5,000"
  }
];

const mockComplaints: Complaint[] = [
  {
    id: 1,
    date: "2023-06-12",
    title: "Late delivery of last order",
    status: "resolved",
    assignedTo: "Support Team"
  },
  {
    id: 2,
    date: "2023-06-18",
    title: "Product quality issue",
    status: "in-progress",
    assignedTo: "Quality Team"
  }
];

const mockPreviousVisits: PreviousVisit[] = [
  {
    id: 1,
    date: "2023-06-10",
    visitor: "Bob Johnson",
    purpose: "Follow-up meeting",
    outcome: "Scheduled next visit",
    duration: "45m"
  },
  {
    id: 2,
    date: "2023-06-05",
    visitor: "Charlie Brown",
    purpose: "Initial consultation",
    outcome: "Requirements gathered",
    duration: "1h 15m"
  },
  {
    id: 3,
    date: "2023-05-20",
    visitor: "Alice Smith",
    purpose: "Product Demo",
    outcome: "Positive feedback received",
    duration: "1h 30m"
  }
];

const mockNotes: Note[] = [
  {
    id: 1,
    author: "Alice Smith",
    date: "2023-06-15",
    content: "Customer is interested in our premium package. Wants to see a detailed proposal.",
    priority: "high"
  },
  {
    id: 2,
    author: "Alice Smith",
    date: "2023-06-15",
    content: "Customer mentioned budget constraints. Suggested our mid-tier package as an alternative.",
    priority: "medium"
  }
];

const mockCheckinImages: CheckinImage[] = [
  {
    id: 1,
    url: "/placeholder.svg?height=200&width=200",
    caption: "Store front",
    timestamp: "2023-06-15 10:35 AM"
  },
  {
    id: 2,
    url: "/placeholder.svg?height=200&width=200",
    caption: "Meeting with owner",
    timestamp: "2023-06-15 11:15 AM"
  },
  {
    id: 3,
    url: "/placeholder.svg?height=200&width=200",
    caption: "Product display",
    timestamp: "2023-06-15 11:45 AM"
  }
];

const keyMetrics = {
  totalVisits: 12,
  avgDuration: "1h 15m",
  conversionRate: "65%",
  lastVisit: "2023-06-15"
};

const joinDefined = (parts: Array<string | number | null | undefined>, separator = ', ') =>
  parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join(separator);

const getStoreOwnerName = (store: StoreDto | null | undefined) =>
  joinDefined([store?.clientFirstName, store?.clientLastName], ' ');

const getStoreAddress = (store: StoreDto | null | undefined) =>
  joinDefined([
    store?.addressLine1,
    store?.addressLine2,
    store?.landmark,
    store?.subDistrict,
    store?.district,
    store?.city,
    store?.state,
    store?.country,
    store?.pincode,
  ]);

export default function VisitDetailPage({
  searchParams: propSearchParams
}: {
  searchParams?: { from?: string; employeeId?: string;[key: string]: string | string[] | undefined }
} = {}) {
  const router = useGuardedRouter();
  const hookSearchParams = useSearchParams();

  // Use prop searchParams if available, otherwise fall back to hook
  const searchParams = propSearchParams && Object.keys(propSearchParams).length > 0 ? {
    get: (key: string) => {
      const value = propSearchParams[key];
      return Array.isArray(value) ? value[0] : (value || null);
    },
    toString: () => {
      const entries = Object.entries(propSearchParams)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]);
      return new URLSearchParams(entries).toString();
    }
  } : hookSearchParams;

  // Store the original source when visit detail loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const from = searchParams?.get('from');
      // If visit detail came from employees page, store it
      // Check if from parameter indicates it came from employees (not employee or dashboardEmployee)
      if (from === 'employees' || (!from || (from !== 'employee' && from !== 'dashboardEmployee'))) {
        // If no from parameter or from is not employee/dashboardEmployee, 
        // check if the referrer suggests it came from employees page
        const referrer = document.referrer;
        if (referrer && referrer.includes('/dashboard/employees')) {
          try {
            window.localStorage.setItem('visitDetailFrom', 'employees');
          } catch (error) {
            console.error('Failed to store visit detail from:', error);
          }
        } else if (!from) {
          // If no from parameter and referrer doesn't help, 
          // check if we have a stored context indicating employees
          const storedContext = window.localStorage.getItem('visitReturnContext');
          if (storedContext) {
            try {
              const parsed = JSON.parse(storedContext);
              if (parsed.route && parsed.route.includes('/dashboard/employees')) {
                window.localStorage.setItem('visitDetailFrom', 'employees');
              }
            } catch (e) {
              // Ignore
            }
          }
        } else if (from === 'employees') {
          try {
            window.localStorage.setItem('visitDetailFrom', 'employees');
          } catch (error) {
            console.error('Failed to store visit detail from:', error);
          }
        }
      }
    }
  }, [searchParams]);

  const params = useParams();
  const visitId = params?.id as string;
  const { userRole, userData, currentUser } = useAuth();

  const [visitDetail, setVisitDetail] = useState<VisitDetail | null>(null);
  const [activeTab, setActiveTab] = useState("metrics");
  const [activeInfoTab, setActiveInfoTab] = useState("visit-info");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intentAuditLogs, setIntentAuditLogs] = useState<IntentAuditLog[]>([]);
  const [stockChanges, setStockChanges] = useState<StockChange[]>([]);
  const [requirements, setRequirements] = useState<TaskWithAttachments[]>([]);
  const [complaints, setComplaints] = useState<TaskWithAttachments[]>([]);
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [storeVisits, setStoreVisits] = useState<VisitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinImages, setCheckinImages] = useState<string[]>([]);
  const [giftImageUrl, setGiftImageUrl] = useState<string | null>(null);
  const [upcomingSitesCount, setUpcomingSitesCount] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [visitsPerPage, setVisitsPerPage] = useState(3);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskErrors, setTaskErrors] = useState<{ requirement: string | null; complaint: string | null }>({ requirement: null, complaint: null });
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [notePendingDelete, setNotePendingDelete] = useState<ApiNote | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [filteredRequirements, setFilteredRequirements] = useState<TaskWithAttachments[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<TaskWithAttachments[]>([]);
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [isNavigatingToStore, setIsNavigatingToStore] = useState(false);
  const [activeRequirementTab, setActiveRequirementTab] = useState('general');
  const [activeComplaintTab, setActiveComplaintTab] = useState('general');
  const [stores, setStores] = useState<Store[]>([]);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [taskImages, setTaskImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const hasPerformedInitialFetch = useRef(false);
  const isFetchingRef = useRef(false);
  const [newTask, setNewTask] = useState<NewTask>({
    id: 0,
    taskTitle: '',
    taskDesciption: '',
    dueDate: '',
    assignedToId: 0,
    assignedToName: '',
    assignedById: 97,
    assignedByName: '',
    storeId: 0,
    storeName: '',
    storeCity: '',
    visitId: Number(visitId),
    visitDate: '',
    status: 'Assigned',
    priority: '' as Priority,
    taskType: 'requirement',
    attachment: [],
    attachmentResponse: [],
    createdAt: '',
    updatedAt: '',
    createdTime: '',
    updatedTime: '',
  });
  const [complaintTask, setComplaintTask] = useState<NewTask>({
    id: 0,
    taskTitle: '',
    taskDesciption: '',
    dueDate: '',
    assignedToId: 0,
    assignedToName: '',
    assignedById: 97,
    assignedByName: '',
    storeId: 0,
    storeName: '',
    storeCity: '',
    visitId: Number(visitId),
    visitDate: '',
    status: 'Assigned',
    priority: '' as Priority,
    taskType: 'complaint',
    attachment: [],
    attachmentResponse: [],
    createdAt: '',
    updatedAt: '',
    createdTime: '',
    updatedTime: '',
  });
  const [storeDetails, setStoreDetails] = useState<{
    storeName: string;
    ownerName: string;
    contactNumber: string;
    email: string;
    city: string;
    address: string;
  } | null>(null);
  const [storeClientType, setStoreClientType] = useState<string | null>(null);

  // Role-based state
  const [isManager, setIsManager] = useState(false);

  // Notes functionality
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isNoteEditMode, setIsNoteEditMode] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteDetails, setEditingNoteDetails] = useState<{ employeeId: number; storeId: number } | null>(null);
  const originalNoteContent = isNoteEditMode && editingNoteId !== null
    ? notes.find((note) => Number(note.id) === editingNoteId)?.content ?? ''
    : '';
  const noteDraftIsDirty = isNoteModalVisible && noteContent !== originalNoteContent;
  const requirementDraftIsDirty = isRequirementModalOpen && Boolean(
    newTask.taskTitle.trim() || newTask.taskDesciption.trim() || newTask.dueDate || newTask.priority
  );
  const complaintDraftIsDirty = isComplaintModalOpen && Boolean(
    complaintTask.taskTitle.trim() || complaintTask.taskDesciption.trim() || complaintTask.dueDate || complaintTask.priority
  );
  const visitDraftIsDirty = noteDraftIsDirty || requirementDraftIsDirty || complaintDraftIsDirty;
  const { markSaved: markVisitDraftSaved, requestDiscard: requestVisitDraftDiscard } = useUnsavedChanges(visitDraftIsDirty);

  const closeNoteEditor = useCallback(() => {
    if (isNoteSaving) return;
    requestVisitDraftDiscard(() => {
      setIsNoteModalVisible(false);
      setNoteContent('');
      setIsNoteEditMode(false);
      setEditingNoteId(null);
      setEditingNoteDetails(null);
      setNoteError(null);
    }, noteDraftIsDirty);
  }, [isNoteSaving, noteDraftIsDirty, requestVisitDraftDiscard]);

  const closeRequirementCreator = useCallback(() => {
    if (isTaskSaving) return;
    requestVisitDraftDiscard(() => {
      setIsRequirementModalOpen(false);
      setActiveRequirementTab('general');
      setTaskCreateError(null);
      setNewTask((current) => ({ ...current, taskTitle: '', taskDesciption: '', dueDate: '', priority: '' as Priority }));
    }, requirementDraftIsDirty);
  }, [isTaskSaving, requestVisitDraftDiscard, requirementDraftIsDirty]);

  const closeComplaintCreator = useCallback(() => {
    if (isTaskSaving) return;
    requestVisitDraftDiscard(() => {
      setIsComplaintModalOpen(false);
      setActiveComplaintTab('general');
      setTaskCreateError(null);
      setComplaintTask((current) => ({ ...current, taskTitle: '', taskDesciption: '', dueDate: '', priority: '' as Priority }));
    }, complaintDraftIsDirty);
  }, [complaintDraftIsDirty, isTaskSaving, requestVisitDraftDiscard]);

  // Helper functions
  const getOutcomeStatus = (visit: VisitDetail | null): { emoji: React.ReactNode; status: string; color: string; isOngoing: boolean } => {
    if (visit?.checkinTime && visit?.checkoutTime) {
      return { emoji: '✅', status: 'Completed', color: 'bg-purple-100 text-purple-800', isOngoing: false };
    } else if (visit?.checkoutTime) {
      return { emoji: '⏱️', status: 'Checked Out', color: 'bg-orange-100 text-orange-800', isOngoing: false };
    } else if (visit?.checkinTime) {
      return { emoji: '🕰️', status: 'On Going', color: 'bg-green-100 text-green-800', isOngoing: true };
    }
    return { emoji: '📅', status: 'Assigned', color: 'bg-muted text-muted-foreground', isOngoing: false };
  };

  const getInitials = (name: string) => {
    const nameParts = name.split(' ');
    const initials = nameParts.map((part) => part[0]).join('');
    return initials.toUpperCase().slice(0, 2);
  };

  // Determine user role and display role
  const normalizedUserRole = normalizeRoleValue(userRole);
  const authorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);

  const getDisplayRole = useMemo(() => {
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['ADMIN'])) {
      return 'Admin';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['DATA_MANAGER'])) {
      return 'Data Manager';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['COORDINATOR'])) {
      return 'Coordinator';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['AVP'])) {
      return 'AVP';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['MANAGER', 'OFFICE_MANAGER', 'REGIONAL_MANAGER'])) {
      return 'Regional Manager';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['FIELD_OFFICER'])) {
      return 'Field Officer';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['HR'])) {
      return 'HR';
    }
    return 'User';
  }, [normalizedUserRole, authorityRoles]);

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

  const getStatusIcon = (status: 'Assigned' | 'On Going' | 'Checked Out' | 'Completed') => {
    switch (status) {
      case 'Assigned':
        return <Clock className="w-4 h-4 mr-2" />;
      case 'On Going':
        return <Loader2 className="w-4 h-4 mr-2" />;
      case 'Checked Out':
        return <CheckCircle className="w-4 h-4 mr-2" />;
      case 'Completed':
        return <CheckCircle className="w-4 h-4 mr-2" />;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    return (
      <span className={`status-badge bg-black text-white dark:bg-neutral-900 dark:text-neutral-100`}>
        {getRequirementComplaintCategoryLabel(priority)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      Assigned: 'bg-muted text-muted-foreground',
      'Work in Progress': 'bg-orange-100 text-orange-800',
      Complete: 'bg-green-100 text-green-800',
    } as const;

    type StatusColor = keyof typeof statusColors;

    const colorClass = (status in statusColors)
      ? statusColors[status as StatusColor]
      : 'bg-gray-100 text-gray-800';

    return (
      <span className={`status-badge ${colorClass}`}>
        {status}
      </span>
    );
  };

  const fetchCheckinImages = useCallback(async (visitId: number, attachments: unknown[]) => {
    try {
      const api = new API();
      const checkinImageUrls = await Promise.all(
        attachments
          .filter((attachment: unknown) => (attachment as { tag?: string }).tag === 'check-in')
          .map(async (attachment: unknown) => {
            const att = attachment as { fileName?: string };
            try {

              const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/visit/downloadFile/${visitId}/check-in/${att.fileName}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
              });

              if (!response.ok) {
                throw new Error('Failed to fetch image');
              }

              const blob = await response.blob();
              return URL.createObjectURL(blob);
            } catch (error) {
              console.error('Error fetching individual image:', error);
              return null;
            }
          })
      );


      setCheckinImages(checkinImageUrls.filter(url => url !== null) as string[]);
    } catch (error) {
      console.error('Error fetching check-in images:', error);
      setCheckinImages([]);
    }
  }, []);

  const fetchGiftImage = useCallback(async (visitId: number, attachments: unknown[]) => {
    try {
      const checkoutAttachment = attachments.find(
        (attachment: unknown) => (attachment as { tag?: string }).tag === 'check-out'
      ) as { fileName?: string } | undefined;

      const fileName = checkoutAttachment?.fileName;
      if (!fileName) {
        setGiftImageUrl(null);
        return;
      }

      const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/visit/downloadFile/${visitId}/check-out/${fileName}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch gift image');
      }

      const blob = await response.blob();
      setGiftImageUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Error fetching gift image:', error);
      setGiftImageUrl(null);
    }
  }, []);

  const extractUpcomingSites = (value: unknown): number | null => {
    if (value == null) return null;
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
  };

  const formatStockValue = (value: unknown, unit: string) => {
    if (value == null || String(value).trim() === '') return '—';
    return `${String(value).trim()} ${unit}`;
  };

  const fetchVisitDetail = useCallback(async (visitId: string) => {
    if (isFetchingRef.current || !visitId) {
      return;
    }
    isFetchingRef.current = true;
    const isInitialFetch = !hasPerformedInitialFetch.current;
    try {
      if (isInitialFetch) {
        setIsLoading(true);
        setActiveTab("metrics");
      }
      setError(null);
      const api = new API();

      // Fetch minimal data first for fast initial render
      console.log('🔍 Fetching visit data for ID:', visitId);
      const visitData = await api.getVisitById(Number(visitId));
      console.log('📊 Visit data received:', visitData);
      setVisitDetail({
        ...visitData,
        status: visitData.status ?? undefined,
        purpose: visitData.purpose || '',
        priority: visitData.priority || 'low',
        outcome: visitData.outcome || null,
        brandsInUse: (visitData.brandsInUse as string[]) || [],
        brandPurchases: Array.isArray(visitData.brandPurchases) ? visitData.brandPurchases : [],
        purchasedFrom: (visitData as unknown as { purchasedFrom?: string | null }).purchasedFrom ?? null,
        constructionStage: (visitData as unknown as { constructionStage?: string | null }).constructionStage ?? null,
        createdAt: visitData.createdAt || '',
        updatedAt: visitData.updatedAt || '',
        storeId: visitData.storeId || 0,
        employeeId: visitData.employeeId || 0,
      });
      setStoreClientType(null);
      setStoreDetails(null);
      setGiftImageUrl(null);
      setUpcomingSitesCount(null);

      if (isInitialFetch) {
        hasPerformedInitialFetch.current = true;
      }

      // Basic metric available from visit data

      if (isInitialFetch) {
        setIsLoading(false);
      }

      // Load remaining data in parallel without blocking UI
      (async () => {
        try {
          console.log('🔄 Loading auxiliary data for visit:', visitId);
          // Determine client type so we can hide tabs for Site Visit
          let resolvedClientType: string | null = null;
          let resolvedUpcomingSites: number | null = null;
          try {
            if (visitData.storeId) {
              const store = await api.getStoreById(visitData.storeId);
              resolvedClientType = store?.clientType ?? null;
              setStoreDetails({
                storeName: store?.storeName || visitData.storeName || '',
                ownerName: getStoreOwnerName(store),
                contactNumber: store?.primaryContact ? String(store.primaryContact) : '',
                email: store?.email || '',
                city: store?.city || '',
                address: getStoreAddress(store),
              });
              const storeAny = store as unknown as Record<string, unknown> | null;
              if (storeAny) {
                resolvedUpcomingSites =
                  extractUpcomingSites(storeAny.upcomingSites) ??
                  extractUpcomingSites(storeAny.upcoming_sites) ??
                  extractUpcomingSites(storeAny.upcomingSite) ??
                  extractUpcomingSites(storeAny.upcomingSiteCount) ??
                  extractUpcomingSites(storeAny.upcomingSitesCount);
              }
            }
          } catch (e) {
            console.warn('Failed to fetch store client type:', e);
          } finally {
            setStoreClientType(resolvedClientType);
            setUpcomingSitesCount(resolvedUpcomingSites);
          }

          const normalizedClientType = (resolvedClientType ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[\/,]+/g, ' ')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ');
          const isSiteVisitClient = normalizedClientType === 'site visit';
          const isProfessionalClient =
            normalizedClientType.includes('engineer') ||
            normalizedClientType.includes('architect') ||
            normalizedClientType.includes('contractor');
          const [
            intentAuditData,
            stockData,
            notesData,
            storeVisitsData,
          ] = await Promise.all([
            api.getIntentAuditByVisit(Number(visitId)),
            api.getMonthlySaleByVisit(Number(visitId)),
            api.getNotesByVisit(Number(visitId)),
            api.getVisitsByStore(visitData.storeId || 0),
          ]);

          console.log('📈 Auxiliary data loaded:', {
            intentAudit: intentAuditData?.length || 0,
            stock: stockData?.length || 0,
            notes: notesData?.length || 0,
            storeVisits: storeVisitsData?.length || 0,
          });

          setIntentAuditLogs(intentAuditData || []);
          setStockChanges(stockData || []);
          // Filter and validate notes - ensure they have valid IDs
          const validNotes = (notesData || []).filter((note: ApiNote) => {
            const hasValidId = note.id != null && (
              (typeof note.id === 'number' && !isNaN(note.id)) ||
              (typeof note.id !== 'number' && String(note.id).trim() !== '' && !isNaN(Number(note.id)))
            );
            // Also ensure note has required properties
            return hasValidId && note.content;
          }).map((note: ApiNote) => {
            // Normalize ID to number if it's a string
            if (typeof note.id !== 'number') {
              const parsedId = Number(note.id);
              if (!isNaN(parsedId)) {
                return { ...note, id: parsedId };
              }
            }
            return note;
          });
          setNotes(validNotes);
          setStoreVisits(storeVisitsData || []);

          // Derive metrics from fetched data (intent level removed)

          if (stockData && stockData.length > 0) {
            const recentStock = formatStockQuantity(
              getStock({ stock: stockData[0].newStock, monthlySale: stockData[0].newMonthlySale }),
              'N/A'
            );
            setMetrics((prev) => {
              const filtered = prev.filter((m) => m.title !== 'Stock');
              return [...filtered, { title: 'Stock', value: recentStock }];
            });
          }

          // Fetch check-in images in background
          if (visitData.attachmentResponse && visitData.attachmentResponse.length > 0) {
            fetchCheckinImages(Number(visitId), visitData.attachmentResponse);
          }
          // Gift image for Engineer/Architect/Contractor
          if (isProfessionalClient && visitData.attachmentResponse && visitData.attachmentResponse.length > 0) {
            fetchGiftImage(Number(visitId), visitData.attachmentResponse);
          }

          // Store details
          if (storeVisitsData && storeVisitsData.length > 0) {
            const firstVisit = storeVisitsData[0];
            const fallbackAddress =
              `${firstVisit.subDistrict || ''}, ${firstVisit.district || ''}, ${firstVisit.state || ''}`
                .replace(/^[, ]+|[, ]+$/g, '');
            setStoreDetails((prev) => ({
              storeName: prev?.storeName || visitData.storeName || '',
              ownerName: prev?.ownerName || '',
              contactNumber: prev?.contactNumber || firstVisit.storePrimaryContact?.toString() || '',
              email: prev?.email || '',
              city: prev?.city || firstVisit.city || '',
              address: prev?.address || fallbackAddress || '',
            }));
          }
        } catch (innerErr) {
          console.error('Error loading visit auxiliary data:', innerErr);
        }
        isFetchingRef.current = false;
      })();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load visit details');
      console.error('Error fetching visit details:', err);
      if (isInitialFetch) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [fetchCheckinImages, fetchGiftImage]);

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    setTasksLoading(true);
    setRequirements([]);
    setComplaints([]);
    setTaskErrors({ requirement: null, complaint: null });
    const api = new API();
    Promise.allSettled([api.getTasksByVisit('requirement', Number(visitId)), api.getTasksByVisit('complaint', Number(visitId))]).then(results => {
      if (cancelled) return;
      results.forEach((result, index) => {
        const type = index === 0 ? 'requirement' : 'complaint';
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          const tasks = result.value.map(task => normalizeVisitTask(task, type, Number(visitId)));
          (index === 0 ? setRequirements : setComplaints)(tasks);
        } else {
          setTaskErrors(prev => ({ ...prev, [type]: result.status === 'rejected' && result.reason instanceof Error ? result.reason.message : 'Unable to load records.' }));
        }
      });
      setTasksLoading(false);
    });
    return () => { cancelled = true; };
  }, [visitId]);

  const isSiteVisitClient = useMemo(() => {
    const normalized = (storeClientType ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');
    return normalized === 'site visit';
  }, [storeClientType]);

  const isProfessionalClient = useMemo(() => {
    const normalized = (storeClientType ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\/,]+/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');
    return (
      normalized.includes('engineer') ||
      normalized.includes('architect') ||
      normalized.includes('contractor')
    );
  }, [storeClientType]);

  // fetchIntentLevel removed (intent level no longer displayed)

  const fetchStockHistory = async (visitId: string) => {
    try {
      const api = new API();
      const data = await api.getMonthlySaleByVisit(Number(visitId));
      const recentStock = data.length > 0
        ? formatStockQuantity(getStock({ stock: data[0].newStock, monthlySale: data[0].newMonthlySale }), 'N/A')
        : 'N/A';
      setMetrics((prevMetrics) => {
        const updatedMetrics = prevMetrics.filter(metric => metric.title !== 'Stock');
        return [
          ...updatedMetrics,
          { title: 'Stock', value: recentStock.toString() },
        ];
      });
    } catch (error) {
      console.error('Error fetching stock history:', error);
    }
  };

  useEffect(() => {
    if (visitId) {
      hasPerformedInitialFetch.current = false;
      isFetchingRef.current = false;
      fetchVisitDetail(visitId);
    }
  }, [visitId, fetchVisitDetail]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!visitId || !hasPerformedInitialFetch.current) {
        return;
      }
      fetchVisitDetail(visitId);
    };

    window.addEventListener('pageshow', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('pageshow', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [visitId, fetchVisitDetail]);

  // Handler functions
  const handleBack = () => {
    if (typeof window !== 'undefined') {
      const storedContext = window.localStorage.getItem('visitReturnContext');
      if (storedContext) {
        try {
          const parsedContext = JSON.parse(storedContext) as { route?: string | null };
          window.localStorage.removeItem('visitReturnContext');
          if (parsedContext?.route) {
            router.push(parsedContext.route);
            return;
          }
        } catch (error) {
          console.error('Failed to parse visit return context:', error);
          window.localStorage.removeItem('visitReturnContext');
        }
      }
    }

    const from = searchParams?.get('from');
    const employeeId = searchParams?.get('employeeId');
    const visitFilter = searchParams?.get('visitFilter');
    const dateRangeKey = searchParams?.get('dateRange');
    const buildEmployeeReturnRoute = (empId: string) => {
      if (visitFilter && ALLOWED_EMPLOYEE_VISIT_FILTERS.has(visitFilter)) {
        const params = new URLSearchParams({ visitFilter });
        return `/dashboard/employee/${empId}?${params.toString()}`;
      }
      return `/dashboard/employee/${empId}`;
    };

    if (from === 'employee' && employeeId) {
      router.push(buildEmployeeReturnRoute(employeeId));
      return;
    }

    if (from === 'dashboardEmployee' && employeeId) {
      const params = new URLSearchParams({
        view: 'employeeDetail',
        employeeId,
      });
      if (visitFilter && ALLOWED_EMPLOYEE_VISIT_FILTERS.has(visitFilter)) {
        params.set('visitFilter', visitFilter);
      }
      if (dateRangeKey && ALLOWED_DASHBOARD_DATE_RANGES.has(dateRangeKey)) {
        params.set('dateRange', dateRangeKey);
      }
      router.push(`/dashboard?${params.toString()}`);
      return;
    }

    router.back();
  };

  const handleViewStore = async () => {
    if (!visitDetail?.storeId) return;
    try {
      setIsNavigatingToStore(true);
      await router.push(`/dashboard/customers/${visitDetail.storeId}`);
    } finally {
      setIsNavigatingToStore(false);
    }
  };

  const fetchTaskImages = async (taskId: number) => {
    setIsLoadingImages(true);
    try {
      const token = localStorage.getItem('authToken');
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

      const attachments: AttachmentResponse[] = Array.isArray(taskData.attachmentResponse)
        ? taskData.attachmentResponse
        : [];

      const imageUrls = attachments.map((attachment) =>
        attachment.fileDownloadUri ??
        `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/downloadFile/${taskId}/${attachment.tag}/${attachment.fileName}`
      );

      setTaskImages(imageUrls);
      setCurrentImageIndex(0);
      setIsImagePreviewOpen(true);
    } catch (error) {
      console.error('Error fetching task images:', error);
    } finally {
      setIsLoadingImages(false);
    }
  };


  const handlePriorityChange = (value: string) => {
    setPriorityFilter(value);
  };

  const filterTasks = useCallback(() => {
    const filterByPriority = (tasks: TaskWithAttachments[]) => {
      if (priorityFilter === 'all') return tasks;
      return tasks.filter(task => task.priority === priorityFilter);
    };

    setFilteredRequirements(filterByPriority(requirements));
    setFilteredComplaints(filterByPriority(complaints));
  }, [priorityFilter, requirements, complaints]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const indexOfLastVisit = currentPage * visitsPerPage;
  const indexOfFirstVisit = indexOfLastVisit - visitsPerPage;
  const filteredVisits = useMemo(() => filterVisitHistory(storeVisits, searchQuery), [storeVisits, searchQuery]);
  const currentVisits = filteredVisits.slice(showAll ? indexOfFirstVisit : 0, showAll ? indexOfLastVisit : visitsPerPage);

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / visitsPerPage));

  const renderPaginationItems = () => {
    const items = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => handlePageChange(i)}
              size="sm"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      } else if (
        (i === currentPage - 2 && i > 2) ||
        (i === currentPage + 2 && i < totalPages - 1)
      ) {
        items.push(
          <PaginationItem key={i}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }
    return items;
  };

  useEffect(() => {
    filterTasks();
  }, [requirements, complaints, priorityFilter, filterTasks]);

  const visitStatus = getOutcomeStatus(visitDetail);
  const storeProjectName = storeDetails?.storeName || visitDetail?.storeName || "N/A";
  const ownerCustomerName = storeDetails?.ownerName || "";
  const storeContactNumber = storeDetails?.contactNumber || "";
  const storeEmail = storeDetails?.email || "";

  const infoItems = [
    {
      icon: Calendar,
      label: "Date & Time",
      value: visitDetail ? `${format(new Date(visitDetail.visit_date), "MMM d, yyyy")} at ${visitDetail.checkinTime || "N/A"}` : "N/A",
    },
    { icon: User, label: "Visited by", value: visitDetail?.employeeName || "N/A" },
    { icon: Store, label: "Store/Project", value: storeProjectName },
    { icon: User, label: "Owner/Customer", value: ownerCustomerName || "N/A" },
    { icon: Phone, label: "Contact", value: storeContactNumber || "N/A" },
    { icon: Mail, label: "Email", value: storeEmail || "N/A" },
    { icon: MapPin, label: "Address", value: storeDetails?.address || "N/A" },
  ];

  const stockValue = metrics.find(m => m.title === 'Stock')?.value;

  const visitSections = [
    { value: 'metrics', label: 'Activity', mobileLabel: 'Activity & Overview', icon: TrendingUp },
    { value: 'visits', label: 'Visits', mobileLabel: 'Recent Visits', icon: Calendar },
    ...(isSiteVisitClient ? [{ value: 'site', label: 'Site Details', icon: ClipboardList }] : []),
    isProfessionalClient ? { value: 'discussion', label: 'Discussion', icon: MessageSquare } : { value: 'brands', label: 'Brands', icon: Building },
    { value: 'requirements', label: 'Requirements', count: requirements.length, icon: FileText },
    { value: 'complaints', label: 'Complaints', count: complaints.length, icon: AlertCircle },
  ];
  const displayMetrics = [
    { label: "Total Visits", value: storeVisits.length },
    { label: "Stock", value: stockValue || "Not recorded" },
    {
      label: "Priority",
      value: visitDetail?.priority || "N/A",
    },
    {
      label: "Rating",
      value: typeof visitDetail?.rating === "number" ? `${visitDetail.rating}/5` : "N/A",
    },
  ];

  const handleOpenLocation = () => {
    if (visitDetail?.checkinLatitude && visitDetail?.checkinLongitude) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${visitDetail.checkinLatitude},${visitDetail.checkinLongitude}`, "_blank");
    }
  };



  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return format(date, "MMM d, yyyy");
    } catch {
      return "N/A";
    }
  };

  const handleImageClick = (image: string) => {
    setPreviewImage(image);
    setPreviewVisible(true);
  };

  // Notes API functions
  const addNote = () => {
    setIsNoteEditMode(false);
    setNoteContent('');
    setIsNoteModalVisible(true);
  };

  const editNote = (note: ApiNote) => {
    // Handle both number and string IDs, or try to parse if needed
    let noteId: number | null = null;

    if (typeof note.id === 'number' && !isNaN(note.id)) {
      noteId = note.id;
    } else if (note.id != null && String(note.id).trim() !== '') {
      const parsed = Number(note.id);
      if (!isNaN(parsed)) {
        noteId = parsed;
      }
    }

    if (noteId === null || noteId === undefined) {
      console.error('Cannot edit note: invalid note ID', {
        noteId: note.id,
        noteIdType: typeof note.id,
        fullNote: note
      });
      return;
    }

    if (!note.content) {
      console.error('Cannot edit note: missing content', note);
      return;
    }

    setNoteContent(note.content);
    setIsNoteEditMode(true);
    setEditingNoteId(noteId);
    setEditingNoteDetails({
      employeeId: note.employeeId || 0,
      storeId: note.storeId || 0
    });
    setIsNoteModalVisible(true);
  };

  const saveNote = async () => {
    if (!noteContent.trim() || isNoteSaving) return;
    setIsNoteSaving(true);
    setNoteError(null);
    try {
      if (isNoteEditMode && editingNoteId != null && typeof editingNoteId === 'number') {
        if (!editingNoteDetails) {
          console.error('Cannot update note: missing note details');
          return;
        }

        const response = await fetch(
          `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/notes/edit?id=${editingNoteId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: JSON.stringify({
              content: noteContent,
              employeeId: editingNoteDetails.employeeId,
              storeId: editingNoteDetails.storeId,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update note');
        }

        const updatedNotes = notes.map((note) =>
          note.id === editingNoteId ? { ...note, content: noteContent } : note
        );
        setNotes(updatedNotes);
      } else if (visitDetail) {
        const response = await fetch(
          'https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/notes/create',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: JSON.stringify({
              content: noteContent,
              employeeId: visitDetail.employeeId || 0,
              storeId: visitDetail.storeId || 0,
              visitId: Number(visitId),
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create note');
        }

        const responseData = await response.json();
        const newNote: ApiNote = {
          id: responseData.id,
          content: noteContent,
          createdDate: new Date().toISOString().split('T')[0],
          updatedDate: new Date().toISOString().split('T')[0],
          createdTime: new Date().toISOString(),
          updatedTime: new Date().toISOString(),
          employeeId: visitDetail.employeeId || 0,
          employeeName: visitDetail.employeeName || '',
          storeId: visitDetail.storeId || 0,
          storeName: visitDetail.storeName || '',
          visitId: Number(visitId),
        };
        setNotes([newNote, ...notes]);
      }

      markVisitDraftSaved();
      setIsNoteModalVisible(false);
      setNoteContent('');
      setIsNoteEditMode(false);
      setEditingNoteId(null);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'Unable to save note.');
    } finally {
      setIsNoteSaving(false);
    }
  };

  const deleteNote = async (id: number) => {
    if (isNoteSaving) return;
    setIsNoteSaving(true);
    setNoteError(null);
    try {
      const response = await fetch(
        `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/notes/delete?id=${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNotes(notes.filter((note) => note.id !== id));
      setNotePendingDelete(null);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'Unable to delete note.');
    } finally {
      setIsNoteSaving(false);
    }
  };

  const createTask = async (taskType: string) => {
    if (isTaskSaving) return;
    setIsTaskSaving(true);
    setTaskCreateError(null);
    try {
      const currentTask = taskType === 'requirement' ? newTask : complaintTask;
      // Basic validation
      const missing: string[] = [];
      if (!currentTask.taskTitle?.trim()) missing.push('Title');
      if (!currentTask.taskDesciption?.trim()) missing.push('Description');
      if (!currentTask.priority) missing.push('Type');
      if (!currentTask.dueDate) missing.push('Due Date');
      if (missing.length) {
        setTaskCreateError(`Please provide: ${missing.join(', ')}`);
        return;
      }

      // Resolve ids and format due date
      const localEmpIdRaw = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
      const localEmpId = localEmpIdRaw ? parseInt(localEmpIdRaw, 10) : NaN;
      const assignedById = !Number.isNaN(localEmpId)
        ? localEmpId
        : (typeof userData?.employeeId === 'number' && userData.employeeId
          ? userData.employeeId
          : (visitDetail?.employeeId ?? currentTask.assignedById));
      const due = currentTask.dueDate.includes('T') ? currentTask.dueDate.split('T')[0] : currentTask.dueDate;

      // Build API payload per backend spec
      const apiPayload: Record<string, unknown> = {
        taskDesciption: currentTask.taskDesciption?.trim() || '',
        dueDate: due,
        assignedToId: Number(visitDetail?.employeeId ?? currentTask.assignedToId ?? 0),
        assignedById: Number(assignedById),
        storeId: Number(visitDetail?.storeId ?? currentTask.storeId ?? 0),
        taskType,
        status: currentTask.status || 'Assigned',
        priority: currentTask.priority,
        visitId: Number(visitId),
      };
      if (currentTask.taskTitle?.trim()) {
        apiPayload.taskTitle = currentTask.taskTitle.trim();
      }

      const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/task/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setTaskCreateError(`Unable to create ${taskType} (${response.status}). Please try again.`);
        return;
      }

      // Try to read id; backend may return just an id or object
      let newId: number | null = null;
      try {
        const data = await response.json();
        newId = typeof data === 'object' && data ? (data.id ?? null) : (typeof data === 'number' ? data : null);
      } catch {
        try {
          const text = await response.text();
          const parsed = parseInt(text, 10);
          if (!Number.isNaN(parsed)) newId = parsed;
        } catch { }
      }

      // Build UI task entry minimal fields used in rendering
      const createdTask: Record<string, unknown> = {
        id: newId ?? Date.now(),
        title: apiPayload.taskTitle || apiPayload.taskDesciption || (taskType === 'requirement' ? 'Requirement' : 'Complaint'),
        description: apiPayload.taskDesciption,
        taskType: apiPayload.taskType,
        status: apiPayload.status,
        priority: apiPayload.priority,
        assignedTo: visitDetail?.employeeName ?? currentTask.assignedToName ?? '',
        dueDate: apiPayload.dueDate,
        visitId: apiPayload.visitId,
      };

      if (taskType === 'requirement') {
        markVisitDraftSaved();
        setRequirements(prevTasks => [createdTask as unknown as Task, ...prevTasks]);
        // Reset requirement form
        setNewTask({
          id: 0,
          taskTitle: '',
          taskDesciption: '',
          dueDate: '',
          assignedToId: 0,
          assignedToName: '',
          assignedById: 97,
          assignedByName: '',
          storeId: 0,
          storeName: '',
          storeCity: '',
          visitId: Number(visitId),
          visitDate: '',
          status: 'Assigned',
          priority: '' as Priority,
          taskType: 'requirement',
          attachment: [],
          attachmentResponse: [],
          createdAt: '',
          updatedAt: '',
          createdTime: '',
          updatedTime: '',
        });
        setIsRequirementModalOpen(false);
        setActiveRequirementTab('general');
      } else {
        markVisitDraftSaved();
        setComplaints(prevTasks => [createdTask as unknown as Task, ...prevTasks]);
        // Reset complaint form
        setComplaintTask({
          id: 0,
          taskTitle: '',
          taskDesciption: '',
          dueDate: '',
          assignedToId: 0,
          assignedToName: '',
          assignedById: 97,
          assignedByName: '',
          storeId: 0,
          storeName: '',
          storeCity: '',
          visitId: Number(visitId),
          visitDate: '',
          status: 'Assigned',
          priority: '' as Priority,
          taskType: 'complaint',
          attachment: [],
          attachmentResponse: [],
          createdAt: '',
          updatedAt: '',
          createdTime: '',
          updatedTime: '',
        });
        setIsComplaintModalOpen(false);
        setActiveComplaintTab('general');
      }
    } catch (error) {
      setTaskCreateError(error instanceof Error ? error.message : 'Unable to create record.');
    } finally {
      setIsTaskSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <div className="text-red-500 mb-4">
                <AlertCircle className="h-12 w-12 mx-auto" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Error Loading Visit Details</h2>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="space-y-2">
                <Button onClick={() => window.location.reload()} className="w-full">
                  Try Again
                </Button>
                <Button variant="outline" onClick={handleBack} className="w-full">
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const fmtTime = (time?: string | null) => {
    if (!time) return '';
    const parsed = parseISO(`1970-01-01T${time}`);
    return Number.isNaN(parsed.getTime()) ? time : format(parsed, 'h:mm a');
  };
  const fmtDay = (date?: string | null) => {
    if (!date) return '—';
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? date : format(parsed, 'MMM dd, yyyy');
  };
  const statusTone: Tone = visitStatus.status === 'Completed' ? 'success' : visitStatus.status === 'On Going' ? 'info' : visitStatus.status === 'Checked Out' ? 'warning' : 'neutral';
  const statusLabel = visitStatus.status === 'On Going' ? 'In progress' : visitStatus.status === 'Assigned' ? 'Scheduled' : visitStatus.status;
  const hasLocation = Boolean(visitDetail?.checkinLatitude && visitDetail?.checkinLongitude);
  const timeWindow = visitDetail?.checkinTime ? `${fmtTime(visitDetail.checkinTime)} → ${visitDetail.checkoutTime ? fmtTime(visitDetail.checkoutTime) : 'now'}` : 'Not checked in';
  const durationValue = (() => {
    if (!visitDetail?.checkinDate || !visitDetail?.checkinTime || !visitDetail?.checkoutDate || !visitDetail?.checkoutTime) return '';
    const ms = new Date(`${visitDetail.checkoutDate}T${visitDetail.checkoutTime}`).getTime() - new Date(`${visitDetail.checkinDate}T${visitDetail.checkinTime}`).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '';
    const mins = Math.round(ms / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  })();
  const heroNextStep: HeroNextStep | null = visitStatus.status === 'Completed'
    ? { done: true, text: visitDetail?.outcome ? `Visit completed. Outcome: ${visitDetail.outcome}.` : 'Visit completed.' }
    : visitStatus.status === 'On Going'
      ? { done: false, text: `In progress since ${fmtTime(visitDetail?.checkinTime)}. Waiting for check-out.` }
      : visitStatus.status === 'Assigned'
        ? { done: false, text: 'Not checked in yet. The field employee checks in from the mobile app.' }
        : null;
  const photos = [
    ...checkinImages.map((src, index) => ({ src, label: `Check-in ${index + 1}` })),
    ...(giftImageUrl ? [{ src: giftImageUrl, label: 'Gift' }] : []),
  ];
  const timelineDot = (tone: 'muted' | 'success' | 'primary' | 'warning' | 'danger', Icon: typeof Calendar) => (
    <span className={cn('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card',
      tone === 'success' && 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950',
      tone === 'primary' && 'border-primary/20 bg-primary/5',
      tone === 'warning' && 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
      tone === 'danger' && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950')}>
      <Icon className={cn('h-3 w-3', tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'primary' ? 'text-primary' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')} />
    </span>
  );
  const taskEvents = [
    ...requirements.map((task) => ({ kind: 'requirement' as const, task })),
    ...complaints.map((task) => ({ kind: 'complaint' as const, task })),
  ];
  const openCreate = (kind: 'requirement' | 'complaint') => {
    setTaskCreateError(null);
    if (kind === 'requirement') setIsRequirementModalOpen(true); else setIsComplaintModalOpen(true);
  };

  const overviewContent = (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
      <Section icon={ListTodo} title="Activity" bodyClassName="px-4 pb-3 pt-1" action={<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNote}><Plus className="mr-1 h-3.5 w-3.5" />Note</Button>}>
        <ol className="relative before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-border">
          <li className="relative flex gap-2.5 pb-3">
            {timelineDot('muted', Calendar)}
            <div className="min-w-0 pt-0.5"><p className="text-xs font-semibold">Visit scheduled</p><p className="text-[11px] text-muted-foreground">{fmtDay(visitDetail?.visit_date)}{visitDetail?.purpose ? ` · ${visitDetail.purpose}` : ''}</p></div>
          </li>
          {visitDetail?.checkinDate && visitDetail?.checkinTime && (
            <li className="relative flex gap-2.5 pb-3">
              {timelineDot('success', LogIn)}
              <div className="min-w-0 pt-0.5"><p className="text-xs font-semibold">Checked in</p><p className="text-[11px] text-muted-foreground">{fmtDay(visitDetail.checkinDate)} at {fmtTime(visitDetail.checkinTime)}{hasLocation && <> · <button type="button" onClick={handleOpenLocation} className="text-foreground hover:underline">location</button></>}</p></div>
            </li>
          )}
          {notes.map((note) => (
            <li key={`activity-note-${note.id}`} className="group relative flex gap-2.5 pb-3">
              {timelineDot('primary', MessageSquare)}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 whitespace-pre-wrap break-words text-xs leading-5">{note.content}</p>
                  <div className="flex shrink-0 items-center md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <Button variant="ghost" size="icon" onClick={() => editNote(note)} className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="Edit note"><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setNotePendingDelete(note)} className="h-6 w-6 text-muted-foreground hover:text-destructive" aria-label="Delete note"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{['Note', fmtDay(note.createdDate), note.employeeName].filter(Boolean).join(' · ')}</p>
              </div>
            </li>
          ))}
          {taskEvents.map(({ kind, task }) => (
            <li key={`activity-${kind}-${task.id}`} className="relative pb-3">
              <button type="button" onClick={() => setActiveTab(kind === 'requirement' ? 'requirements' : 'complaints')} className="flex w-full gap-2.5 text-left">
                {timelineDot(kind === 'complaint' ? 'danger' : 'warning', kind === 'complaint' ? AlertCircle : ClipboardList)}
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs font-semibold">{kind === 'complaint' ? 'Complaint logged' : 'Requirement logged'}</p>
                  <p className="break-words text-xs leading-5">{task.title || 'Untitled'}</p>
                  <p className="text-[11px] text-muted-foreground">{[task.priority ? getRequirementComplaintCategoryLabel(task.priority) : '', task.status, task.dueDate ? `Due ${fmtDay(task.dueDate)}` : ''].filter(Boolean).join(' · ')}</p>
                </div>
              </button>
            </li>
          ))}
          {visitDetail?.checkoutDate && visitDetail?.checkoutTime ? (
            <li className="relative flex gap-2.5">
              {timelineDot('success', CheckCircle)}
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold">Visit completed</p>
                <p className="text-[11px] text-muted-foreground">{fmtDay(visitDetail.checkoutDate)} at {fmtTime(visitDetail.checkoutTime)}{durationValue ? ` · ${durationValue}` : ''}</p>
                {visitDetail.outcome && <p className="mt-0.5 text-xs leading-5"><span className="font-medium">Outcome:</span> <span className="text-muted-foreground">{visitDetail.outcome}</span></p>}
              </div>
            </li>
          ) : (
            <li className="relative flex gap-2.5">
              {timelineDot('muted', Clock)}
              <div className="min-w-0 pt-0.5"><p className="text-xs font-semibold">{visitDetail?.checkinTime ? 'Visit in progress' : 'Awaiting check-in'}</p><p className="text-[11px] text-muted-foreground">{visitDetail?.checkinTime ? 'Waiting for check-out' : 'Not started yet'}</p></div>
            </li>
          )}
        </ol>
      </Section>

      </div>

      <div className="space-y-4">
      <Section icon={ClipboardList} title="Visit details">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="Purpose" value={visitDetail?.purpose || 'Not recorded'} />
          <Info label="Outcome" value={visitDetail?.outcome || 'Not recorded'} />
          <Info label="Check-in" value={visitDetail?.checkinDate && visitDetail?.checkinTime ? `${fmtDay(visitDetail.checkinDate)}, ${fmtTime(visitDetail.checkinTime)}` : 'Not checked in'} />
          <Info label="Check-out" value={visitDetail?.checkoutDate && visitDetail?.checkoutTime ? `${fmtDay(visitDetail.checkoutDate)}, ${fmtTime(visitDetail.checkoutTime)}` : 'Not checked out'} />
          <Info label="Location" value={hasLocation ? <button type="button" onClick={handleOpenLocation} className="inline-flex items-center gap-1 hover:underline">View on map<ExternalLink className="h-3 w-3 text-muted-foreground" /></button> : 'Not recorded'} />
          {isProfessionalClient && <Info label="Upcoming sites" value={upcomingSitesCount ?? '—'} />}
        </dl>
      </Section>

      <Section icon={Store} title="Store" action={visitDetail?.storeId ? <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={isNavigatingToStore} onClick={handleViewStore}>Open<ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Button> : undefined}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {ownerCustomerName && <Info label="Owner" value={ownerCustomerName} />}
          <Info label="Contact" value={storeDetails?.contactNumber ? <a href={`tel:${storeDetails.contactNumber}`} className="hover:underline">{storeDetails.contactNumber}</a> : 'Not recorded'} />
          {storeEmail && <Info label="Email" value={storeEmail} />}
          <Info label="City" value={storeDetails?.city || 'Not recorded'} />
          <Info className="sm:col-span-2" label="Address" value={storeDetails?.address ? <span>{storeDetails.address} <button type="button" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${visitDetail?.storeName} ${storeDetails?.address}`)}`, '_blank')} className="ml-1 inline-flex items-center gap-1 font-normal text-muted-foreground hover:text-foreground hover:underline">Map<ExternalLink className="h-3 w-3" /></button></span> : 'Not recorded'} />
        </dl>
      </Section>


      </div>
    </div>
  );

  const hasStock = [visitDetail?.steelStockAvailable, visitDetail?.steelStockRequired, visitDetail?.cementStockAvailable, visitDetail?.cementStockRequired].some((v) => v !== null && v !== undefined);
  const stockContent = (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section icon={Package} title="Stock">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="Steel available" value={formatStockValue(visitDetail?.steelStockAvailable, 'tons')} />
          <Info label="Steel required" value={formatStockValue(visitDetail?.steelStockRequired, 'tons')} />
          <Info label="Cement available" value={formatStockValue(visitDetail?.cementStockAvailable, 'bags')} />
          <Info label="Cement required" value={formatStockValue(visitDetail?.cementStockRequired, 'bags')} />
        </dl>
      </Section>
    </div>
  );
  const photosContent = (
    <Section icon={ImageIcon} title="Check-in & gift photos" bodyClassName={photos.length ? 'p-3' : 'p-0'}>
      {photos.length === 0 ? <EmptyState compact title="No check-in or gift photos uploaded." /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo) => (
            <button key={photo.src} type="button" onClick={() => handleImageClick(photo.src)} className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={`${photo.label} · view full size`}>
              <NextImage src={photo.src} alt={photo.label} width={320} height={240} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] font-medium text-white">{photo.label}</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );

  const visitTabs: DetailTab[] = [
    { value: 'metrics', label: 'Overview', icon: TrendingUp, content: overviewContent },
    { value: 'photos', label: 'Photos', icon: ImageIcon, count: photos.length, content: photosContent },
    ...(hasStock ? [{ value: 'stock', label: 'Stock', icon: Package, content: stockContent }] : []),
    { value: 'visits', label: 'Store visits', icon: Calendar, count: storeVisits.length, content: (<div className="space-y-4">
            {activeTab === 'visits' && (
              <section className="space-y-3" aria-labelledby="visit-history-heading">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 id="visit-history-heading" className="text-sm font-semibold text-foreground">Visit history</h2>
                    <p className="text-xs text-muted-foreground">{searchQuery.trim() ? `${filteredVisits.length} matching visits of ${storeVisits.length}` : `${storeVisits.length} visits recorded for this store`}</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="Search visit purpose"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="h-9 pr-9 text-sm shadow-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="Clear visit search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => {
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border bg-card">
                  {currentVisits.map((visit: VisitDto) => {
                    // Determine visit status
                    const getVisitStatus = () => {
                      if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
                        return { status: 'Completed', color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300', icon: CheckCircle };
                      } else if (visit.checkinDate && visit.checkinTime) {
                        return { status: 'In progress', color: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300', icon: Clock };
                      } else {
                        return { status: 'Scheduled', color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300', icon: Calendar };
                      }
                    };

                    const visitStatus = getVisitStatus();
                    const VisitStatusIcon = visitStatus.icon;

                    return (
                      <article
                        key={visit.id}
                        className="group grid gap-3 border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h3 className="text-sm font-semibold text-foreground">{visit.purpose || 'Visit'}</h3>
                              <span className="text-[11px] text-muted-foreground">#{visit.id}</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <Store className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{visit.storeName || 'Store unavailable'}</span>
                              </span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                <User className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{visit.employeeName || 'Employee unavailable'}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime
                                  ? calculateDuration(visit.checkinTime, visit.checkoutTime)
                                  : 'Duration unavailable'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pl-11 sm:justify-end sm:pl-0">
                          <Badge variant="outline" className={`${visitStatus.color} gap-1 px-1.5 py-0.5 text-[11px] font-medium shadow-none`}>
                            <VisitStatusIcon className="h-3 w-3" />
                            {visitStatus.status}
                          </Badge>
                          <div className="min-w-[78px] text-right">
                            <p className="text-xs font-medium text-foreground">
                              {visit.checkinDate && visit.checkinTime
                                ? format(new Date(visit.checkinDate), "MMM dd, yyyy")
                                : 'Date pending'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {visit.checkinDate && visit.checkinTime
                                ? format(parseISO(`1970-01-01T${visit.checkinTime}`), 'h:mm a')
                                : 'Time pending'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/visits/${visit.id}`)}
                            className="h-8 px-2 text-xs font-medium"
                          >
                            View
                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                  {currentVisits.length === 0 && (
                    <div className="flex min-h-28 flex-col items-center justify-center px-4 py-8 text-center">
                      <Calendar className="mb-2 h-5 w-5 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">No matching visits</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Try a different visit purpose.</p>
                    </div>
                  )}
                </div>
                {(filteredVisits.length > visitsPerPage || showAll) && (
                  <div className="mt-4">
                    <Button onClick={() => { setShowAll(!showAll); setCurrentPage(1); }}>
                      {showAll ? 'Show Less' : 'Show More'}
                    </Button>
                    {showAll && (
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="visitsPerPage">Rows per page:</Label>
                          <Select value={visitsPerPage.toString()} onValueChange={(value) => { setVisitsPerPage(parseInt(value)); setCurrentPage(1); }}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage >= totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
    </div>) },
    ...(isSiteVisitClient ? [{ value: 'site', label: 'Site details', icon: ClipboardList, content: (<div className="space-y-4">
            {isSiteVisitClient && activeTab === "site" && (
              <div>
                <Card className="gap-0 overflow-hidden rounded-lg border-border/80 py-0 shadow-none">
                  <CardHeader className="border-b px-3 py-2.5">
                    <CardTitle className="text-sm font-medium text-foreground">Site Visit Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs font-medium text-foreground mb-1">Brands used</p>
                        {Array.isArray(visitDetail?.brandsInUse) && visitDetail!.brandsInUse.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {visitDetail!.brandsInUse.map((b) => (
                              <Badge key={b} variant="secondary" className="font-normal">
                                {b}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">—</p>
                        )}
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs font-medium text-foreground mb-1">Purchased from</p>
                        <p className="text-sm text-foreground">{visitDetail?.purchasedFrom || '—'}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
                        <p className="text-xs font-medium text-foreground mb-1">Construction stage</p>
                        <p className="text-sm text-foreground">{visitDetail?.constructionStage || '—'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Notes are available in the Activity section.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
    </div>) }] : []),
    isProfessionalClient
      ? { value: 'discussion', label: 'Discussion', icon: MessageSquare, count: notes.length, content: (<div className="space-y-4">
            {isProfessionalClient && activeTab === "discussion" && (
              <div>
                {/* Discussion card is rendered in-place of the usual tabs for professional client types */}
                <Card className="gap-0 overflow-hidden rounded-lg border-border/80 py-0 shadow-none">
                  <CardHeader className="border-b px-3 py-2.5">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-medium text-foreground">Discussion</CardTitle>
                      <Button onClick={addNote} size="sm" className="text-xs">
                        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Message
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="notes-list space-y-2">
                      {notes.length === 0 ? (
                        <div className="text-center py-6">
                          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No discussion yet</p>
                        </div>
                      ) : (
                        notes.map((note, index) => {
                          const hasValidId = note.id != null && (
                            (typeof note.id === 'number' && !isNaN(note.id)) ||
                            (typeof note.id !== 'number' && String(note.id).trim() !== '' && !isNaN(Number(note.id)))
                          );
                          return (
                            <div key={note.id ?? `note-${index}`} className="rounded-lg border bg-card p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">
                                  {note.createdDate ? format(new Date(note.createdDate), "MMM d, yyyy") : 'Unknown date'}
                                </span>
                                <div className="flex items-center gap-1">
                                  {hasValidId && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => editNote(note)}
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => {
                                          const idToDelete = typeof note.id === 'number' ? note.id : Number(note.id);
                                          if (!isNaN(idToDelete)) {
                                            setNotePendingDelete(note);
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-foreground">{note.content || 'No content'}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
    </div>) }
      : { value: 'brands', label: 'Brands', icon: Building, count: visitDetail?.brandPurchases?.length ?? 0, content: (<div className="space-y-4">
            {activeTab === 'brands' && !isProfessionalClient && <BrandTab compact brandPurchases={visitDetail?.brandPurchases ?? []} />}
    </div>) },
    { value: 'requirements', label: 'Requirements', icon: FileText, count: requirements.length, content: (<div className="space-y-4">
            {activeTab === 'requirements' && (
              <VisitTasksTab tasks={requirements} type="requirement" priority={priorityFilter} onPriorityChange={handlePriorityChange} loading={tasksLoading} error={taskErrors.requirement} />
            )}
    </div>) },
    { value: 'complaints', label: 'Complaints', icon: AlertCircle, count: complaints.length, content: (<div className="space-y-4">
            {activeTab === 'complaints' && (
              <VisitTasksTab tasks={complaints} type="complaint" priority={priorityFilter} onPriorityChange={handlePriorityChange} loading={tasksLoading} error={taskErrors.complaint} />
            )}
    </div>) },
  ];

  return (
    <div className="icon-visit-details mx-auto w-full max-w-[1600px] space-y-4">
      <DetailHero
        name={storeProjectName}
        onBack={handleBack}
        backLabel="Back"
        badges={<>
          <Pill tone={statusTone}>{statusLabel}</Pill>
          {userRole && <Pill>{`${getDisplayRole} View`}</Pill>}
        </>}
        meta={[
          { icon: Calendar, label: fmtDay(visitDetail?.visit_date), title: 'Visit date' },
          { icon: Clock, label: timeWindow, title: 'Check-in → check-out' },
          { icon: User, label: visitDetail?.employeeName || 'Unknown employee', title: 'Visited by' },
          ...(storeDetails?.city ? [{ icon: MapPin, label: storeDetails.city }] : []),
          { icon: Hash, label: visitDetail?.id ?? visitId },
        ]}
        actions={<>
          <Button variant="outline" size="sm" className="h-8" onClick={addNote}><MessageSquare className="mr-1.5 h-3.5 w-3.5" />Add note</Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => openCreate('requirement')}><FileText className="mr-1.5 h-3.5 w-3.5" />Requirement</Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => openCreate('complaint')}><AlertCircle className="mr-1.5 h-3.5 w-3.5" />Complaint</Button>
          {visitDetail?.storeId ? <Button variant="outline" size="sm" className="h-8" disabled={isNavigatingToStore} onClick={handleViewStore}><Store className="mr-1.5 h-3.5 w-3.5" />Store</Button> : null}
        </>}
        kpis={<>
          <KpiCell icon={Clock} label="Duration" value={durationValue || '—'} hint={visitStatus.status === 'On Going' ? 'still in progress' : undefined} />
          <KpiCell icon={TrendingUp} label="Priority" value={visitDetail?.priority || 'N/A'} />
          <KpiCell icon={CheckCircle} label="Rating" value={typeof visitDetail?.rating === 'number' ? `${visitDetail.rating}/5` : 'N/A'} />
          <KpiCell icon={Calendar} label="Store visits" value={storeVisits.length} hint="all visits to this account" />
        </>}
        nextStep={heroNextStep}
      />

      <DetailShell value={activeTab} onValueChange={setActiveTab} tabs={visitTabs} />

      {/* Modals */}
      {/* Notes Modal */}
      <FormSheet
        open={isNoteModalVisible}
        onOpenChange={(open) => { if (!open) closeNoteEditor(); }}
        icon={MessageSquare}
        title={isNoteEditMode ? 'Edit note' : 'Add note'}
        description={`${visitDetail?.storeName || 'Visit'}${visitDetail?.visit_date ? ` · ${fmtDay(visitDetail.visit_date)}` : ''}`}
        errors={noteError ? [noteError] : undefined}
        footerNote={isNoteEditMode ? 'Updates the existing note on this visit.' : 'Saved to this visit under your account.'}
        onSubmit={() => void saveNote()}
        submitLabel={isNoteEditMode ? 'Update note' : 'Add note'}
        submitting={isNoteSaving}
        submitDisabled={!noteContent.trim()}
      >
        <FormField label="Note" required>
          <textarea aria-label="Note content" autoFocus rows={8} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="What happened on this visit…" className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
        </FormField>
      </FormSheet>
      <Dialog open={!!notePendingDelete} onOpenChange={open => { if (!open && !isNoteSaving) { setNotePendingDelete(null); setNoteError(null); } }}>
        <DialogContent className="icon-visit-details sm:max-w-md"><DialogHeader><DialogTitle>Delete note?</DialogTitle><DialogDescription>This will permanently delete this note from the visit.</DialogDescription></DialogHeader>{noteError && <p role="alert" className="text-sm text-destructive">{noteError}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={isNoteSaving} onClick={() => setNotePendingDelete(null)}>Cancel</Button><Button variant="destructive" disabled={isNoteSaving} onClick={() => notePendingDelete && deleteNote(notePendingDelete.id)}>{isNoteSaving ? 'Deleting…' : 'Delete'}</Button></div></DialogContent>
      </Dialog>

      <TaskCreateSheet
        kind="requirement"
        open={isRequirementModalOpen}
        onClose={closeRequirementCreator}
        value={{
          taskTitle: newTask.taskTitle,
          taskDescription: newTask.taskDesciption,
          dueDate: newTask.dueDate,
          assignedToId: Number(visitDetail?.employeeId ?? 0),
          assignedToName: visitDetail?.employeeName ?? '',
          priority: newTask.priority,
          storeId: Number(visitDetail?.storeId ?? 0),
          storeName: visitDetail?.storeName ?? '',
        }}
        onChange={(patch) => setNewTask((prev) => ({
          ...prev,
          ...(patch.taskTitle !== undefined ? { taskTitle: patch.taskTitle } : {}),
          ...(patch.taskDescription !== undefined ? { taskDesciption: patch.taskDescription } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority as Priority } : {}),
        }))}
        employees={[]}
        stores={[]}
        locked={{ employee: visitDetail?.employeeName || 'Visit employee', store: visitDetail?.storeName || 'Visit store' }}
        isSubmitting={isTaskSaving}
        error={taskCreateError}
        onSubmit={() => void createTask('requirement')}
      />
      <TaskCreateSheet
        kind="complaint"
        open={isComplaintModalOpen}
        onClose={closeComplaintCreator}
        value={{
          taskTitle: complaintTask.taskTitle,
          taskDescription: complaintTask.taskDesciption,
          dueDate: complaintTask.dueDate,
          assignedToId: Number(visitDetail?.employeeId ?? 0),
          assignedToName: visitDetail?.employeeName ?? '',
          priority: complaintTask.priority,
          storeId: Number(visitDetail?.storeId ?? 0),
          storeName: visitDetail?.storeName ?? '',
        }}
        onChange={(patch) => setComplaintTask((prev) => ({
          ...prev,
          ...(patch.taskTitle !== undefined ? { taskTitle: patch.taskTitle } : {}),
          ...(patch.taskDescription !== undefined ? { taskDesciption: patch.taskDescription } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority as Priority } : {}),
        }))}
        employees={[]}
        stores={[]}
        locked={{ employee: visitDetail?.employeeName || 'Visit employee', store: visitDetail?.storeName || 'Visit store' }}
        isSubmitting={isTaskSaving}
        error={taskCreateError}
        onSubmit={() => void createTask('complaint')}
      />

      {/* Task Image Preview Dialog */}
      {isImagePreviewOpen && (
        <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Complaint Images</DialogTitle>
            </DialogHeader>
            {isLoadingImages ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-2">Loading images...</span>
              </div>
            ) : taskImages.length > 0 ? (
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
            ) : (
              <div className="text-center py-6">
                <p>No images available</p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Modal */}
      <Dialog open={previewVisible} onOpenChange={setPreviewVisible}>
        <DialogContent className="icon-visit-details sm:max-w-4xl"><DialogHeader><DialogTitle>Visit image</DialogTitle><DialogDescription>Full-size image captured for this visit.</DialogDescription></DialogHeader>{previewImage && <NextImage src={previewImage} alt="Visit image preview" width={800} height={600} className="max-h-[75dvh] w-full object-contain" />}</DialogContent>
      </Dialog>
    </div>
  );
};
