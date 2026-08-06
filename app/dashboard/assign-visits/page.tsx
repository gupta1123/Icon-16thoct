"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import styles from "./assign-visits.module.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  apiService,
  type BulkVisitCreateResult,
  type BulkVisitResultDetail,
  type EmployeeDto,
  type StoreDto,
  type VisitEditPayload,
  type VisitDto,
  type VisitGridCell,
  type VisitGridV2Response,
  type TeamHierarchyResponse,
  type ScopedEmployee,
} from "@/lib/api";

// Using the actual types from API
type Store = StoreDto;

function formatDateKey(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeKey(d: Date) {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const formatRangePart = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

type VisitGridState = Record<number, Record<string, VisitDto[]>>;
type CellKey = string;
type AssignmentSaveStatus = "pending" | "skipped" | "failed";
type Assignment = {
  employeeId: number;
  dateKey: string;
  store: Store;
  saveStatus?: AssignmentSaveStatus;
  saveReason?: string;
};
type SaveReason = {
  key?: CellKey;
  status: "skipped" | "failed" | "info";
  message: string;
};
type SaveSummary = {
  created: number;
  skipped: number;
  failed: number;
  reasons: SaveReason[];
  message?: string;
};
type EditVisitForm = {
  employeeId: number;
  storeId: number;
  storeName: string;
  visitDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  purpose: string;
  priority: string;
};
type ActionFeedback = {
  type: "success" | "error";
  message: string;
};
type VisitDetailsSelection = {
  visit: VisitDto;
  employeeId: number;
  employeeName: string;
  employeeCity: string;
  dateKey: string;
};

type BoardVisitState = "planned" | "ongoing" | "completed" | "missed" | "aborted" | "cancelled";

const ASSIGNMENT_SOURCE = "WEB_ASSIGN_VISITS";
const ASSIGN_VISITS_EMPLOYEE_ID = 10000;
const NO_TIME_VALUE = "__NOT_SET__";

const BASE_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
});

const formatTimeLabel = (value: string) => {
  const [hoursText, minutes = "00"] = value.split(":");
  const hours = Number(hoursText);
  if (!Number.isFinite(hours)) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
};

const getTimeOptions = (currentValue: string) =>
  Array.from(new Set([...BASE_TIME_OPTIONS, ...(currentValue ? [currentValue] : [])])).sort();

const toTimeInputValue = (value?: string | null) => String(value ?? "").slice(0, 5);

const toApiTimeValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
};

const dedupeEmployeesById = (employeeList: EmployeeDto[]): EmployeeDto[] =>
  Array.from(
    employeeList.reduce<Map<number, EmployeeDto>>((uniqueEmployees, employee) => {
      if (!uniqueEmployees.has(employee.id)) {
        uniqueEmployees.set(employee.id, employee);
      }
      return uniqueEmployees;
    }, new Map()).values()
  );

const dedupeStoresById = (storeList: StoreDto[]): StoreDto[] =>
  Array.from(
    storeList.reduce<Map<number, StoreDto>>((uniqueStores, store) => {
      if (!uniqueStores.has(store.storeId)) {
        uniqueStores.set(store.storeId, store);
      }
      return uniqueStores;
    }, new Map()).values()
  );

const normalizeStatusLabel = (value?: string | null) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized || normalized === "SCHEDULED") return "Assigned";
  if (normalized === "ONGOING" || normalized === "ON_GOING" || normalized === "IN_PROGRESS") return "On Going";
  if (normalized === "CHECKED_OUT") return "Checked Out";
  if (normalized === "COMPLETE") return "Completed";
  return normalized
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getVisitStatusLabel = (visit: VisitDto) => {
  if (visit.status) return normalizeStatusLabel(visit.status);
  if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) return "Completed";
  if (visit.checkoutDate && visit.checkoutTime) return "Checked Out";
  if (visit.checkinDate && visit.checkinTime) return "On Going";
  return "Assigned";
};

const getBoardVisitState = (visit: VisitDto): BoardVisitState => {
  const normalized = String(visit.status ?? "").trim().toUpperCase();
  if (normalized === "ONGOING" || normalized === "ON_GOING" || normalized === "IN_PROGRESS") return "ongoing";
  if (normalized === "COMPLETED" || normalized === "COMPLETE" || normalized === "CHECKED_OUT") return "completed";
  if (normalized === "MISSED") return "missed";
  if (normalized === "ABORTED") return "aborted";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "cancelled";
  if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) return "completed";
  if (visit.checkinDate && visit.checkinTime) return "ongoing";
  return "planned";
};

const statusMarkClass = (state: BoardVisitState | "pending") => ({
  planned: styles.plannedMark,
  ongoing: styles.ongoingMark,
  completed: styles.completedMark,
  missed: styles.missedMark,
  aborted: styles.abortedMark,
  cancelled: styles.cancelledMark,
  pending: styles.pendingMark,
})[state];

const visitChipClass = (state: BoardVisitState) => ({
  planned: styles.plannedChip,
  ongoing: styles.ongoingChip,
  completed: styles.completedChip,
  missed: styles.missedChip,
  aborted: styles.abortedChip,
  cancelled: styles.cancelledChip,
})[state];

const normalizeGridCell = (cell: VisitGridCell | VisitDto[] | VisitDto | null | undefined): VisitDto[] => {
  if (!cell) return [];
  if (Array.isArray(cell)) return cell.filter(Boolean);
  if ("visits" in cell && Array.isArray(cell.visits)) return cell.visits.filter(Boolean);
  if ("id" in cell || "storeId" in cell || "storeName" in cell) return [cell as VisitDto];
  return [];
};

const normalizeGridResponse = (response: VisitGridV2Response): VisitGridState => {
  return Object.entries(response ?? {}).reduce<VisitGridState>((acc, [employeeId, byDate]) => {
    const numericEmployeeId = Number(employeeId);
    if (!Number.isFinite(numericEmployeeId)) return acc;
    acc[numericEmployeeId] = Object.entries(byDate ?? {}).reduce<Record<string, VisitDto[]>>((dateAcc, [dateKey, cell]) => {
      dateAcc[dateKey] = normalizeGridCell(cell);
      return dateAcc;
    }, {});
    return acc;
  }, {});
};

