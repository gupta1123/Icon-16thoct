"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Building2, ArrowRight, ArrowLeft, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeRoleValue } from '@/lib/role-utils';
import SearchableSelect, { type SearchableOption } from "@/components/searchable-select";

const ELIGIBLE_MANAGER_ROLES = new Set([
    "MANAGER",
    "OFFICE_MANAGER",
    "REGIONAL_MANAGER",
    "COORDINATOR",
]);

const isEligibleManagerRole = (role?: string | null) => {
    const normalized = normalizeRoleValue(role ?? null);
    if (!normalized) return false;
    return ELIGIBLE_MANAGER_ROLES.has(normalized);
};

const isCoordinatorRole = (role?: string | null) => {
    const normalized = normalizeRoleValue(role ?? null);
    return normalized === "COORDINATOR";
};

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    city: string;
    role: string;
    teamId: number | null;
    employeeId?: string | null;
    primaryContact?: number;
    secondaryContact?: number | null;
    status?: string;
    email?: string;
    departmentName?: string | null;
    state?: string;
    addressLine1?: string;
    addressLine2?: string | null;
    country?: string;
    pincode?: number;
    dateOfJoining?: string;
    userDto?: {
        username: string;
        password?: string | null;
        plainPassword?: string;
        roles?: string | null;
        employeeId?: number | null;
        firstName?: string | null;
        lastName?: string | null;
    };
    isOfficeManager?: boolean;
    assignedCity?: string[];
    travelAllowance?: number | null;
    dearnessAllowance?: number | null;
    createdAt?: string;
    updatedAt?: string;
    createdTime?: string;
    updatedTime?: string;
    companyId?: number | null;
    companyName?: string | null;
    fullMonthSalary?: number | null;
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

interface CityOption {
    value: string;
    label: string;
}


interface TeamSummary {
    id: number;
    name?: string | null;
    teamType?: string | null;
    officeManager?: OfficeManager | OfficeManager[] | null;
    fieldOfficers?: Array<{ id?: number | null }> | null;
    avp?: number | { id?: number | null } | Array<number | { id?: number | null } | null> | null;
}

const extractAvpIds = (value: TeamSummary["avp"]): number[] => {
    if (!value) return [];
    const entries = Array.isArray(value) ? value : [value];
    const ids: number[] = [];
    for (const entry of entries) {
        if (!entry) continue;
        if (typeof entry === "number") {
            ids.push(entry);
        } else if (typeof entry.id === "number") {
            ids.push(entry.id);
        }
    }
    return ids;
};

const formatTeamSummaryLabel = (team: TeamSummary): string => {
    const manager = Array.isArray(team.officeManager)
        ? team.officeManager.find((mgr) => Boolean(mgr))
        : team.officeManager;
    const first = manager?.firstName?.trim() ?? "";
    const last = manager?.lastName?.trim() ?? "";
    const name = `${first} ${last}`.trim();
    if (team.name && team.name.trim().length > 0) {
        return `${team.name} – ${name || `Team #${team.id}`}`;
    }
    return name || `Team #${team.id}`;
};

