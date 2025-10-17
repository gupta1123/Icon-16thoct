"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
    Plus
} from 'lucide-react';
import { normalizeRoleValue } from '@/lib/role-utils';

interface Team {
    id: number;
    officeManager: {
        id: number;
        firstName: string | null;
        lastName: string | null;
        assignedCity: string[];
        role?: string;
    };
    fieldOfficers: FieldOfficer[];
    teamType?: string; // "COORDINATOR_TEAM" or "REGIONAL_MANAGER_TEAM"
}

interface FieldOfficer {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
}

const resolveTeamCategory = (team: Team): 'coordinator' | 'regional' | null => {
    const normalizedTeamType = typeof team.teamType === 'string' ? team.teamType.toUpperCase() : '';
    if (normalizedTeamType === 'COORDINATOR_TEAM') {
        return 'coordinator';
    }
    if (normalizedTeamType === 'REGIONAL_MANAGER_TEAM') {
        return 'regional';
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
    const [currentPage, setCurrentPage] = useState<{ [key: number]: number }>({});
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [newCity, setNewCity] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCoordinatorTeam, setIsCoordinatorTeam] = useState(false);

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
            const response = await fetch('/api/proxy/employee/team/getAll', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch teams: ${response.statusText}`);
            }

            const data = await response.json();
            setTeams(data);
            setIsDataAvailable(data.length > 0);
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

    const handleRemoveFieldOfficer = async (teamId: number, fieldOfficerId: number) => {
        if (!token) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/proxy/employee/team/deleteFieldOfficer?id=${teamId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fieldOfficers: [fieldOfficerId],
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove field officer');
            }

            await fetchTeams();
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

    const handlePageChange = (teamId: number, newPage: number) => {
        setCurrentPage(prev => ({ ...prev, [teamId]: newPage }));
    };

    const getInitials = (firstName: string | null, lastName: string | null) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    const getTeamTypeInfo = (team: Team) => {
        const teamType = team.teamType || (team.officeManager?.role === 'Coordinator' ? 'COORDINATOR_TEAM' : 'REGIONAL_MANAGER_TEAM');
        
        if (teamType === 'COORDINATOR_TEAM') {
            return {
                label: 'Coordinator Team',
                badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
                icon: Users
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
                            {isDataAvailable ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {teams.map((team) => {
                                        const pageCount = Math.ceil(team.fieldOfficers.length / 4);
                                        const currentPageForTeam = currentPage[team.id] || 1;
                                        const startIndex = (currentPageForTeam - 1) * 4;
                                        const visibleOfficers = team.fieldOfficers.slice(startIndex, startIndex + 4);

                                        const teamTypeInfo = getTeamTypeInfo(team);
                                        const TeamIcon = teamTypeInfo.icon;
                                        
                                        return (
                                            <Card key={team.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                                                <CardContent className="p-6">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center">
                                                            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-3 text-lg font-semibold">
                                                                {getInitials(team.officeManager?.firstName, team.officeManager?.lastName)}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-foreground">
                                                                    {team.officeManager?.firstName ?? 'N/A'} {team.officeManager?.lastName ?? 'N/A'}
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
                                                                        onClick={() => handleRemoveFieldOfficer(team.id, officer.id)}
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
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
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
