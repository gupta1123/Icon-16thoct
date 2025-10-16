"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Building2, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const AddTeam = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [step, setStep] = useState<'selectType' | 'createTeam'>('selectType');
    const [teamType, setTeamType] = useState<'coordinator' | 'regional' | null>(null);
    const [officeManager, setOfficeManager] = useState<{ value: number, label: string, role: string } | null>(null);
    const [selectedCities, setSelectedCities] = useState<CityOption[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
    const [officeManagers, setOfficeManagers] = useState<OfficeManager[]>([]);
    const [cities, setCities] = useState<CityOption[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [citySelectValue, setCitySelectValue] = useState<string>("placeholder");
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [assignedFoIds, setAssignedFoIds] = useState<Set<number>>(new Set());
    const [isCoordinator, setIsCoordinator] = useState(false);

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
        setCitySelectValue("placeholder");
        setIsCoordinator(false);
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

            const assignedManagerIds = teamsData.map((team: { officeManager: { id: number } }) => team.officeManager.id);
            const deletedManagerIds = allEmployeesData
                .filter((employee: OfficeManager) => 
                    (employee.role === "Manager" || 
                     employee.role === "Office Manager" || 
                     employee.role === "Regional Manager" || 
                     employee.role === "Coordinator") && 
                    employee.deleted)
                .map((employee: OfficeManager) => employee.id);
            const availableManagers = allEmployeesData
                .filter((employee: OfficeManager) =>
                    (employee.role === "Manager" || 
                     employee.role === "Office Manager" || 
                     employee.role === "Regional Manager" || 
                     employee.role === "Coordinator") &&
                    !assignedManagerIds.includes(employee.id) &&
                    !deletedManagerIds.includes(employee.id)
                );

            setOfficeManagers(availableManagers);
            // Build set of all field officer IDs already in any team
            const assignedIds = new Set<number>();
            for (const team of teamsData) {
                const members = Array.isArray(team.fieldOfficers) ? team.fieldOfficers : [];
                for (const member of members) {
                    if (member && typeof member.id === 'number') {
                        assignedIds.add(member.id);
                    }
                }
            }
            setAssignedFoIds(assignedIds);
        } catch (error) {
            console.error("Error fetching Regional managers:", error);
        }
    }, [token]);
   
    const handleOfficeManagerChange = (value: string) => {
        if (value === "placeholder") return;
        
        const manager = officeManagers.find(m => m.id.toString() === value);
        if (manager) {
            const isCoord = manager.role?.toLowerCase() === "coordinator";
            setOfficeManager({ 
                value: manager.id, 
                label: `${manager.firstName} ${manager.lastName}`,
                role: manager.role || ""
            });
            setIsCoordinator(isCoord);
            // Clear previously selected employees when manager changes
            setSelectedEmployees([]);
            
            // If coordinator, fetch all field officers immediately (no city restrictions)
            if (isCoord) {
                setSelectedCities([]);
                fetchAllFieldOfficers();
            } else if (selectedCities.length > 0) {
                // For regional managers, refresh available employees for currently selected cities
                const cities = selectedCities.map(option => option.value);
                fetchEmployeesByCities(cities);
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
        if (isModalOpen && token) {
            fetchOfficeManagers();
            fetchCities();
        }
    }, [isModalOpen, token, fetchOfficeManagers, fetchCities]);

    // Re-filter employees when assigned team membership changes
    useEffect(() => {
        if (isModalOpen && selectedCities.length > 0) {
            const cities = selectedCities.map((c) => c.value);
            fetchEmployeesByCities(cities);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assignedFoIds]);

    const fetchAllFieldOfficers = async () => {
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
            
            // For coordinators: show all field officers (no city restrictions, but exclude those already in any team)
            const filteredEmployees = fieldOfficersData
                .filter((employee: Record<string, unknown>) => {
                    const isFO = typeof employee.role === 'string' && employee.role.toLowerCase() === 'field officer';
                    const isActive = !employee.status || String(employee.status).toLowerCase() === 'active';
                    const notInAnyTeam = !assignedFoIds.has(employee.id as number);
                    return isFO && isActive && notInAnyTeam;
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
                    status: employee.status as string
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
            
            // Filter field officers from the selected cities (exclude those already in any team)
            const filteredEmployees = fieldOfficersData
                .filter((employee: Record<string, unknown>) => {
                    const isFO = typeof employee.role === 'string' && employee.role.toLowerCase() === 'field officer';
                    const inCityDirect = cities.includes(employee.city as string);
                    const inCityAssigned = Array.isArray(employee.assignedCity) && employee.assignedCity.some((c: string) => cities.includes(c));
                    const inCity = inCityDirect || inCityAssigned;
                    const isActive = !employee.status || String(employee.status).toLowerCase() === 'active';
                    const notInAnyTeam = !assignedFoIds.has(employee.id as number);
                    return isFO && inCity && isActive && notInAnyTeam;
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
                    status: employee.status as string
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
        if (!officeManager) {
            return;
        }

        // For regional managers, field officers are required
        // For coordinators, field officers are optional (can create empty team)
        if (!isCoordinator && selectedEmployees.length === 0) {
            return;
        }

        try {
            setIsCreatingTeam(true);
            const response = await fetch(
                "/api/proxy/employee/team/create",
                {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        officeManager: officeManager.value,
                        fieldOfficers: selectedEmployees.length > 0 ? selectedEmployees : [],
                    }),
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

    const handleCityChange = (value: string) => {
        if (value === "placeholder") return;
        
        const cityOption = cities.find(c => c.value === value);
        if (cityOption && !selectedCities.find(c => c.value === value)) {
            const next = [...selectedCities, cityOption];
            setSelectedCities(next);
            // Auto-load available field officers for the selected cities (independent of manager)
            const nextCities = next.map(o => o.value);
            fetchEmployeesByCities(nextCities);
        }
        
        // Reset the select to placeholder after selection
        setCitySelectValue("placeholder");
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
                                    : "Create a regional manager team with field officers"
                            }
                        </DialogDescription>
                    </DialogHeader>
                    {step === 'selectType' ? (
                        <div className="grid grid-cols-2 gap-4 py-4">
                            <Card 
                                className={`cursor-pointer transition-all hover:shadow-lg ${teamType === 'coordinator' ? 'ring-2 ring-purple-500 border-purple-500' : ''}`}
                                onClick={() => setTeamType('coordinator')}
                            >
                                <CardHeader className="text-center">
                                    <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                                        <Users className="h-8 w-8 text-purple-600" />
                                    </div>
                                    <CardTitle className="text-lg">Coordinator Team</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-center text-sm">
                                        Cross-city team management. Add members later from Teams page.
                                    </CardDescription>
                                </CardContent>
                            </Card>

                            <Card 
                                className={`cursor-pointer transition-all hover:shadow-lg ${teamType === 'regional' ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                                onClick={() => setTeamType('regional')}
                            >
                                <CardHeader className="text-center">
                                    <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Building2 className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <CardTitle className="text-lg">Regional Manager Team</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-center text-sm">
                                        City-based team with field officers from assigned cities.
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="officeManager" className="text-sm font-medium">
                                    {teamType === 'coordinator' ? 'Select Coordinator' : 'Select Regional Manager'}
                                </label>
                                <Select value={officeManager?.value.toString() || "placeholder"} onValueChange={handleOfficeManagerChange}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder={`Select a ${teamType === 'coordinator' ? 'Coordinator' : 'Regional Manager'}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="placeholder" disabled>
                                            Select a {teamType === 'coordinator' ? 'Coordinator' : 'Regional Manager'}
                                        </SelectItem>
                                        {officeManagers
                                            .filter(manager => 
                                                teamType === 'coordinator' 
                                                    ? manager.role?.toLowerCase() === 'coordinator'
                                                    : manager.role?.toLowerCase() !== 'coordinator'
                                            )
                                            .map((manager) => (
                                                <SelectItem key={manager.id} value={manager.id.toString()}>
                                                    {manager.firstName} {manager.lastName} ({manager.role})
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {teamType === 'regional' && !isCoordinator && (
                                <>
                                    <div>
                                        <label htmlFor="city" className="text-sm font-medium">Cities</label>
                                        <Select value={citySelectValue} onValueChange={handleCityChange}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Select cities" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="placeholder" disabled>
                                                    Select cities
                                                </SelectItem>
                                                {cities.map((city) => (
                                                    <SelectItem key={city.value} value={city.value}>
                                                        {city.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {selectedCities.map((city) => (
                                                <div key={city.value} className="flex items-center gap-1 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-md text-sm">
                                                    {city.label}
                                                    <button 
                                                        onClick={() => removeCity(city.value)}
                                                        className="text-slate-500 hover:text-slate-700 ml-1 transition-colors"
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
                                            <div className="max-h-60 overflow-y-auto mt-2 border rounded-md p-2">
                                                {employees.length === 0 ? (
                                                    <p className="text-sm text-gray-500 py-4 text-center">
                                                        No field officers available in the selected cities.
                                                    </p>
                                                ) : (
                                                    employees.map((employee) => (
                                                        <div key={employee.id} className="flex items-center space-x-3 p-2 rounded-md mb-1 hover:bg-slate-50">
                                                            <Checkbox
                                                                id={`employee-${employee.id}`}
                                                                checked={selectedEmployees.includes(employee.id)}
                                                                onCheckedChange={() => handleEmployeeToggle(employee.id)}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <label htmlFor={`employee-${employee.id}`} className="font-medium cursor-pointer text-sm block truncate">
                                                                    {employee.firstName} {employee.lastName}
                                                                </label>
                                                                <div className="text-xs text-gray-500 truncate">
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
                                        fetchOfficeManagers();
                                        fetchCities();
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
                                        !officeManager || 
                                        (teamType === 'regional' && selectedEmployees.length === 0) ||
                                        isCreatingTeam
                                    }
                                >
                                    {isCreatingTeam ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating...
                                        </span>
                                    ) : (
                                        'Create Team'
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
