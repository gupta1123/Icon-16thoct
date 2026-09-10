"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, Archive, Settings, Plus, Loader2, XCircle, Filter, MoreHorizontal, Eye, Phone, Mail, Building, Calendar, MapPin } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import AddTeam from "@/components/AddTeam";
import SearchableSelect, { type SearchableOption } from "@/components/searchable-select";
import { API_BASE_URL } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeRoleValue } from "@/lib/role-utils";
import { useAuth } from "@/components/auth-provider";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentName: string;
  userName: string;
  password: string;
  primaryContact: string;
  dateOfJoining: string;
  name: string;
  department: string;
  actions: string;
  assignedCity?: string[];
  city: string;
  state: string;
  userDto: {
    username: string;
    password: string | null;
    roles: string | null;
    employeeId: number | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface TeamData {
  id: number;
  office: {
    id: number;
    firstName: string;
    lastName: string;
  };
  fieldOfficers: User[];
}

const EMPLOYEE_LIST_STATE_KEY = "employeeListState";
const EMPLOYEE_LIST_RETURN_CONTEXT_KEY = "employeeListReturnContext";

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={displayValue}>{displayValue}</span>;
}

const toSentenceCase = (text: string): string => {
  if (!text) return text;
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function EmployeeList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEditId = searchParams.get('edit');
  const openedEditId = useRef<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("all");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState(['name', 'role', 'userName', 'primaryContact', 'city', 'state', 'actions']);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof User>('firstName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAssignCityModalOpen, setIsAssignCityModalOpen] = useState(false);
  const [userToAssignCity, setUserToAssignCity] = useState<User | null>(null);
  const [selectedCityToAssign, setSelectedCityToAssign] = useState<string>("");
  const [isAssigningCity, setIsAssigningCity] = useState(false);
  const [archivedEmployees, setArchivedEmployees] = useState<User[]>([]);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
  const [isEditUsernameModalOpen, setIsEditUsernameModalOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState<{ id: number; username: string } | null>(null);
  const [expandedCards, setExpandedCards] = useState<number[]>([]);

  useEffect(() => {
    if (!requestedEditId || openedEditId.current === requestedEditId || isLoading) return;
    const employee = users.find(user => String(user.id) === requestedEditId);
    if (!employee) return;
    openedEditId.current = requestedEditId;
    setEditingEmployee({ ...employee, name: `${employee.firstName} ${employee.lastName}` });
    setIsEditModalOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit');
    router.replace(params.size ? `/dashboard/employees?${params}` : '/dashboard/employees', { scroll: false });
  }, [requestedEditId, isLoading, users, router, searchParams]);

  const cityOptions = useMemo<SearchableOption<string>[]>(() =>
    cities.map((city) => ({
      value: city,
      label: city,
      data: city,
    })),
  [cities]);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  const employeeId = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;

  const { token: authToken } = useAuth();
  const [isDataManager, setIsDataManager] = useState(false);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/user/manage/current-user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const userData = await response.json();
          const authorities = userData.authorities || [];
          const roles: string[] = authorities.map((a: { authority: string }) => a.authority);
          setIsDataManager(roles.includes('ROLE_DATA_MANAGER'));
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, [token]);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (role === 'MANAGER' || role === 'AVP') {
        const response = await fetch(`${API_BASE_URL}/employee/team/getByEmployee?id=${employeeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch team data');
        const teamDataList: TeamData[] = await response.json();
        if (!teamDataList || teamDataList.length === 0) throw new Error('No team data found for the manager');
        const team = teamDataList[0];
        setTeamData(team);
        setUsers(team.fieldOfficers.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
      } else {
        const response = await fetch(`${API_BASE_URL}/employee/getAll`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch employees');
        const data: User[] = await response.json();
        if (!data) throw new Error('No data received when fetching all employees');
        setUsers(data.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [token, role, employeeId]);

  const fetchArchivedEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee/getAllInactive`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setArchivedEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching archived employees:', error);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee/getCities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const citiesData = await response.json();
        setCities(citiesData);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchCities();
    }
  }, [token, fetchEmployees]);

  const showDeleteConfirmation = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const response = await fetch(`${API_BASE_URL}/employee/delete?id=${userToDelete.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        setUsers((prev) => prev.filter((user) => user.id !== userToDelete.id));
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const openAssignCityModal = (user: User) => {
    setUserToAssignCity(user);
    setSelectedCityToAssign("");
    setIsAssignCityModalOpen(true);
  };

  const handleAssignCity = async () => {
    if (!userToAssignCity || !selectedCityToAssign) return;
    setIsAssigningCity(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/employee/assignCity?id=${userToAssignCity.id}&city=${encodeURIComponent(selectedCityToAssign)}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        await fetchEmployees();
        setIsAssignCityModalOpen(false);
        setUserToAssignCity(null);
        setSelectedCityToAssign("");
      }
    } catch (error) {
      console.error('Error assigning city:', error);
    } finally {
      setIsAssigningCity(false);
    }
  };

  const cancelAssignCity = () => {
    setIsAssignCityModalOpen(false);
    setUserToAssignCity(null);
    setSelectedCityToAssign("");
  };

  const toggleCardExpansion = (userId: number) => {
    setExpandedCards(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleResetPasswordSubmit = async () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/user/manage/update`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: users.find(user => user.id === resetPasswordUserId)?.userName,
          password: newPassword
        })
      });
      if (response.ok) {
        setIsResetPasswordOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEmployee) return;
    try {
      const response = await fetch(`${API_BASE_URL}/employee/edit?empId=${editingEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: editingEmployee.firstName,
          lastName: editingEmployee.lastName,
          email: editingEmployee.email,
          role: formatRoleForPayload(editingEmployee.role),
          departmentName: editingEmployee.departmentName,
          userName: editingEmployee.userName,
          primaryContact: editingEmployee.primaryContact,
          city: editingEmployee.city,
          state: editingEmployee.state,
          dateOfJoining: editingEmployee.dateOfJoining,
        })
      });
      if (response.ok) {
        setUsers(prev => prev.map(user => (user.id === editingEmployee.id ? editingEmployee : user)));
        setIsEditModalOpen(false);
      }
    } catch (error) {
      console.error('Error updating employee:', error);
    }
  };

  const handleUnarchive = async (employeeId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/employee/setActive?id=${employeeId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchArchivedEmployees();
        fetchEmployees();
      }
    } catch (error) {
      console.error('Error unarchiving employee:', error);
    }
  };

  const handleSaveUsername = async () => {
    if (!editingUsername?.username.trim()) return;
    try {
      setIsLoading(true);
      const encodedUsername = encodeURIComponent(editingUsername.username.trim());
      const response = await fetch(
        `${API_BASE_URL}/employee/editUsername?id=${editingUsername.id}&username=${encodedUsername}`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        setIsEditUsernameModalOpen(false);
        setEditingUsername(null);
        fetchEmployees();
      }
    } catch (error) {
      console.error('Error updating username:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() || 'E';
  };

  const transformRole = (role: string) => {
    if (!role) return '';
    const roleLower = role.toLowerCase().trim();
    const roleMap: Record<string, string> = {
      'hr': 'HR',
      'regional manager': 'Regional Manager',
      'regional_manager': 'Regional Manager',
      'office manager': 'Office Manager',
      'manager': 'Regional Manager',
      'coordinator': 'Coordinator',
      'data manager': 'Data Manager',
      'data_manager': 'Data Manager',
      'field officer': 'Field Officer',
      'field_officer': 'Field Officer',
      'avp': 'AVP'
    };
    return roleMap[roleLower] || role;
  };

  const formatRoleForPayload = (role: string) => {
    const normalizedRole = role.trim().replace(/\s+/g, '_').toUpperCase();
    const roleMap: Record<string, string> = {
      HR: 'HR',
      AVP: 'AVP',
      REGIONAL_MANAGER: 'Regional Manager',
      OFFICE_MANAGER: 'Office Manager',
      MANAGER: 'Manager',
      COORDINATOR: 'Coordinator',
      DATA_MANAGER: 'Data Manager',
      FIELD_OFFICER: 'Field Officer',
    };
    return roleMap[normalizedRole] || role.trim().replace(/_/g, ' ');
  };

  const getRoleBadgeColor = (role?: string) => {
    const roleLower = (role ?? '').toLowerCase().trim();
    if (roleLower.includes('regional') || roleLower.includes('manager')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (roleLower.includes('field') || roleLower.includes('officer')) return 'bg-green-100 text-green-800 border-green-200';
    if (roleLower.includes('avp')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (roleLower.includes('hr')) return 'bg-pink-100 text-pink-800 border-pink-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const handleSort = (column: keyof User) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingEmployee(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleEditUser = (user: User) => {
    setEditingEmployee({ ...user, name: `${user.firstName} ${user.lastName}` });
    setIsEditModalOpen(true);
  };

  const handleResetPassword = (userId: number | string) => {
    setResetPasswordUserId(userId);
    setIsResetPasswordOpen(true);
  };

  const handleEditUsername = (userId: number, currentUsername: string) => {
    setEditingUsername({ id: userId, username: currentUsername });
    setIsEditUsernameModalOpen(true);
  };

  const handleViewUser = (userId: number) => {
    router.push(`/dashboard/employee/${userId}`);
  };

  const roles = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => { if (u.role) set.add(transformRole(u.role)); });
    return Array.from(set).sort();
  }, [users]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => { if (u.city) set.add(u.city); });
    return Array.from(set).sort();
  }, [users]);

  const uniqueStates = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => { if (u.state) set.add(u.state); });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.toLowerCase();
      const roleStr = transformRole(user.role).toLowerCase();
      const emailStr = (user.email ?? '').toLowerCase();
      const userNameStr = (user.userName ?? '').toLowerCase();
      const cityStr = (user.city ?? '').toLowerCase();
      const stateStr = (user.state ?? '').toLowerCase();

      const matchesSearch = !q || fullName.includes(q) || roleStr.includes(q) || emailStr.includes(q) || userNameStr.includes(q);
      const matchesRole = selectedRoleFilter === 'all' || transformRole(user.role) === selectedRoleFilter;
      const matchesCity = selectedCityFilter === 'all' || user.city === selectedCityFilter;
      const matchesState = selectedStateFilter === 'all' || user.state === selectedStateFilter;

      return matchesSearch && matchesRole && matchesCity && matchesState;
    });
  }, [users, searchQuery, selectedRoleFilter, selectedCityFilter, selectedStateFilter]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / itemsPerPage));
  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);

  const filteredArchivedEmployees = useMemo(() => {
    const q = archiveSearchQuery.trim().toLowerCase();
    return archivedEmployees.filter((emp) =>
      !q || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
      emp.role.toLowerCase().includes(q) ||
      (emp.city ?? '').toLowerCase().includes(q)
    );
  }, [archivedEmployees, archiveSearchQuery]);

  return (
    <Card className="gap-0 border-border/70 py-0 shadow-sm">
      <CardContent className="space-y-4 p-4">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!isDataManager && (
              <Button
                size="sm"
                onClick={() => router.push('/dashboard/employees/add')}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            )}
            {!isDataManager && <AddTeam />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAreFiltersVisible((visible) => !visible)}>
              <Filter className="mr-2 h-4 w-4" />
              {areFiltersVisible ? 'Hide Filters' : 'Show Filters'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                {[
                  ['name', 'Name'],
                  ['role', 'Role'],
                  ['userName', 'Username'],
                  ['primaryContact', 'Phone'],
                  ['city', 'City'],
                  ['state', 'State'],
                  ['assignedCities', 'Assigned Cities'],
                  ['actions', 'Actions'],
                ].map(([key, label]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={selectedColumns.includes(key)}
                    onCheckedChange={() => {
                      if (selectedColumns.includes(key)) {
                        setSelectedColumns(selectedColumns.filter((col) => col !== key));
                      } else {
                        setSelectedColumns([...selectedColumns, key]);
                      }
                    }}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsArchivedModalOpen(true);
                fetchArchivedEmployees();
              }}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div>}

        {/* Filter Card Grid */}
        {areFiltersVisible && (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative min-w-0">
                <Label htmlFor="employee-search" className="sr-only">Search</Label>
                <Input
                  id="employee-search"
                  type="search"
                  autoComplete="off"
                  placeholder="Search name, email, or role"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 bg-background pr-8 text-xs shadow-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="min-w-0">
                <Label className="sr-only">Role</Label>
                <Select
                  value={selectedRoleFilter}
                  onValueChange={(val) => {
                    setSelectedRoleFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 bg-background text-xs shadow-none">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0">
                <Label className="sr-only">City</Label>
                <Select
                  value={selectedCityFilter}
                  onValueChange={(val) => {
                    setSelectedCityFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 bg-background text-xs shadow-none">
                    <SelectValue placeholder="All cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {uniqueCities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0">
                <Label className="sr-only">State</Label>
                <Select
                  value={selectedStateFilter}
                  onValueChange={(val) => {
                    setSelectedStateFilter(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 bg-background text-xs shadow-none">
                    <SelectValue placeholder="All states" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden min-w-0 md:block">
          <Table className="table-fixed text-xs font-poppins">
            <colgroup>
              {selectedColumns.includes('name') && <col className="w-[20%]" />}
              {selectedColumns.includes('role') && <col className="w-[15%]" />}
              {selectedColumns.includes('userName') && <col className="w-[14%]" />}
              {selectedColumns.includes('primaryContact') && <col className="w-[13%]" />}
              {selectedColumns.includes('city') && <col className="w-[12%]" />}
              {selectedColumns.includes('state') && <col className="w-[11%]" />}
              {selectedColumns.includes('assignedCities') && <col className="w-[10%]" />}
              {selectedColumns.includes('actions') && <col className="w-[5%]" />}
            </colgroup>
            <TableHeader>
              <TableRow>
                {selectedColumns.includes('name') && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('firstName')}>
                    Name {sortColumn === 'firstName' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                )}
                {selectedColumns.includes('role') && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('role')}>
                    Role {sortColumn === 'role' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                )}
                {selectedColumns.includes('userName') && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('userName')}>
                    Username {sortColumn === 'userName' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                )}
                {selectedColumns.includes('primaryContact') && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('primaryContact')}>
                    Phone {sortColumn === 'primaryContact' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                )}
                {selectedColumns.includes('city') && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('city')}>
                    City {sortColumn === 'city' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                )}
                {selectedColumns.includes('state') && (
                  <TableHead className="cursor-pointer" onClick={() => handleSort('state')}>
                    State {sortColumn === 'state' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                  </TableHead>
                )}
                {selectedColumns.includes('assignedCities') && <TableHead>Assigned Cities</TableHead>}
                {selectedColumns.includes('actions') && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {selectedColumns.map((col) => (
                      <TableCell key={col}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : currentUsers.length > 0 ? (
                currentUsers.map((user) => {
                  const normalizedRole = normalizeRoleValue(user.role ?? null);
                  const showAssignedCities = normalizedRole === "FIELD_OFFICER" || normalizedRole === "REGIONAL_MANAGER";
                  const canAssignCities = normalizedRole === "FIELD_OFFICER";

                  return (
                    <TableRow key={user.id}>
                      {selectedColumns.includes('name') && (
                        <TableCell className="font-medium">
                          <button onClick={() => handleViewUser(user.id)} className="hover:underline text-left">
                            <Ellipsis value={`${user.firstName} ${user.lastName}`} />
                          </button>
                        </TableCell>
                      )}
                      {selectedColumns.includes('role') && (
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs border ${getRoleBadgeColor(user.role)}`}>
                            {transformRole(user.role)}
                          </Badge>
                        </TableCell>
                      )}
                      {selectedColumns.includes('userName') && <TableCell><Ellipsis value={user.userName} /></TableCell>}
                      {selectedColumns.includes('primaryContact') && <TableCell><Ellipsis value={user.primaryContact} /></TableCell>}
                      {selectedColumns.includes('city') && <TableCell><Ellipsis value={user.city} /></TableCell>}
                      {selectedColumns.includes('state') && <TableCell><Ellipsis value={user.state} /></TableCell>}
                      {selectedColumns.includes('assignedCities') && (
                        <TableCell>
                          {showAssignedCities ? (
                            user.assignedCity && user.assignedCity.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.assignedCity.map((city, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{city}</Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">None</span>
                                {canAssignCities && (
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openAssignCityModal(user)}>
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                      )}
                      {selectedColumns.includes('actions') && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewUser(user.id)}>
                                View employee
                              </DropdownMenuItem>
                              {!isDataManager && (
                                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                  Edit employee
                                </DropdownMenuItem>
                              )}
                              {!isDataManager && (
                                <DropdownMenuItem onClick={() => handleEditUsername(user.id, user.userName)}>
                                  Edit Username
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                                Reset Password
                              </DropdownMenuItem>
                              {canAssignCities && (
                                <DropdownMenuItem onClick={() => openAssignCityModal(user)}>
                                  Assign City
                                </DropdownMenuItem>
                              )}
                              {!isDataManager && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => showDeleteConfirmation(user)} className="text-destructive">
                                    Delete employee
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={selectedColumns.length} className="h-24 text-center text-muted-foreground">
                    No employees found matching the selected filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile View */}
        <div className="space-y-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
          ) : currentUsers.length > 0 ? (
            currentUsers.map((user) => (
              <Card key={user.id} className="overflow-hidden border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-muted text-xs font-semibold">{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.userName || '—'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`text-xs border shrink-0 ${getRoleBadgeColor(user.role)}`}>
                      {transformRole(user.role)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div><span className="text-muted-foreground">Phone</span><Ellipsis value={user.primaryContact} /></div>
                    <div><span className="text-muted-foreground">Location</span><Ellipsis value={[toSentenceCase(user.city), user.state].filter(Boolean).join(', ')} /></div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    {!isDataManager && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleEditUser(user)}>
                        Edit
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => handleViewUser(user.id)}>
                      View details
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUsername(user.id, user.userName)}>
                          Edit Username
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                          Reset Password
                        </DropdownMenuItem>
                        {normalizeRoleValue(user.role) === 'FIELD_OFFICER' && (
                          <DropdownMenuItem onClick={() => openAssignCityModal(user)}>
                            Assign City
                          </DropdownMenuItem>
                        )}
                        {!isDataManager && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => showDeleteConfirmation(user)} className="text-destructive">
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">No employees match the filters</div>
          )}
        </div>

        {/* Footer Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="pageSize" className="text-xs font-normal">Rows per page:</Label>
            <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(parseInt(val, 10))}>
              <SelectTrigger id="pageSize" className="h-8 w-16 text-xs shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-2">
              Showing {currentUsers.length} of {sortedUsers.length} employees
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs shadow-none"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Previous</span>
            </Button>
            <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs shadow-none"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <span className="hidden sm:inline">Next</span><ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter a new password for the user.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPasswordSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Employee</DialogTitle></DialogHeader>
          {editingEmployee && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" value={editingEmployee.firstName} onChange={handleEditInputChange} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" value={editingEmployee.lastName} onChange={handleEditInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" value={editingEmployee.email} onChange={handleEditInputChange} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="primaryContact">Primary Contact</Label>
                  <Input id="primaryContact" name="primaryContact" value={editingEmployee.primaryContact} onChange={handleEditInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={editingEmployee.role} onValueChange={(val) => setEditingEmployee({ ...editingEmployee, role: val })}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Regional Manager">Regional Manager</SelectItem>
                      <SelectItem value="Coordinator">Coordinator</SelectItem>
                      <SelectItem value="Data Manager">Data Manager</SelectItem>
                      <SelectItem value="Field Officer">Field Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dateOfJoining">Date of Joining</Label>
                  <Input id="dateOfJoining" name="dateOfJoining" type="date" value={editingEmployee.dateOfJoining} onChange={handleEditInputChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" value={editingEmployee.city} onChange={handleEditInputChange} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" value={editingEmployee.state} onChange={handleEditInputChange} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archived Employees Modal */}
      <Dialog open={isArchivedModalOpen} onOpenChange={setIsArchivedModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Archived Employees</DialogTitle>
            <DialogDescription>View and manage archived employees</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input placeholder="Search archived employees..." value={archiveSearchQuery} onChange={(e) => setArchiveSearchQuery(e.target.value)} className="max-w-md" />
              <Badge variant="secondary" className="h-9 px-3">{filteredArchivedEmployees.length} Results</Badge>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchivedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{`${employee.firstName} ${employee.lastName}`}</TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>{employee.departmentName}</TableCell>
                      <TableCell>{employee.city}</TableCell>
                      <TableCell>
                        {!isDataManager && (
                          <Button variant="outline" size="sm" onClick={() => handleUnarchive(employee.id)} className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Unarchive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredArchivedEmployees.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No archived employees found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Username Modal */}
      <Dialog open={isEditUsernameModalOpen} onOpenChange={setIsEditUsernameModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>Enter a new username for the employee.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newUsername">New Username</Label>
              <Input
                id="newUsername"
                value={editingUsername?.username || ''}
                onChange={(e) => setEditingUsername(prev => prev ? { ...prev, username: e.target.value } : null)}
                placeholder="Enter new username"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUsernameModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUsername} disabled={!editingUsername?.username.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.firstName} {userToDelete?.lastName}? This action will archive the employee.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelDelete}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Delete Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign City Modal */}
      <Dialog open={isAssignCityModalOpen} onOpenChange={setIsAssignCityModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign City</DialogTitle>
            <DialogDescription>Assign a city to {userToAssignCity?.firstName} {userToAssignCity?.lastName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="city-select">Select City</Label>
              <SearchableSelect<string>
                options={cityOptions}
                value={selectedCityToAssign || undefined}
                onSelect={(option) => setSelectedCityToAssign(option?.value || "")}
                placeholder="Choose a city"
                searchPlaceholder="Search cities..."
                triggerClassName="w-full"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelAssignCity}>Cancel</Button>
            <Button onClick={handleAssignCity} disabled={!selectedCityToAssign || isAssigningCity}>
              {isAssigningCity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Assign City'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
