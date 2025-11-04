"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building,
  Crown,
  Plus,
  Trash2,
  User,
  Users,
  X,
  Loader2,
  MapPin,
  Navigation,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { Checkbox } from "@/components/ui/checkbox";

// Dummy data types
type FieldOfficer = {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
};

type RegionalManager = {
  id: number;
  teamId?: number; // Optional teamId to distinguish same RM in different teams
  firstName: string;
  lastName: string;
  city: string;
  assignedCities?: string[]; // Cities assigned to this Regional Manager
  fieldOfficers: FieldOfficer[];
};

type AVPTeam = {
  id: number;
  firstName: string;
  lastName: string;
  regionalManagers: RegionalManager[];
};

type CoordinatorTeam = {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  fieldOfficers: FieldOfficer[];
};

// Helper function to get initials
const getInitials = (firstName: string, lastName: string): string => {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
};

const formatName = (firstName: string, lastName: string): string => {
  return `${firstName} ${lastName}`.trim();
};

// API Response Types
interface ApiEmployee {
  id: number;
  name: string;
  role?: string;
  city?: string;
  state?: string;
  employeeCode?: string;
  assignedCities?: string[];
  [key: string]: unknown;
}

interface ApiManagerEntry {
  teamId: number;
  manager: ApiEmployee;
  avp?: ApiEmployee;
  fieldOfficers?: ApiEmployee[];
}

interface ApiAvpGroup {
  avp: ApiEmployee;
  managers: Array<{
    teamId: number;
    manager: ApiEmployee;
  }>;
}

interface ApiTeamHierarchyResponse {
  avpTeams?: ApiAvpGroup[];
  regionalManagerTeams?: ApiManagerEntry[];
  coordinatorTeams?: ApiManagerEntry[];
}

// Helper to split name into first and last
const splitName = (name: string): { firstName: string; lastName: string } => {
  const parts = name.trim().split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
};

// Type for API employee with firstName/lastName
interface ApiEmployeeWithName {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  city?: string;
  [key: string]: unknown;
}

// Transform API employee to FieldOfficer
const toFieldOfficer = (emp: ApiEmployee | ApiEmployeeWithName): FieldOfficer => {
  // Handle both API response formats: with 'name' field or 'firstName'/'lastName' fields
  let firstName = "";
  let lastName = "";
  
  if (emp.firstName !== undefined && emp.lastName !== undefined) {
    // Format from getAllFieldOfficers API
    firstName = typeof emp.firstName === 'string' ? emp.firstName : "";
    lastName = typeof emp.lastName === 'string' ? emp.lastName : "";
  } else if (emp.name && typeof emp.name === 'string') {
    // Format from team hierarchy API
    const nameParts = splitName(emp.name);
    firstName = nameParts.firstName;
    lastName = nameParts.lastName;
  }
  
  return {
    id: emp.id,
    firstName,
    lastName,
    city: typeof emp.city === 'string' ? emp.city : "",
  };
};

// Transform API employee to RegionalManager
const toRegionalManager = (emp: ApiEmployee, fieldOfficers: FieldOfficer[], teamId?: number, assignedCities?: string[]): RegionalManager => {
  const { firstName, lastName } = splitName(emp.name);
  return {
    id: emp.id,
    teamId,
    firstName,
    lastName,
    city: emp.city || "",
    assignedCities: assignedCities || emp.assignedCities || [],
    fieldOfficers,
  };
};

