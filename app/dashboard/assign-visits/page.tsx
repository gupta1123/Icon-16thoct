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
import { apiService, type EmployeeDto, type StoreDto, type VisitDto, type TeamHierarchyResponse, type ScopedEmployee } from "@/lib/api";

// Using the actual types from API
type Store = StoreDto;

function formatDateKey(d: Date) {
  return d.toISOString().slice(0, 10); // yyyy-MM-dd
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AssignVisitsPage() {
  const { userRole, currentUser, isLoading: authLoading, isAuthenticated, token } = useAuth();
  
  // State for real data
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [existingVisits, setExistingVisits] = useState<Record<number, Record<string, VisitDto | null>>>({});
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
          const hierarchyData: TeamHierarchyResponse = await apiService.getTeamHierarchyScoped();
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
          const visitsData = await apiService.bulkGetForGrid(employeeIds, startKey, endKey);
          setExistingVisits(visitsData);
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

  // Assignments state: key = `${empId}-${dateKey}` => store
  type CellKey = string;
  type Assignment = { employeeId: number; dateKey: string; store: Store };
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
        const hasExistingVisit = Boolean(existingVisits[emp.id]?.[dateKey]);
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
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const openCellModal = async (employee: EmployeeDto, dateKey: string) => {
    const column = dateCols.find((col) => col.key === dateKey);
    if (column?.isSunday) {
      return; // Do not allow adding on Sundays
    }
    setModalCell({ employee, dateKey });
    setStoreQuery('');
    setLoadingStores(true);
    setModalOpen(true);
    
    try {
      // Load stores for this specific employee
      const employeeStores = await apiService.getDealersForEmployee(employee.id);
      setStores(employeeStores);
    } catch (err) {
      console.error('Error loading stores for employee:', err);
      setError('Failed to load stores for this employee');
    } finally {
      setLoadingStores(false);
    }
  };

  // Debounced search with better filtering
  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return stores.slice(0, 50); // Show first 50 stores by default
    
    return stores
      .filter(s => {
        const storeName = s.storeName.toLowerCase();
        const city = s.city.toLowerCase();
        const clientType = (s.clientType || '').toLowerCase();
        
        return storeName.includes(q) || 
               city.includes(q) || 
               clientType.includes(q);
      })
      .slice(0, 100); // Limit to 100 results for performance
  }, [stores, storeQuery]);

  // Handle search input with debouncing
  const handleSearchChange = (value: string) => {
    setStoreQuery(value);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debouncing
    const timeout = setTimeout(() => {
      // Search is automatically handled by the useMemo above
    }, 300);
    
    setSearchTimeout(timeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const assignStore = (store: Store) => {
    if (!modalCell) return;
    const key = `${modalCell.employee.id}-${modalCell.dateKey}`;
    setAssignments(prev => ({ ...prev, [key]: { employeeId: modalCell.employee.id, dateKey: modalCell.dateKey, store } }));
    setDirty(true);
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
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

  const saveChanges = async () => {
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    
    try {
      const toCreate = Object.values(assignments);
      
      // Convert assignments to VisitDto format
      const visitDtos: VisitDto[] = toCreate.map(assignment => ({
        employeeId: assignment.employeeId,
        storeId: assignment.store.storeId,
        visit_date: assignment.dateKey,
        scheduledStartTime: '10:00:00', // Default time
        scheduledEndTime: '11:00:00',   // Default time
        purpose: 'Assigned Visit',
        priority: 'MEDIUM',
        isSelfGenerated: false,
      } as VisitDto));
      
      // Call the bulk create API
      const result = await apiService.bulkCreateVisits(visitDtos);
      
      setDirty(false);
      setSaveMessage(`Successfully created ${result.created} visits${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
      
      // Clear assignments and reload data
      setAssignments({});
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

      {saveMessage && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{saveMessage}</div>
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
                        const existingVisit = existingVisits[emp.id]?.[col.key];
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
                            {existingVisit ? (
                              <div className="flex items-center justify-center">
                                <div 
                                  className="max-w-[180px] px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-medium truncate cursor-help"
                                  title={existingVisit.storeName}
                                >
                                  {existingVisit.storeName}
                                </div>
                              </div>
                            ) : assigned ? (
                              <div className="flex items-center justify-center gap-1">
                                <div 
                                  className="max-w-[160px] px-2 py-1 bg-outline text-foreground rounded-md text-xs font-medium truncate cursor-help"
                                  title={assigned.store.storeName}
                                >
                                  {assigned.store.storeName}
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
                  {filteredStores.length} stores found
                  {stores.length > filteredStores.length && ` (showing first ${filteredStores.length})`}
                </div>
              )}
              <div className="max-h-64 overflow-auto border rounded p-2 space-y-1">
                {loadingStores ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2 text-sm">Loading stores...</span>
                  </div>
                ) : filteredStores.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    {storeQuery ? 'No stores match your search.' : 'No stores available for this employee.'}
                  </div>
                ) : (
                  filteredStores.map(s => (
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
