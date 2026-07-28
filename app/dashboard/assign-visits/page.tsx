"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, X, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  apiService,
  type BulkVisitCreateResult,
  type BulkVisitResultDetail,
  type EmployeeDto,
  type StoreDto,
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

const ASSIGNMENT_SOURCE = "WEB_ASSIGN_VISITS";
const ASSIGN_VISITS_EMPLOYEE_ID = 10000;

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

const getVisitAssignmentMeta = (visit: VisitDto) => {
  const assignedBy = visit.assignedByName
    ? `Assigned by ${visit.assignedByName}`
    : visit.assignedById
      ? `Assigned by #${visit.assignedById}`
      : "";
  const assignedTimestamp =
    visit.assignedAt ||
    [visit.assignedDate, visit.assignedTime].filter(Boolean).join(" ");
  const source = visit.assignmentSource ? `Source: ${visit.assignmentSource}` : "";
  return [assignedBy, assignedTimestamp, source].filter(Boolean).join(" • ");
};

const getVisitAssignmentLines = (visit: VisitDto) => {
  const assignedBy = visit.assignedByName
    ? `By ${visit.assignedByName}`
    : visit.assignedById
      ? `By #${visit.assignedById}`
      : "";
  const assignedTimestamp =
    visit.assignedAt ||
    [visit.assignedDate, visit.assignedTime].filter(Boolean).join(" ");
  const assignedAt = assignedTimestamp ? `At ${assignedTimestamp.replace("T", " ")}` : "";
  const source = visit.assignmentSource ? `Source ${visit.assignmentSource.replace(/_/g, " ")}` : "";
  return [assignedBy, assignedAt, source].filter(Boolean);
};

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
  const { userRole, currentUser, isLoading: authLoading, isAuthenticated, token } = useAuth();
  
  // State for real data
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [existingVisits, setExistingVisits] = useState<VisitGridState>({});
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const initialStartDateRef = useRef<Date | null>(null);
  if (!initialStartDateRef.current) {
    initialStartDateRef.current = startDate;
  }
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

  const goToPreviousRange = useCallback(() => {
    if (!initialStartDateRef.current) return;
    if (startDate.getTime() <= initialStartDateRef.current.getTime()) return;
    moveDateRange(-15);
  }, [moveDateRange, startDate]);
  const goToNextRange = useCallback(() => moveDateRange(15), [moveDateRange]);

  const dateRangeLabel = useMemo(() => {
    if (dateCols.length === 0) return "";
    const startLabel = dateCols[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endLabel = dateCols[dateCols.length - 1].date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${startLabel} - ${endLabel}`;
  }, [dateCols]);

  const canGoPrevious = useMemo(() => {
    if (!initialStartDateRef.current) return false;
    return startDate.getTime() > initialStartDateRef.current.getTime();
  }, [startDate]);

  useEffect(() => {
    setNoVisitFilters((prev) => {
      const validKeys = new Set(dateCols.map(col => col.key));
      const entries = Object.entries(prev).filter(([key]) => validKeys.has(key));
      if (entries.length === Object.keys(prev).length) {
        return prev;
      }
      return entries.reduce<Record<string, boolean>>((acc, [key, value]) => {
        if (value) acc[key] = true;
        return acc;
      }, {});
    });
  }, [dateCols]);

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
  const [noVisitFilters, setNoVisitFilters] = useState<Record<string, boolean>>({});

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
    return sorted.filter(emp =>
      `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase().includes(search)
    );
  }, [employees, employeeSearch]);

  const filteredByVisitEmployees = useMemo(() => {
    const activeFilters = Object.entries(noVisitFilters)
      .filter(([, value]) => value)
      .map(([key]) => key);

    if (activeFilters.length === 0) {
      return filteredEmployees;
    }

    return filteredEmployees.filter(emp =>
      activeFilters.every(dateKey => {
        const assignmentKey = `${emp.id}-${dateKey}`;
        const hasAssignment = Boolean(assignments[assignmentKey]);
        const hasExistingVisit = (existingVisits[emp.id]?.[dateKey]?.length ?? 0) > 0;
        return !hasAssignment && !hasExistingVisit;
      })
    );
  }, [filteredEmployees, noVisitFilters, assignments, existingVisits]);

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

  const toggleNoVisitFilter = useCallback((dateKey: string, value: boolean) => {
    setNoVisitFilters(prev => {
      if (value) {
        if (prev[dateKey]) return prev;
        return { ...prev, [dateKey]: true };
      }
      if (!prev[dateKey]) return prev;
      const { [dateKey]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCell, setModalCell] = useState<{ employee: EmployeeDto; dateKey: string } | null>(null);
  const [storeQuery, setStoreQuery] = useState('');
  const [loadingStores, setLoadingStores] = useState(false);

  const loadStoresForEmployee = useCallback(async (employeeId: number, search: string) => {
    setLoadingStores(true);
    try {
      const employeeStores = await apiService.getDealersForEmployee(employeeId, {
        search,
        page: 0,
        size: 50,
      });
      setStores(employeeStores);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Assign Visits</h1>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="secondary">{Object.keys(assignments).length} pending</Badge>
          )}
          <Button onClick={saveChanges} disabled={!dirty || saving}>
            {saving ? (
              <>
                <Save className="mr-2 h-4 w-4 animate-pulse" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={goToPreviousRange} disabled={!canGoPrevious}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous 15 Days
          </Button>
          <div className="text-sm text-muted-foreground">{dateRangeLabel}</div>
          <Button variant="outline" onClick={goToNextRange}>
            Next 15 Days
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <Input
          className="w-full max-w-xs"
          placeholder="Search employees..."
          value={employeeSearch}
          onChange={(e) => setEmployeeSearch(e.target.value)}
        />
      </div>

      {saveSummary && (
        <div
          className={[
            "rounded border p-3 text-sm",
            saveSummary.failed > 0 || saveSummary.skipped > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-green-200 bg-green-50 text-green-900",
          ].join(" ")}
        >
          <div className="font-medium">
            Save result: {saveSummary.created} created, {saveSummary.skipped} skipped, {saveSummary.failed} failed
          </div>
          {saveSummary.message && (
            <div className="mt-1 text-xs opacity-80">{saveSummary.message}</div>
          )}
          {saveSummary.reasons.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {saveSummary.reasons.map((reason, index) => (
                <li key={`${reason.status}-${index}`}>
                  <span className="font-medium capitalize">{reason.status}:</span> {reason.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      <div className="overflow-auto rounded border">
        <table className="min-w-[1200px] w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 bg-muted/50 backdrop-blur px-3 py-2 text-left">Employee</th>
              {dateCols.map(col => {
                const isNoVisitActive = Boolean(noVisitFilters[col.key]);
                const headerClassNames = [
                  "px-2 py-2 text-center align-top w-32",
                  col.isSunday ? "bg-red-50 text-red-700" : "",
                  isNoVisitActive ? "ring-1 ring-primary/40" : "",
                ].join(" ").trim();

                return (
                  <th key={col.key} className={headerClassNames}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="font-medium">{formatDayLabel(col.date)}</div>
                      <div className="text-xs">{col.date.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <Checkbox
                          id={`no-visit-${col.key}`}
                          className="h-3.5 w-3.5"
                          checked={isNoVisitActive}
                          onCheckedChange={(checked) => toggleNoVisitFilter(col.key, checked === true)}
                        />
                        <label
                          htmlFor={`no-visit-${col.key}`}
                          className="cursor-pointer select-none"
                        >
                          No visit
                        </label>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groupedEmployees.length === 0 ? (
              <tr>
                <td colSpan={dateCols.length + 1} className="px-3 py-8 text-center text-muted-foreground">
                  {loading ? 'Loading employees...' : 'No employees found for your role.'}
                </td>
              </tr>
            ) : (
              groupedEmployees.map(({ city, employees }) => (
                <React.Fragment key={city}>
                  <tr>
                    <td className="bg-muted/40 px-3 py-2 font-semibold sticky left-0">{city}</td>
                    {dateCols.map(col => (
                      <td key={`${city}-${col.key}`} className={`${col.isSunday ? 'bg-red-50/40' : ''}`}></td>
                    ))}
                  </tr>
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 sticky left-0 bg-background/90 backdrop-blur whitespace-nowrap">{emp.firstName} {emp.lastName}</td>
                      {dateCols.map(col => {
                        const key = `${emp.id}-${col.key}`;
                        const assigned = assignments[key];
                        const existingVisitList = existingVisits[emp.id]?.[col.key] ?? [];
                        const isNoVisitActive = Boolean(noVisitFilters[col.key]);
                        
                        return (
                          <td
                            key={key}
                            className={[
                              "px-2 py-1 text-center",
                              col.isSunday ? "bg-red-50/40" : "",
                              isNoVisitActive ? "bg-primary/5" : "",
                            ].join(" ").trim()}
                          >
                            {existingVisitList.length > 0 ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                {existingVisitList.map((visit, index) => {
                                  const visitName = visit.storeName || (visit.storeId ? `Store #${visit.storeId}` : "Visit");
                                  const statusLabel = getVisitStatusLabel(visit);
                                  const meta = getVisitAssignmentMeta(visit);
                                  const metaLines = getVisitAssignmentLines(visit);
                                  const title = [visitName, statusLabel, meta].filter(Boolean).join("\n");

                                  return (
                                    <div
                                      key={`${visit.id ?? visit.storeId ?? visitName}-${index}`}
                                      className="w-full max-w-[190px] rounded-md bg-secondary px-2 py-1 text-left text-xs text-secondary-foreground cursor-help"
                                      title={title}
                                    >
                                      <div className="truncate font-medium">{visitName}</div>
                                      <div className="text-[10px] opacity-80">{statusLabel}</div>
                                      {metaLines.map((line) => (
                                        <div key={line} className="truncate text-[10px] opacity-70">{line}</div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : assigned ? (
                              <div className="flex items-center justify-center gap-1">
                                <div
                                  className={[
                                    "max-w-[170px] rounded-md px-2 py-1 text-left text-xs cursor-help",
                                    assigned.saveStatus === "failed"
                                      ? "bg-red-50 text-red-700"
                                      : assigned.saveStatus === "skipped"
                                        ? "bg-amber-50 text-amber-800"
                                        : "bg-muted text-foreground",
                                  ].join(" ")}
                                  title={[assigned.store.storeName, assigned.saveReason].filter(Boolean).join("\n")}
                                >
                                  <div className="truncate font-medium">{assigned.store.storeName}</div>
                                  <div className="text-[10px] opacity-80">
                                    {assigned.saveStatus === "failed"
                                      ? "Failed"
                                      : assigned.saveStatus === "skipped"
                                        ? "Skipped"
                                        : "Pending save"}
                                  </div>
                                  {assigned.saveReason && (
                                    <div className="truncate text-[10px] opacity-75">{assigned.saveReason}</div>
                                  )}
                                </div>
                                <Button size="icon" variant="ghost" onClick={() => removeAssignment(emp.id, col.key)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : col.isSunday ? (
                              <div className="flex h-9 items-center justify-center">
                                <span className="sr-only">Assignments disabled on Sundays</span>
                              </div>
                            ) : (
                              <Button size="icon" variant="outline" onClick={() => openCellModal(emp, col.key)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Store for {modalCell?.employee.firstName} {modalCell?.employee.lastName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search by store name, city, or type..."
              value={storeQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <div className="space-y-2">
              {storeQuery && (
                <div className="text-xs text-muted-foreground">
                  {stores.length} stores found
                </div>
              )}
              <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
                {loadingStores ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm">Loading stores...</span>
                  </div>
                ) : stores.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {storeQuery ? 'No stores match your search.' : 'No stores available for this employee.'}
                  </div>
                ) : (
                  stores.map(s => (
                    <div key={s.storeId} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted cursor-pointer" onClick={() => assignStore(s)}>
                      <div>
                        <div className="font-medium text-sm">{s.storeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.city} • {s.clientType || 'Dealer'}
                        </div>
                      </div>
                      <Button size="sm" variant="outline">Assign</Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