export default function AssignVisitsPage() {
  const { userRole, userData, currentUser, isLoading: authLoading, isAuthenticated, token } = useAuth();
  
  // State for real data
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [existingVisits, setExistingVisits] = useState<VisitGridState>({});
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dates: today to next 15 days
  const dateCols = useMemo(() => {
    const arr: { date: Date; key: string; isSunday: boolean }[] = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      arr.push({ date: d, key: formatDateKey(d), isSunday: d.getDay() === 0 });
    }
    return arr;
  }, [startDate]);

  const moveDateRange = useCallback((offset: number) => {
    setStartDate(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  }, []);

  const goToPreviousRange = useCallback(() => moveDateRange(-15), [moveDateRange]);
  const goToNextRange = useCallback(() => moveDateRange(15), [moveDateRange]);
  const goToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setStartDate(today);
  }, []);

  const isShowingToday = useMemo(() => formatDateKey(startDate) === formatDateKey(new Date()), [startDate]);

  // Load employees based on role
  const loadEmployees = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      
      let employeeData: EmployeeDto[] = [];
      
      // Debug logging
      console.log('Current userRole:', userRole);
      console.log('Current user authorities:', currentUser?.authorities);
      console.log('Auth loading state:', authLoading);
      console.log('Is authenticated:', isAuthenticated);
      console.log('Token from auth context:', token);
      console.log('Token from localStorage:', typeof window !== 'undefined' ? localStorage.getItem('authToken') : 'N/A');
      
      // Check if user is authenticated
      if (!isAuthenticated || !token) {
        throw new Error('User is not authenticated. Please log in again.');
      }
      
      // Check role with more flexible matching
      const isRegionalManager =
        userRole === 'REGIONAL_MANAGER' ||
        userRole === 'AVP' ||
        currentUser?.authorities?.some(
          (a: { authority: string }) =>
            a.authority === 'ROLE_REGIONAL_MANAGER' || a.authority === 'ROLE_AVP'
        );
      const isAdmin = userRole === 'ADMIN' || 
                     currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_ADMIN');
      const isCoordinator = userRole === 'COORDINATOR' || 
                           currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_COORDINATOR');
      const isDataManager = userRole === 'DATA_MANAGER' || 
                            currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_DATA_MANAGER');
      const isManager = userRole === 'MANAGER' || 
                        currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_MANAGER') ||
                        userRole === 'OFFICE MANAGER' || 
                        currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_OFFICE MANAGER');
      
      console.log('Role checks:', { isRegionalManager, isAdmin, isCoordinator, isDataManager, isManager });
      
      // Use hierarchy API for all roles - it returns scoped team based on logged-in user
      // The API automatically scopes results based on the logged-in user's role (Admin, AVP, Regional Manager, Coordinator, Data Manager, Manager)
      if (isRegionalManager || isAdmin || isCoordinator || isDataManager || isManager) {
        console.log('Loading team hierarchy with scoped API...');
        try {
          // Use the hierarchy API to get team structure scoped to current user's role
          const hierarchyData: TeamHierarchyResponse = await apiService.getTeamHierarchyScoped(ASSIGN_VISITS_EMPLOYEE_ID);
          console.log('Team hierarchy loaded:', hierarchyData);
          
          // Extract all field officers from all teams
          const fieldOfficers: ScopedEmployee[] = [];
          hierarchyData.teams.forEach(team => {
            fieldOfficers.push(...team.fieldOfficers);
          });
          
          // Convert ScopedEmployee to EmployeeDto format
          employeeData = fieldOfficers.map((fo: ScopedEmployee) => {
            // Split name into firstName and lastName
            const nameParts = fo.name.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            return {
              id: fo.id,
              firstName,
              lastName,
              employeeId: fo.employeeCode || '',
              primaryContact: 0,
              secondaryContact: 0,
              departmentName: '',
              email: '',
              role: fo.role,
              addressLine1: '',
              addressLine2: '',
              city: fo.city,
              state: fo.state,
              country: 'India',
              pincode: 0,
              dateOfJoining: '',
              createdAt: '',
              status: 'ACTIVE'
            } as EmployeeDto;
          });
          
          console.log('Field officers converted:', employeeData);
          
          // Fallback to old APIs if new API doesn't return field officers
          if (employeeData.length === 0) {
            console.log('No field officers from hierarchy, falling back to role-specific APIs...');
            if (isRegionalManager) {
              employeeData = await apiService.getTeamFieldOfficers();
            } else {
              employeeData = await apiService.getAllFieldOfficers();
            }
          }
        } catch (apiError) {
          console.error('API Error loading team hierarchy:', apiError);
          // Fallback to old APIs on error
          try {
            console.log('Falling back to role-specific APIs...');
            if (isRegionalManager) {
              employeeData = await apiService.getTeamFieldOfficers();
              console.log('Team field officers loaded (fallback):', employeeData);
            } else {
              employeeData = await apiService.getAllFieldOfficers();
              console.log('All field officers loaded (fallback):', employeeData);
            }
          } catch (fallbackError) {
            console.error('Fallback API Error:', fallbackError);
            throw apiError; // Throw original error
          }
        }
      } else {
        throw new Error(`Insufficient permissions to load employees. Current role: ${userRole}, Authorities: ${JSON.stringify(currentUser?.authorities)}`);
      }
      
      employeeData = dedupeEmployeesById(employeeData);
      console.log('Setting employees:', employeeData);
      setEmployees(employeeData);
      
      // Load existing visits for the grid
      if (employeeData.length > 0) {
        const employeeIds = employeeData.map(emp => emp.id);
        const startKey = dateCols[0]?.key;
        const endKey = dateCols[dateCols.length - 1]?.key;
        if (startKey && endKey) {
          const visitsData = await apiService.bulkGetForGridV2(employeeIds, startKey, endKey);
          setExistingVisits(normalizeGridResponse(visitsData));
        } else {
          setExistingVisits({});
        }
      } else {
        setExistingVisits({});
      }
    } catch (err) {
      console.error('Error loading employees:', err);
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [userRole, currentUser, dateCols, isAuthenticated, token]);

  // Load employees when auth data is available
  useEffect(() => {
    if (!authLoading && userRole) {
      loadEmployees();
    }
  }, [loadEmployees, authLoading, userRole]);

  // Assignments state: key = `${empId}-${dateKey}` => pending store assignment.
  const [assignments, setAssignments] = useState<Record<CellKey, Assignment>>({});
  const [dirty, setDirty] = useState(false);

  // Group employees by city
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [hideClosed, setHideClosed] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(() => new Set());

  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    const sorted = [...employees].sort((a, b) => {
      const cityCompare = (a.city || '').localeCompare(b.city || '', undefined, { sensitivity: 'base' });
      if (cityCompare !== 0) return cityCompare;
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
    if (!search) {
      return sorted;
    }
    return sorted.filter((emp) => {
      const employeeName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const employeeCode = String(emp.employeeId || emp.id).toLowerCase();
      const dealerMatches = dateCols.some((date) =>
        (existingVisits[emp.id]?.[date.key] ?? []).some((visit) =>
          String(visit.storeName || '').toLowerCase().includes(search)
        )
      );
      return employeeName.includes(search) || employeeCode.includes(search) || dealerMatches;
    });
  }, [employees, employeeSearch, dateCols, existingVisits]);

  const filteredByVisitEmployees = useMemo(() => {
    if (!unassignedOnly) {
      return filteredEmployees;
    }

    return filteredEmployees.filter(emp =>
      dateCols.every(({ key: dateKey }) => {
        const assignmentKey = `${emp.id}-${dateKey}`;
        const hasAssignment = Boolean(assignments[assignmentKey]);
        const hasExistingVisit = (existingVisits[emp.id]?.[dateKey]?.length ?? 0) > 0;
        return !hasAssignment && !hasExistingVisit;
      })
    );
  }, [filteredEmployees, unassignedOnly, dateCols, assignments, existingVisits]);

  const groupedEmployees = useMemo(() => {
    const map = new Map<string, EmployeeDto[]>();
    filteredByVisitEmployees.forEach((employee) => {
      const cityKey = (employee.city || 'Unknown').trim();
      const list = map.get(cityKey) ?? [];
      list.push(employee);
      map.set(cityKey, list);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([city, list]) => ({
        city,
        employees: [...list].sort((a, b) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        }),
      }));
  }, [filteredByVisitEmployees]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCell, setModalCell] = useState<{ employee: EmployeeDto; dateKey: string } | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [loadingStores, setLoadingStores] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [visitBeingEdited, setVisitBeingEdited] = useState<VisitDto | null>(null);
  const [editForm, setEditForm] = useState<EditVisitForm | null>(null);
  const [editStoreQuery, setEditStoreQuery] = useState("");
  const [editStores, setEditStores] = useState<StoreDto[]>([]);
  const [loadingEditStores, setLoadingEditStores] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<VisitDto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [visitDetails, setVisitDetails] = useState<VisitDetailsSelection | null>(null);

  const loadStoresForEmployee = useCallback(async (employeeId: number, search: string) => {
    setLoadingStores(true);
    try {
      const employeeStores = await apiService.getDealersForEmployee(employeeId, {
        search,
        page: 0,
        size: 50,
      });
      setStores(dedupeStoresById(employeeStores));
    } catch (err) {
      console.error('Error loading stores for employee:', err);
      setStores([]);
      setError('Failed to load stores for this employee');
    } finally {
      setLoadingStores(false);
    }
  }, []);

  const openCellModal = (employee: EmployeeDto, dateKey: string) => {
    const column = dateCols.find((col) => col.key === dateKey);
    if (column?.isSunday) {
      return; // Do not allow adding on Sundays
    }
    setModalCell({ employee, dateKey });
    setStoreQuery('');
    setStores([]);
    setError(null);
    setModalOpen(true);
  };

  const handleSearchChange = (value: string) => {
    setStoreQuery(value);
  };

  useEffect(() => {
    if (!modalOpen || !modalCell) return;

    const timeout = window.setTimeout(() => {
      void loadStoresForEmployee(modalCell.employee.id, storeQuery);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadStoresForEmployee, modalCell, modalOpen, storeQuery]);

  const loadEditStoresForEmployee = useCallback(async (employeeId: number, search: string) => {
    setLoadingEditStores(true);
    try {
      const employeeStores = await apiService.getDealersForEmployee(employeeId, {
        search,
        page: 0,
        size: 50,
      });
      setEditStores(dedupeStoresById(employeeStores));
    } catch (err) {
      console.error("Error loading stores for visit edit:", err);
      setEditStores([]);
      setActionError("Failed to load dealers for the selected employee.");
    } finally {
      setLoadingEditStores(false);
    }
  }, []);

  useEffect(() => {
    if (!editDialogOpen || !editForm?.employeeId) return;

    const timeout = window.setTimeout(() => {
      void loadEditStoresForEmployee(editForm.employeeId, editStoreQuery);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [editDialogOpen, editForm?.employeeId, editStoreQuery, loadEditStoresForEmployee]);

  const openEditVisit = (visit: VisitDto, fallbackEmployeeId: number, fallbackDate: string) => {
    const employeeId = Number(visit.employeeId || fallbackEmployeeId);
    const storeId = Number(visit.storeId);
    const storeName = visit.storeName || (storeId ? `Store #${storeId}` : "");

    setVisitBeingEdited(visit);
    setEditForm({
      employeeId,
      storeId,
      storeName,
      visitDate: visit.visit_date || fallbackDate,
      scheduledStartTime: toTimeInputValue(visit.scheduledStartTime),
      scheduledEndTime: toTimeInputValue(visit.scheduledEndTime),
      purpose: visit.purpose || "",
      priority: String(visit.priority || "MEDIUM").toUpperCase(),
    });
    setEditStoreQuery(storeName);
    setEditStores([]);
    setActionError(null);
    setActionFeedback(null);
    setEditDialogOpen(true);
  };

  const openDeleteVisit = (visit: VisitDto) => {
    setVisitToDelete(visit);
    setActionError(null);
    setActionFeedback(null);
    setDeleteDialogOpen(true);
  };

  const handleEditEmployeeChange = (employeeIdValue: string) => {
    const employeeId = Number(employeeIdValue);
    if (!Number.isFinite(employeeId)) return;

    setEditForm((previous) => previous
      ? {
          ...previous,
          employeeId,
          storeId: 0,
          storeName: "",
        }
      : previous
    );
    setEditStoreQuery("");
    setEditStores([]);
    setActionError(null);
  };

  const selectEditStore = (store: StoreDto) => {
    setEditForm((previous) => previous
      ? {
          ...previous,
          storeId: store.storeId,
          storeName: store.storeName,
        }
      : previous
    );
    setEditStoreQuery(store.storeName);
    setActionError(null);
  };

  const saveEditedVisit = async () => {
    if (!visitBeingEdited || !editForm) return;

    const visitId = Number(visitBeingEdited.id);
    if (!Number.isFinite(visitId) || visitId <= 0) {
      setActionError("This visit does not have a valid ID and cannot be edited.");
      return;
    }
    if (!Number.isFinite(editForm.employeeId) || editForm.employeeId <= 0) {
      setActionError("Select a field officer.");
      return;
    }
    if (!Number.isFinite(editForm.storeId) || editForm.storeId <= 0) {
      setActionError("Select a dealer from the search results.");
      return;
    }
    if (!editForm.visitDate) {
      setActionError("Select a visit date.");
      return;
    }
    const selectedDate = new Date(`${editForm.visitDate}T00:00:00`);
    if (selectedDate.getDay() === 0) {
      setActionError("Visits cannot be assigned on Sundays.");
      return;
    }
    if (!editForm.purpose.trim()) {
      setActionError("Enter the purpose of the visit.");
      return;
    }
    if (
      editForm.scheduledStartTime &&
      editForm.scheduledEndTime &&
      editForm.scheduledEndTime <= editForm.scheduledStartTime
    ) {
      setActionError("End time must be later than start time.");
      return;
    }

    const assignedById = Number(userData?.employeeId ?? visitBeingEdited.assignedById ?? ASSIGN_VISITS_EMPLOYEE_ID);
    if (!Number.isFinite(assignedById) || assignedById <= 0) {
      setActionError("Unable to identify the employee making this change.");
      return;
    }

    const payload: VisitEditPayload = {
      storeId: editForm.storeId,
      employeeId: editForm.employeeId,
      visit_date: editForm.visitDate,
      scheduledStartTime: toApiTimeValue(editForm.scheduledStartTime),
      scheduledEndTime: toApiTimeValue(editForm.scheduledEndTime),
      purpose: editForm.purpose.trim(),
      priority: editForm.priority,
      isSelfGenerated: visitBeingEdited.isSelfGenerated ?? false,
      assignedById,
    };

    setActionSaving(true);
    setActionError(null);
    try {
      await apiService.editVisit(visitId, payload);
      setEditDialogOpen(false);
      setVisitBeingEdited(null);
      setEditForm(null);
      setActionFeedback({ type: "success", message: "Visit assignment updated successfully." });
      await loadEmployees();
    } catch (err) {
      console.error("Error editing visit:", err);
      setActionError(err instanceof Error ? err.message : "Failed to update the visit assignment.");
    } finally {
      setActionSaving(false);
    }
  };

  const deleteExistingVisit = async () => {
    if (!visitToDelete) return;

    const visitId = Number(visitToDelete.id);
    if (!Number.isFinite(visitId) || visitId <= 0) {
      setActionError("This visit does not have a valid ID and cannot be deleted.");
      return;
    }

    setActionSaving(true);
    setActionError(null);
    try {
      await apiService.deleteVisit(visitId);
      setDeleteDialogOpen(false);
      setVisitToDelete(null);
      setActionFeedback({ type: "success", message: "Visit deleted permanently." });
      await loadEmployees();
    } catch (err) {
      console.error("Error deleting visit:", err);
      setActionError(err instanceof Error ? err.message : "Failed to delete the visit.");
    } finally {
      setActionSaving(false);
    }
  };

  const assignStore = (store: Store) => {
    if (!modalCell) return;
    const key = `${modalCell.employee.id}-${modalCell.dateKey}`;
    setAssignments(prev => ({
      ...prev,
      [key]: {
        employeeId: modalCell.employee.id,
        dateKey: modalCell.dateKey,
        store,
        saveStatus: "pending",
      },
    }));
    setDirty(true);
    setSaveSummary(null);
    setModalOpen(false);
    setModalCell(null);
  };

  const removeAssignment = (employeeId: number, dateKey: string) => {
    const key = `${employeeId}-${dateKey}`;
    setAssignments(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    setDirty(true);
  };

  const discardPendingAssignments = () => {
    setAssignments({});
    setDirty(false);
    setSaveSummary(null);
  };

  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  
  // Check permissions after all hooks
  const isAdmin = userRole === 'ADMIN' || currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_ADMIN');
  const isCoordinator = userRole === 'COORDINATOR' || currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_COORDINATOR');
  const isRegionalManager =
    userRole === 'REGIONAL_MANAGER' ||
    userRole === 'AVP' ||
    currentUser?.authorities?.some(
      (a: { authority: string }) =>
        a.authority === 'ROLE_REGIONAL_MANAGER' || a.authority === 'ROLE_AVP'
    );
  const isDataManager = userRole === 'DATA_MANAGER' || currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_DATA_MANAGER');
  const isManager = userRole === 'MANAGER' || currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_MANAGER') ||
                    userRole === 'OFFICE MANAGER' || currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_OFFICE MANAGER') ||
                    userRole === 'AVP' || currentUser?.authorities?.some((a: { authority: string }) => a.authority === 'ROLE_AVP');

  const getAssignmentKey = (employeeId: number, dateKey: string, storeId?: number) => {
    return storeId ? `${employeeId}-${dateKey}-${storeId}` : `${employeeId}-${dateKey}`;
  };

  const getCurrentEmployeeId = () => {
    return ASSIGN_VISITS_EMPLOYEE_ID;
  };

  const getReasonText = (detail: string | BulkVisitResultDetail, fallback: string) => {
    if (typeof detail === "string") return detail;
    return detail.reason || detail.message || detail.error || fallback;
  };

  const getDetailKey = (detail: BulkVisitResultDetail, allAssignments: Assignment[]) => {
    const employeeId = typeof detail.employeeId === "number" ? detail.employeeId : Number(detail.employeeId);
    const storeId = typeof detail.storeId === "number" ? detail.storeId : Number(detail.storeId);
    const dateKey = detail.visitDate || detail.visit_date || detail.date;

    if (Number.isFinite(employeeId) && dateKey) {
      return getAssignmentKey(employeeId, dateKey, Number.isFinite(storeId) ? storeId : undefined);
    }

    const searchableText = [detail.reason, detail.message, detail.error].filter(Boolean).join(" ").toLowerCase();
    if (!searchableText) return undefined;

    const matched = allAssignments.find((assignment) => {
      const employee = employees.find((item) => item.id === assignment.employeeId);
      const employeeName = `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim().toLowerCase();
      return (
        searchableText.includes(String(assignment.store.storeId)) ||
        searchableText.includes((assignment.store.storeName || "").toLowerCase()) ||
        searchableText.includes(assignment.dateKey) ||
        (employeeName && searchableText.includes(employeeName))
      );
    });

    return matched ? getAssignmentKey(matched.employeeId, matched.dateKey, matched.store.storeId) : undefined;
  };

  const normalizeSaveResult = (result: BulkVisitCreateResult, allAssignments: Assignment[]): SaveSummary => {
    const created = typeof result.created === "number" ? result.created : 0;
    const skipped = typeof result.skipped === "number" ? result.skipped : 0;
    const failed = typeof result.failed === "number" ? result.failed : 0;

    const reasons: SaveReason[] = [];

    result.results?.forEach((detail) => {
      const status = String(detail.status || "").toLowerCase();
      if (status.includes("skip") || status.includes("fail") || detail.reason || detail.message || detail.error) {
        reasons.push({
          key: getDetailKey(detail, allAssignments),
          status: status.includes("skip") ? "skipped" : status.includes("fail") ? "failed" : "info",
          message: getReasonText(detail, "Visit was not created."),
        });
      }
    });

    result.skippedVisits?.forEach((detail) => {
      reasons.push({
        key: typeof detail === "string" ? undefined : getDetailKey(detail, allAssignments),
        status: "skipped",
        message: getReasonText(detail, "Visit was skipped."),
      });
    });

    result.failedVisits?.forEach((detail) => {
      reasons.push({
        key: typeof detail === "string" ? undefined : getDetailKey(detail, allAssignments),
        status: "failed",
        message: getReasonText(detail, "Visit failed."),
      });
    });

    result.errors?.forEach((detail) => {
      reasons.push({
        key: typeof detail === "string" ? undefined : getDetailKey(detail, allAssignments),
        status: "failed",
        message: getReasonText(detail, "Visit failed."),
      });
    });

    if ((skipped > 0 || failed > 0) && reasons.length === 0) {
      reasons.push({
        status: "info",
        message: "The API returned skipped or failed counts without item-level reasons. Selections were preserved for review.",
      });
    }

    return {
      created,
      skipped,
      failed,
      reasons,
      message: result.message,
    };
  };

  const saveChanges = async () => {
    setSaving(true);
    setSaveSummary(null);
    setError(null);
    
    try {
      const toCreate = Object.values(assignments);
      if (toCreate.length === 0) {
        setDirty(false);
        setSaveSummary({
          created: 0,
          skipped: 0,
          failed: 0,
          reasons: [{ status: "info", message: "No pending assignments to save." }],
        });
        return;
      }

      const assignedById = getCurrentEmployeeId();
      if (!assignedById) {
        throw new Error("Unable to identify the assigning manager. Please sign in again.");
      }

      const now = new Date();
      const assignedDate = formatDateKey(now);
      const assignedTime = formatTimeKey(now);
      const assignedAt = `${assignedDate}T${assignedTime}`;
      
      const visitDtos: VisitDto[] = toCreate.map(assignment => ({
        employeeId: assignment.employeeId,
        storeId: assignment.store.storeId,
        visit_date: assignment.dateKey,
        isSelfGenerated: false,
        assignedById,
        assignedAt,
        assignedDate,
        assignedTime,
        assignmentSource: ASSIGNMENT_SOURCE,
        status: "ASSIGNED",
      } as VisitDto));
      
      const result = await apiService.bulkCreateVisits(visitDtos);
      const summary = normalizeSaveResult(result, toCreate);
      setSaveSummary(summary);
      
      if (summary.skipped === 0 && summary.failed === 0) {
        setAssignments({});
        setDirty(false);
      } else {
        const problemKeys = new Map<CellKey, AssignmentSaveStatus>();
        const reasonByKey = new Map<CellKey, string>();

        summary.reasons.forEach((reason) => {
          if (!reason.key) return;
          const status: AssignmentSaveStatus = reason.status === "skipped" ? "skipped" : "failed";
          problemKeys.set(reason.key, status);
          reasonByKey.set(reason.key, reason.message);
        });

        setAssignments(prev => {
          if (problemKeys.size === 0) {
            return Object.entries(prev).reduce<Record<CellKey, Assignment>>((acc, [key, assignment]) => {
              acc[key] = {
                ...assignment,
                saveStatus: "failed",
                saveReason: "The API did not identify which selected visits were skipped or failed.",
              };
              return acc;
            }, {});
          }

          return Object.entries(prev).reduce<Record<CellKey, Assignment>>((acc, [key, assignment]) => {
            const detailedKey = getAssignmentKey(assignment.employeeId, assignment.dateKey, assignment.store.storeId);
            const status = problemKeys.get(detailedKey) ?? problemKeys.get(key);
            const reason = reasonByKey.get(detailedKey) ?? reasonByKey.get(key);
            if (status) {
              acc[key] = {
                ...assignment,
                saveStatus: status,
                saveReason: reason || "Visit was not created.",
              };
            }
            return acc;
          }, {});
        });
        setDirty(true);
      }

      await loadEmployees();
      
    } catch (err) {
      console.error('Error creating visits:', err);
      setError(err instanceof Error ? err.message : 'Failed to create visits');
    } finally {
      setSaving(false);
    }
  };

  if (!(isAdmin || isCoordinator || isRegionalManager || isDataManager || isManager)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assign Visits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            You don&apos;t have permission to access this page.
            <br />
            <strong>Current role:</strong> {userRole}
            <br />
            <strong>Authorities:</strong> {JSON.stringify(currentUser?.authorities)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">
          {authLoading ? 'Loading user data...' : 'Loading employees and visits...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assign Visits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
          <Button onClick={loadEmployees} className="mt-3">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const todayKey = formatDateKey(new Date());
  const pendingCount = Object.keys(assignments).length;

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <div className={styles.stepper}>
          <button type="button" className={styles.stepperButton} onClick={goToPreviousRange} aria-label="Previous 15 days" title="Previous 15 days">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className={styles.dateRange}>
            <strong>{dateCols[0] ? formatRangePart(dateCols[0].date) : "—"}</strong>
            <span>—</span>
            <strong>{dateCols[14] ? formatRangePart(dateCols[14].date) : "—"}</strong>
          </div>
          <button type="button" className={styles.stepperButton} onClick={goToNextRange} aria-label="Next 15 days" title="Next 15 days">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          className={[styles.toolbarButton, isShowingToday ? styles.toolbarButtonActive : ""].join(" ")}
          onClick={goToToday}
        >
          Today
        </button>

        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search officer or dealer…"
            value={employeeSearch}
            onChange={(event) => setEmployeeSearch(event.target.value)}
          />
        </div>

        <button
          type="button"
          className={[styles.filterChip, unassignedOnly ? styles.filterChipActive : ""].join(" ")}
          onClick={() => setUnassignedOnly((value) => !value)}
          aria-pressed={unassignedOnly}
        >
          {unassignedOnly && <Check className="h-3.5 w-3.5" />}
          Unassigned all window
        </button>
        <button
          type="button"
          className={[styles.filterChip, hideClosed ? styles.filterChipActive : ""].join(" ")}
          onClick={() => setHideClosed((value) => !value)}
          aria-pressed={hideClosed}
        >
          {hideClosed && <Check className="h-3.5 w-3.5" />}
          Hide closed
        </button>

        <div className={styles.legend} aria-label="Visit status legend">
          {([
            ["planned", "Planned"],
            ["ongoing", "Ongoing"],
            ["completed", "Done"],
            ["missed", "Missed"],
            ["aborted", "Aborted"],
            ["cancelled", "Cancelled"],
          ] as const).map(([state, label]) => (
            <span key={state} className={styles.legendItem}>
              <i className={[styles.statusMark, statusMarkClass(state)].join(" ")} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {saveSummary && (
        <div className={[styles.notice, saveSummary.failed > 0 || saveSummary.skipped > 0 ? styles.noticeWarning : styles.noticeSuccess].join(" ")}>
          <strong>{saveSummary.created} created</strong> · {saveSummary.skipped} skipped · {saveSummary.failed} failed
          {saveSummary.message ? ` — ${saveSummary.message}` : ""}
        </div>
      )}

      {actionFeedback && (
        <div className={[styles.notice, actionFeedback.type === "success" ? styles.noticeSuccess : styles.noticeError].join(" ")}>
          {actionFeedback.message}
        </div>
      )}

      <div className={styles.board}>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `var(--av-name-col) repeat(${dateCols.length}, minmax(var(--av-col), 1fr))` }}
        >
          <div className={[styles.gridHeader, styles.officerHeader].join(" ")}>Field officer</div>
          {dateCols.map((column) => {
            const bookedCount = filteredByVisitEmployees.filter((employee) =>
              Boolean(assignments[`${employee.id}-${column.key}`]) || (existingVisits[employee.id]?.[column.key]?.length ?? 0) > 0
            ).length;
            const isToday = column.key === todayKey;

            return (
              <div
                key={column.key}
                className={[
                  styles.gridHeader,
                  styles.dateHeader,
                  isToday ? styles.dateHeaderToday : "",
                  column.isSunday ? styles.dateHeaderOff : "",
                ].join(" ")}
              >
                <span className={styles.dayName}>{column.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <span className={styles.dayNumber}>{column.date.getDate()}</span>
                <span className={styles.monthName}>{column.date.toLocaleDateString(undefined, { month: "short" })}</span>
                <span className={styles.dateCount}>{column.isSunday ? "Weekly off" : `${bookedCount} / ${filteredByVisitEmployees.length}`}</span>
              </div>
            );
          })}

          {groupedEmployees.length === 0 ? (
            <div className={styles.emptyState} style={{ gridColumn: "1 / -1" }}>
              <strong>No officers match</strong>
              <span>Clear the search or filters to see the full planning board.</span>
            </div>
          ) : (
            groupedEmployees.map(({ city, employees: cityEmployees }) => {
              const plannedAhead = cityEmployees.reduce((total, employee) =>
                total + dateCols.reduce((employeeTotal, date) =>
                  employeeTotal + (existingVisits[employee.id]?.[date.key]?.length ?? 0) + (assignments[`${employee.id}-${date.key}`] ? 1 : 0), 0
                ), 0
              );

              return (
                <React.Fragment key={city}>
                  <div className={styles.cityBand} style={{ gridColumn: "1 / -1" }}>
                    <h2 className={styles.cityName}>{city}</h2>
                    <span className={styles.cityMeta}>{cityEmployees.length} officer{cityEmployees.length === 1 ? "" : "s"}</span>
                    <span className={styles.cityPlanCount}>{plannedAhead} planned ahead</span>
                  </div>

                  {cityEmployees.map((employee) => {
                    const employeeName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
                    const employeePlanned = dateCols.reduce((total, date) =>
                      total + (existingVisits[employee.id]?.[date.key]?.length ?? 0) + (assignments[`${employee.id}-${date.key}`] ? 1 : 0), 0
                    );

                    return (
                      <React.Fragment key={employee.id}>
                        <div className={styles.officerCell}>
                          <span className={styles.officerInfo}>
                            <span className={styles.officerName}>{employeeName}</span>
                            <span className={styles.officerId}>{employee.employeeId || employee.id}</span>
                          </span>
                          <span className={styles.officerCount} title="Planned across this window"><strong>{employeePlanned}</strong></span>
                        </div>

                        {dateCols.map((column) => {
                          const cellKey = `${employee.id}-${column.key}`;
                          const pendingAssignment = assignments[cellKey];
                          const rawVisits = existingVisits[employee.id]?.[column.key] ?? [];
                          const visibleVisits = hideClosed
                            ? rawVisits.filter((visit) => !["cancelled", "missed"].includes(getBoardVisitState(visit)))
                            : rawVisits;
                          const isExpanded = expandedCells.has(cellKey);
                          const visitsToShow = isExpanded ? visibleVisits : visibleVisits.slice(0, 2);
                          const isPast = column.key < todayKey;
                          const assignmentDisabled = isPast || column.isSunday;
                          const hasItems = visitsToShow.length > 0 || Boolean(pendingAssignment);

                          return (
                            <div
                              key={cellKey}
                              className={[
                                styles.cell,
                                column.key === todayKey ? styles.todayCell : "",
                                column.isSunday ? styles.offCell : "",
                                hasItems ? styles.cellHasVisits : "",
                              ].join(" ")}
                              title={column.isSunday ? "Weekly off — assignment disabled" : isPast ? "Past date — read only" : undefined}
                            >
                              {visitsToShow.map((visit, index) => {
                                const visitName = visit.storeName || (visit.storeId ? `Store #${visit.storeId}` : "Visit");
                                const visitState = getBoardVisitState(visit);
                                const visitStatus = getVisitStatusLabel(visit);

                                return (
                                  <div key={`${visit.id ?? visit.storeId ?? visitName}-${index}`} className={styles.visitWrap}>
                                    <button
                                      type="button"
                                      className={[styles.visitChip, visitChipClass(visitState)].join(" ")}
                                      title={`${visitName} · ${visitStatus}`}
                                      onClick={() => setVisitDetails({
                                        visit,
                                        employeeId: employee.id,
                                        employeeName,
                                        employeeCity: employee.city || "",
                                        dateKey: column.key,
                                      })}
                                    >
                                      <i className={[styles.statusMark, statusMarkClass(visitState)].join(" ")} />
                                      <span className={styles.visitName}>{visitName}</span>
                                    </button>
                                  </div>
                                );
                              })}

                              {!isExpanded && visibleVisits.length > 2 && (
                                <button
                                  type="button"
                                  className={styles.moreButton}
                                  onClick={() => setExpandedCells((current) => new Set(current).add(cellKey))}
                                >
                                  +{visibleVisits.length - 2} more
                                </button>
                              )}

                              {pendingAssignment && (
                                <div
                                  className={[
                                    styles.pendingChip,
                                    pendingAssignment.saveStatus === "failed" ? styles.failedChip : "",
                                    pendingAssignment.saveStatus === "skipped" ? styles.skippedChip : "",
                                  ].join(" ")}
                                  title={[pendingAssignment.store.storeName, pendingAssignment.saveReason].filter(Boolean).join("\n")}
                                >
                                  <i className={[styles.statusMark, statusMarkClass("pending")].join(" ")} />
                                  <span className={styles.visitName}>{pendingAssignment.store.storeName}</span>
                                  <button
                                    type="button"
                                    className={styles.removePendingButton}
                                    onClick={() => removeAssignment(employee.id, column.key)}
                                    aria-label={`Remove pending visit to ${pendingAssignment.store.storeName}`}
                                    title="Remove"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                className={[styles.addButton, assignmentDisabled ? styles.addButtonDisabled : ""].join(" ")}
                                onClick={() => openCellModal(employee, column.key)}
                                disabled={assignmentDisabled}
                                aria-label={`Assign dealer to ${employeeName} on ${formatDayLabel(column.date)}`}
                                title="Assign a dealer"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {dirty && (
        <div className={styles.saveBar}>
          <span className={styles.pendingCount}>{pendingCount}</span>
          <span className={styles.saveCopy}>
            Unsaved assignments
            <span>Nothing reaches a field officer until you save.</span>
          </span>
          <span className={styles.grow} />
          <button type="button" className={styles.secondaryAction} onClick={discardPendingAssignments} disabled={saving}>Discard</button>
          <button type="button" className={styles.primaryAction} onClick={saveChanges} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      )}

      <Sheet
        open={Boolean(visitDetails)}
        onOpenChange={(open) => {
          if (!open) setVisitDetails(null);
        }}
      >
        <SheetContent side="right" className={styles.detailsDrawer}>
          {visitDetails && (() => {
            const { visit, employeeId, employeeName, employeeCity, dateKey } = visitDetails;
            const visitName = visit.storeName || (visit.storeId ? `Store #${visit.storeId}` : `Visit #${visit.id}`);
            const visitState = getBoardVisitState(visit);
            const schedule = [visit.scheduledStartTime, visit.scheduledEndTime]
              .map((time) => toTimeInputValue(time))
              .filter(Boolean)
              .map(formatTimeLabel)
              .join(" – ");
            const formattedDate = new Date(`${visit.visit_date || dateKey}T00:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <>
                <div className={styles.drawerHeader}>
                  <SheetHeader className="space-y-1 text-left">
                    <SheetTitle className={styles.drawerTitle}>{visitName}</SheetTitle>
                    <SheetDescription className={styles.drawerCaption}>
                      {[visit.storeId ? `Store #${visit.storeId}` : null, visit.id ? `Visit #${visit.id}` : null].filter(Boolean).join(" · ")}
                    </SheetDescription>
                  </SheetHeader>
                  <div className={styles.statusPill}>
                    <i className={[styles.statusMark, statusMarkClass(visitState)].join(" ")} />
                    {getVisitStatusLabel(visit)}
                  </div>
                </div>

                <div className={styles.drawerBody}>
                  <dl className={styles.detailsList}>
                    <dt>Field officer</dt>
                    <dd>{employeeName}{employeeCity ? <span> · {employeeCity}</span> : null}</dd>

                    <dt>Date</dt>
                    <dd>{formattedDate}</dd>

                    <dt>Purpose</dt>
                    <dd>{visit.purpose || "Not provided"}</dd>

                    <dt>Priority</dt>
                    <dd>{visit.priority ? normalizeStatusLabel(String(visit.priority)) : "Not provided"}</dd>

                    <dt>Schedule</dt>
                    <dd>{schedule || "Not scheduled"}</dd>
                  </dl>

                  <div className={styles.drawerSectionTitle}>Actions</div>
                  <div className={styles.drawerActions}>
                    <button
                      type="button"
                      className={styles.drawerActionButton}
                      onClick={() => {
                        setVisitDetails(null);
                        openEditVisit(visit, employeeId, dateKey);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit assignment
                    </button>
                    <button
                      type="button"
                      className={[styles.drawerActionButton, styles.drawerDeleteButton].join(" ")}
                      onClick={() => {
                        setVisitDetails(null);
                        openDeleteVisit(visit);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className={[styles.dialogContent, "sm:max-w-[520px]"].join(" ")}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle className={styles.dialogTitle}>Assign a dealer</DialogTitle>
            <DialogDescription className={styles.dialogCaption}>
              {modalCell ? `${modalCell.employee.firstName} ${modalCell.employee.lastName} · ${modalCell.dateKey}` : "Select a dealer"}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            <div className={styles.searchBox}>
              <Search className={styles.searchIcon} />
              <Input
                className="h-9 pl-8"
                placeholder="Dealer name, town or code…"
                value={storeQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                autoFocus
              />
            </div>
            <div className={[styles.dealerList, "mt-3"].join(" ")}>
              {loadingStores ? (
                <div className={styles.dialogEmpty}><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Searching…</div>
              ) : stores.length === 0 ? (
                <div className={styles.dialogEmpty}>No dealer matches this officer&apos;s book.</div>
              ) : (
                stores.map((store) => (
                  <button key={store.storeId} type="button" className={styles.dealerRow} onClick={() => assignStore(store)}>
                    <span className={styles.dealerAvatar}>{store.storeName.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0">
                      <span className={styles.dealerName}>{store.storeName}</span>
                      <span className={styles.dealerMeta}>{[store.storeId, store.city, store.clientType || "Dealer"].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter className={styles.dialogFooter}>
            <span className={styles.dialogEndpoint}>{stores.length} match{stores.length === 1 ? "" : "es"}</span>
            <button type="button" className={styles.secondaryAction} onClick={() => setModalOpen(false)}>Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (actionSaving) return;
          setEditDialogOpen(open);
          if (!open) {
            setVisitBeingEdited(null);
            setEditForm(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent className={[styles.dialogContent, "sm:max-w-[560px]"].join(" ")}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle className={styles.dialogTitle}>Edit assignment</DialogTitle>
            <DialogDescription className={styles.dialogCaption}>
              {[visitBeingEdited?.storeName, visitBeingEdited?.employeeName, editForm?.visitDate].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className={styles.dialogBody}>
              <div className={styles.field}>
                <Label className={styles.fieldLabel} htmlFor="edit-visit-dealer">Dealer</Label>
                <Input
                  id="edit-visit-dealer"
                  value={editStoreQuery}
                  placeholder="Search dealer by name, town or code…"
                  onChange={(event) => {
                    const value = event.target.value;
                    setEditStoreQuery(value);
                    setEditForm((previous) => previous && value !== previous.storeName ? { ...previous, storeId: 0, storeName: "" } : previous);
                    setActionError(null);
                  }}
                  disabled={actionSaving}
                  autoComplete="off"
                />
                <div className={[styles.dealerList, "mt-2"].join(" ")}>
                  {loadingEditStores ? (
                    <div className={styles.dialogEmpty}><Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />Searching…</div>
                  ) : editStores.length === 0 ? (
                    editForm.storeId > 0 && editForm.storeName ? (
                      <div className={[styles.dealerRow, styles.dealerRowSelected].join(" ")}>
                        <span className={styles.dealerAvatar}>{editForm.storeName.slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className={styles.dealerName}>{editForm.storeName}</span>
                          <span className={styles.dealerMeta}>Current assignment</span>
                        </span>
                        <span className={styles.selectedTag}>Selected</span>
                      </div>
                    ) : (
                      <div className={styles.dialogEmpty}>No dealer found for this field officer.</div>
                    )
                  ) : (
                    editStores.map((store) => (
                      <button
                        key={store.storeId}
                        type="button"
                        className={[styles.dealerRow, editForm.storeId === store.storeId ? styles.dealerRowSelected : ""].join(" ")}
                        onClick={() => selectEditStore(store)}
                        disabled={actionSaving}
                      >
                        <span className={styles.dealerAvatar}>{store.storeName.slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className={styles.dealerName}>{store.storeName}</span>
                          <span className={styles.dealerMeta}>{[store.storeId, store.city].filter(Boolean).join(" · ")}</span>
                        </span>
                        {editForm.storeId === store.storeId && <span className={styles.selectedTag}>Selected</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor="edit-visit-employee">Field officer</Label>
                  <Select value={String(editForm.employeeId)} onValueChange={handleEditEmployeeChange} disabled={actionSaving}>
                    <SelectTrigger id="edit-visit-employee" className="w-full"><SelectValue placeholder="Select a field officer" /></SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={String(employee.id)}>
                          {employee.firstName} {employee.lastName} — {employee.city || "No city"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor="edit-visit-date">Date</Label>
                  <Input id="edit-visit-date" type="date" value={editForm.visitDate} onChange={(event) => setEditForm((previous) => previous ? { ...previous, visitDate: event.target.value } : previous)} disabled={actionSaving} />
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor="edit-visit-purpose">Purpose</Label>
                  <Input id="edit-visit-purpose" value={editForm.purpose} placeholder="Follow-up" onChange={(event) => setEditForm((previous) => previous ? { ...previous, purpose: event.target.value } : previous)} disabled={actionSaving} />
                </div>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor="edit-visit-priority">Priority</Label>
                  <Select value={editForm.priority} onValueChange={(priority) => setEditForm((previous) => previous ? { ...previous, priority } : previous)} disabled={actionSaving}>
                    <SelectTrigger id="edit-visit-priority" className="w-full"><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor="edit-visit-start-time">Scheduled start</Label>
                  <Select
                    value={editForm.scheduledStartTime || NO_TIME_VALUE}
                    onValueChange={(value) => setEditForm((previous) => previous
                      ? { ...previous, scheduledStartTime: value === NO_TIME_VALUE ? "" : value }
                      : previous
                    )}
                    disabled={actionSaving}
                  >
                    <SelectTrigger id="edit-visit-start-time" className="w-full">
                      <SelectValue placeholder="Select start time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value={NO_TIME_VALUE}>Not set</SelectItem>
                      {getTimeOptions(editForm.scheduledStartTime).map((time) => (
                        <SelectItem key={`start-${time}`} value={time}>{formatTimeLabel(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={styles.field}>
                  <Label className={styles.fieldLabel} htmlFor="edit-visit-end-time">Scheduled end</Label>
                  <Select
                    value={editForm.scheduledEndTime || NO_TIME_VALUE}
                    onValueChange={(value) => setEditForm((previous) => previous
                      ? { ...previous, scheduledEndTime: value === NO_TIME_VALUE ? "" : value }
                      : previous
                    )}
                    disabled={actionSaving}
                  >
                    <SelectTrigger id="edit-visit-end-time" className="w-full">
                      <SelectValue placeholder="Select end time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value={NO_TIME_VALUE}>Not set</SelectItem>
                      {getTimeOptions(editForm.scheduledEndTime).map((time) => (
                        <SelectItem key={`end-${time}`} value={time}>{formatTimeLabel(time)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {actionError && <div className={[styles.notice, styles.noticeError, "mx-0 mt-2"].join(" ")}>{actionError}</div>}
            </div>
          )}

          <DialogFooter className={styles.dialogFooter}>
            <span className={styles.dialogEndpoint}>{visitBeingEdited?.id ? `PUT /visit/edit?id=${visitBeingEdited.id}` : "PUT /visit/edit"}</span>
            <button type="button" className={styles.secondaryAction} onClick={() => setEditDialogOpen(false)} disabled={actionSaving}>Cancel</button>
            <button type="button" className={styles.primaryAction} onClick={saveEditedVisit} disabled={actionSaving || !editForm}>
              {actionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {actionSaving ? "Saving…" : "Save changes"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (actionSaving) return;
          setDeleteDialogOpen(open);
          if (!open) {
            setVisitToDelete(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent className={[styles.dialogContent, "sm:max-w-[500px]"].join(" ")}>
          <DialogHeader className={styles.dialogHeader}>
            <DialogTitle className={styles.dialogTitle}>Delete visit?</DialogTitle>
            <DialogDescription className={styles.dialogCaption}>
              {[visitToDelete?.storeName || (visitToDelete?.id ? `Visit #${visitToDelete.id}` : "Visit"), visitToDelete?.employeeName, visitToDelete?.visit_date].filter(Boolean).join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <div className={styles.dialogBody}>
            <p className={styles.deleteWarning}>
              <strong>Are you sure you want to delete this visit?</strong> It will be permanently removed from the field officer&apos;s plan and cannot be recovered.
            </p>
            {actionError && <div className={[styles.notice, styles.noticeError, "mx-0 mt-2"].join(" ")}>{actionError}</div>}
          </div>
          <DialogFooter className={styles.dialogFooter}>
            <span className={styles.grow} />
            <button type="button" className={styles.secondaryAction} onClick={() => setDeleteDialogOpen(false)} disabled={actionSaving}>Cancel</button>
            <button type="button" className={[styles.secondaryAction, styles.destructiveAction].join(" ")} onClick={deleteExistingVisit} disabled={actionSaving || !visitToDelete}>
              {actionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {actionSaving ? "Deleting…" : "Delete visit"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