const AddTeam = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [step, setStep] = useState<'selectType' | 'createTeam'>('selectType');
    const [teamType, setTeamType] = useState<'coordinator' | 'regional' | 'avp' | null>(null);
    const [officeManager, setOfficeManager] = useState<{ value: number, label: string, role: string } | null>(null);
    const [selectedCities, setSelectedCities] = useState<CityOption[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
    const [officeManagers, setOfficeManagers] = useState<OfficeManager[]>([]);
    const [cities, setCities] = useState<CityOption[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [assignedFoIds, setAssignedFoIds] = useState<{ coordinator: number[]; regional: number[] }>({
        coordinator: [],
        regional: [],
    });
    const [isCoordinator, setIsCoordinator] = useState(false);
    const [availableAvps, setAvailableAvps] = useState<Employee[]>([]);
    const [teamsWithoutAvp, setTeamsWithoutAvp] = useState<TeamSummary[]>([]);
    const [selectedAvpId, setSelectedAvpId] = useState<number | null>(null);
    const [selectedAvpTeamId, setSelectedAvpTeamId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const managerOptions = useMemo<SearchableOption<OfficeManager>[]>(() => {
        return officeManagers
            .filter(manager => {
                const normalizedRole = normalizeRoleValue(manager.role ?? null);
                if (!normalizedRole) return false;
                if (teamType === 'coordinator') {
                    return normalizedRole === 'COORDINATOR';
                }
                if (teamType === 'regional') {
                    return ["MANAGER", "OFFICE_MANAGER", "REGIONAL_MANAGER"].includes(normalizedRole);
                }
                return teamType == null;
            })
            .map((manager) => ({
                value: manager.id.toString(),
                label: `${manager.firstName} ${manager.lastName}${manager.role ? ` (${manager.role})` : ''}`,
                data: manager,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [officeManagers, teamType]);

    const cityOptions = useMemo<SearchableOption<CityOption>[]>(() => {
        return cities.map((city) => ({
            value: city.value,
            label: city.label,
            data: city,
        }));
    }, [cities]);

    const avpOptions = useMemo<SearchableOption<Employee>[]>(() => {
        return availableAvps.map((avp) => ({
            value: avp.id.toString(),
            label: `${avp.firstName} ${avp.lastName}${avp.city ? ` (${avp.city})` : ""}`,
            data: avp,
        }));
    }, [availableAvps]);

    const avpTeamOptions = useMemo<SearchableOption<TeamSummary>[]>(() => {
        return teamsWithoutAvp.map((team) => ({
            value: team.id.toString(),
            label: formatTeamSummaryLabel(team),
            data: team,
        }));
    }, [teamsWithoutAvp]);

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    useEffect(() => {
        if (!isModalOpen) {
            resetForm();
        }
    }, [isModalOpen]);

    const resetForm = () => {
        setStep('selectType');
        setTeamType(null);
        setOfficeManager(null);
        setSelectedCities([]);
        setSelectedEmployees([]);
        setEmployees([]);
        setIsCoordinator(false);
        setSelectedAvpId(null);
        setSelectedAvpTeamId(null);
        setError(null);
    };

    const fetchOfficeManagers = useCallback(async () => {
        try {
            const allEmployeesResponse = await fetch(
                "/api/proxy/employee/getAll",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const teamsResponse = await fetch(
                "/api/proxy/employee/team/getAll",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const allEmployeesData = await allEmployeesResponse.json();
            const teamsData = await teamsResponse.json();

            const assignedManagerIds = new Set<number>();
            const coordinatorAssigned = new Set<number>();
            const regionalAssigned = new Set<number>();
            const avpAssignedIds = new Set<number>();
            const teamsNeedingAvp: TeamSummary[] = [];

            const getOfficeManagersForTeam = (team: TeamSummary): OfficeManager[] => {
                if (Array.isArray(team.officeManager)) {
                    return team.officeManager.filter((mgr): mgr is OfficeManager => Boolean(mgr?.id));
                }
                return team.officeManager && typeof team.officeManager.id === "number"
                    ? [team.officeManager as OfficeManager]
                    : [];
            };

            const determineTeamCategory = (team: TeamSummary): 'coordinator' | 'regional' | null => {
                const normalizedTeamType = typeof team.teamType === "string" ? team.teamType.toUpperCase() : "";
                if (normalizedTeamType === "COORDINATOR_TEAM") return 'coordinator';
                if (normalizedTeamType === "REGIONAL_MANAGER_TEAM") return 'regional';

                const primaryManager = getOfficeManagersForTeam(team)[0];
                const managerRole = normalizeRoleValue(primaryManager?.role ?? null);
                if (managerRole === "COORDINATOR") return 'coordinator';
                if (managerRole && ["MANAGER", "OFFICE_MANAGER", "REGIONAL_MANAGER"].includes(managerRole)) {
                    return 'regional';
                }
                return null;
            };

            for (const team of teamsData) {
                const officeManagersForTeam = getOfficeManagersForTeam(team);
                officeManagersForTeam.forEach((manager) => {
                    if (typeof manager.id === "number") {
                        assignedManagerIds.add(manager.id);
                    }
                });

                const category = determineTeamCategory(team);
                const members = Array.isArray(team.fieldOfficers) ? team.fieldOfficers : [];
                members.forEach((member: { id?: number | null }) => {
                    if (member && typeof member.id === "number") {
                        if (category === "coordinator") {
                            coordinatorAssigned.add(member.id);
                        } else if (category === "regional") {
                            regionalAssigned.add(member.id);
                        }
                    }
                });

                const teamAvpIds = extractAvpIds(team.avp);
                teamAvpIds.forEach((id) => avpAssignedIds.add(id));
                if (category === "regional" && teamAvpIds.length === 0) {
                    teamsNeedingAvp.push(team);
                }
            }

            // Get all team IDs that exist
            const existingTeamIds = new Set<number>();
            teamsData.forEach((team: TeamSummary) => {
                if (typeof team.id === "number") {
                    existingTeamIds.add(team.id);
                }
            });

            // Find regional managers without teams and create synthetic team entries
            const deletedManagerIds = allEmployeesData
                .filter((employee: OfficeManager) => 
                    isEligibleManagerRole(employee.role) && employee.deleted)
                .map((employee: OfficeManager) => employee.id);
            
            const regionalManagerRoles = ["MANAGER", "OFFICE_MANAGER", "REGIONAL_MANAGER"];
            const regionalManagersWithoutTeams = allEmployeesData
                .filter((employee: Employee) => {
                    const normalizedRole = normalizeRoleValue(employee.role ?? null);
                    if (!normalizedRole) return false;
                    if (!regionalManagerRoles.includes(normalizedRole)) return false;
                    // Check if employee is deleted (using status field if deleted property doesn't exist)
                    const employeeAsManager = employee as unknown as OfficeManager;
                    const isDeleted = employeeAsManager.deleted || employee.status === "deleted" || employee.status === "inactive";
                    if (isDeleted) return false;
                    // Check if they have a team (teamId exists and is in existingTeamIds)
                    // OR if they're not assigned as office manager to any existing team
                    const hasTeamInResponse = typeof employee.teamId === "number" && existingTeamIds.has(employee.teamId);
                    const isOfficeManagerOfExistingTeam = assignedManagerIds.has(employee.id);
                    // Include if they don't have a team or aren't already assigned
                    return !hasTeamInResponse && !isOfficeManagerOfExistingTeam;
                })
                .map((employee: Employee): TeamSummary => {
                    // Create synthetic team entry with negative ID to avoid conflicts
                    // Use employee.id as base but make it negative
                    const syntheticTeamId = -(employee.id || 0) - 1000000;
                    const employeeAsManager = employee as unknown as OfficeManager;
                    return {
                        id: syntheticTeamId,
                        name: null,
                        teamType: "REGIONAL_MANAGER_TEAM",
                        officeManager: {
                            id: employee.id,
                            firstName: employee.firstName,
                            lastName: employee.lastName,
                            city: employee.city || "",
                            email: employee.email || "",
                            role: employee.role || "",
                            deleted: employeeAsManager.deleted || false,
                        },
                        fieldOfficers: [],
                        avp: null,
                    };
                });

            // Add synthetic teams to the list
            teamsNeedingAvp.push(...regionalManagersWithoutTeams);

            const availableManagers = allEmployeesData
                .filter((employee: OfficeManager) =>
                    isEligibleManagerRole(employee.role) &&
                    !assignedManagerIds.has(employee.id) &&
                    !deletedManagerIds.includes(employee.id)
                );

            const avpCandidates = allEmployeesData.filter(
                (employee: Employee) => normalizeRoleValue(employee.role) === "AVP"
            );
            const availableAvpList = avpCandidates.filter(
                (avp: Employee) => typeof avp.id === "number" && !avpAssignedIds.has(avp.id)
            );

            setOfficeManagers(availableManagers);
            setAvailableAvps(availableAvpList);
            setTeamsWithoutAvp(teamsNeedingAvp);
            setAssignedFoIds({
                coordinator: Array.from(coordinatorAssigned),
                regional: Array.from(regionalAssigned),
            });
        } catch (error) {
            console.error("Error fetching team data:", error);
        }
    }, [token]);
   
    const handleOfficeManagerSelect = (option: SearchableOption<OfficeManager> | null) => {
        if (!option) {
            setOfficeManager(null);
            setIsCoordinator(false);
            setSelectedEmployees([]);
            setSelectedCities([]);
            setEmployees([]);
            return;
        }

        const manager = option.data ?? officeManagers.find(m => m.id.toString() === option.value);
        if (!manager) return;

        const isCoord = teamType === 'coordinator' ? true : isCoordinatorRole(manager.role);
        setOfficeManager({
            value: manager.id,
            label: `${manager.firstName} ${manager.lastName}`,
            role: manager.role || ""
        });
        setIsCoordinator(isCoord);
        setSelectedEmployees([]);

        if (isCoord) {
            setSelectedCities([]);
            setEmployees([]);
            fetchAllFieldOfficers();
        } else if (teamType === 'regional') {
            if (selectedCities.length > 0) {
                const cities = selectedCities.map(option => option.value);
                fetchEmployeesByCities(cities);
            } else {
                setEmployees([]);
            }
        }
    };

    const fetchCities = useCallback(async () => {
        try {
            const response = await fetch(
                "/api/proxy/employee/getCities",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            const data = await response.json();
            const sortedCities = data
                .filter((city: string) => city && city.trim() !== '') // Filter out empty cities
                .sort((a: string, b: string) => a.localeCompare(b))
                .map((city: string) => ({ value: city, label: city }));
            setCities(sortedCities);
        } catch (error) {
            console.error("Error fetching cities:", error);
        }
    }, [token]);

    useEffect(() => {
        if (!token || !isModalOpen) {
            return;
        }

        fetchOfficeManagers();
    }, [isModalOpen, token, fetchOfficeManagers]);

    useEffect(() => {
        if (!token || !isModalOpen) {
            return;
        }

        if (teamType === 'regional') {
            fetchCities();
        } else {
            setSelectedCities([]);
        }

        if (teamType !== 'regional') {
            setEmployees([]);
        }
    }, [isModalOpen, token, teamType, fetchCities]);

    useEffect(() => {
        if (teamType === 'avp') {
            setOfficeManager(null);
            setSelectedEmployees([]);
            setSelectedCities([]);
            setEmployees([]);
        }
    }, [teamType]);

    // Re-filter employees when assigned team membership changes
    useEffect(() => {
        if (isModalOpen && selectedCities.length > 0) {
            const cities = selectedCities.map((c) => c.value);
            fetchEmployeesByCities(cities);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignedFoIds.coordinator, assignedFoIds.regional]);

    const fetchAllFieldOfficers = async () => {
        try {
            const response = await fetch(
                "/api/proxy/employee/getAllFieldOfficers",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const fieldOfficersData = await response.json();
            const assignedCoordinatorSet = new Set(assignedFoIds.coordinator);

            // Filter to only show actual field officers using role normalization
            const filteredEmployees = fieldOfficersData
                .filter((employee: Record<string, unknown>) => {
                    const isFO = normalizeRoleValue(employee.role as string) === "FIELD_OFFICER";
                    const isActive = !employee.status || String(employee.status).toLowerCase() === 'active';
                    const notAssignedToCoordinatorTeam = !assignedCoordinatorSet.has(employee.id as number);
                    return isFO && isActive && notAssignedToCoordinatorTeam;
                })
                .map((employee: Record<string, unknown>) => ({
                    id: employee.id as number,
                    firstName: employee.firstName as string,
                    lastName: employee.lastName as string,
                    city: employee.city as string,
                    role: employee.role as string,
                    teamId: employee.teamId as number | null,
                    employeeId: employee.employeeId as string | null,
                    primaryContact: employee.primaryContact as number,
                    email: employee.email as string,
                    departmentName: employee.departmentName as string | null,
                    state: employee.state as string,
                    userDto: employee.userDto as Employee['userDto'],
                    status: employee.status as string,
                    assignedCity: Array.isArray(employee.assignedCity)
                        ? (employee.assignedCity as string[])
                        : [],
                }));

            setEmployees(filteredEmployees);
        } catch (error) {
            console.error('Error fetching all field officers:', error);
        }
    };

    const fetchEmployeesByCities = async (cities: string[]) => {
        try {
            const response = await fetch(
                "/api/proxy/employee/getFieldOfficer",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const fieldOfficersData = await response.json();
            const assignedRegionalSet = new Set(assignedFoIds.regional);

            // Filter field officers from the selected cities (exclude those already in any team)
            const filteredEmployees = fieldOfficersData
                .filter((employee: Record<string, unknown>) => {
                    const isFO = normalizeRoleValue(employee.role as string) === "FIELD_OFFICER";
                    const inCityDirect = cities.includes(employee.city as string);
                    const inCityAssigned = Array.isArray(employee.assignedCity) && employee.assignedCity.some((c: string) => cities.includes(c));
                    const inCity = inCityDirect || inCityAssigned;
                    const isActive = !employee.status || String(employee.status).toLowerCase() === 'active';
                    const notAssignedToRegionalTeam = !assignedRegionalSet.has(employee.id as number);
                    return isFO && inCity && isActive && notAssignedToRegionalTeam;
                })
                .map((employee: Record<string, unknown>) => ({
                    id: employee.id as number,
                    firstName: employee.firstName as string,
                    lastName: employee.lastName as string,
                    city: employee.city as string,
                    role: employee.role as string,
                    teamId: employee.teamId as number | null,
                    employeeId: employee.employeeId as string | null,
                    primaryContact: employee.primaryContact as number,
                    email: employee.email as string,
                    departmentName: employee.departmentName as string | null,
                    state: employee.state as string,
                    userDto: employee.userDto as Employee['userDto'],
                    status: employee.status as string,
                    assignedCity: Array.isArray(employee.assignedCity)
                        ? (employee.assignedCity as string[])
                        : [],
                }));

            setEmployees(filteredEmployees);
        } catch (error) {
            console.error(`Error fetching field officers for cities ${cities.join(", ")}:`, error);
        }
    };

    const handleCitySelect = async () => {
        if (selectedCities.length > 0 && officeManager) {
            const cities = selectedCities.map(option => option.value);
            try {
                for (const city of cities) {
                    await fetch(
                        `/api/proxy/employee/assignCity?id=${officeManager.value}&city=${city}`,
                        {
                            method: 'PUT',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );
                }
                await fetchEmployeesByCities(cities);
            } catch (error) {
                console.error(`Error assigning cities to Regional manager ${officeManager.value}:`, error);
            }
        }
    };

    const handleCreateTeam = async () => {
        if (teamType === 'avp') {
            if (!selectedAvpId || !selectedAvpTeamId) {
                return;
            }
            try {
                setIsCreatingTeam(true);
                setError(null);
                
                // Check if this is a synthetic team ID (negative) for a regional manager without a team
                let actualTeamId = selectedAvpTeamId;
                
                if (selectedAvpTeamId < 0) {
                    // This is a synthetic team - need to get the office manager ID
                    // Synthetic ID format: -(employee.id) - 1000000
                    const employeeId = -(selectedAvpTeamId + 1000000);
                    
                    // Find the team for this manager from teamsWithoutAvp
                    const syntheticTeam = teamsWithoutAvp.find(t => t.id === selectedAvpTeamId);
                    if (!syntheticTeam || !syntheticTeam.officeManager) {
                        console.error("Could not find synthetic team or office manager");
                        throw new Error("Could not find regional manager team");
                    }
                    
                    const officeManagerId = Array.isArray(syntheticTeam.officeManager)
                        ? syntheticTeam.officeManager[0]?.id
                        : syntheticTeam.officeManager.id;
                    
                    if (!officeManagerId || typeof officeManagerId !== "number") {
                        console.error("Invalid office manager ID");
                        throw new Error("Invalid regional manager ID");
                    }
                    
                    // First, create a team for this regional manager
                    const createTeamResponse = await fetch(
                        "/api/proxy/employee/team/create",
                        {
                            method: 'POST',
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                officeManagerId: officeManagerId,
                                fieldOfficerIds: [],
                                teamType: "REGIONAL_MANAGER_TEAM",
                            }),
                        }
                    );
                    
                    if (!createTeamResponse.ok) {
                        const errorText = await createTeamResponse.text();
                        console.error("Error creating team:", errorText);
                        
                        // Check if it's the "id must not be null" error
                        if (errorText.toLowerCase().includes("id must not be null") || 
                            errorText.toLowerCase().includes("given id must not be null")) {
                            const manager = Array.isArray(syntheticTeam.officeManager)
                                ? syntheticTeam.officeManager[0]
                                : syntheticTeam.officeManager;
                            const managerName = manager
                                ? `${manager.firstName ?? ""} ${manager.lastName ?? ""}`.trim()
                                : "the Regional Manager";
                            throw new Error(`Please add team members to ${managerName} first before assigning an AVP.`);
                        }
                        
                        throw new Error("Failed to create team for regional manager");
                    }
                    
                    const createdTeam = await createTeamResponse.json();
                    actualTeamId = createdTeam.id || createdTeam;
                }
                
                // Now assign AVP to the team (either existing or newly created)
                const response = await fetch(
                    `/api/proxy/employee/team/editAvp?id=${actualTeamId}`,
                    {
                        method: 'PUT',
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ avp: selectedAvpId }),
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Error assigning AVP:", errorText);
                    throw new Error(`Failed to assign AVP to team ${actualTeamId}`);
                }

                setIsModalOpen(false);
                resetForm();
                window.location.reload();
            } catch (error) {
                console.error("Error assigning AVP to team:", error);
                const errorMessage = error instanceof Error ? error.message : "An error occurred while assigning AVP to team";
                setError(errorMessage);
            } finally {
                setIsCreatingTeam(false);
            }
            return;
        }

        if (!officeManager) {
            return;
        }

        // For regional managers, field officers are required
        // For coordinators, field officers are optional (can create empty team)
        if (teamType === 'regional' && selectedEmployees.length === 0) {
            return;
        }

        try {
            setIsCreatingTeam(true);

            if (teamType === 'regional' && !isCoordinator) {
                const selectedOfficerDetails = employees.filter((employee) =>
                    selectedEmployees.includes(employee.id)
                );

                const citySet = new Set<string>();

                selectedCities.forEach((cityOption) => {
                    if (cityOption?.value) {
                        citySet.add(cityOption.value.trim());
                    }
                });

                selectedOfficerDetails.forEach((officer) => {
                    if (officer.city) {
                        citySet.add(officer.city.trim());
                    }
                    officer.assignedCity?.forEach((city) => {
                        if (city) {
                            citySet.add(city.trim());
                        }
                    });
                });

                const citiesToAssign = Array.from(citySet).filter(Boolean);

                for (const city of citiesToAssign) {
                    const assignResponse = await fetch(
                        `/api/proxy/employee/assignCity?id=${officeManager.value}&city=${encodeURIComponent(city)}`,
                        {
                            method: 'PUT',
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );

                    if (!assignResponse.ok) {
                        throw new Error(`Failed to assign city ${city} to office manager.`);
                    }
                }
            }

            const payload = {
                officeManager: officeManager.value,
                fieldOfficers: selectedEmployees.length > 0 ? selectedEmployees : [],
            };

            const response = await fetch(
                "/api/proxy/employee/team/create",
                {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (response.status === 200) {
                setIsModalOpen(false);
                resetForm();
                // Optionally refresh the page or notify parent component
                window.location.reload();
            }
        } catch (error: unknown) {
            console.error("Error creating team:", error);
        } finally {
            setIsCreatingTeam(false);
        }
    };

    const handleCityOptionSelect = (option: SearchableOption<CityOption> | null) => {
        if (!option) return;

        const { value, label } = option;
        if (!value || selectedCities.some((city) => city.value === value)) {
            return;
        }

        const next = [...selectedCities, { value, label }];
        setSelectedCities(next);
        const nextCities = next.map(o => o.value);
        fetchEmployeesByCities(nextCities);
    };

    const removeCity = (cityValue: string) => {
        const next = selectedCities.filter(c => c.value !== cityValue);
        setSelectedCities(next);
        if (next.length === 0) {
            setEmployees([]);
        } else {
            fetchEmployeesByCities(next.map(o => o.value));
        }
    };

    const handleTeamOptionSelect = (option: SearchableOption<TeamSummary> | null) => {
        if (!option) {
            setSelectedAvpTeamId(null);
            setError(null);
            return;
        }

        const teamId = Number(option.value);
        if (isNaN(teamId)) {
            return;
        }

        setSelectedAvpTeamId(teamId);
        setError(null); // Clear error when selection changes
    };

    const handleEmployeeToggle = (employeeId: number) => {
        setSelectedEmployees(prev => 
            prev.includes(employeeId) 
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId]
        );
    };

    return (
        <>
            <Button onClick={() => setIsModalOpen(true)}>Add Team</Button>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>
                            {step === 'selectType' ? 'Select Team Type' : 'Create New Team'}
                        </DialogTitle>
                        <DialogDescription>
                            {step === 'selectType' 
                                ? "Choose the type of team you want to create"
                                : teamType === 'coordinator'
                                    ? "Create a coordinator team - Add members later from the Teams page"
                                : teamType === 'regional'
                                        ? "Create a regional manager team with field officers"
                                        : teamType === 'avp'
                                            ? "Assign an AVP to a regional manager team."
                                            : "Configure your new team"
                            }
                        </DialogDescription>
                    </DialogHeader>
                    {step === 'selectType' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                            <Card 
                                className={`cursor-pointer transition-all hover:shadow-lg ${teamType === 'coordinator' ? 'ring-2 ring-purple-500 border-purple-500' : ''}`}
                                onClick={() => {
                                    setTeamType('coordinator');
                                    setOfficeManager(null);
                                    setIsCoordinator(false);
                                    setSelectedEmployees([]);
                                    setSelectedCities([]);
                                    setSelectedAvpId(null);
                                    setSelectedAvpTeamId(null);
                                    setEmployees([]);
                                }}
                            >
                                <CardHeader className="text-center">
                                    <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                        <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <CardTitle className="text-lg text-foreground">Coordinator Team</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-center text-sm text-muted-foreground">
                                        Cross-city team management. Add members later from Teams page.
                                    </CardDescription>
                                </CardContent>
                            </Card>

                            <Card 
                                className={`cursor-pointer transition-all hover:shadow-lg ${teamType === 'regional' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                onClick={() => {
                                    setTeamType('regional');
                                    setOfficeManager(null);
                                    setIsCoordinator(false);
                                    setSelectedEmployees([]);
                                    setSelectedCities([]);
                                    setSelectedAvpId(null);
                                    setSelectedAvpTeamId(null);
                                    setEmployees([]);
                                }}
                            >
                                <CardHeader className="text-center">
                                    <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                        <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <CardTitle className="text-lg text-foreground">Regional Manager Team</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-center text-sm text-muted-foreground">
                                        City-based team with field officers from assigned cities.
                                    </CardDescription>
                                </CardContent>
                            </Card>

                            <Card
                                className={`cursor-pointer transition-all hover:shadow-lg ${teamType === 'avp' ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}
                                onClick={() => {
                                    setTeamType('avp');
                                    setOfficeManager(null);
                                    setIsCoordinator(false);
                                    setSelectedEmployees([]);
                                    setSelectedCities([]);
                                    setSelectedAvpId(null);
                                    setSelectedAvpTeamId(null);
                                    setEmployees([]);
                                }}
                            >
                                <CardHeader className="text-center">
                                    <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                                        <Crown className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <CardTitle className="text-lg text-foreground">AVP Assignment</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-center text-sm text-muted-foreground">
                                        Assign an AVP to lead a regional manager team.
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {teamType !== 'avp' && (
                                <div>
                                    <label htmlFor="officeManager" className="text-sm font-medium">
                                        {teamType === 'coordinator' ? 'Select Coordinator' : 'Select Regional Manager'}
                                    </label>
                                    <SearchableSelect<OfficeManager>
                                        options={managerOptions}
                                        value={officeManager ? officeManager.value.toString() : undefined}
                                        onSelect={handleOfficeManagerSelect}
                                        placeholder={teamType === 'coordinator' ? 'Select a Coordinator' : 'Select a Regional Manager'}
                                        emptyMessage={teamType === 'coordinator' ? 'No coordinators available' : 'No regional managers available'}
                                        noResultsMessage="No matches found"
                                        searchPlaceholder="Search by name..."
                                        allowClear={Boolean(officeManager)}
                                    />
                                </div>
                            )}

                            {teamType === 'regional' && !isCoordinator && (
                                <>
                                    <div>
                                        <label htmlFor="city" className="text-sm font-medium">Cities</label>
                                        <SearchableSelect<CityOption>
                                            options={cityOptions}
                                            value={undefined}
                                            onSelect={handleCityOptionSelect}
                                            placeholder="Select cities"
                                            emptyMessage="No cities available"
                                            noResultsMessage="No cities match your search"
                                            searchPlaceholder="Search cities..."
                                            allowClear={false}
                                        />
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {selectedCities.map((city) => (
                                                <div key={city.value} className="flex items-center gap-1 bg-muted border border-border px-3 py-1.5 rounded-md text-sm text-foreground">
                                                    {city.label}
                                                    <button 
                                                        onClick={() => removeCity(city.value)}
                                                        className="text-muted-foreground hover:text-foreground ml-1 transition-colors"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <Button className="mt-2" onClick={handleCitySelect} disabled={selectedCities.length === 0}>
                                            Load Field Officers
                                        </Button>
                                    </div>

                                    {selectedCities.length > 0 && (
                                        <div>
                                            <label className="text-sm font-medium">Team Members ({employees.length} available)</label>
                                            <div className="max-h-60 overflow-y-auto mt-2 border border-border rounded-md p-2 bg-background">
                                                {employees.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                                        No field officers available in the selected cities.
                                                    </p>
                                                ) : (
                                                    employees.map((employee) => (
                                                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md mb-1 hover:bg-muted">
                                                            <Checkbox
                                                                id={`employee-${employee.id}`}
                                                                checked={selectedEmployees.includes(employee.id)}
                                                                onCheckedChange={() => handleEmployeeToggle(employee.id)}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <label htmlFor={`employee-${employee.id}`} className="font-medium cursor-pointer text-sm block truncate text-foreground">
                                                                    {employee.firstName} {employee.lastName}
                                                                </label>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {employee.city}, {employee.state}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {teamType === 'avp' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium">Select AVP</label>
                                        <SearchableSelect<Employee>
                                            options={avpOptions}
                                            value={selectedAvpId != null ? selectedAvpId.toString() : undefined}
                                            onSelect={(option) => setSelectedAvpId(option ? Number(option.value) : null)}
                                            placeholder="Select an AVP"
                                            emptyMessage="No AVPs available"
                                            noResultsMessage="No AVPs found"
                                            searchPlaceholder="Search AVPs..."
                                            allowClear={Boolean(selectedAvpId)}
                                        />
                                        {availableAvps.length === 0 && (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                All AVPs already manage a team.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-sm font-medium">Assign to Team</label>
                                        <SearchableSelect<TeamSummary>
                                            options={avpTeamOptions}
                                            value={selectedAvpTeamId != null ? selectedAvpTeamId.toString() : undefined}
                                            onSelect={handleTeamOptionSelect}
                                            placeholder="Select a regional manager team"
                                            emptyMessage="No teams available"
                                            noResultsMessage="No teams found"
                                            searchPlaceholder="Search teams..."
                                            allowClear={Boolean(selectedAvpTeamId)}
                                        />
                                        {teamsWithoutAvp.length === 0 && (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                All regional teams already have an AVP assigned.
                                            </p>
                                        )}
                                    </div>
                                    {error && (
                                        <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                                            <p className="font-medium">Error</p>
                                            <p>{error}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-between mt-4">
                        <div>
                            {step === 'createTeam' && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setStep('selectType');
                                        setOfficeManager(null);
                                        setSelectedCities([]);
                                        setSelectedEmployees([]);
                                        setSelectedAvpId(null);
                                        setSelectedAvpTeamId(null);
                                        setEmployees([]);
                                    }}
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back
                                </Button>
                            )}
                        </div>
                        <div className="flex space-x-2">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            {step === 'selectType' ? (
                                <Button
                                    onClick={() => {
                                        setStep('createTeam');
                                        setOfficeManager(null);
                                        setSelectedEmployees([]);
                                        setSelectedCities([]);
                                        setSelectedAvpId(null);
                                        setSelectedAvpTeamId(null);
                                        setEmployees([]);
                                        fetchOfficeManagers();
                                        if (teamType === 'regional') {
                                            fetchCities();
                                        }
                                    }}
                                    disabled={!teamType}
                                >
                                    Next
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleCreateTeam}
                                    disabled={
                                        isCreatingTeam ||
                                        (teamType === 'avp'
                                            ? (!selectedAvpId || !selectedAvpTeamId)
                                            : (!officeManager || (teamType === 'regional' && selectedEmployees.length === 0)))
                                    }
                                >
                                    {isCreatingTeam ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {teamType === 'avp' ? 'Saving...' : 'Creating...'}
                                        </span>
                                    ) : (
                                        teamType === 'avp' ? 'Assign AVP' : 'Create Team'
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AddTeam;
