"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MapPin, Calendar, Building, User, ArrowLeft, Eye, EyeOff, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MoreHorizontal, Filter, Loader2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AddTeam from "@/components/AddTeam";
import SearchableSelect, { type SearchableOption } from "@/components/searchable-select";
import { API, type StateDto, type DistrictDto, type SubDistrictDto, type CityDto } from "@/lib/api";
import { useRouter } from "next/navigation";
import { normalizeRoleValue } from "@/lib/role-utils";

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

interface OfficeManager {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  email: string;
  deleted?: boolean;
  role?: string;
}

const EMPLOYEE_LIST_STATE_KEY = "employeeListState";
const EMPLOYEE_LIST_RETURN_CONTEXT_KEY = "employeeListReturnContext";
const SORTABLE_COLUMNS: Array<keyof User> = [
  'firstName',
  'role',
  'userName',
  'primaryContact',
  'city',
  'state',
];
const ALL_COLUMN_KEYS = ['name', 'email', 'city', 'state', 'role', 'assignedCities', 'department', 'userName', 'dateOfJoining', 'primaryContact', 'actions'] as const;
const INITIAL_MOBILE_FILTERS = {
  name: '',
  role: '',
  city: '',
  state: '',
  email: '',
};

export default function EmployeeList() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [officeManager, setOfficeManager] = useState<OfficeManager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  const [mobileFilters, setMobileFilters] = useState(INITIAL_MOBILE_FILTERS);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState(['name', 'email', 'city', 'state', 'role', 'assignedCities', 'department', 'userName', 'dateOfJoining', 'primaryContact', 'actions']);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof User>('firstName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [assignCityUserId, setAssignCityUserId] = useState<number | null>(null);
  const [assignCityUserName, setAssignCityUserName] = useState<string>("");
  const [city, setCity] = useState("");
  const [assignedCity, setAssignedCity] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [assignedCities, setAssignedCities] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('tab1');
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
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [primaryContactError, setPrimaryContactError] = useState<string | null>(null);
  const [secondaryContactError, setSecondaryContactError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<number[]>([]);
  const [isRestoringState, setIsRestoringState] = useState(true);

  // Location state for employee
  const [employeeStates, setEmployeeStates] = useState<StateDto[]>([]);
  const [employeeDistricts, setEmployeeDistricts] = useState<DistrictDto[]>([]);
  const [isLoadingEmployeeStates, setIsLoadingEmployeeStates] = useState(false);
  const [isLoadingEmployeeDistricts, setIsLoadingEmployeeDistricts] = useState(false);
  const [selectedEmployeeStateId, setSelectedEmployeeStateId] = useState<number | null>(null);
  const [selectedEmployeeDistrictId, setSelectedEmployeeDistrictId] = useState<number | null>(null);
  const employeeStateOptions = useMemo<SearchableOption<StateDto>[]>(() =>
    employeeStates.map((state) => ({
      value: state.id.toString(),
      label: state.stateName,
      data: state,
    })),
  [employeeStates]);
  const employeeDistrictOptions = useMemo<SearchableOption<DistrictDto>[]>(() =>
    employeeDistricts.map((district) => ({
      value: district.id.toString(),
      label: district.districtName,
      data: district,
    })),
  [employeeDistricts]);

  // Additional state for new employee form
  const initialNewEmployeeState = {
    firstName: "",
    lastName: "",
    primaryContact: "",
    secondaryContact: "",
    departmentName: "",
    email: "",
    role: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    dateOfJoining: "",
    userName: "",
    password: "",
    subDistrict: "",
  };
  const [newEmployee, setNewEmployee] = useState(initialNewEmployeeState);

  // Get auth data from localStorage instead of Redux
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  const employeeId = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
  const officeManagerId = typeof window !== 'undefined' ? localStorage.getItem('officeManagerId') : null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsRestoringState(false);
      return;
    }

    try {
      const storedState = window.localStorage.getItem(EMPLOYEE_LIST_STATE_KEY);
      if (!storedState) {
        return;
      }

      const parsed = JSON.parse(storedState) as {
        searchQuery?: unknown;
        currentPage?: unknown;
        itemsPerPage?: unknown;
        selectedColumns?: unknown;
        sortColumn?: unknown;
        sortDirection?: unknown;
        mobileFilters?: unknown;
      };

      if (typeof parsed.searchQuery === 'string') {
        setSearchQuery(parsed.searchQuery);
      }

      if (typeof parsed.currentPage === 'number' && Number.isFinite(parsed.currentPage) && parsed.currentPage > 0) {
        setCurrentPage(parsed.currentPage);
      }

      if (typeof parsed.itemsPerPage === 'number' && Number.isFinite(parsed.itemsPerPage) && parsed.itemsPerPage > 0) {
        setItemsPerPage(parsed.itemsPerPage);
      }

      if (Array.isArray(parsed.selectedColumns)) {
        const validColumns = parsed.selectedColumns.filter(
          (column): column is typeof ALL_COLUMN_KEYS[number] =>
            typeof column === 'string' && (ALL_COLUMN_KEYS as readonly string[]).includes(column)
        );
        if (validColumns.length > 0) {
          setSelectedColumns(validColumns.slice());
        }
      }

      if (typeof parsed.sortColumn === 'string' && SORTABLE_COLUMNS.includes(parsed.sortColumn as keyof User)) {
        setSortColumn(parsed.sortColumn as keyof User);
      }

      if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') {
        setSortDirection(parsed.sortDirection);
      }

      if (parsed.mobileFilters && typeof parsed.mobileFilters === 'object' && parsed.mobileFilters !== null) {
        const nextFilters = { ...INITIAL_MOBILE_FILTERS };
        (['name', 'role', 'city', 'state', 'email'] as const).forEach((key) => {
          const value = (parsed.mobileFilters as Record<string, unknown>)[key];
          if (typeof value === 'string') {
            nextFilters[key] = value;
          }
        });
        setMobileFilters(nextFilters);
      }
    } catch (error) {
      console.error('Failed to restore employee list state:', error);
    } finally {
      setIsRestoringState(false);
    }
  }, []);

  useEffect(() => {
    if (isRestoringState) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
      searchQuery,
      currentPage,
      itemsPerPage,
      selectedColumns,
      sortColumn,
      sortDirection,
      mobileFilters,
    };

    try {
      window.localStorage.setItem(EMPLOYEE_LIST_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist employee list state:', error);
    }
  }, [searchQuery, currentPage, itemsPerPage, selectedColumns, sortColumn, sortDirection, mobileFilters, isRestoringState]);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (role === 'MANAGER' || role === 'AVP') {
        const response = await fetch(`/api/proxy/employee/team/getByEmployee?id=${employeeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch team data');
        }

        const teamData: TeamData[] = await response.json();
        if (!teamData || teamData.length === 0) {
          throw new Error('No team data found for the manager');
        }

        const team = teamData[0];
        setTeamData(team);
        setUsers(team.fieldOfficers.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
      } else {
        const response = await fetch('/api/proxy/employee/getAll', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }

        const data: User[] = await response.json();
        if (!data) {
          throw new Error('No data received when fetching all employees');
        }

        setUsers(data.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
        setAssignedCities(data.filter((user: User) => user.city).map((user: User) => user.city));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [token, role, employeeId]);

  const fetchArchivedEmployees = async () => {
    try {
      console.log('Fetching archived employees...');
      const response = await fetch('/api/proxy/employee/getAllInactive', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch archived employees: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Archived employees data:', data);
      console.log('Number of archived employees:', data.length);
      setArchivedEmployees(data);
    } catch (error) {
      console.error('Error fetching archived employees:', error);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await fetch('/api/proxy/employee/getCities', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const citiesData = await response.json();
        setCities(citiesData);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const showDeleteConfirmation = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(
        `/api/proxy/employee/delete?id=${userToDelete.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userToDelete.id));
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      } else {
        console.error('Failed to delete employee');
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
        `/api/proxy/employee/assignCity?id=${userToAssignCity.id}&city=${encodeURIComponent(selectedCityToAssign)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        // Refresh the employee list to show updated assigned cities
        await fetchEmployees();
        setIsAssignCityModalOpen(false);
        setUserToAssignCity(null);
        setSelectedCityToAssign("");
      } else {
        console.error('Failed to assign city');
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
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleResetPasswordSubmit = async () => {
    if (newPassword !== confirmPassword) {
      console.error('Passwords do not match!');
      return;
    }

    try {
      const response = await fetch(
        "/api/proxy/user/manage/update",
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: users.find(user => user.id === resetPasswordUserId)?.userName,
            password: newPassword
          })
        }
      );

      if (response.ok) {
        setIsResetPasswordOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        console.error('Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (editingEmployee) {
      try {
        const response = await fetch(
          `/api/proxy/employee/edit?empId=${editingEmployee.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              firstName: editingEmployee.firstName,
              lastName: editingEmployee.lastName,
              email: editingEmployee.email,
              role: editingEmployee.role,
              departmentName: editingEmployee.departmentName,
              userName: editingEmployee.userName,
              primaryContact: editingEmployee.primaryContact,
              city: editingEmployee.city,
              state: editingEmployee.state,
              dateOfJoining: editingEmployee.dateOfJoining,
            })
          }
        );

        if (response.ok) {
          setUsers(prevUsers =>
            prevUsers.map(user => (user.id === editingEmployee.id ? editingEmployee : user))
          );
          setIsEditModalOpen(false);
        } else {
          console.error('Failed to update employee');
        }
      } catch (error) {
        console.error('Error updating employee:', error);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      setIsAddingEmployee(true);
      console.log('Starting employee creation...');
      console.log('Token present:', !!token);
      console.log('Employee data:', newEmployee);

      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }

      const requestBody = {
        user: {
          username: newEmployee.userName,
          password: newEmployee.password,
        },
        employee: {
          firstName: newEmployee.firstName,
          lastName: newEmployee.lastName,
          primaryContact: newEmployee.primaryContact,
          secondaryContact: newEmployee.secondaryContact,
          departmentName: newEmployee.departmentName,
          email: newEmployee.email,
          role: newEmployee.role,
          addressLine1: newEmployee.addressLine1,
          addressLine2: newEmployee.addressLine2,
          city: newEmployee.city,
          state: newEmployee.state,
          country: newEmployee.country,
          pincode: newEmployee.pincode,
          dateOfJoining: newEmployee.dateOfJoining,
          subDistrict: newEmployee.subDistrict,
        },
      };

      console.log('Request body:', requestBody);

      const response = await fetch(
        "/api/proxy/employee-user/create",
        {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody)
        }
      );

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        // Get all employees to find the newly created employee
        const getAllResponse = await fetch('/api/proxy/employee/getAll', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (getAllResponse.ok) {
          const allEmployees = await getAllResponse.json();
          // Find the newly created employee by matching the username
          const createdEmployee = allEmployees.find(
            (emp: User) => emp.userDto?.username === newEmployee.userName
          );

          if (createdEmployee) {
            // Create attendance log for the new employee
            try {
              const attendanceResponse = await fetch(
                `/api/proxy/attendance-log/createAttendanceLog?employeeId=${createdEmployee.id}`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              if (attendanceResponse.ok) {
                console.log('Employee added successfully and attendance log created!');
              }
            } catch (attendanceError) {
              console.error("Error creating attendance log:", attendanceError);
              console.log('Employee added successfully but failed to create attendance log.');
            }
          }
        }

        setIsModalOpen(false);
        setActiveTab('tab1');
        setNewEmployee(initialNewEmployeeState);
        setSelectedEmployeeStateId(null);
        setSelectedEmployeeDistrictId(null);
        setPrimaryContactError(null);
        setSecondaryContactError(null);
        fetchEmployees();
      } else {
        const errorText = await response.text();
        console.error('Error adding employee! Status:', response.status);
        console.error('Error response:', errorText);
        alert(`Failed to add employee: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error adding employee:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        alert('Network error: Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        alert(`Error adding employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleUnarchive = async (employeeId: number) => {
    try {
      const response = await fetch(
        `/api/proxy/employee/setActive?id=${employeeId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        fetchArchivedEmployees();
        fetchEmployees();
      }
    } catch (error) {
      console.error('Error unarchiving employee:', error);
    }
  };

  const handleSaveUsername = async () => {
    if (!editingUsername?.username.trim()) {
      console.error('Username cannot be empty');
      return;
    }

    if (editingUsername) {
      try {
        setIsLoading(true);
        
        const encodedUsername = encodeURIComponent(editingUsername.username.trim());
        const response = await fetch(
          `/api/proxy/employee/editUsername?id=${editingUsername.id}&username=${encodedUsername}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const text = await response.text().catch(() => '');
        if (response.ok) {
          setIsEditUsernameModalOpen(false);
          setEditingUsername(null);
          fetchEmployees();
          if (text) {
            console.log('Username update response:', text);
          }
        }
      } catch (error) {
        console.error('Error updating username:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchEmployees();
      fetchCities();
    }
  }, [token, role, employeeId, fetchEmployees]);

  // Load states when modal opens
  useEffect(() => {
    const fetchEmployeeStates = async () => {
      if (!isModalOpen) {
        setEmployeeStates([]);
        setIsLoadingEmployeeStates(false);
        return;
      }

      try {
        setIsLoadingEmployeeStates(true);
        const statesData = await API.getAllStates();
        setEmployeeStates(statesData);
      } catch (error) {
        console.error('Error fetching states:', error);
        setEmployeeStates([]);
      } finally {
        setIsLoadingEmployeeStates(false);
      }
    };

    void fetchEmployeeStates();
  }, [isModalOpen]);

  // Load districts when state changes
  useEffect(() => {
    const fetchEmployeeDistricts = async () => {
      if (!selectedEmployeeStateId) {
        setEmployeeDistricts([]);
        setSelectedEmployeeDistrictId(null);
        setIsLoadingEmployeeDistricts(false);
        return;
      }

      try {
        setIsLoadingEmployeeDistricts(true);
        const districtsData = await API.getDistrictsByStateId(selectedEmployeeStateId);
        setEmployeeDistricts(districtsData);
        setSelectedEmployeeDistrictId(null);
      } catch (error) {
        console.error('Error fetching districts:', error);
        setEmployeeDistricts([]);
      } finally {
        setIsLoadingEmployeeDistricts(false);
      }
    };

    void fetchEmployeeDistricts();
  }, [selectedEmployeeStateId]);

  // Helper functions
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const transformRole = (role: string) => {
    if (!role) return '';
    
    const roleLower = role.toLowerCase().trim();
    
    // Map various role formats to display values
    const roleMap: { [key: string]: string } = {
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

  // Helper function to get role badge color
  const getRoleBadgeColor = (role: string) => {
    const roleLower = role.toLowerCase().trim();
    
    // Map roles to unique colors
    const roleColorMap: { [key: string]: string } = {
      'hr': 'bg-pink-100 text-pink-800 border-pink-200',
      'regional manager': 'bg-purple-100 text-purple-800 border-purple-200',
      'regional_manager': 'bg-purple-100 text-purple-800 border-purple-200',
      'office manager': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'manager': 'bg-purple-100 text-purple-800 border-purple-200',
      'coordinator': 'bg-orange-100 text-orange-800 border-orange-200',
      'data manager': 'bg-blue-100 text-blue-800 border-blue-200',
      'data_manager': 'bg-blue-100 text-blue-800 border-blue-200',
      'field officer': 'bg-green-100 text-green-800 border-green-200',
      'field_officer': 'bg-green-100 text-green-800 border-green-200',
      'avp': 'bg-amber-100 text-amber-800 border-amber-200'
    };
    
    return roleColorMap[roleLower] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const handleSort = (column: keyof User) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === 'primaryContact' || name === 'secondaryContact') {
      // Keep only digits and cap to 10 digits
      const digitsOnly = (value || '').replace(/\D/g, '');
      const capped = digitsOnly.slice(0, 10);
      const digitCount = capped.length;

      // Instant validation: show error only when 1-9 digits; none at 10
      const err = digitCount > 0 && digitCount < 10 ? 'Phone number must be 10 digits' : null;
      if (name === 'primaryContact') setPrimaryContactError(err);
      if (name === 'secondaryContact') setSecondaryContactError(err);

      value = capped;
    }

    setNewEmployee((prevEmployee) => ({
      ...prevEmployee,
      [name]: value,
    }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingEmployee(prevEmployee => prevEmployee ? { ...prevEmployee, [name]: value } : null);
  };

  // Helper function to normalize role for case-insensitive matching
  const normalizeRole = (role: string): string => {
    if (!role) return '';
    
    const roleLower = role.toLowerCase().trim();
    
    // Map various role formats to standard values
    const roleMap: { [key: string]: string } = {
      'hr': 'HR',
      'regional manager': 'regional manager',
      'office manager': 'office manager', 
      'manager': 'regional manager',
      'coordinator': 'coordinator',
      'data manager': 'data_manager',
      'data_manager': 'data_manager',
      'field officer': 'field officer',
      'field_officer': 'field officer',
      'avp': 'avp'
    };
    
    return roleMap[roleLower] || roleLower;
  };

  // Helper function to get display role from normalized role
  const getDisplayRole = (normalizedRole: string): string => {
    const displayMap: { [key: string]: string } = {
      'HR': 'HR',
      'regional manager': 'Regional Manager',
      'office manager': 'Office Manager',
      'coordinator': 'Coordinator', 
      'data_manager': 'Data Manager',
      'field officer': 'Field Officer'
    };
    
    return displayMap[normalizedRole] || normalizedRole;
  };

  const handleEditUser = (user: User) => {
    // Normalize the role before setting it
    const normalizedRole = normalizeRole(user.role);
    setEditingEmployee({ 
      ...user, 
      name: `${user.firstName} ${user.lastName}`,
      role: normalizedRole 
    });
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
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          EMPLOYEE_LIST_RETURN_CONTEXT_KEY,
          JSON.stringify({ route: '/dashboard/employees', timestamp: Date.now() })
        );
      } catch (error) {
        console.error('Failed to store employee return context:', error);
      }
    }
    router.push(`/dashboard/employee/${userId}`);
  };

  const handleNextClick = () => {
    setActiveTab('tab2');
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
  };

  const closeUsernameDialog = () => {
    setIsEditUsernameModalOpen(false);
    setEditingUsername(null);
  };

  // Mobile filter functions
  const handleMobileFilterChange = (field: string, value: string) => {
    setMobileFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearMobileFilters = () => {
    setMobileFilters(INITIAL_MOBILE_FILTERS);
  };

  const applyMobileFilters = () => {
    setIsMobileFilterExpanded(false);
  };

  // Filtering and sorting logic
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearchQuery = (`${user.firstName} ${user.lastName}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transformRole(user.role).toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesMobileFilters = 
        (mobileFilters.name === '' || `${user.firstName} ${user.lastName}`.toLowerCase().includes(mobileFilters.name.toLowerCase())) &&
        (mobileFilters.role === '' || transformRole(user.role).toLowerCase().includes(mobileFilters.role.toLowerCase())) &&
        (mobileFilters.city === '' || user.city.toLowerCase().includes(mobileFilters.city.toLowerCase())) &&
        (mobileFilters.state === '' || user.state.toLowerCase().includes(mobileFilters.state.toLowerCase())) &&
        (mobileFilters.email === '' || user.email.toLowerCase().includes(mobileFilters.email.toLowerCase()));
      
      return matchesSearchQuery && matchesMobileFilters;
    });
  }, [users, searchQuery, mobileFilters]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortColumn, sortDirection]);

  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  const filteredArchivedEmployees = useMemo(() => {
    console.log('Filtering archived employees:', archivedEmployees.length, 'employees, search query:', archiveSearchQuery);
    const filtered = archivedEmployees.filter((employee) =>
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.role.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.departmentName.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.city.toLowerCase().includes(archiveSearchQuery.toLowerCase())
    );
    console.log('Filtered result:', filtered.length, 'employees');
    return filtered;
  }, [archivedEmployees, archiveSearchQuery]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Controls Section */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search Section */}
          <div className="flex-1 max-w-md">
            <Input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          {/* Action Buttons Section */}
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setIsArchivedModalOpen(true);
                fetchArchivedEmployees();
              }}
              className="text-xs sm:text-sm"
            >
              Archived Employees
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:inline-flex text-xs sm:text-sm">
                  Select Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {['name', 'city', 'state', 'role', 'assignedCities', 'userName', 'primaryContact', 'actions'].map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => {
                      if (selectedColumns.includes(column)) {
                        setSelectedColumns(selectedColumns.filter((col) => col !== column));
                      } else {
                        setSelectedColumns([...selectedColumns, column]);
                      }
                    }}
                  >
                    {column === 'assignedCities' ? 'Assigned Cities' : column}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <AddTeam />
            
            <Button 
              size="sm" 
              onClick={() => setIsModalOpen(true)}
              className="text-xs sm:text-sm"
            >
              Add Employee
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMobileFilterExpanded(true)}
              className="md:hidden"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet open={isMobileFilterExpanded} onOpenChange={setIsMobileFilterExpanded}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Employee Filters</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mobile-name">Name</Label>
              <Input
                id="mobile-name"
                placeholder="Search by name..."
                value={mobileFilters.name}
                onChange={(e) => handleMobileFilterChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-role">Role</Label>
              <Input
                id="mobile-role"
                placeholder="Search by role..."
                value={mobileFilters.role}
                onChange={(e) => handleMobileFilterChange('role', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-city">City</Label>
              <Input
                id="mobile-city"
                placeholder="Search by city..."
                value={mobileFilters.city}
                onChange={(e) => handleMobileFilterChange('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-state">State</Label>
              <Input
                id="mobile-state"
                placeholder="Search by state..."
                value={mobileFilters.state}
                onChange={(e) => handleMobileFilterChange('state', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-email">Email</Label>
              <Input
                id="mobile-email"
                placeholder="Search by email..."
                value={mobileFilters.email}
                onChange={(e) => handleMobileFilterChange('email', e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="flex gap-2">
            <Button variant="outline" onClick={clearMobileFilters}>Clear All</Button>
            <Button onClick={applyMobileFilters}>Apply Filters</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {isLoading && <div>Loading employees...</div>}
      {error && <div className="text-red-500">Error: {error}</div>}

      {!isLoading && !error && (
        <>
          {/* Mobile view */}
          <div className="md:hidden space-y-4">
            {currentUsers.map((user) => {
              const normalizedRole = normalizeRoleValue(user.role ?? null);
              const showAssignedCities = normalizedRole === "FIELD_OFFICER" || normalizedRole === "REGIONAL_MANAGER";
              const canAssignCities = normalizedRole === "FIELD_OFFICER";

              return (
              <Card key={user.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + ' ' + user.lastName)}&background=264653&color=fff&size=120&bold=true`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <AvatarFallback className="text-base">{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{`${user.firstName} ${user.lastName}`}</CardTitle>
                        <p className="text-sm text-gray-500">{user.city}, {user.state}</p>
                      </div>
                    </div>
                    <Badge className={`text-xs px-2 py-0.5 border ${getRoleBadgeColor(user.role)}`}>
                      {transformRole(user.role)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <User className="text-blue-500 h-4 w-4" />
                      <span className="font-medium text-sm">Username:</span>
                      <span className="text-sm">{user.userName}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleCardExpansion(user.id)}
                    >
                      {expandedCards.includes(user.id) ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </div>

                  {expandedCards.includes(user.id) && (
                    <div className="mt-4 space-y-3 text-sm">
                      {selectedColumns.includes('primaryContact') && (
                        <div className="flex items-center space-x-3">
                          <Phone className="text-green-500 h-4 w-4" />
                          <span className="font-medium">Phone:</span>
                          <span>{user.primaryContact}</span>
                        </div>
                      )}
                      {selectedColumns.includes('email') && (
                        <div className="flex items-center space-x-3">
                          <Mail className="text-red-500 h-4 w-4" />
                          <span className="font-medium">Email:</span>
                          <span className="text-sm">{user.email}</span>
                        </div>
                      )}
                      {selectedColumns.includes('department') && user.departmentName && (
                        <div className="flex items-center space-x-3">
                          <Building className="text-purple-500 h-4 w-4" />
                          <span className="font-medium">Department:</span>
                          <span>{user.departmentName}</span>
                        </div>
                      )}
                      {selectedColumns.includes('dateOfJoining') && (
                        <div className="flex items-center space-x-3">
                          <Calendar className="text-indigo-500 h-4 w-4" />
                          <span className="font-medium">Joined:</span>
                          <span>{format(new Date(user.dateOfJoining), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {selectedColumns.includes('assignedCities') && (
                        <div className="flex items-start space-x-3">
                          <MapPin className="text-blue-500 h-4 w-4 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-medium">Assigned Cities:</span>
                            {showAssignedCities ? (
                              user.assignedCity && user.assignedCity.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {user.assignedCity.map((city, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {city}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">No cities assigned</span>
                                  {canAssignCities && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => openAssignCityModal(user)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground italic ml-2">Not applicable for {transformRole(user.role)}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleEditUser(user)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleEditUsername(user.id, user.userName)}>
                          Edit Username
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleViewUser(user.id)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleResetPassword(user.id)}>
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => showDeleteConfirmation(user)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
              </CardContent>
              </Card>
            );
            })}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block">
            <div className="rounded-md border overflow-hidden w-full">
              <div className="overflow-x-auto w-full">
                <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  {selectedColumns.includes('name') && (
                    <TableHead className="cursor-pointer w-48" onClick={() => handleSort('firstName')}>
                      Name
                      {sortColumn === 'firstName' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('role') && (
                    <TableHead className="cursor-pointer w-32" onClick={() => handleSort('role')}>
                      Role
                      {sortColumn === 'role' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('userName') && (
                    <TableHead className="cursor-pointer w-32" onClick={() => handleSort('userName')}>
                      User Name
                      {sortColumn === 'userName' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('primaryContact') && (
                    <TableHead className="cursor-pointer w-32" onClick={() => handleSort('primaryContact')}>
                      Phone
                      {sortColumn === 'primaryContact' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('city') && (
                    <TableHead className="cursor-pointer w-32" onClick={() => handleSort('city')}>
                      City
                      {sortColumn === 'city' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('state') && (
                    <TableHead className="cursor-pointer w-32" onClick={() => handleSort('state')}>
                      State
                      {sortColumn === 'state' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('assignedCities') && (
                    <TableHead className="w-40">Assigned Cities</TableHead>
                  )}
                  {selectedColumns.includes('actions') && (
                    <TableHead className="text-right w-16">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((user) => {
                  const normalizedRole = normalizeRoleValue(user.role ?? null);
                  const showAssignedCities = normalizedRole === "FIELD_OFFICER" || normalizedRole === "REGIONAL_MANAGER";
                  const canAssignCities = normalizedRole === "FIELD_OFFICER";

                  return (
                  <TableRow key={user.id}>
                    {selectedColumns.includes('name') && (
                      <TableCell className="font-medium w-48 truncate" title={`${user.firstName} ${user.lastName}`}>{`${user.firstName} ${user.lastName}`}</TableCell>
                    )}
                    {selectedColumns.includes('role') && (
                      <TableCell className="w-32">
                        <Badge className={`text-xs px-2 py-0.5 border ${getRoleBadgeColor(user.role)}`}>
                          {transformRole(user.role)}
                        </Badge>
                      </TableCell>
                    )}
                    {selectedColumns.includes('userName') && <TableCell className="w-32 truncate" title={user.userName}>{user.userName}</TableCell>}
                    {selectedColumns.includes('primaryContact') && <TableCell className="w-32">{user.primaryContact}</TableCell>}
                    {selectedColumns.includes('city') && <TableCell className="w-32 truncate" title={user.city}>{user.city}</TableCell>}
                    {selectedColumns.includes('state') && <TableCell className="w-32 truncate" title={user.state}>{user.state}</TableCell>}
                    {selectedColumns.includes('assignedCities') && (
                      <TableCell className="w-40">
                        {showAssignedCities ? (
                          user.assignedCity && user.assignedCity.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.assignedCity.map((city, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {city}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">No cities assigned</span>
                              {canAssignCities && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() => openAssignCityModal(user)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                    )}
                    {selectedColumns.includes('actions') && (
                      <TableCell className="text-right w-16">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <span>•••</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditUser(user)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUsername(user.id, user.userName)}>
                              Edit Username
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewUser(user.id)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => showDeleteConfirmation(user)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {Math.ceil(sortedUsers.length / itemsPerPage)}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => paginate(Math.min(Math.ceil(sortedUsers.length / itemsPerPage), currentPage + 1))}
                disabled={currentPage >= Math.ceil(sortedUsers.length / itemsPerPage)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for the user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResetPasswordSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Employee Modal */}
      <Dialog open={isModalOpen} onOpenChange={(isOpen) => {
        setIsModalOpen(isOpen);
        if (!isOpen) {
          setNewEmployee(initialNewEmployeeState);
          setIsAddingEmployee(false);
          // Reset location selections
          setSelectedEmployeeStateId(null);
          setSelectedEmployeeDistrictId(null);
          setPrimaryContactError(null);
          setSecondaryContactError(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tab1">Personal & Work</TabsTrigger>
              <TabsTrigger value="tab2">Credentials</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1" className="pb-4">
              <div className="space-y-4">
                <div className="text-lg font-semibold">Personal Information</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">
                      First Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={newEmployee.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      Last Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={newEmployee.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryContact">
                      Primary Contact <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="primaryContact"
                      name="primaryContact"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="10 digit phone number"
                      value={newEmployee.primaryContact}
                      onChange={handleInputChange}
                      className={primaryContactError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      required
                    />
                    {primaryContactError && (
                      <p className="text-xs text-red-500">{primaryContactError}</p>
                    )}
                    {newEmployee.primaryContact && !primaryContactError && (
                      <p className="text-xs text-green-600">✓ Valid phone number</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryContact">Secondary Contact</Label>
                    <Input
                      id="secondaryContact"
                      name="secondaryContact"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      placeholder="10 digit phone number"
                      value={newEmployee.secondaryContact}
                      onChange={handleInputChange}
                      className={secondaryContactError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {secondaryContactError && newEmployee.secondaryContact && (
                      <p className="text-xs text-red-500">{secondaryContactError}</p>
                    )}
                    {newEmployee.secondaryContact && !secondaryContactError && (
                      <p className="text-xs text-green-600">✓ Valid phone number</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <Input
                    id="addressLine1"
                    name="addressLine1"
                    value={newEmployee.addressLine1}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    name="addressLine2"
                    value={newEmployee.addressLine2}
                    onChange={handleInputChange}
                  />
                </div>
                {/* State & District */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>State</Label>
                    <SearchableSelect<StateDto>
                      options={employeeStateOptions}
                      value={selectedEmployeeStateId ? selectedEmployeeStateId.toString() : undefined}
                      onSelect={(option) => {
                        if (!option) {
                          setSelectedEmployeeStateId(null);
                          setSelectedEmployeeDistrictId(null);
                          setNewEmployee((prev) => ({ ...prev, state: "" }));
                          return;
                        }
                        const stateId = Number.parseInt(option.value, 10);
                        setSelectedEmployeeStateId(stateId);
                        setSelectedEmployeeDistrictId(null);
                        setNewEmployee((prev) => ({
                          ...prev,
                          state: option.data?.stateName ?? "",
                        }));
                      }}
                      placeholder="Select state"
                      searchPlaceholder="Search state..."
                      triggerClassName="w-full"
                      contentClassName="[width:var(--radix-popover-trigger-width,280px)]"
                      allowClear={Boolean(selectedEmployeeStateId)}
                      loading={isLoadingEmployeeStates}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>District</Label>
                    <SearchableSelect<DistrictDto>
                      options={employeeDistrictOptions}
                      value={selectedEmployeeDistrictId ? selectedEmployeeDistrictId.toString() : undefined}
                      onSelect={(option) => {
                        if (!option) {
                          setSelectedEmployeeDistrictId(null);
                          return;
                        }
                        const districtId = Number.parseInt(option.value, 10);
                        setSelectedEmployeeDistrictId(districtId);
                      }}
                      placeholder={selectedEmployeeStateId ? "Select district" : "Select state first"}
                      searchPlaceholder="Search district..."
                      triggerClassName="w-full"
                      contentClassName="[width:var(--radix-popover-trigger-width,280px)]"
                      allowClear={Boolean(selectedEmployeeDistrictId)}
                      disabled={!selectedEmployeeStateId}
                      loading={isLoadingEmployeeDistricts}
                      loadingMessage="Loading districts..."
                    />
                  </div>
                </div>

                {/* Sub-District & City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subDistrict">Sub-District</Label>
                    <Input
                      id="subDistrict"
                      placeholder="Enter sub-district"
                      value={newEmployee.subDistrict}
                      onChange={(e) => setNewEmployee({ ...newEmployee, subDistrict: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="Enter city"
                      value={newEmployee.city}
                      onChange={(e) => setNewEmployee({ ...newEmployee, city: e.target.value })}
                    />
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    value={newEmployee.country || 'India'}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    name="pincode"
                    value={newEmployee.pincode}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="text-lg font-semibold mt-6">Work Information</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departmentName">
                      Department <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={newEmployee.departmentName}
                      onValueChange={(value) =>
                        setNewEmployee({ ...newEmployee, departmentName: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role <span className="text-red-500">*</span></Label>
                    <Select
                      value={newEmployee.role}
                      onValueChange={(value) =>
                        setNewEmployee({ ...newEmployee, role: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="AVP">AVP</SelectItem>
                        <SelectItem value="Regional_Manager">Regional Manager</SelectItem>
                        <SelectItem value="Coordinator">Coordinator</SelectItem>
                        <SelectItem value="Data Manager">Data Manager</SelectItem>
                        <SelectItem value="Field Officer">Field Officer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfJoining">Date of Joining</Label>
                    <Input
                      id="dateOfJoining"
                      name="dateOfJoining"
                      type="date"
                      value={newEmployee.dateOfJoining}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                
                {/* Next Button - Moved below all fields */}
                <div className="pt-6 mt-6 border-t">
                  <Button
                    onClick={handleNextClick}
                    disabled={
                      !newEmployee.firstName ||
                      !newEmployee.lastName ||
                      !newEmployee.primaryContact ||
                      !newEmployee.departmentName ||
                      !newEmployee.role ||
                      !!primaryContactError ||
                      (!!newEmployee.secondaryContact && !!secondaryContactError)
                    }
                    className="w-full"
                    size="lg"
                  >
                    Next: Credentials →
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="tab2" className="pb-4">
              <div className="space-y-4">
                <div className="text-lg font-semibold">User Credentials</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="userName">
                      User Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="userName"
                      name="userName"
                      value={newEmployee.userName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={newEmployee.password}
                        onChange={handleInputChange}
                        required
                      />
                      <button
                        type="button"
                        className="absolute top-1/2 right-2 transform -translate-y-1/2 focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Submit Button - Below all fields */}
              <div className="pt-6 mt-6 border-t">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('tab1')}
                    className="flex-1"
                    size="lg"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!newEmployee.userName || !newEmployee.password || isAddingEmployee}
                    className="flex-1"
                    size="lg"
                  >
                    {isAddingEmployee ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding Employee...
                      </>
                    ) : (
                      'Add Employee'
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={editingEmployee.firstName}
                    onChange={handleEditInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={editingEmployee.lastName}
                    onChange={handleEditInputChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    value={editingEmployee.email}
                    onChange={handleEditInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="primaryContact">Primary Contact</Label>
                  <Input
                    id="primaryContact"
                    name="primaryContact"
                    value={editingEmployee.primaryContact}
                    onChange={handleEditInputChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={editingEmployee.role}
                    onValueChange={(value) =>
                      setEditingEmployee({ ...editingEmployee, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Regional_Manager">Regional Manager</SelectItem>
                      <SelectItem value="Coordinator">Coordinator</SelectItem>
                      <SelectItem value="Data Manager">Data Manager</SelectItem>
                      <SelectItem value="Field Officer">Field Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dateOfJoining">Date of Joining</Label>
                  <Input
                    id="dateOfJoining"
                    name="dateOfJoining"
                    type="date"
                    value={editingEmployee.dateOfJoining}
                    onChange={handleEditInputChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={editingEmployee.city}
                    onChange={handleEditInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    name="state"
                    value={editingEmployee.state}
                    onChange={handleEditInputChange}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archived Employees Modal */}
      <Dialog open={isArchivedModalOpen} onOpenChange={setIsArchivedModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Archived Employees</DialogTitle>
            <DialogDescription>
              View and manage archived employees
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Filter */}
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search archived employees..."
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
                className="max-w-md"
              />
              <Badge variant="secondary" className="h-9 px-3">
                {filteredArchivedEmployees.length} Results
              </Badge>
              <Badge variant="outline" className="h-9 px-3">
                Total: {archivedEmployees.length}
              </Badge>
            </div>

            {/* Table */}
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
                      <TableCell className="font-medium">
                        {`${employee.firstName} ${employee.lastName}`}
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>{employee.departmentName}</TableCell>
                      <TableCell>{employee.city}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnarchive(employee.id)}
                          className="flex items-center gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Unarchive
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredArchivedEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm text-muted-foreground">
                            {archivedEmployees.length === 0 
                              ? "No archived employees found" 
                              : "No results found for your search"}
                          </p>
                          {archivedEmployees.length > 0 && archiveSearchQuery && (
                            <Button 
                              variant="ghost" 
                              onClick={() => setArchiveSearchQuery("")}
                              className="text-sm"
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Username Modal */}
      <Dialog open={isEditUsernameModalOpen} onOpenChange={closeUsernameDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>
              Enter a new username for the employee. Username must not be empty.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newUsername">New Username</Label>
              <Input
                id="newUsername"
                value={editingUsername?.username || ''}
                onChange={(e) => setEditingUsername(prev => prev ? { ...prev, username: e.target.value } : null)}
                placeholder="Enter new username"
                disabled={isLoading}
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={closeUsernameDialog}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUsername}
              disabled={isLoading || !editingUsername?.username.trim()}
              className="relative"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.firstName} {userToDelete?.lastName}? 
              This action will archive the employee and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={cancelDelete}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
            >
              Delete Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign City Modal */}
      <Dialog open={isAssignCityModalOpen} onOpenChange={setIsAssignCityModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign City</DialogTitle>
            <DialogDescription>
              Assign a city to {userToAssignCity?.firstName} {userToAssignCity?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="city-select">Select City</Label>
              <Select value={selectedCityToAssign} onValueChange={setSelectedCityToAssign}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={cancelAssignCity}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCity}
              disabled={!selectedCityToAssign || isAssigningCity}
            >
              {isAssigningCity ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign City'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
