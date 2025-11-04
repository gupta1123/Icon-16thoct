"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { 
    UserPlus, 
    ChevronLeft, 
    ChevronRight, 
    MapPin, 
    X, 
    Trash2, 
    Users, 
    User, 
    Building2,
    Loader2,
    Plus,
    Crown,
    Phone,
    Mail,
    Calendar,
    Briefcase
} from 'lucide-react';
import { normalizeRoleValue } from '@/lib/role-utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Team {
    id: number;
    avp?: {
        id: number;
        firstName: string | null;
        lastName: string | null;
        role?: string;
        email?: string;
        primaryContact?: number;
        secondaryContact?: number | null;
        departmentName?: string;
        city?: string;
        state?: string;
        dateOfJoining?: string;
    } | null;
    officeManager: {
        id: number;
        firstName: string | null;
        lastName: string | null;
        assignedCity: string[];
        role?: string;
        email?: string;
        primaryContact?: number;
        secondaryContact?: number | null;
        departmentName?: string;
        city?: string;
        state?: string;
        dateOfJoining?: string;
        status?: string;
    };
    fieldOfficers: FieldOfficer[];
    teamType?: string; // "COORDINATOR_TEAM", "REGIONAL_MANAGER_TEAM", or "AVP_TEAM"
}

const getTeamLeadComparableName = (team: Team) => (`${team.officeManager?.firstName ?? ''} ${team.officeManager?.lastName ?? ''}`)
    .trim()
    .toLowerCase();

const sortTeamsByLeadName = (a: Team, b: Team) => {
    const nameA = getTeamLeadComparableName(a);
    const nameB = getTeamLeadComparableName(b);
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;
    return nameA.localeCompare(nameB);
};

const TEAM_FILTER_OPTIONS = [
    { value: 'all' as const, label: 'All' },
    { value: 'coordinator' as const, label: 'Coordinator' },
    { value: 'regional' as const, label: 'Regional Manager' },
    { value: 'avp' as const, label: 'AVP' },
];

interface FieldOfficer {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    city?: string;
    state?: string;
    email?: string;
    primaryContact?: number;
}

interface HierarchyEmployee {
    id?: number | null;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    role?: string | null;
    email?: string | null;
    emailId?: string | null;
    emailAddress?: string | null;
    officialEmail?: string | null;
    primaryContact?: number | string | null;
    secondaryContact?: number | string | null;
    contactNumber?: number | string | null;
    phone?: number | string | null;
    phoneNumber?: number | string | null;
    mobile?: number | string | null;
    alternateContact?: number | string | null;
    departmentName?: string | null;
    department?: string | null;
    city?: string | null;
    state?: string | null;
    status?: string | null;
    employmentStatus?: string | null;
    dateOfJoining?: string | null;
    joiningDate?: string | null;
    assignedCity?: unknown;
    assignedCities?: unknown;
    cities?: unknown;
    fieldOfficers?: HierarchyEmployee[] | null;
}

interface HierarchyManagerEntry {
    teamId?: number | null;
    manager?: HierarchyEmployee | null;
    fieldOfficers?: HierarchyEmployee[] | null;
}

interface HierarchyAvpGroup {
    avp?: HierarchyEmployee | null;
    managers?: HierarchyManagerEntry[] | null;
}

interface TeamHierarchyApiResponse {
    avpTeams?: HierarchyAvpGroup[] | null;
    regionalManagerTeams?: HierarchyManagerEntry[] | null;
    coordinatorTeams?: HierarchyManagerEntry[] | null;
}

const toContactNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const digits = value.replace(/\D/g, '');
        if (!digits) {
            return undefined;
        }
        const numeric = Number(digits);
        return Number.isFinite(numeric) ? numeric : undefined;
    }
    return undefined;
};

const toStringArray = (value: unknown): string[] => {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value
            .map((entry) => {
                if (typeof entry === 'string') {
                    return entry.trim();
                }
                if (entry == null) {
                    return '';
                }
                return String(entry).trim();
            })
            .filter((entry) => entry.length > 0);
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((part) => part.trim())
            .filter((part) => part.length > 0);
    }
    return [String(value)].filter((entry) => entry.length > 0);
};

const resolveNameParts = (
    employee?: HierarchyEmployee | null
): { firstName: string | null; lastName: string | null } => {
    const directFirst = employee?.firstName?.trim();
    const directLast = employee?.lastName?.trim();

    if (directFirst || directLast) {
        return {
            firstName: directFirst || null,
            lastName: directLast || null,
        };
    }

    const displayName = employee?.name?.trim();
    if (!displayName) {
        return { firstName: null, lastName: null };
    }

    const segments = displayName.split(/\s+/);
    if (segments.length === 0) {
        return { firstName: null, lastName: null };
    }
    const [first, ...rest] = segments;
    return {
        firstName: first ?? null,
        lastName: rest.length > 0 ? rest.join(' ') : null,
    };
};

