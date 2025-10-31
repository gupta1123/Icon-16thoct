"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
  DollarSign,
  ArrowLeft,
  Store,
  CheckCircle,
  Loader2,
  ExternalLink,
  ClipboardList,
  ListTodo,
  MapPin as MapMarker,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { API, BrandProCon, IntentAuditLog, MonthlySaleChange, Task, Note as ApiNote, VisitDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { normalizeRoleValue, extractAuthorityRoles, hasAnyRole } from "@/lib/role-utils";
import BrandTab from './BrandTab';

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
  brandProCons: {
    id: number;
    brandName: string;
    pros: string[];
    cons: string[];
  }[];
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
  monthlySale?: number;
  brandsInUse?: string[];
  brandProCons?: BrandProCon[];
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

export default function VisitDetailPage({ 
  searchParams: propSearchParams 
}: { 
  searchParams?: { from?: string; employeeId?: string; [key: string]: string | string[] | undefined }
} = {}) {
  const router = useRouter();
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
  
  const params = useParams();
  const visitId = params?.id as string;
  const { userRole, userData, currentUser } = useAuth();
  
  const [visitDetail, setVisitDetail] = useState<VisitDetail | null>(null);
  const [activeTab, setActiveTab] = useState("metrics");
  const [activeInfoTab, setActiveInfoTab] = useState("visit-info");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [brandProCons, setBrandProCons] = useState<BrandProCon[]>([]);
  const [intentAuditLogs, setIntentAuditLogs] = useState<IntentAuditLog[]>([]);
  const [monthlySaleChanges, setMonthlySaleChanges] = useState<MonthlySaleChange[]>([]);
  const [requirements, setRequirements] = useState<TaskWithAttachments[]>([]);
  const [complaints, setComplaints] = useState<TaskWithAttachments[]>([]);
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [storeVisits, setStoreVisits] = useState<VisitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinImages, setCheckinImages] = useState<string[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const visitsPerPage = 3;
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
    priority: 'low',
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
    priority: 'low',
    taskType: 'complaint',
    attachment: [],
    attachmentResponse: [],
    createdAt: '',
    updatedAt: '',
    createdTime: '',
    updatedTime: '',
  });
  const [storeDetails, setStoreDetails] = useState<{
    contactNumber: string;
    city: string;
    address: string;
  } | null>(null);
  
  // Role-based state
  const [isManager, setIsManager] = useState(false);
  
  // Notes functionality
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isNoteEditMode, setIsNoteEditMode] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteDetails, setEditingNoteDetails] = useState<{ employeeId: number; storeId: number } | null>(null);
  
  // Brand functionality
  const [isAddBrandModalVisible, setIsAddBrandModalVisible] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newPros, setNewPros] = useState<string[]>([]);
  const [newCons, setNewCons] = useState<string[]>([]);
  const [currentPro, setCurrentPro] = useState('');
  const [currentCon, setCurrentCon] = useState('');

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
        {priority}
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
           
              const response = await fetch(`/api/proxy/visit/downloadFile/${visitId}/check-in/${att.fileName}`, {
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
        purpose: visitData.purpose || '',
        priority: visitData.priority || 'low',
        outcome: visitData.outcome || null,
        brandsInUse: (visitData.brandsInUse as string[]) || [],
        brandProCons: (visitData.brandProCons as BrandProCon[]) || [],
        createdAt: visitData.createdAt || '',
        updatedAt: visitData.updatedAt || '',
        storeId: visitData.storeId || 0,
        employeeId: visitData.employeeId || 0,
      });

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
          const [
            proConsData,
            intentAuditData,
            monthlySaleData,
            requirementsData,
            complaintsData,
            notesData,
            storeVisitsData,
          ] = await Promise.all([
            api.getVisitProCons(Number(visitId)),
            api.getIntentAuditByVisit(Number(visitId)),
            api.getMonthlySaleByVisit(Number(visitId)),
            api.getTasksByVisit('requirement', Number(visitId)),
            api.getTasksByVisit('complaint', Number(visitId)),
            api.getNotesByVisit(Number(visitId)),
            api.getVisitsByStore(visitData.storeId || 0),
          ]);
          
          console.log('📈 Auxiliary data loaded:', {
            proCons: proConsData?.length || 0,
            intentAudit: intentAuditData?.length || 0,
            monthlySale: monthlySaleData?.length || 0,
            requirements: requirementsData?.length || 0,
            complaints: complaintsData?.length || 0,
            notes: notesData?.length || 0,
            storeVisits: storeVisitsData?.length || 0,
          });

          setBrandProCons(proConsData || []);
          setIntentAuditLogs(intentAuditData || []);
          setMonthlySaleChanges(monthlySaleData || []);
          // Normalize tasks for UI (use consistent keys)
          const normalizedReqs: TaskWithAttachments[] = (requirementsData || []).map((t: RawTaskData) => ({
            id: t.id,
            title: (t.taskTitle && String(t.taskTitle).trim()) || (t.taskDesciption || 'Requirement'),
            description: t.taskDesciption || '',
            status: t.status || 'Assigned',
            priority: t.priority || 'low',
            assignedTo: t.assignedToName || '',
            dueDate: t.dueDate || '',
            type: t.taskType || 'requirement',
            visitId: t.visitId || Number(visitId),
            attachmentResponse: t.attachmentResponse || [],
          }));
          const normalizedCmps: TaskWithAttachments[] = (complaintsData || []).map((t: RawTaskData) => ({
            id: t.id,
            title: (t.taskTitle && String(t.taskTitle).trim()) || (t.taskDesciption || 'Complaint'),
            description: t.taskDesciption || '',
            status: t.status || 'Assigned',
            priority: t.priority || 'low',
            assignedTo: t.assignedToName || '',
            dueDate: t.dueDate || '',
            type: t.taskType || 'complaint',
            visitId: t.visitId || Number(visitId),
            attachmentResponse: t.attachmentResponse || [],
          }));
          setRequirements(normalizedReqs);
          setComplaints(normalizedCmps);
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

          if (monthlySaleData && monthlySaleData.length > 0) {
            const recentSales = `${monthlySaleData[0].newMonthlySale.toLocaleString()} tons`;
            setMetrics((prev) => {
              const filtered = prev.filter((m) => m.title !== 'Monthly Sales');
              return [...filtered, { title: 'Monthly Sales', value: recentSales }];
            });
          }

          // Fetch check-in images in background
          if (visitData.attachmentResponse && visitData.attachmentResponse.length > 0) {
            fetchCheckinImages(Number(visitId), visitData.attachmentResponse);
          }

          // Store details
          if (storeVisitsData && storeVisitsData.length > 0) {
            const firstVisit = storeVisitsData[0];
            setStoreDetails({
              contactNumber: firstVisit.storePrimaryContact?.toString() || 'Not available',
              city: firstVisit.city || 'Not available',
              address:
                `${firstVisit.subDistrict || ''}, ${firstVisit.district || ''}, ${firstVisit.state || ''}`
                  .replace(/^[, ]+|[, ]+$/g, '') || 'Not available',
            });
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
  }, [fetchCheckinImages]);



  // fetchIntentLevel removed (intent level no longer displayed)

  const fetchMonthlySales = async (visitId: string) => {
    try {
      const api = new API();
      const data = await api.getMonthlySaleByVisit(Number(visitId));
      const recentSales = data.length > 0 ? `${data[0].newMonthlySale.toLocaleString()} tons` : 'N/A';
      setMetrics((prevMetrics) => {
        const updatedMetrics = prevMetrics.filter(metric => metric.title !== 'Monthly Sales');
        return [
          ...updatedMetrics,
          { title: 'Monthly Sales', value: recentSales.toString() },
        ];
      });
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
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
      const taskResponse = await fetch(`/api/proxy/task/getById?id=${taskId}`, {
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
        `/api/proxy/task/downloadFile/${taskId}/${attachment.tag}/${attachment.fileName}`
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
  const currentVisits = storeVisits.slice(indexOfFirstVisit, indexOfLastVisit);

  const totalPages = Math.ceil(storeVisits.length / visitsPerPage);

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

  const infoItems = [
    {
      icon: Calendar,
      label: "Date & Time",
      value: visitDetail ? `${format(new Date(visitDetail.visit_date), "MMM d, yyyy")} at ${visitDetail.checkinTime || "N/A"}` : "N/A",
    },
    { icon: User, label: "Visited by", value: visitDetail?.employeeName || "N/A" },
    { icon: Phone, label: "Phone", value: storeDetails?.contactNumber || "N/A" },
    { icon: Mail, label: "Email", value: "N/A" },
    { icon: MapPin, label: "Address", value: storeDetails?.address || "N/A" },
  ];

  const monthlySaleValue = metrics.find(m => m.title === 'Monthly Sales')?.value;
  
  const displayMetrics = [
    { label: "Total Visits", value: storeVisits.length || "N/A" },
    { label: "Monthly Sale", value: monthlySaleValue || "" },
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
    if (!noteContent.trim()) return;

    try {
      if (isNoteEditMode && editingNoteId != null && typeof editingNoteId === 'number') {
        if (!editingNoteDetails) {
          console.error('Cannot update note: missing note details');
          return;
        }
        
        const response = await fetch(
          `/api/proxy/notes/edit?id=${editingNoteId}`,
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
          '/api/proxy/notes/create',
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
      
      setIsNoteModalVisible(false);
      setNoteContent('');
      setIsNoteEditMode(false);
      setEditingNoteId(null);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const deleteNote = async (id: number) => {
    try {
      const response = await fetch(
        `/api/proxy/notes/delete?id=${id}`,
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
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Brands functionality
  const handleAddBrandProCon = async (brandName: string, pros: string[], cons: string[]) => {
    try {
      const api = new API();
      await api.addBrandProCons(Number(visitId), [{
        brandName,
        pros,
        cons,
      }]);
      
      // Refresh brand data
      const updatedBrands = await api.getVisitProCons(Number(visitId));
      setBrandProCons(updatedBrands);
    } catch (error) {
      console.error('Error adding brand Pro/Con:', error);
    }
  };

  const handleDeleteBrandProCon = async (brandName: string) => {
    try {
      const api = new API();
      await api.deleteBrandProCons(Number(visitId), [{
        brandName,
      }]);
      
      // Refresh brand data
      const updatedBrands = await api.getVisitProCons(Number(visitId));
      setBrandProCons(updatedBrands);
    } catch (error) {
      console.error('Error deleting brand Pro/Con:', error);
    }
  };

  const openAddBrandModal = () => {
    setNewBrandName('');
    setNewPros([]);
    setNewCons([]);
    setCurrentPro('');
    setCurrentCon('');
    setIsAddBrandModalVisible(true);
  };

  const addPro = () => {
    if (currentPro.trim()) {
      setNewPros([...newPros, currentPro.trim()]);
      setCurrentPro('');
    }
  };

  const addCon = () => {
    if (currentCon.trim()) {
      setNewCons([...newCons, currentCon.trim()]);
      setCurrentCon('');
    }
  };

  const removePro = (index: number) => {
    setNewPros(newPros.filter((_, i) => i !== index));
  };

  const removeCon = (index: number) => {
    setNewCons(newCons.filter((_, i) => i !== index));
  };

  const saveBrand = async () => {
    if (!newBrandName.trim()) return;

    try {
      await handleAddBrandProCon(newBrandName.trim(), newPros, newCons);
      setIsAddBrandModalVisible(false);
    } catch (error) {
      console.error('Error saving brand:', error);
    }
  };

  const createTask = async (taskType: string) => {
    try {
      const currentTask = taskType === 'requirement' ? newTask : complaintTask;
      // Basic validation
      const missing: string[] = [];
      if (!currentTask.taskDesciption?.trim()) missing.push('Description');
      if (!currentTask.dueDate) missing.push('Due Date');
      if (missing.length) {
        console.error(`Please provide: ${missing.join(', ')}`);
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
        priority: currentTask.priority || 'low',
        visitId: Number(visitId),
      };
      if (taskType === 'requirement' && currentTask.taskTitle?.trim()) {
        apiPayload.taskTitle = currentTask.taskTitle.trim();
      }

      const response = await fetch('/api/proxy/task/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create task:', response.status, errorText);
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
        } catch {}
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
          priority: 'low',
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
          priority: 'low',
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
      console.error('Error creating task:', error);
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

                  return (
    <div className="container mx-auto p-3 sm:p-6">
      <div className="visit-details grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Panel */}
        <aside className="lg:col-span-3 space-y-4 sm:space-y-6">
          <div className="back-button-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="back-button flex items-center cursor-pointer text-foreground hover:text-muted-foreground" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="text-sm sm:text-base">Back</span>
                      </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`status-badge ${visitStatus.color} px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1`}>
                {getStatusIcon(visitStatus.status as 'Assigned' | 'On Going' | 'Checked Out' | 'Completed')}
                <span className="whitespace-nowrap">{visitStatus.status}</span>
              </div>
              {userRole && (
                <Badge variant={isManager ? "secondary" : "default"} className="text-xs">
                  {getDisplayRole}
                </Badge>
              )}
            </div>
                    </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-foreground">Visit Details</CardTitle>
                <p className="text-xs text-muted-foreground">Visit information and actions</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg border border-dashed bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {getInitials(visitDetail?.storeName || '')}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-sm font-medium text-foreground truncate">
                    {visitDetail?.storeName || 'Store not available'}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {visitDetail?.employeeName ? `Visited by ${visitDetail.employeeName}` : 'Field officer not available'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full justify-start px-3 py-2 h-auto"
                  variant="outline"
                  onClick={handleViewStore}
                  disabled={isNavigatingToStore}
                >
                  <Store className="mr-2 h-4 w-4" />
                  <span className="text-sm">
                    {isNavigatingToStore ? 'Opening Store…' : 'View Store'}
                  </span>
                </Button>
                <Button className="w-full justify-start px-3 py-2 h-auto" variant="outline" onClick={() => setIsRequirementModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="text-sm">Add Requirement</span>
                </Button>
                <Button className="w-full justify-start px-3 py-2 h-auto" variant="outline" onClick={() => setIsComplaintModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="text-sm">Add Complaint</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Visit Information Card - Sidebar typography */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-foreground">Visit Information</CardTitle>
                <p className="text-xs text-muted-foreground">Detailed visit and store information</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tabs Navigation */}
              <div className="flex border-b">
                <button
                  className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                    activeInfoTab === 'visit-info' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveInfoTab('visit-info')}
                >
                  Visit Details
                </button>
                <button
                  className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                    activeInfoTab === 'store-info' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveInfoTab('store-info')}
                >
                  Store Details
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-3">
                {/* Visit Info Content */}
                {activeInfoTab === 'visit-info' && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <ListTodo className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Purpose</p>
                        <p className="text-xs text-muted-foreground">{visitDetail?.purpose || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <MapMarker className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Location</p>
                        <div className="text-xs text-muted-foreground">
                          {visitDetail?.checkinLatitude && visitDetail?.checkinLongitude ? (
                            <button
                              onClick={handleOpenLocation}
                              className="text-foreground hover:text-muted-foreground transition-colors flex items-center gap-1"
                            >
                              <ExternalLink className="w-2 h-2" />
                              View Location
                            </button>
                          ) : (
                            <span>N/A</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <LogIn className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Check-in</p>
                        <div className="text-xs text-muted-foreground">
                          {visitDetail?.checkinDate && visitDetail?.checkinTime ? (
                            <div className="flex flex-col">
                              <span>{format(new Date(visitDetail.checkinDate), "dd MMM yyyy")}</span>
                              <span className="text-xs">
                                {format(parseISO(`1970-01-01T${visitDetail.checkinTime}`), 'h:mm a')}
                              </span>
                            </div>
                          ) : (
                            <span>N/A</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <LogOut className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Check-out</p>
                        <div className="text-xs text-muted-foreground">
                          {visitDetail?.checkoutDate && visitDetail?.checkoutTime ? (
                            <div className="flex flex-col">
                              <span>{format(new Date(visitDetail.checkoutDate), "dd MMM yyyy")}</span>
                              <span className="text-xs">
                                {format(parseISO(`1970-01-01T${visitDetail.checkoutTime}`), 'h:mm a')}
                              </span>
                            </div>
                          ) : (
                            <span>N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Store Info Content */}
                {activeInfoTab === 'store-info' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-foreground">{visitDetail?.storeName || 'N/A'}</h3>
                        <p className="text-xs text-muted-foreground">{storeDetails?.city || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Contact</p>
                        {storeDetails?.contactNumber ? (
                          <a 
                            href={`tel:${storeDetails.contactNumber}`}
                            className="text-xs text-foreground hover:text-muted-foreground transition-colors"
                          >
                            {storeDetails.contactNumber}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                        <MapMarker className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">Location</p>
                        <div className="text-xs text-muted-foreground">
                          <p>{storeDetails?.address || 'N/A'}</p>
                          {(visitDetail?.storeLatitude && visitDetail?.storeLongitude) ? (
                            <button
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${visitDetail.storeLatitude},${visitDetail.storeLongitude}`, "_blank")}
                              className="text-foreground hover:text-muted-foreground transition-colors mt-1 inline-flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="w-2 h-2" />
                              View on Maps
                            </button>
                          ) : storeDetails?.city ? (
                            <button
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${visitDetail?.storeName} ${storeDetails?.address}`)}`, "_blank")}
                              className="text-foreground hover:text-muted-foreground transition-colors mt-1 inline-flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="w-2 h-2" />
                              View on Maps
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
                <section className="lg:col-span-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="overflow-x-auto mb-3">
              <TabsList className="inline-flex gap-2 w-max min-w-full">
                <TabsTrigger value="metrics" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <TrendingUp className="w-4 h-4" />
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="visits" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                  Visits
                </TabsTrigger>
                <TabsTrigger value="brands" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <Building className="w-4 h-4" />
                  Brands
                </TabsTrigger>
                <TabsTrigger value="requirements" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <FileText className="w-4 h-4" />
                  Requirements
                </TabsTrigger>
                <TabsTrigger value="complaints" className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                  <AlertCircle className="w-4 h-4" />
                  Complaints
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="metrics">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-foreground">Visit Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {displayMetrics.map((metric, index) => (
                      <div key={index} className="text-center p-2">
                        <h3 className="text-xs font-medium text-muted-foreground mb-1 truncate">{metric.label}</h3>
                        <div className="text-sm font-medium text-foreground truncate">{metric.value || "-"}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="visits" className="space-y-4">
              <div className="filter-bar">
                <Input
                  placeholder="Search by Visit Purpose"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 text-sm"
                />
              </div>
              <div className="visits-list space-y-2">
                {storeVisits.length === 0 && !isLoading ? (
                  <div className="text-center py-6">
                    <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No visits found for this store</p>
                  </div>
                ) : (
                  currentVisits.map((visit) => (
                    <Card key={visit.id} className="max-w-md mx-auto border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-foreground">{visit.purpose}</span>
                          <span className="text-xs text-muted-foreground">
                            {visit.checkinDate && visit.checkinTime
                              ? `${format(new Date(visit.checkinDate), "dd MMM ''yy")} ${format(parseISO(`1970-01-01T${visit.checkinTime}`), 'h:mm a')}`
                              : 'Check-in time not available'}
                          </span>
                        </div>
                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground">Employee: {visit.employeeName}</p>
                          <p className="text-muted-foreground">Store: {visit.storeName}</p>
                          <p className="text-xs text-muted-foreground">Visit ID: {visit.id}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
              {storeVisits.length > visitsPerPage && (
                <div className="mt-2 space-y-3">
                  <Button onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Show Less' : 'Show More'}
                  </Button>
                  {showAll && (
                    <Pagination>
                      <PaginationPrevious
                        onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                        size="sm"
                      />
                      <PaginationContent>
                        {renderPaginationItems()}
                      </PaginationContent>
                      <PaginationNext
                        onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                        size="sm"
                      />
                    </Pagination>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="brands">
              <BrandTab
                brands={brandProCons}
                setBrands={setBrandProCons}
                visitId={visitId}
                token={typeof window !== 'undefined' ? localStorage.getItem('authToken') : null}
                fetchVisitDetail={async () => {
                  if (visitId) {
                    await fetchVisitDetail(visitId);
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="requirements" className="space-y-2">
              <div className="filter-bar">
                <Select value={priorityFilter} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-48 text-sm">
                    <SelectValue placeholder="Filter by Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="requirements-list space-y-2">
                {filteredRequirements.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No requirements found for this visit</p>
                  </div>
                ) : (
                  filteredRequirements.map((req, index) => (
                    <Card key={index} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-foreground">{req.title}</span>
                          <div className="flex gap-2">
                            {getPriorityBadge(req.priority as Priority)}
                            {getStatusBadge(req.status)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Due: {format(new Date(req.dueDate), 'MMM d, yyyy')}</p>
                          <div className="flex items-center">
                            <div className="avatar w-5 h-5 rounded-full bg-muted flex items-center justify-center mr-2">
                              <span className="text-xs">{getInitials(req.assignedTo || 'Unknown')}</span>
                            </div>
                            <span>Assigned to {req.assignedTo || 'Unknown'}</span>
                          </div>
                          <p>{req.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="complaints" className="space-y-2">
              <div className="filter-bar">
                <Select value={priorityFilter} onValueChange={handlePriorityChange}>
                  <SelectTrigger className="w-48 text-sm">
                    <SelectValue placeholder="Filter by Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="complaints-list space-y-2">
                {filteredComplaints.length === 0 ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No complaints found for this visit</p>
                  </div>
                ) : (
                  filteredComplaints.map((complaint, index) => (
                    <Card key={index} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{complaint.title}</span>
                            {Array.isArray(complaint.attachmentResponse) && complaint.attachmentResponse.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => fetchTaskImages(complaint.id)}
                                title="View Images"
                              >
                                <ImageIcon className="h-4 w-4 text-blue-500" />
                              </Button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {getPriorityBadge(complaint.priority as Priority)}
                            {getStatusBadge(complaint.status)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Reported: {format(new Date(complaint.dueDate), 'MMM d, yyyy')}</p>
                          <div className="flex items-center">
                            <div className="avatar w-5 h-5 rounded-full bg-muted flex items-center justify-center mr-2">
                              <span className="text-xs">{getInitials(complaint.assignedTo || 'Unknown')}</span>
                            </div>
                            <span>Handled by {complaint.assignedTo || 'Unknown'}</span>
                          </div>
                          <p>{complaint.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>


        {/* Right Panel */}
        <aside className="lg:col-span-3 space-y-4">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-foreground">
                      Check-in Images
                    </CardTitle>
                </CardHeader>
                <CardContent>
                  {checkinImages.length > 0 ? (
                <div className="space-y-3">
                      {checkinImages.map((image, index) => (
                        <div key={index} className="rounded-lg border overflow-hidden">
                          <div className="relative w-full h-32 bg-muted">
                        <NextImage
                              src={image}
                              alt={`Check-in image ${index + 1}`}
                          width={300}
                          height={200}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(image)}
                            />
                          </div>
                          <div className="p-3">
                            <h4 className="text-xs font-medium text-foreground mb-2">
                              Check-in Image {index + 1}
                            </h4>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full text-xs"
                              onClick={() => handleImageClick(image)}
                            >
                              View Full Size
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-xs text-muted-foreground">No images available for this visit</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-foreground">
                  Notes
                    </CardTitle>
                <Button onClick={addNote} size="sm" className="text-xs">
                  <i className="fas fa-plus mr-2"></i> Add Note
                </Button>
                  </div>
                </CardHeader>
                <CardContent>
              <div className="notes-list space-y-2">
                {notes.map((note, index) => {
                  // Check if note has valid ID for editing/deleting
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
                                    deleteNote(idToDelete);
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
                })}
                    </div>
                </CardContent>
              </Card>
        </aside>
      </div>

      {/* Modals */}
      {/* Notes Modal */}
      {isNoteModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">
              {isNoteEditMode ? 'Edit Note' : 'Add Note'}
              </CardTitle>
                </CardHeader>
            <CardContent className="space-y-4">
            <textarea
              placeholder="Enter note content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsNoteModalVisible(false)}>
                Cancel
              </Button>
              <Button onClick={saveNote}>
                {isNoteEditMode ? 'Update' : 'Add'}
              </Button>
            </div>
                </CardContent>
              </Card>
        </div>
      )}

      {/* Requirement Modal */}
      {isRequirementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">Create Requirement</CardTitle>
              <p className="text-sm text-muted-foreground">Fill in the requirement details</p>
            </CardHeader>
            <CardContent>
              <Tabs value={activeRequirementTab} onValueChange={setActiveRequirementTab} className="w-full">
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
                        value={newTask.taskTitle}
                        onChange={(e) => setNewTask({ ...newTask, taskTitle: e.target.value })}
                        className="w-full"
                />
              </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementDescription">Requirement Description</Label>
                      <Input
                        id="requirementDescription"
                        placeholder="Enter requirement description"
                        value={newTask.taskDesciption}
                        onChange={(e) => setNewTask({ ...newTask, taskDesciption: e.target.value })}
                        className="w-full"
                      />
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementCategory">Category</Label>
                      <Select value="requirement" disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Requirement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requirement">Requirement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementStoreName">Store</Label>
                      <Input
                        id="requirementStoreName"
                        value={visitDetail ? `${visitDetail.storeName}` : 'Loading...'}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
                    </div>
                    <div className="flex justify-between mt-4">
                      <Button variant="outline" onClick={() => setIsRequirementModalOpen(false)}>Cancel</Button>
                      <Button onClick={() => setActiveRequirementTab('details')}>Next</Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="details">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="requirementDueDate">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!newTask.dueDate && 'text-muted-foreground'}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTask.dueDate ? format(new Date(newTask.dueDate), 'PPP') : <span>Pick a date</span>}
                      </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={newTask.dueDate ? new Date(newTask.dueDate) : undefined}
                            onSelect={(date) => setNewTask({ ...newTask, dueDate: date ? date.toISOString().split('T')[0] : '' })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementAssignedTo">Assigned To</Label>
                      <Input
                        id="requirementAssignedTo"
                        value={visitDetail ? `${visitDetail.employeeName}` : ''}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementPriority">Priority</Label>
                      <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value as Priority })}>
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
                    <div className="flex justify-between mt-4">
                      <Button variant="outline" onClick={() => setActiveRequirementTab('general')}>Back</Button>
                      <Button onClick={() => createTask('requirement')}>Create Requirement</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complaint Modal */}
      {isComplaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">Create Complaint</CardTitle>
              <p className="text-sm text-muted-foreground">Fill in the complaint details</p>
            </CardHeader>
            <CardContent>
              <Tabs value={activeComplaintTab} onValueChange={setActiveComplaintTab} className="w-full">
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
                      <Label htmlFor="complaintCategory">Category</Label>
                      <Select value="complaint" disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Complaint" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="complaint">Complaint</SelectItem>
                        </SelectContent>
                      </Select>
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintStoreName">Store</Label>
                      <Input
                        id="complaintStoreName"
                        value={visitDetail ? `${visitDetail.storeName}` : 'Loading...'}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
              </div>
                    <div className="flex justify-between mt-4">
                      <Button variant="outline" onClick={() => setIsComplaintModalOpen(false)}>Cancel</Button>
                      <Button onClick={() => setActiveComplaintTab('details')}>Next</Button>
            </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="details">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="complaintDueDate">Due Date</Label>
                      <Popover>
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
                          <CalendarComponent
                            mode="single"
                            selected={complaintTask.dueDate ? new Date(complaintTask.dueDate) : undefined}
                            onSelect={(date) => setComplaintTask({ ...complaintTask, dueDate: date ? date.toISOString().split('T')[0] : '' })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
            </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintAssignedTo">Assigned To</Label>
                      <Input
                        id="complaintAssignedTo"
                        value={visitDetail ? `${visitDetail.employeeName}` : ''}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
          </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintPriority">Priority</Label>
                      <Select value={complaintTask.priority} onValueChange={(value) => setComplaintTask({ ...complaintTask, priority: value as Priority })}>
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
                    <div className="flex justify-between mt-4">
                      <Button variant="outline" onClick={() => setActiveComplaintTab('general')}>Back</Button>
                      <Button onClick={() => createTask('complaint')}>Create Complaint</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

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
      {previewVisible && previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setPreviewVisible(false)}>
          <div className="relative max-w-4xl max-h-4xl p-4">
            <NextImage 
              src={previewImage} 
              alt="Preview Image" 
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-gray-100"
              onClick={() => setPreviewVisible(false)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