export default function TestTeamsPage() {
  const { token } = useAuth();
  
  const [avpTeams, setAvpTeams] = useState<AVPTeam[]>([]);
  const [regionalManagerTeams, setRegionalManagerTeams] = useState<RegionalManager[]>([]);
  const [coordinatorTeams, setCoordinatorTeams] = useState<CoordinatorTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentCardType, setCurrentCardType] = useState<"avp-rm" | "avp-fo" | "rm" | "coord" | null>(null);
  const [currentCardId, setCurrentCardId] = useState<number | null>(null);
  const [currentRmId, setCurrentRmId] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    name: string;
    onConfirm: () => void;
  }>({ open: false, name: "", onConfirm: () => {} });

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [selectedOfficers, setSelectedOfficers] = useState<number[]>([]);

  // Helper function to transform API response to state
  const transformApiData = (data: ApiTeamHierarchyResponse) => {
    // Transform Regional Manager Teams - always show separately even if under multiple AVPs
    const rmTeamsMap = new Map<number, RegionalManager>();
    const allFieldOfficers = new Set<number>();

    // Process regionalManagerTeams first to get all RM teams with their field officers
    if (data.regionalManagerTeams) {
      data.regionalManagerTeams.forEach((rmEntry) => {
        const fieldOfficers = (rmEntry.fieldOfficers || []).map(toFieldOfficer);
        fieldOfficers.forEach((fo) => allFieldOfficers.add(fo.id));

        // Each RM team gets its own entry - even if same RM appears in multiple places
        const rmKey = rmEntry.teamId; // Use teamId as key to ensure separate cards
        if (!rmTeamsMap.has(rmKey)) {
          const rm = toRegionalManager(rmEntry.manager, fieldOfficers, rmEntry.teamId, rmEntry.manager.assignedCities);
          rmTeamsMap.set(rmKey, rm);
        }
      });
    }

    // Also process RMs from AVP teams to ensure they're all included, even without field officers
    if (data.avpTeams) {
      data.avpTeams.forEach((avpGroup) => {
        avpGroup.managers.forEach((mgrEntry) => {
          const rmKey = mgrEntry.teamId;
          // Only add if not already in the map (to avoid overwriting data from regionalManagerTeams)
          if (!rmTeamsMap.has(rmKey)) {
            // Try to find field officers from regionalManagerTeams
            const rmEntry = data.regionalManagerTeams?.find(
              (rm) => rm.teamId === mgrEntry.teamId
            );
            const fieldOfficers = (rmEntry?.fieldOfficers || []).map(toFieldOfficer);
            
            // Create RM entry even if no field officers
            const rm = toRegionalManager(mgrEntry.manager, fieldOfficers, mgrEntry.teamId, mgrEntry.manager.assignedCities);
            rmTeamsMap.set(rmKey, rm);
          }
        });
      });
    }

    const transformedRmTeams = Array.from(rmTeamsMap.values());

    // Transform AVP Teams
    const avpTeamsData: AVPTeam[] = [];
    if (data.avpTeams) {
      data.avpTeams.forEach((avpGroup) => {
        const { firstName, lastName } = splitName(avpGroup.avp.name);
        const regionalManagers: RegionalManager[] = [];

        // Process each manager under this AVP
        avpGroup.managers.forEach((mgrEntry) => {
          // Find the full RM team data including field officers
          const rmEntry = data.regionalManagerTeams?.find(
            (rm) => rm.teamId === mgrEntry.teamId
          );

          const fieldOfficers = (rmEntry?.fieldOfficers || []).map(toFieldOfficer);
          fieldOfficers.forEach((fo) => allFieldOfficers.add(fo.id));

          const rm = toRegionalManager(mgrEntry.manager, fieldOfficers, mgrEntry.teamId, mgrEntry.manager.assignedCities);
          regionalManagers.push(rm);
        });

        if (regionalManagers.length > 0) {
          avpTeamsData.push({
            id: avpGroup.avp.id,
            firstName,
            lastName,
            regionalManagers,
          });
        }
      });
    }

    // Transform Coordinator Teams
    const coordTeams: CoordinatorTeam[] = [];
    if (data.coordinatorTeams) {
      data.coordinatorTeams.forEach((coordEntry) => {
        const { firstName, lastName } = splitName(coordEntry.manager.name);
        const fieldOfficers = (coordEntry.fieldOfficers || []).map(toFieldOfficer);
        fieldOfficers.forEach((fo) => allFieldOfficers.add(fo.id));

        coordTeams.push({
          id: coordEntry.teamId,
          firstName,
          lastName,
          city: coordEntry.manager.city || "",
          fieldOfficers,
        });
      });
    }

    return {
      avpTeams: avpTeamsData,
      regionalManagerTeams: transformedRmTeams,
      coordinatorTeams: coordTeams,
    };
  };

  // Fetch data from API
  useEffect(() => {
    const fetchTeamHierarchy = async () => {
      if (!token) {
        setError("Authentication token not found. Please log in.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/proxy/employee/team/hierarchy", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch teams: ${response.status} ${response.statusText}`);
        }

        const data: ApiTeamHierarchyResponse = await response.json();
        const transformed = transformApiData(data);
        
        setAvpTeams(transformed.avpTeams);
        setRegionalManagerTeams(transformed.regionalManagerTeams);
        setCoordinatorTeams(transformed.coordinatorTeams);
      } catch (err) {
        console.error("Error fetching team hierarchy:", err);
        setError(err instanceof Error ? err.message : "Failed to load teams");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamHierarchy();
  }, [token]);

  const handleAddFieldOfficer = (
    type: "avp-rm" | "avp-fo" | "rm" | "coord",
    cardId: number,
    rmId?: number
  ) => {
    setCurrentCardType(type);
    setCurrentCardId(cardId);
    setCurrentRmId(rmId ?? null);
    setSelectedOfficers([]); // Reset selections when dialog opens
    setIsAddDialogOpen(true);
  };

  const handleToggleOfficerSelection = (officerId: number) => {
    setSelectedOfficers((prev) =>
      prev.includes(officerId)
        ? prev.filter((id) => id !== officerId)
        : [...prev, officerId]
    );
  };

  const handleConfirmAddFieldOfficer = async (officerIds?: number[]) => {
    const officersToAdd = officerIds || selectedOfficers;
    
    if (officersToAdd.length === 0) {
      setError("Please select at least one field officer");
      return;
    }

    if (!currentCardType || currentCardId === null || !token) return;

    // Determine teamId based on card type
    let teamId: number | null = null;

    if (currentCardType === "avp-rm" || currentCardType === "avp-fo") {
      // For AVP teams, find the RM teamId
      const avpTeam = avpTeams.find((t) => t.id === currentCardId);
      if (currentCardType === "avp-rm" && currentRmId !== null && avpTeam) {
        const rm = avpTeam.regionalManagers.find((r) => r.id === currentRmId);
        teamId = rm?.teamId ?? null;
      } else if (currentCardType === "avp-fo" && avpTeam && avpTeam.regionalManagers.length > 0) {
        teamId = avpTeam.regionalManagers[0]?.teamId ?? null;
      }
    } else if (currentCardType === "rm") {
      // For RM teams, use teamId from the regional manager
      const rm = regionalManagerTeams.find((r) => r.id === currentCardId);
      teamId = rm?.teamId ?? null;
    } else if (currentCardType === "coord") {
      // For coordinator teams, use the team id
      teamId = currentCardId;
    }

    if (!teamId) {
      setError("Unable to determine team ID");
      return;
    }

    try {
      const response = await fetch(
        `/api/proxy/employee/team/addFieldOfficer?id=${teamId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fieldOfficers: officersToAdd,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add field officer");
      }

      // Refresh data from API
      const refreshResponse = await fetch("/api/proxy/employee/team/hierarchy", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (refreshResponse.ok) {
        const refreshData: ApiTeamHierarchyResponse = await refreshResponse.json();
        const transformed = transformApiData(refreshData);
        
        setAvpTeams(transformed.avpTeams);
        setRegionalManagerTeams(transformed.regionalManagerTeams);
        setCoordinatorTeams(transformed.coordinatorTeams);
      }

      setIsAddDialogOpen(false);
      setSelectedOfficers([]);
      setCurrentCardType(null);
      setCurrentCardId(null);
      setCurrentRmId(null);
    } catch (err) {
      console.error("Error adding field officer:", err);
      setError(err instanceof Error ? err.message : "Failed to add field officer");
    }
  };

  const handleDeleteFieldOfficer = (
    type: "avp-rm" | "avp-fo" | "rm" | "coord",
    cardId: number,
    officerId: number,
    rmId?: number
  ) => {
    let officerName = "";
    if (type === "avp-rm" || type === "avp-fo") {
      const team = avpTeams.find((t) => t.id === cardId);
      if (team) {
        const targetRm = rmId !== null ? team.regionalManagers.find((rm) => rm.id === rmId) : team.regionalManagers[0];
        const officer = targetRm?.fieldOfficers.find((o) => o.id === officerId);
        officerName = officer ? formatName(officer.firstName, officer.lastName) : "";
      }
    } else if (type === "rm") {
      const rm = regionalManagerTeams.find((r) => r.id === cardId);
      const officer = rm?.fieldOfficers.find((o) => o.id === officerId);
      officerName = officer ? formatName(officer.firstName, officer.lastName) : "";
    } else if (type === "coord") {
      const team = coordinatorTeams.find((t) => t.id === cardId);
      const officer = team?.fieldOfficers.find((o) => o.id === officerId);
      officerName = officer ? formatName(officer.firstName, officer.lastName) : "";
    }

    setDeleteConfirmation({
      open: true,
      name: officerName,
      onConfirm: async () => {
        if (!token) {
          setError("Authentication token not found");
          return;
        }

        // Determine teamId based on card type
        let teamId: number | null = null;

        if (type === "avp-rm" || type === "avp-fo") {
          const avpTeam = avpTeams.find((t) => t.id === cardId);
          if (type === "avp-rm" && rmId !== null && avpTeam) {
            const rm = avpTeam.regionalManagers.find((r) => r.id === rmId);
            teamId = rm?.teamId ?? null;
          } else if (type === "avp-fo" && avpTeam && avpTeam.regionalManagers.length > 0) {
            teamId = avpTeam.regionalManagers[0]?.teamId ?? null;
          }
        } else if (type === "rm") {
          const rm = regionalManagerTeams.find((r) => r.id === cardId);
          teamId = rm?.teamId ?? null;
        } else if (type === "coord") {
          teamId = cardId;
        }

        if (!teamId) {
          setError("Unable to determine team ID");
          setDeleteConfirmation({ open: false, name: "", onConfirm: () => {} });
          return;
        }

        try {
          const response = await fetch(
            `/api/proxy/employee/team/deleteFieldOfficer?id=${teamId}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fieldOfficers: [officerId],
              }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to remove field officer");
          }

          // Refresh data from API
          const refreshResponse = await fetch("/api/proxy/employee/team/hierarchy", {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          });

          if (refreshResponse.ok) {
            const refreshData: ApiTeamHierarchyResponse = await refreshResponse.json();
            const transformed = transformApiData(refreshData);
            
            setAvpTeams(transformed.avpTeams);
            setRegionalManagerTeams(transformed.regionalManagerTeams);
            setCoordinatorTeams(transformed.coordinatorTeams);
          }

          setDeleteConfirmation({ open: false, name: "", onConfirm: () => {} });
        } catch (err) {
          console.error("Error removing field officer:", err);
          setError(err instanceof Error ? err.message : "Failed to remove field officer");
          setDeleteConfirmation({ open: false, name: "", onConfirm: () => {} });
        }
      },
    });
  };

  const [availableOfficersForDialog, setAvailableOfficersForDialog] = useState<FieldOfficer[]>([]);
  const [isLoadingOfficers, setIsLoadingOfficers] = useState(false);

  // Fetch available field officers when dialog opens
  useEffect(() => {
    const fetchAvailableOfficers = async () => {
      if (!isAddDialogOpen || !currentCardType || currentCardId === null || !token) {
        setAvailableOfficersForDialog([]);
        return;
      }

      setIsLoadingOfficers(true);
      try {
        let existingOfficerIds: number[] = [];
        let allAvailableOfficers: FieldOfficer[] = [];

        // Get existing officer IDs for the current team
        if (currentCardType === "avp-rm" || currentCardType === "avp-fo") {
          const team = avpTeams.find((t) => t.id === currentCardId);
          if (team) {
            if (currentCardType === "avp-rm" && currentRmId !== null) {
              const rm = team.regionalManagers.find((r) => r.id === currentRmId);
              existingOfficerIds = rm?.fieldOfficers.map((o) => o.id) ?? [];
              // Fetch by assignedCities for RM teams - make separate calls for each city
              const assignedCities = rm?.assignedCities || [];
              if (assignedCities.length > 0) {
                const cityPromises = assignedCities.map(city =>
                  fetch(
                    `/api/proxy/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  )
                );
                
                const responses = await Promise.all(cityPromises);
                const allCityData = await Promise.all(
                  responses.map(async (response) => {
                    if (response.ok) {
                      return await response.json();
                    }
                    return [];
                  })
                );
                
                const allOfficersFromCities = allCityData.flat() as ApiEmployeeWithName[];
                const uniqueOfficersMap = new Map<number, ApiEmployeeWithName>();
                allOfficersFromCities
                  .filter((o: ApiEmployeeWithName) => {
                    const role = o.role?.toUpperCase() || "";
                    return role.includes("FIELD_OFFICER") || role.includes("FIELD OFFICER");
                  })
                  .forEach((o: ApiEmployeeWithName) => {
                    if (!uniqueOfficersMap.has(o.id)) {
                      uniqueOfficersMap.set(o.id, o);
                    }
                  });
                allAvailableOfficers = Array.from(uniqueOfficersMap.values()).map(toFieldOfficer);
              }
            } else if (currentCardType === "avp-fo") {
              const firstRm = team.regionalManagers[0];
              existingOfficerIds = firstRm?.fieldOfficers.map((o) => o.id) ?? [];
              // Fetch by assignedCities for first RM - make separate calls for each city
              const assignedCities = firstRm?.assignedCities || [];
              if (assignedCities.length > 0) {
                const cityPromises = assignedCities.map(city =>
                  fetch(
                    `/api/proxy/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  )
                );
                
                const responses = await Promise.all(cityPromises);
                const allCityData = await Promise.all(
                  responses.map(async (response) => {
                    if (response.ok) {
                      return await response.json();
                    }
                    return [];
                  })
                );
                
                const allOfficersFromCities = allCityData.flat() as ApiEmployeeWithName[];
                const uniqueOfficersMap = new Map<number, ApiEmployeeWithName>();
                allOfficersFromCities
                  .filter((o: ApiEmployeeWithName) => {
                    const role = o.role?.toUpperCase() || "";
                    return role.includes("FIELD_OFFICER") || role.includes("FIELD OFFICER");
                  })
                  .forEach((o: ApiEmployeeWithName) => {
                    if (!uniqueOfficersMap.has(o.id)) {
                      uniqueOfficersMap.set(o.id, o);
                    }
                  });
                allAvailableOfficers = Array.from(uniqueOfficersMap.values()).map(toFieldOfficer);
              }
            }
          }
        } else if (currentCardType === "rm") {
          const rm = regionalManagerTeams.find((r) => r.id === currentCardId);
          existingOfficerIds = rm?.fieldOfficers.map((o) => o.id) ?? [];
          // Fetch by assignedCities for RM teams - make separate calls for each city
          const assignedCities = rm?.assignedCities || [];
          if (assignedCities.length > 0) {
            // Make API calls for each city
            const cityPromises = assignedCities.map(city =>
              fetch(
                `/api/proxy/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              )
            );
            
            const responses = await Promise.all(cityPromises);
            const allCityData = await Promise.all(
              responses.map(async (response) => {
                if (response.ok) {
                  return await response.json();
                }
                return [];
              })
            );
            
            // Flatten and combine all officers from all cities, removing duplicates by ID
            const allOfficersFromCities = allCityData.flat() as ApiEmployeeWithName[];
            const uniqueOfficersMap = new Map<number, ApiEmployeeWithName>();
            allOfficersFromCities
              .filter((o: ApiEmployeeWithName) => {
                const role = o.role?.toUpperCase() || "";
                return role.includes("FIELD_OFFICER") || role.includes("FIELD OFFICER");
              })
              .forEach((o: ApiEmployeeWithName) => {
                if (!uniqueOfficersMap.has(o.id)) {
                  uniqueOfficersMap.set(o.id, o);
                }
              });
            allAvailableOfficers = Array.from(uniqueOfficersMap.values()).map(toFieldOfficer);
          }
        } else if (currentCardType === "coord") {
          const team = coordinatorTeams.find((t) => t.id === currentCardId);
          existingOfficerIds = team?.fieldOfficers.map((o) => o.id) ?? [];
          // For coordinators, fetch all field officers
          const response = await fetch("/api/proxy/employee/getAllFieldOfficers", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const officers: ApiEmployeeWithName[] = await response.json();
            allAvailableOfficers = officers
              .filter((o: ApiEmployeeWithName) => {
                const role = o.role?.toUpperCase() || "";
                return role.includes("FIELD_OFFICER") || role.includes("FIELD OFFICER");
              })
              .map(toFieldOfficer);
          }
        }

        // Filter out already assigned officers and officers in other teams of same type
        const otherTeamOfficerIds = new Set<number>();
        if (currentCardType === "coord") {
          coordinatorTeams.forEach((t) => {
            if (t.id !== currentCardId) {
              t.fieldOfficers.forEach((o) => otherTeamOfficerIds.add(o.id));
            }
          });
        } else if (currentCardType === "rm") {
          regionalManagerTeams.forEach((rm) => {
            if (rm.id !== currentCardId) {
              rm.fieldOfficers.forEach((o) => otherTeamOfficerIds.add(o.id));
            }
          });
        }

        const filtered = allAvailableOfficers.filter(
          (o) => !existingOfficerIds.includes(o.id) && !otherTeamOfficerIds.has(o.id)
        );

        setAvailableOfficersForDialog(filtered);
      } catch (err) {
        console.error("Error fetching available officers:", err);
        setAvailableOfficersForDialog([]);
      } finally {
        setIsLoadingOfficers(false);
      }
    };

    fetchAvailableOfficers();
  }, [isAddDialogOpen, currentCardType, currentCardId, currentRmId, token, avpTeams, regionalManagerTeams, coordinatorTeams]);

  // Section component matching Settings page
  function Section({
    title,
    count,
    children,
  }: {
    title: string;
    count: number;
    children: React.ReactNode;
  }) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <Badge variant="outline" className="text-xs">
            {count}
          </Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-2xl">Teams</CardTitle>
          <CardDescription>
            Manage AVP, Regional Manager, and Coordinator teams with field officers.
          </CardDescription>
        </div>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filter teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            <SelectItem value="avp">AVP Teams</SelectItem>
            <SelectItem value="regional-manager">Regional Manager Teams</SelectItem>
            <SelectItem value="coordinator">Coordinator Teams</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading teams...
        </div>
      ) : (
        <>
          {/* AVP Teams Section */}
      {(activeFilter === "all" || activeFilter === "avp") && (
        <Section title="AVP Teams" count={avpTeams.length}>
          {avpTeams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="bg-primary/10 p-1.5 rounded-md flex-shrink-0">
                    <Crown className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span className="truncate">
                        {formatName(team.firstName, team.lastName)}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs uppercase tracking-wide border-primary text-primary bg-primary/10"
                      >
                        AVP Team
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                      <Crown className="h-3 w-3" />
                      AVP
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs defaultValue="rm" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="rm" className="text-xs">
                      Regional Manager
                    </TabsTrigger>
                    <TabsTrigger value="fo" className="text-xs">
                      Field Officer
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="rm" className="space-y-3 mt-0">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Regional Managers ({team.regionalManagers.length})
                      </p>
                      {team.regionalManagers.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1.5 py-2">
                          No regional managers assigned
                        </p>
                      ) : (
                        team.regionalManagers.map((rm) => (
                          <div
                            key={rm.id}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(rm.firstName, rm.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {formatName(rm.firstName, rm.lastName)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {rm.city}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="fo" className="space-y-3 mt-0">
                    <div className="space-y-2">
                      {(() => {
                        // Collect all field officers from all RMs under this AVP with their RM info
                        const officerWithRmMap = new Map<number, { officer: FieldOfficer; rm: RegionalManager }>();
                        
                        team.regionalManagers.forEach((rm) => {
                          rm.fieldOfficers.forEach((fo) => {
                            // Use the first RM if officer appears in multiple RMs
                            if (!officerWithRmMap.has(fo.id)) {
                              officerWithRmMap.set(fo.id, { officer: fo, rm });
                            }
                          });
                        });

                        const fieldOfficersWithRm = Array.from(officerWithRmMap.values());

                        return (
                          <>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Field Officers ({fieldOfficersWithRm.length})
                            </p>
                            {fieldOfficersWithRm.length === 0 ? (
                              <p className="text-xs text-muted-foreground px-1.5 py-2">
                                No field officers assigned
                              </p>
                            ) : (
                              fieldOfficersWithRm.map(({ officer, rm }) => (
                                <div
                                  key={officer.id}
                                  className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted group"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-xs">
                                        {getInitials(officer.firstName, officer.lastName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {formatName(officer.firstName, officer.lastName)}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {officer.city} • RM: {formatName(rm.firstName, rm.lastName)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}

      {/* Regional Manager Teams Section */}
      {(activeFilter === "all" || activeFilter === "regional-manager") && (
        <Section title="Regional Manager Teams" count={regionalManagerTeams.length}>
          {regionalManagerTeams.map((rm) => (
            <Card key={rm.id} className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="bg-primary/10 p-1.5 rounded-md flex-shrink-0">
                    <Building className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span className="truncate">
                        {formatName(rm.firstName, rm.lastName)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        Regional Manager Team
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                      <Building className="h-3 w-3" />
                      {rm.city}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <Users className="h-3 w-3" />
                      Field Officers ({rm.fieldOfficers.length})
                    </h4>
                    <div className="space-y-1">
                      {rm.fieldOfficers.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1.5 py-2">
                          No field officers assigned
                        </p>
                      ) : (
                        rm.fieldOfficers.map((officer) => (
                        <div
                          key={officer.id}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted group"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(officer.firstName, officer.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {formatName(officer.firstName, officer.lastName)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {officer.city}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteFieldOfficer("rm", rm.id, officer.id)}
                            className="ml-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full p-1 text-red-600 hover:text-red-800 transition-colors opacity-0 group-hover:opacity-100"
                            title={`Remove ${formatName(officer.firstName, officer.lastName)}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        ))
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={() => handleAddFieldOfficer("rm", rm.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field Officer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}

      {/* Coordinator Teams Section */}
      {(activeFilter === "all" || activeFilter === "coordinator") && (
        <Section title="Coordinator Teams" count={coordinatorTeams.length}>
          {coordinatorTeams.map((team) => (
            <Card key={team.id} className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="bg-primary/10 p-1.5 rounded-md flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <span className="truncate">
                        {formatName(team.firstName, team.lastName)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        Coordinator Team
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                      <Building className="h-3 w-3" />
                      {team.city}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <Users className="h-3 w-3" />
                      Field Officers ({team.fieldOfficers.length})
                    </h4>
                    <div className="space-y-1">
                      {team.fieldOfficers.map((officer) => (
                        <div
                          key={officer.id}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-muted group"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {getInitials(officer.firstName, officer.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {formatName(officer.firstName, officer.lastName)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {officer.city}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteFieldOfficer("coord", team.id, officer.id)}
                            className="ml-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full p-1 text-red-600 hover:text-red-800 transition-colors opacity-0 group-hover:opacity-100"
                            title={`Remove ${formatName(officer.firstName, officer.lastName)}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 text-xs"
                      onClick={() => handleAddFieldOfficer("coord", team.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Field Officer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}

      {/* Add Field Officer Dialog */}
      <Dialog 
        open={isAddDialogOpen} 
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setSelectedOfficers([]); // Clear selections when dialog closes
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Field Officer</DialogTitle>
            <DialogDescription>
              Select field officers to add to this team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {isLoadingOfficers ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading available officers...
              </div>
            ) : availableOfficersForDialog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No available field officers to add.
              </p>
            ) : (
              availableOfficersForDialog.map((officer: FieldOfficer) => (
                <div
                  key={officer.id}
                  onClick={() => handleToggleOfficerSelection(officer.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-md border hover:bg-muted transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={selectedOfficers.includes(officer.id)}
                    onCheckedChange={() => handleToggleOfficerSelection(officer.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getInitials(officer.firstName, officer.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formatName(officer.firstName, officer.lastName)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {officer.city}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setSelectedOfficers([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleConfirmAddFieldOfficer()}
              disabled={selectedOfficers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {selectedOfficers.length > 0 ? `(${selectedOfficers.length})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

     
      <Dialog
        open={deleteConfirmation.open}
        onOpenChange={(open) =>
          setDeleteConfirmation({ ...deleteConfirmation, open })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Field Officer</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deleteConfirmation.name} from
              this team? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteConfirmation({ open: false, name: "", onConfirm: () => {} })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteConfirmation.onConfirm}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  );
}