const resolveEmail = (employee?: HierarchyEmployee | null): string | undefined => {
    return (
        employee?.email ||
        employee?.emailId ||
        employee?.emailAddress ||
        employee?.officialEmail ||
        undefined
    )?.trim() || undefined;
};

const resolveAssignedCities = (employee?: HierarchyEmployee | null): string[] => {
    if (!employee) return [];

    const combined: string[] = [];

    combined.push(...toStringArray(employee.assignedCity));
    combined.push(...toStringArray(employee.assignedCities));
    combined.push(...toStringArray(employee.cities));

    if (combined.length === 0 && employee.city) {
        combined.push(employee.city);
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    return combined.filter((city) => {
        if (!city) return false;
        const normalized = city.trim();
        if (!normalized || seen.has(normalized.toLowerCase())) {
            return false;
        }
        seen.add(normalized.toLowerCase());
        return true;
    });
};

const buildOfficeManager = (employee?: HierarchyEmployee | null): Team["officeManager"] => {
    const { firstName, lastName } = resolveNameParts(employee);
    const role = employee?.role ?? undefined;

    return {
        id: typeof employee?.id === 'number' ? employee.id : 0,
        firstName,
        lastName,
        role,
        email: resolveEmail(employee),
        primaryContact: toContactNumber(
            employee?.primaryContact ??
                employee?.contactNumber ??
                employee?.phone ??
                employee?.phoneNumber ??
                employee?.mobile
        ),
        secondaryContact: toContactNumber(employee?.secondaryContact ?? employee?.alternateContact),
        departmentName: employee?.departmentName ?? employee?.department ?? undefined,
        assignedCity: resolveAssignedCities(employee),
        city: employee?.city ?? undefined,
        state: employee?.state ?? undefined,
        dateOfJoining: employee?.dateOfJoining ?? employee?.joiningDate ?? undefined,
        status: employee?.status ?? employee?.employmentStatus ?? undefined,
    };
};

const buildAvpMember = (employee?: HierarchyEmployee | null): Team["avp"] => {
    if (!employee) return null;
    const manager = buildOfficeManager(employee);
    return {
        ...manager,
        role: employee.role ?? manager.role ?? 'AVP',
    };
};

const buildFieldOfficer = (employee?: HierarchyEmployee | null): FieldOfficer | null => {
    if (!employee || typeof employee.id !== 'number') {
        return null;
    }

    const { firstName, lastName } = resolveNameParts(employee);

    return {
        id: employee.id,
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        role: employee.role ?? 'Field Officer',
        status: employee.status ?? employee.employmentStatus ?? 'ACTIVE',
        city: employee.city ?? undefined,
        state: employee.state ?? undefined,
        email: resolveEmail(employee),
        primaryContact: toContactNumber(
            employee.primaryContact ??
                employee.contactNumber ??
                employee.phone ??
                employee.phoneNumber ??
                employee.mobile
        ),
    };
};

const normalizeFieldOfficers = (members?: HierarchyEmployee[] | null): FieldOfficer[] => {
    if (!Array.isArray(members)) {
        return [];
    }
    return members
        .map((member) => buildFieldOfficer(member))
        .filter((member): member is FieldOfficer => member !== null);
};

const transformTeamHierarchy = (payload?: TeamHierarchyApiResponse | null): Team[] => {
    if (!payload) {
        return [];
    }

    const teamsById = new Map<number, Team>();

    const ensureTeam = (
        teamId: number | null | undefined,
        manager?: HierarchyEmployee | null,
        teamType?: Team["teamType"]
    ): Team | undefined => {
        if (!teamId || teamId <= 0) {
            return undefined;
        }

        const existing = teamsById.get(teamId);
        if (existing) {
            if (manager) {
                existing.officeManager = buildOfficeManager(manager);
            }
            if (teamType) {
                existing.teamType = teamType;
            }
            return existing;
        }

        if (!manager) {
            return undefined;
        }

        const newTeam: Team = {
            id: teamId,
            officeManager: buildOfficeManager(manager),
            fieldOfficers: [],
            teamType: teamType ?? 'REGIONAL_MANAGER_TEAM',
            avp: null,
        };
        teamsById.set(teamId, newTeam);
        return newTeam;
    };

    const regionalTeams = Array.isArray(payload.regionalManagerTeams)
        ? payload.regionalManagerTeams
        : [];
    regionalTeams.forEach((entry) => {
        const team = ensureTeam(entry.teamId ?? null, entry.manager, 'REGIONAL_MANAGER_TEAM');
        if (!team) {
            return;
        }
        team.fieldOfficers = normalizeFieldOfficers(entry.fieldOfficers);
    });

    const coordinatorTeams = Array.isArray(payload.coordinatorTeams)
        ? payload.coordinatorTeams
        : [];
    coordinatorTeams.forEach((entry) => {
        const team = ensureTeam(entry.teamId ?? null, entry.manager, 'COORDINATOR_TEAM');
        if (!team) {
            return;
        }
        team.fieldOfficers = normalizeFieldOfficers(entry.fieldOfficers);
    });

    const avpTeams = Array.isArray(payload.avpTeams) ? payload.avpTeams : [];
    avpTeams.forEach((group) => {
        const avp = buildAvpMember(group.avp);
        const managers = Array.isArray(group.managers) ? group.managers : [];
        managers.forEach((managerEntry) => {
            const team = ensureTeam(managerEntry.teamId ?? null, managerEntry.manager, 'AVP_TEAM');
            if (!team) {
                return;
            }
            if (avp) {
                team.avp = avp;
            }
            if ((!team.fieldOfficers || team.fieldOfficers.length === 0) && managerEntry.fieldOfficers) {
                team.fieldOfficers = normalizeFieldOfficers(managerEntry.fieldOfficers);
            }
        });
    });

    return Array.from(teamsById.values());
};

const resolveTeamCategory = (team: Team): 'coordinator' | 'regional' | 'avp' | null => {
    const normalizedTeamType = typeof team.teamType === 'string' ? team.teamType.toUpperCase() : '';
    if (normalizedTeamType === 'COORDINATOR_TEAM') {
        return 'coordinator';
    }
    if (normalizedTeamType === 'REGIONAL_MANAGER_TEAM') {
        return 'regional';
    }
    if (normalizedTeamType === 'AVP_TEAM' || team.avp) {
        return 'avp';
    }

    const officeRole = normalizeRoleValue(team.officeManager?.role ?? null);
    if (officeRole === 'COORDINATOR') {
        return 'coordinator';
    }
    if (officeRole && ['MANAGER', 'OFFICE_MANAGER', 'REGIONAL_MANAGER'].includes(officeRole)) {
        return 'regional';
    }
    return null;
};

const Teams: React.FC = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [isDataAvailable, setIsDataAvailable] = useState<boolean>(true);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState<boolean>(false);
    const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [selectedOfficeManagerId, setSelectedOfficeManagerId] = useState<number | null>(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
    const [isCityRemoveModalVisible, setIsCityRemoveModalVisible] = useState<boolean>(false);
    const [fieldOfficers, setFieldOfficers] = useState<FieldOfficer[]>([]);
    const [selectedFieldOfficers, setSelectedFieldOfficers] = useState<number[]>([]);
    const [assignedCities, setAssignedCities] = useState<string[]>([]);
    const [cityToRemove, setCityToRemove] = useState<string | null>(null);
    const [fieldOfficerToRemove, setFieldOfficerToRemove] = useState<{ teamId: number; officerId: number; name: string } | null>(null);
    const [isRemoveFieldOfficerModalVisible, setIsRemoveFieldOfficerModalVisible] = useState(false);
    const [currentPage, setCurrentPage] = useState<{ [key: number]: number }>({});
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [newCity, setNewCity] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCoordinatorTeam, setIsCoordinatorTeam] = useState(false);
    const [teamFilter, setTeamFilter] = useState<'all' | 'coordinator' | 'regional' | 'avp'>('all');

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const fetchTeams = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/proxy/employee/team/hierarchy', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch teams: ${response.statusText}`);
            }

            const data = (await response.json()) as TeamHierarchyApiResponse;
            const transformedTeams = transformTeamHierarchy(data);
            setTeams(transformedTeams);
            setIsDataAvailable(transformedTeams.length > 0);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
            setIsDataAvailable(false);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const fetchCities = async () => {
        if (!token) return;

        try {
            const response = await fetch("/api/proxy/employee/getCities", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch cities');
            }

            const data = await response.json();
            const sortedCities = data.sort((a: string, b: string) => a.localeCompare(b));
            setAvailableCities(sortedCities);
        } catch (error) {
            console.error('Error fetching cities:', error);
        }
    };

    const fetchAllFieldOfficers = async (officeManagerId: number) => {
        if (!token) return;

        try {
            const response = await fetch('/api/proxy/employee/getAllFieldOfficers', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch field officers');
            }

            const allFieldOfficers: FieldOfficer[] = await response.json();
            
            // Filter to only show actual field officers using role normalization
            const fieldOfficersOnly = allFieldOfficers.filter((officer: FieldOfficer) => 
                normalizeRoleValue(officer.role) === "FIELD_OFFICER"
            );
            
            const currentTeam = teams.find(team => team.officeManager.id === officeManagerId);
            const currentTeamMemberIds = currentTeam ? currentTeam.fieldOfficers.map(officer => officer.id) : [];
            
            const otherCoordinatorTeamMemberIds = new Set<number>();
            teams.forEach(team => {
                const category = resolveTeamCategory(team);
                if (category === 'coordinator' && team.id !== currentTeam?.id) {
                    team.fieldOfficers.forEach(officer => otherCoordinatorTeamMemberIds.add(officer.id));
                }
            });

            // For coordinator teams: exclude current team members and officers already assigned to other coordinator teams
            const availableFieldOfficers = fieldOfficersOnly.filter((officer: FieldOfficer) => 
                !currentTeamMemberIds.includes(officer.id) && 
                !otherCoordinatorTeamMemberIds.has(officer.id)
            );
            setFieldOfficers(availableFieldOfficers);
        } catch (error) {
            console.error('Error fetching all field officers:', error);
        }
    };

    const fetchFieldOfficersByCities = async (cities: string[], officeManagerId: number) => {
        if (!token) return;

        try {
            const promises = cities.map(city =>
                fetch(`/api/proxy/employee/getFieldOfficerByCity?city=${city}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                })
            );
            const responses = await Promise.all(promises);
            const allData = await Promise.all(responses.map(r => r.json()));
            const allFieldOfficers: FieldOfficer[] = allData.flat();
            
            // Filter to only show actual field officers using role normalization
            const fieldOfficersOnly = allFieldOfficers.filter((officer: FieldOfficer) => 
                normalizeRoleValue(officer.role) === "FIELD_OFFICER"
            );
            
            const currentTeam = teams.find(team => team.officeManager.id === officeManagerId);
            const currentTeamMemberIds = currentTeam ? currentTeam.fieldOfficers.map(officer => officer.id) : [];
            
            const otherRegionalManagerTeamMemberIds = new Set<number>();
            teams.forEach(team => {
                const category = resolveTeamCategory(team);
                if (category === 'regional' && team.id !== currentTeam?.id) {
                    team.fieldOfficers.forEach(officer => otherRegionalManagerTeamMemberIds.add(officer.id));
                }
            });
            
            // For regional manager teams: exclude current team members and officers already assigned to other regional manager teams
            const availableFieldOfficers = fieldOfficersOnly.filter((officer: FieldOfficer) => 
                !currentTeamMemberIds.includes(officer.id) && 
                !otherRegionalManagerTeamMemberIds.has(officer.id)
            );
            setFieldOfficers(availableFieldOfficers);
        } catch (error) {
            console.error('Error fetching field officers:', error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchTeams();
        }
    }, [fetchTeams]);

    const showDeleteModal = (teamId: number) => {
        setDeleteTeamId(teamId);
        setIsDeleteModalVisible(true);
    };

    const handleDeleteTeam = async () => {
        if (!deleteTeamId || !token) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/proxy/employee/team/delete?id=${deleteTeamId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete team');
            }

            await fetchTeams();
            setIsDeleteModalVisible(false);
        } catch (error) {
            console.error('Error deleting team:', error);
            setError(error instanceof Error ? error.message : 'Error deleting team');
        } finally {
            setIsSaving(false);
        }
    };

    const showEditModal = (team: Team) => {
        setSelectedTeamId(team.id);
        setSelectedOfficeManagerId(team.officeManager.id);
        setAssignedCities(team.officeManager.assignedCity);
        
        const isCoordinator = team.officeManager?.role?.toLowerCase() === 'coordinator';
        setIsCoordinatorTeam(isCoordinator);
        
        if (isCoordinator) {
            // For coordinators, fetch all field officers (no city restrictions)
            fetchAllFieldOfficers(team.officeManager.id);
        } else {
            // For regional managers, fetch field officers by assigned cities
            fetchCities();
            fetchFieldOfficersByCities(team.officeManager.assignedCity, team.officeManager.id);
        }
        
        setIsEditModalVisible(true);
    };

    const handleRemoveCity = (city: string) => {
        setCityToRemove(city);
        setIsCityRemoveModalVisible(true);
    };

    const confirmRemoveCity = async () => {
        if (!cityToRemove || !selectedOfficeManagerId || !token) return;

        setIsSaving(true);
        try {
            const response = await fetch(
                `/api/proxy/employee/removeCity?id=${selectedOfficeManagerId}&city=${cityToRemove}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to remove city');
            }

            setAssignedCities(prev => prev.filter(c => c !== cityToRemove));
            setIsCityRemoveModalVisible(false);
            setCityToRemove(null);
        } catch (error) {
            console.error('Error removing city:', error);
            setError(error instanceof Error ? error.message : 'Error removing city');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddFieldOfficer = async () => {
        if (!selectedTeamId || selectedFieldOfficers.length === 0 || !token) return;

        setIsSaving(true);
        try {
            const response = await fetch(
                `/api/proxy/employee/team/addFieldOfficer?id=${selectedTeamId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fieldOfficers: selectedFieldOfficers,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to add field officers');
            }

            await fetchTeams();
            setIsEditModalVisible(false);
            setSelectedFieldOfficers([]);
        } catch (error) {
            console.error('Error adding field officer:', error);
            setError(error instanceof Error ? error.message : 'Error adding field officers');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveFieldOfficerClick = (teamId: number, fieldOfficerId: number, fieldOfficerName: string) => {
        setFieldOfficerToRemove({ teamId, officerId: fieldOfficerId, name: fieldOfficerName });
        setIsRemoveFieldOfficerModalVisible(true);
    };

    const confirmRemoveFieldOfficer = async () => {
        if (!fieldOfficerToRemove || !token) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/proxy/employee/team/deleteFieldOfficer?id=${fieldOfficerToRemove.teamId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fieldOfficers: [fieldOfficerToRemove.officerId],
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove field officer');
            }

            await fetchTeams();
            setIsRemoveFieldOfficerModalVisible(false);
            setFieldOfficerToRemove(null);
        } catch (error) {
            console.error('Error removing field officer:', error);
            setError(error instanceof Error ? error.message : 'Error removing field officer');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignCity = async () => {
        if (!newCity || !selectedOfficeManagerId || !token) return;

        setIsSaving(true);
        try {
            const response = await fetch(
                `/api/proxy/employee/assignCity?id=${selectedOfficeManagerId}&city=${newCity}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to assign city');
            }

            await fetchFieldOfficersByCities([...assignedCities, newCity], selectedOfficeManagerId);
            setAssignedCities(prev => [...prev, newCity]);
            setNewCity('');
        } catch (error) {
            console.error('Error assigning city:', error);
            setError(error instanceof Error ? error.message : 'Error assigning city');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredTeams = useMemo(() => {
        const sorted = [...teams].sort(sortTeamsByLeadName);
        if (teamFilter === 'all') {
            return sorted;
        }
        return sorted.filter(team => resolveTeamCategory(team) === teamFilter);
    }, [teams, teamFilter]);

    const handlePageChange = (teamId: number, newPage: number) => {
        setCurrentPage(prev => ({ ...prev, [teamId]: newPage }));
    };

    const getInitials = (firstName: string | null, lastName: string | null) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    const formatPhoneNumber = (phone: number | undefined): string => {
        if (!phone) return 'N/A';
        const phoneStr = phone.toString();
        if (phoneStr.length === 10) {
            return `${phoneStr.slice(0, 5)} ${phoneStr.slice(5)}`;
        }
        return phoneStr;
    };

    const formatDate = (dateString: string | undefined | null): string => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const year = date.getFullYear().toString().slice(-2);
            return `${day} ${month} '${year}`;
        } catch {
            return dateString;
        }
    };

    const getTeamTypeInfo = (team: Team) => {
        const teamType = team.teamType || (team.officeManager?.role === 'Coordinator' ? 'COORDINATOR_TEAM' : 'REGIONAL_MANAGER_TEAM');
        
        if (teamType === 'COORDINATOR_TEAM') {
            return {
                label: 'Coordinator Team',
                badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
                icon: Users
            };
        } else if (teamType === 'AVP_TEAM' || team.avp) {
            return {
                label: 'AVP Team',
                badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
                icon: Crown
            };
        } else {
            return {
                label: 'Regional Manager Team',
                badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
                icon: Building2
            };
        }
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-foreground">Team Management</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage teams, assign cities, and add field officers to teams</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading teams...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setError(null);
                                        fetchTeams();
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && (
                        <>
                            {teams.length > 0 && (
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Showing {filteredTeams.length} of {teams.length} teams
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium">Filter teams:</span>
                                        {TEAM_FILTER_OPTIONS.map((option) => (
                                            <Button
                                                key={option.value}
                                                size="sm"
                                                variant={teamFilter === option.value ? "default" : "outline"}
                                                onClick={() => setTeamFilter(option.value)}
                                            >
                                                {option.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {isDataAvailable ? (
                                filteredTeams.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredTeams.map((team) => {
                                            const pageCount = Math.ceil(team.fieldOfficers.length / 4);
                                            const currentPageForTeam = currentPage[team.id] || 1;
                                            const startIndex = (currentPageForTeam - 1) * 4;
                                            const visibleOfficers = team.fieldOfficers.slice(startIndex, startIndex + 4);

                                            const teamTypeInfo = getTeamTypeInfo(team);
                                            const TeamIcon = teamTypeInfo.icon;
                                            
                                            const isAvpTeam = team.teamType === 'AVP_TEAM' || team.avp;
                                            const displayPerson = isAvpTeam && team.avp ? team.avp : team.officeManager;
                                            
                                            return (
                                                <Card key={team.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                                                <CardContent className="p-6">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center">
                                                            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-3 text-lg font-semibold">
                                                                {getInitials(displayPerson?.firstName, displayPerson?.lastName)}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-foreground">
                                                                    {displayPerson?.firstName ?? 'N/A'} {displayPerson?.lastName ?? 'N/A'}
                                                                </h3>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Badge className={`text-xs px-2 py-0.5 border ${teamTypeInfo.badgeClass}`}>
                                                                        <TeamIcon className="h-3 w-3 mr-1" />
                                                                        {teamTypeInfo.label}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => showDeleteModal(team.id)}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 size={20} />
                                                        </Button>
                                                    </div>
                                                    
                                                    {isAvpTeam ? (
                                                        <Tabs defaultValue="rm" className="w-full">
                                                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                                                <TabsTrigger value="rm" className="flex items-center gap-2">
                                                                    <Users className="h-4 w-4" />
                                                                    Regional Manager
                                                                </TabsTrigger>
                                                                <TabsTrigger value="field-officers" className="flex items-center gap-2">
                                                                    <User className="h-4 w-4" />
                                                                    Field Officers ({team.fieldOfficers.length})
                                                                </TabsTrigger>
                                                            </TabsList>
                                                            
                                                            <TabsContent value="rm" className="space-y-4 mt-0">
                                                                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                                                                    <div className="flex items-start gap-4">
                                                                        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0">
                                                                            {getInitials(team.officeManager?.firstName, team.officeManager?.lastName)}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className="text-lg font-semibold text-foreground mb-1">
                                                                                {team.officeManager?.firstName ?? 'N/A'} {team.officeManager?.lastName ?? 'N/A'}
                                                                            </h4>
                                                                            <Badge variant="outline" className="mb-3">
                                                                                {team.officeManager?.role ?? 'Regional Manager'}
                                                                            </Badge>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                                                                {team.officeManager?.primaryContact && (
                                                                                    <div className="flex items-center gap-2 text-sm">
                                                                                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                                        <span className="text-muted-foreground">{formatPhoneNumber(team.officeManager.primaryContact)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {team.officeManager?.departmentName && (
                                                                                    <div className="flex items-center gap-2 text-sm">
                                                                                        <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                                        <span className="text-muted-foreground">{team.officeManager.departmentName}</span>
                                                                                    </div>
                                                                                )}
                                                                                {team.officeManager?.dateOfJoining && (
                                                                                    <div className="flex items-center gap-2 text-sm">
                                                                                        <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                                        <span className="text-muted-foreground">Joined {formatDate(team.officeManager.dateOfJoining)}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {team.officeManager.assignedCity.length > 0 && (
                                                                    <div>
                                                                        <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                            Assigned Cities
                                                                        </h5>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {team.officeManager.assignedCity.map((city, index) => (
                                                                                <Badge key={index} variant="secondary" className="flex items-center">
                                                                                    <Building2 size={12} className="mr-1" />
                                                                                    {city}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </TabsContent>
                                                            
                                                            <TabsContent value="field-officers" className="space-y-3 mt-0">
                                                                {team.fieldOfficers.length > 0 ? (
                                                                    <>
                                                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                                                            {team.fieldOfficers.map((officer) => (
                                                                                <div key={officer.id} className="bg-muted/30 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-all duration-200 group">
                                                                                    <div className="flex items-start justify-between gap-3">
                                                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                                                                                {getInitials(officer.firstName, officer.lastName)}
                                                                                            </div>
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <p className="font-medium text-sm text-foreground">
                                                                                                    {`${officer.firstName} ${officer.lastName}`}
                                                                                                </p>
                                                                                                <p className="text-xs text-muted-foreground mb-1">
                                                                                                    {officer.role}
                                                                                                </p>
                                                                                                <div className="flex items-center gap-2 mt-2">
                                                                                                    <Badge variant="outline" className="text-xs">
                                                                                                        <Users className="h-3 w-3 mr-1" />
                                                                                                        RM: {team.officeManager?.firstName ?? 'N/A'} {team.officeManager?.lastName ?? 'N/A'}
                                                                                                    </Badge>
                                                                                                    {officer.status === 'inactive' && (
                                                                                                        <Badge variant="destructive" className="text-xs">
                                                                                                            Inactive
                                                                                                        </Badge>
                                                                                                    )}
                                                                                                </div>
                                                                                                {officer.city && (
                                                                                                    <div className="flex items-center gap-1 mt-1.5">
                                                                                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                                                                                        <span className="text-xs text-muted-foreground">
                                                                                                            {officer.city}{officer.state ? `, ${officer.state}` : ''}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <Button
                                                                                            variant="ghost"
                                                                                            size="sm"
                                                                                            onClick={() => handleRemoveFieldOfficerClick(team.id, officer.id, `${officer.firstName} ${officer.lastName}`.trim())}
                                                                                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                                                                            disabled={isSaving}
                                                                                        >
                                                                                            <X size={16} />
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="pt-4 border-t">
                                                                            <Button
                                                                                className="w-full"
                                                                                onClick={() => showEditModal(team)}
                                                                            >
                                                                                <UserPlus size={16} className="mr-2" />
                                                                                Add Field Officer
                                                                            </Button>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div className="text-center py-8">
                                                                        <User className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                                                                        <p className="text-sm text-muted-foreground mb-4">No field officers assigned yet</p>
                                                                        <Button
                                                                            onClick={() => showEditModal(team)}
                                                                            variant="outline"
                                                                        >
                                                                            <UserPlus size={16} className="mr-2" />
                                                                            Add Field Officer
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </TabsContent>
                                                        </Tabs>
                                                    ) : (
                                                        <>
                                                            <div className="flex flex-wrap gap-2 mb-4">
                                                                {team.officeManager.assignedCity.map((city, index) => (
                                                                    <Badge key={index} variant="secondary" className="flex items-center">
                                                                        <Building2 size={12} className="mr-1" />
                                                                        {city}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                            
                                                            <div className="space-y-3">
                                                                {visibleOfficers.map((officer) => (
                                                                    <div key={officer.id} className="bg-muted/30 p-3 rounded-lg flex items-center justify-between group hover:bg-muted/50 transition-all duration-300">
                                                                        <div className="flex items-center min-w-0">
                                                                            <User size={20} className="text-muted-foreground mr-2 flex-shrink-0" />
                                                                            <div className="min-w-0 flex-grow">
                                                                                <p className="font-medium text-sm text-foreground truncate">
                                                                                    {`${officer.firstName} ${officer.lastName}`}
                                                                                </p>
                                                                                <p className="text-xs text-muted-foreground truncate">
                                                                                    {officer.role}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center">
                                                                            {officer.status === 'inactive' && (
                                                                                <Badge variant="destructive" className="mr-2 text-xs">
                                                                                    Inactive
                                                                                </Badge>
                                                                            )}
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleRemoveFieldOfficerClick(team.id, officer.id, `${officer.firstName} ${officer.lastName}`.trim())}
                                                                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                                disabled={isSaving}
                                                                            >
                                                                                <X size={16} />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            
                                                            {pageCount > 1 && (
                                                                <div className="flex items-center justify-between mt-4">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Label htmlFor="pageSize">Rows per page:</Label>
                                                                        <Select value="4" onValueChange={() => {}}>
                                                                            <SelectTrigger className="w-20">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="4">4</SelectItem>
                                                                                <SelectItem value="8">8</SelectItem>
                                                                                <SelectItem value="12">12</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center space-x-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handlePageChange(team.id, currentPageForTeam - 1)}
                                                                            disabled={currentPageForTeam === 1}
                                                                        >
                                                                            <ChevronLeft className="h-4 w-4" />
                                                                            Previous
                                                                        </Button>
                                                                        
                                                                        <span className="text-sm text-muted-foreground">
                                                                            Page {currentPageForTeam} of {pageCount}
                                                                        </span>
                                                                        
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handlePageChange(team.id, currentPageForTeam + 1)}
                                                                            disabled={currentPageForTeam >= pageCount}
                                                                        >
                                                                            Next
                                                                            <ChevronRight className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="mt-4 pt-4 border-t">
                                                                <Button
                                                                    className="w-full"
                                                                    onClick={() => showEditModal(team)}
                                                                >
                                                                    <UserPlus size={16} className="mr-2" />
                                                                    Add Field Officer
                                                                </Button>
                                                            </div>
                                                        </>
                                                    )}
                                                </CardContent>
                                            </Card>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-10">
                                        <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                                        <p className="text-xl font-semibold text-foreground">No teams match the selected filter</p>
                                        <p className="text-muted-foreground mt-2">Try switching filters to view other teams.</p>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-10">
                                    <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                                    <p className="text-xl font-semibold text-foreground">No teams available</p>
                                    <p className="text-muted-foreground mt-2">Try refreshing the page or check back later.</p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Delete Team Modal */}
            <Dialog open={isDeleteModalVisible} onOpenChange={setIsDeleteModalVisible}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Team</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">Are you sure you want to delete this team? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteModalVisible(false)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteTeam}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Team Modal */}
            <Dialog open={isEditModalVisible} onOpenChange={setIsEditModalVisible}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Add Field Officer</span>
                            {isCoordinatorTeam && (
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                    <Users className="h-3 w-3 mr-1" />
                                    Coordinator Team
                                </Badge>
                            )}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Team Leader: {teams.find(t => t.id === selectedTeamId)?.officeManager?.firstName} {teams.find(t => t.id === selectedTeamId)?.officeManager?.lastName}
                        </p>
                    </DialogHeader>
                    <div className="space-y-4">
                        {!isCoordinatorTeam && (
                            <>
                                <div>
                                    <Label className="text-sm font-medium text-foreground">Assigned Cities</Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {assignedCities.map((city, index) => (
                                            <Badge key={index} variant="secondary" className="flex items-center">
                                                <Building2 size={12} className="mr-1" />
                                                {city}
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    onClick={() => handleRemoveCity(city)} 
                                                    className="h-auto p-0 ml-1 text-muted-foreground hover:text-foreground"
                                                >
                                                    <X size={12} />
                                                </Button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="newCity">Add New City</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="newCity"
                                            value={newCity}
                                            onChange={(e) => setNewCity(e.target.value)}
                                            placeholder="Enter city name"
                                        />
                                        <Button onClick={handleAssignCity} disabled={!newCity || isSaving}>
                                            {isSaving ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div>
                            <Label className="text-sm font-medium text-foreground">Available Field Officers</Label>
                            <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                                {fieldOfficers.map((officer) => (
                                    <div key={officer.id} className="flex items-center space-x-2">
                                        {officer.status === 'active' ? (
                                            <div className="flex items-center w-full">
                                                <Checkbox
                                                    id={`officer-${officer.id}`}
                                                    checked={selectedFieldOfficers.includes(officer.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedFieldOfficers(prev =>
                                                            checked
                                                                ? [...prev, officer.id]
                                                                : prev.filter(id => id !== officer.id)
                                                        );
                                                    }}
                                                />
                                                <Label htmlFor={`officer-${officer.id}`} className="ml-2 text-sm text-foreground">
                                                    {`${officer.firstName} ${officer.lastName} (${officer.role})`}
                                                </Label>
                                            </div>
                                        ) : (
                                            <div className="flex items-center w-full">
                                                <span className="text-sm text-muted-foreground">{`${officer.firstName} ${officer.lastName} (${officer.role})`}</span>
                                                <Badge variant="destructive" className="ml-2 text-xs">
                                                    Inactive
                                                </Badge>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalVisible(false)}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddFieldOfficer} 
                            disabled={selectedFieldOfficers.length === 0 || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Selected Officers'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Field Officer Modal */}
            <Dialog
                open={isRemoveFieldOfficerModalVisible}
                onOpenChange={(open) => {
                    setIsRemoveFieldOfficerModalVisible(open);
                    if (!open) {
                        setFieldOfficerToRemove(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Field Officer</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to remove{" "}
                        <span className="font-semibold text-foreground">
                            {fieldOfficerToRemove?.name ?? "this field officer"}
                        </span>{" "}
                        from this team?
                    </p>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsRemoveFieldOfficerModalVisible(false);
                                setFieldOfficerToRemove(null);
                            }}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmRemoveFieldOfficer}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                "Remove"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove City Modal */}
            <Dialog open={isCityRemoveModalVisible} onOpenChange={setIsCityRemoveModalVisible}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove City</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">Are you sure you want to remove {cityToRemove} from this team?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCityRemoveModalVisible(false)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmRemoveCity}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                'Remove'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Teams;
