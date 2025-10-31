"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  API,
  EmployeeDto,
  TeamCreateRequest,
  TeamResponseDto,
  apiService,
} from "@/lib/api";
import {
  Building,
  Crown,
  Edit,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { normalizeRoleValue } from "@/lib/role-utils";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";

type TeamWithFlag = TeamResponseDto & { isAvpTeamCard?: boolean };

type TeamCardProps = {
  team: TeamWithFlag;
  onEdit: (team: TeamResponseDto) => void;
  onDelete: (teamId: number) => void;
  onRemoveOfficer: (teamId: number, officerId: number) => void;
  avpEmployee: EmployeeDto | null;
  onManageAvp: (team: TeamResponseDto) => void;
  isUpdatingAvp: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModify: boolean;
  isDeleting: boolean;
  showConfirmationDialog: (
    title: string,
    description: string,
    onConfirm: () => void,
    isLoading?: boolean
  ) => void;
};

const categoryLabel = (
  cat: ReturnType<typeof getTeamCategory>
): "Coordinator Team" | "Regional Manager Team" | "AVP Team" | "Team" => {
  switch (cat) {
    case "coordinator":
      return "Coordinator Team";
    case "regional":
      return "Regional Manager Team";
    case "avp":
      return "AVP Team";
    default:
      return "Team";
  }
};

const getTeamCategory = (
  team: TeamResponseDto
): "coordinator" | "regional" | "avp" | null => {
  const normalizedTeamType = (
    typeof team.teamType === "string" ? team.teamType : ""
  )
    .toUpperCase()
    .trim();
  if (normalizedTeamType === "COORDINATOR_TEAM") return "coordinator";
  if (normalizedTeamType === "REGIONAL_MANAGER_TEAM") return "regional";
  if (normalizedTeamType === "AVP_TEAM") return "avp";

  const officeRole = normalizeRoleValue(team.officeManager?.role ?? null);
  if (officeRole === "COORDINATOR") return "coordinator";
  if (officeRole && ["MANAGER", "OFFICE_MANAGER", "REGIONAL_MANAGER"].includes(officeRole))
    return "regional";
  if (officeRole === "AVP") return "avp";

  return null;
};

const formatEmployeeName = (employee: EmployeeDto | null | undefined) => {
  if (!employee) return "Unassigned";
  const first = employee.firstName?.trim() ?? "";
  const last = employee.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full.length > 0 ? full : employee.email ?? "Unnamed";
};

const normalizeCities = (input: unknown): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return (input as unknown[])
      .filter((value): value is string => typeof value === "string")
      .map((city) => city.trim())
      .filter(Boolean);
  }
  if (typeof input === "object") {
    return Object.values(input as Record<string, unknown>)
      .filter((value): value is string => typeof value === "string")
      .map((city) => city.trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const getAssignedCities = (employee?: EmployeeDto | null) => {
  if (!employee) return [];
  return normalizeCities(
    (employee as unknown as Record<string, unknown>)?.assignedCity
  );
};

const deriveTeamCities = (team: TeamResponseDto) => {
  const cities = new Set<string>();
  const assigned = getAssignedCities(team.officeManager);
  if (getTeamCategory(team) === "regional") {
    assigned.forEach((city) => cities.add(city));
  }
  team.fieldOfficers.forEach((officer) => {
    if (officer.city) {
      cities.add(officer.city);
    }
  });
  return Array.from(cities);
};

const resolveTeamAvp = (
  team: TeamResponseDto
): { id: number | null; employee: EmployeeDto | null } => {
  const value = team.avp;
  if (!value) {
    return { id: null, employee: null };
  }

  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    if (entry == null) continue;
    if (typeof entry === "number") {
      return { id: entry, employee: null };
    }
    const maybeEmployee = entry as Partial<EmployeeDto>;
    if (typeof maybeEmployee.id === "number") {
      return { id: maybeEmployee.id, employee: maybeEmployee as EmployeeDto };
    }
  }

  return { id: null, employee: null };
};

function TeamCard({
  team,
  onEdit,
  onDelete,
  onRemoveOfficer,
  avpEmployee,
  onManageAvp,
  isUpdatingAvp,
  canEdit,
  canDelete,
  canModify,
  isDeleting,
  showConfirmationDialog,
}: TeamCardProps) {
  const isAvpTeamCard = team.isAvpTeamCard ?? false;
  const teamCities = deriveTeamCities(team);
  const fieldOfficers = isAvpTeamCard ? [] : team.fieldOfficers; // Hide FO list on AVP cards
  const teamCategory = getTeamCategory(team);
  const isAvpTeam = teamCategory === "avp" || isAvpTeamCard;
  const teamTypeLabel = categoryLabel(teamCategory);
  const resolvedAvp = resolveTeamAvp(team);
  const hasAvpAssigned = resolvedAvp.id != null || avpEmployee != null;

  // For AVP team cards, show AVP as the main person, RM as overseen
  const displayPerson =
    isAvpTeamCard && avpEmployee ? avpEmployee : team.officeManager;

  const avpInitial = (employee: EmployeeDto | null) => {
    const first = employee?.firstName?.trim()?.[0];
    const last = employee?.lastName?.trim()?.[0];
    return (first ?? last ?? "?").toUpperCase();
  };

  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="bg-primary/10 p-1.5 rounded-md flex-shrink-0">
              <Building className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <span className="truncate">
                  {formatEmployeeName(displayPerson)}
                </span>
                <Badge
                  variant={isAvpTeam ? "outline" : "secondary"}
                  className={cn(
                    "text-xs",
                    isAvpTeam &&
                      "uppercase tracking-wide border-primary text-primary bg-primary/10"
                  )}
                >
                  {teamTypeLabel}
                </Badge>
                {!isAvpTeamCard && hasAvpAssigned && (
                  <Badge
                    variant="outline"
                    className="text-xs text-primary border-primary"
                  >
                    AVP Assigned
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                <Crown className="h-3 w-3" />
                {isAvpTeamCard
                  ? avpEmployee?.role ?? "AVP"
                  : team.officeManager?.role ?? "Unknown Role"}
                {isAvpTeamCard && team.officeManager && (
                  <span className="ml-2 text-muted-foreground">
                    • Oversees {formatEmployeeName(team.officeManager)}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(team)}
                  title="Edit team"
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(team.id)}
                  title="Delete team"
                  disabled={isDeleting}
                  className="h-8 w-8 p-0"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 text-destructive" />
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* AVP Team Card: show overseen RM */}
          {isAvpTeamCard && team.officeManager && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <Building className="h-3 w-3" />
                Oversees Regional Manager
              </h4>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">
                      {(
                        team.officeManager.firstName?.[0] ??
                        team.officeManager.lastName?.[0] ??
                        "?"
                      ).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      {formatEmployeeName(team.officeManager)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {team.officeManager.city ?? "City unknown"}
                    </p>
                  </div>
                </div>
                {canModify && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onManageAvp(team)}
                    className="h-7 px-3 text-xs"
                    disabled={isUpdatingAvp}
                  >
                    {isUpdatingAvp ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Manage AVP"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* RM Card: show AVP assignment */}
          {!isAvpTeamCard &&
            (teamCategory === "regional" || teamCategory === "avp") && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                  <Crown className="h-3 w-3" />
                  AVP
                </h4>
                {avpEmployee ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {avpInitial(avpEmployee)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {formatEmployeeName(avpEmployee)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {avpEmployee.city ?? "City unknown"}
                        </p>
                      </div>
                    </div>
                    {canModify && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageAvp(team)}
                        className="h-7 px-3 text-xs"
                        disabled={isUpdatingAvp}
                      >
                        {isUpdatingAvp ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Change"
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      No AVP assigned
                    </p>
                    {canModify && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onManageAvp(team)}
                        className="h-7 px-3 text-xs"
                        disabled={isUpdatingAvp}
                      >
                        {isUpdatingAvp ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Add AVP"
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Cities */}
          {(!isAvpTeamCard || team.officeManager) && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <MapPin className="h-3 w-3" />
                Cities ({teamCities.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {teamCities.length === 0 && (
                  <Badge variant="outline" className="text-xs">
                    No cities assigned
                  </Badge>
                )}
                {teamCities.map((city) => (
                  <Badge
                    key={city}
                    variant="outline"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Navigation className="h-2 w-2" />
                    {city}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Field Officers (hidden on AVP cards) */}
          {!isAvpTeamCard && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <Users className="h-3 w-3" />
                Field Officers ({fieldOfficers.length})
              </h4>
              <div className="space-y-1">
                {fieldOfficers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No field officers assigned
                  </p>
                )}
                {fieldOfficers.map((officer) => (
                  <div
                    key={officer.id}
                    className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted group"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {(
                          officer.firstName?.[0] ??
                          officer.lastName?.[0] ??
                          "?"
                        ).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {formatEmployeeName(officer)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {officer.city ?? "City unknown"}
                      </p>
                    </div>
                    {canModify && (
                      <button
                        onClick={() => {
                          const officerName = formatEmployeeName(officer);
                          showConfirmationDialog(
                            "Remove Field Officer",
                            `Are you sure you want to remove ${officerName} from this team?`,
                            () => onRemoveOfficer(team.id, officer.id)
                          );
                        }}
                        className="ml-1 hover:bg-red-100 rounded-full p-1 text-red-600 hover:text-red-800 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Remove ${formatEmployeeName(officer)} from team`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AVP cards: show managed FO count */}
          {isAvpTeamCard && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                <Users className="h-3 w-3" />
                Field Officers (Managed Team)
              </h4>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {team.fieldOfficers.length} field officer
                  {team.fieldOfficers.length !== 1 ? "s" : ""} under{" "}
                  {formatEmployeeName(team.officeManager)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type TeamFormState = {
  officeManagerId: number | null;
  fieldOfficerIds: number[];
};

const INITIAL_TEAM_FORM: TeamFormState = {
  officeManagerId: null,
  fieldOfficerIds: [],
};

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

export default function TeamSettings() {
  const { userRole, userData } = useAuth();
  const normalizedUserRole = normalizeRoleValue(userRole);
  const isAvpUser = normalizedUserRole === "AVP";
  const avpEmployeeId = userData?.employeeId ?? null;

  const [teams, setTeams] = useState<TeamResponseDto[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [managers, setManagers] = useState<EmployeeDto[]>([]);
  const [fieldOfficers, setFieldOfficers] = useState<EmployeeDto[]>([]);
  const [avps, setAvps] = useState<EmployeeDto[]>([]);

  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [newTeam, setNewTeam] = useState<TeamFormState>(INITIAL_TEAM_FORM);

  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamResponseDto | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<number | null>(null);
  const [editingFieldOfficerIds, setEditingFieldOfficerIds] = useState<number[]>(
    []
  );

  const [isAvpDialogOpen, setIsAvpDialogOpen] = useState(false);
  const [activeAvpTeam, setActiveAvpTeam] = useState<TeamResponseDto | null>(
    null
  );
  const [selectedAvpId, setSelectedAvpId] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState<number | null>(null);
  const [isUpdatingAvp, setIsUpdatingAvp] = useState(false);
  const [avpFilter, setAvpFilter] = useState<string>("all");

  const teamsForCurrentUser = useMemo(() => {
    if (!isAvpUser) {
      return teams;
    }
    if (avpEmployeeId == null) {
      return [];
    }
    return teams.filter((team) => {
      const resolved = resolveTeamAvp(team);
      if (resolved.id != null) {
        return resolved.id === avpEmployeeId;
      }
      return resolved.employee?.id === avpEmployeeId;
    });
  }, [teams, isAvpUser, avpEmployeeId]);

  // Assigned FOs by category (global for admin/DATA_MANAGER, scoped for others)
  const assignedFieldOfficerIdsByType = useMemo(() => {
    const coordinator = new Set<number>();
    const regional = new Set<number>();

    const base =
      userRole === "ADMIN" || userRole === "DATA_MANAGER"
        ? teams
        : teamsForCurrentUser;

    base.forEach((team) => {
      const category = getTeamCategory(team);
      if (!category) return;
      if (category === "coordinator") {
        team.fieldOfficers.forEach((officer) => coordinator.add(officer.id));
      } else if (category === "regional") {
        team.fieldOfficers.forEach((officer) => regional.add(officer.id));
      }
    });

    return {
      coordinator: Array.from(coordinator),
      regional: Array.from(regional),
    };
  }, [teams, teamsForCurrentUser, userRole]);

  const assignedAvpIds = useMemo(() => {
    const ids = new Set<number>();
    teamsForCurrentUser.forEach((team) => {
      const { id } = resolveTeamAvp(team);
      if (id != null) {
        ids.add(id);
      }
    });
    return ids;
  }, [teamsForCurrentUser]);

  const avpLookupById = useMemo(() => {
    const map = new Map<number, EmployeeDto>();
    avps.forEach((avp) => map.set(avp.id, avp));
    teamsForCurrentUser.forEach((team) => {
      const { employee } = resolveTeamAvp(team);
      if (employee && typeof employee.id === "number") {
        map.set(employee.id, employee);
      }
    });
    return map;
  }, [avps, teamsForCurrentUser]);

  const avpFilterOptions = useMemo(() => {
    const map = new Map<number, EmployeeDto>();
    teamsForCurrentUser.forEach((team) => {
      const resolved = resolveTeamAvp(team);
      const employee = resolved.employee;
      if (employee && typeof employee.id === "number") {
        map.set(employee.id, employee);
      } else if (resolved.id != null) {
        const fallback = avpLookupById.get(resolved.id);
        if (fallback) {
          map.set(fallback.id, fallback);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      formatEmployeeName(a).localeCompare(formatEmployeeName(b))
    );
  }, [teamsForCurrentUser, avpLookupById]);

  const availableAvps = useMemo(() => {
    if (!activeAvpTeam) {
      return avps;
    }
    const resolved = resolveTeamAvp(activeAvpTeam);
    const currentId = resolved.id;
    const filtered = avps.filter((avp) => {
      if (currentId != null && avp.id === currentId) {
        return true;
      }
      return !assignedAvpIds.has(avp.id);
    });

    if (resolved.employee && typeof resolved.employee.id === "number") {
      const currentEmployee = resolved.employee;
      if (!filtered.some((avp) => avp.id === currentEmployee.id)) {
        return [...filtered, currentEmployee];
      }
    }

    return filtered;
  }, [avps, activeAvpTeam, assignedAvpIds]);

  // Manager & FO option pools
  const managerOptions = useMemo(() => {
    const allowedRoles = ["COORDINATOR", "REGIONAL_MANAGER"];
    const deduped = new Map<number, EmployeeDto>();
    managers.forEach((manager) => {
      deduped.set(manager.id, manager);
    });
    teamsForCurrentUser.forEach((team) => {
      const officeManager = team.officeManager;
      if (
        officeManager &&
        allowedRoles.includes(normalizeRoleValue(officeManager.role) || "")
      ) {
        deduped.set(officeManager.id, officeManager);
      }
    });
    return Array.from(deduped.values()).filter((manager) =>
      allowedRoles.includes(normalizeRoleValue(manager.role) || "")
    );
  }, [managers, teamsForCurrentUser]);

  const fieldOfficerOptions = useMemo(() => {
    const deduped = new Map<number, EmployeeDto>();
    fieldOfficers.forEach((officer) => deduped.set(officer.id, officer));
    teamsForCurrentUser.forEach((team) => {
      team.fieldOfficers.forEach((officer) => deduped.set(officer.id, officer));
    });
    return Array.from(deduped.values()).filter(
      (officer) => normalizeRoleValue(officer.role) === "FIELD_OFFICER"
    );
  }, [fieldOfficers, teamsForCurrentUser]);

  const selectedNewManager = useMemo(
    () =>
      managerOptions.find((manager) => manager.id === newTeam.officeManagerId) ??
      null,
    [managerOptions, newTeam.officeManagerId]
  );

  const selectedEditingManager = useMemo(() => {
    if (editingManagerId == null) return null;
    return (
      managerOptions.find((manager) => manager.id === editingManagerId) ??
      editingTeam?.officeManager ??
      null
    );
  }, [managerOptions, editingManagerId, editingTeam]);

  const filterFieldOfficersForManager = (
    manager: EmployeeDto | null,
    officers: EmployeeDto[],
    includeExistingIds: number[] = []
  ) => {
    if (!manager) return officers;

    const normalizedRole = normalizeRoleValue(manager.role);

    // Coordinators can manage FOs from any city
    if (normalizedRole === "COORDINATOR") {
      return officers;
    }

    // RM/MANAGER/OFFICE_MANAGER: restrict to assigned cities
    if (
      normalizedRole === "REGIONAL_MANAGER" ||
      normalizedRole === "MANAGER" ||
      normalizedRole === "OFFICE_MANAGER"
    ) {
      const assignedCities = new Set(
        getAssignedCities(manager).map((c) => c.trim().toLowerCase())
      );
      if (assignedCities.size === 0) return officers;
      return officers.filter((officer) => {
        if (includeExistingIds.includes(officer.id)) return true;
        const officerCity = officer.city?.trim().toLowerCase();
        return officerCity ? assignedCities.has(officerCity) : false;
      });
    }
    return officers;
  };

  const availableNewTeamOfficers = useMemo(() => {
    const managerRole = normalizeRoleValue(selectedNewManager?.role ?? null);
    const targetCategory =
      managerRole === "COORDINATOR"
        ? "coordinator"
        : managerRole
        ? "regional"
        : null;

    const assignedSet = targetCategory
      ? new Set(
          targetCategory === "coordinator"
            ? assignedFieldOfficerIdsByType.coordinator
            : assignedFieldOfficerIdsByType.regional
        )
      : null;

    return filterFieldOfficersForManager(
      selectedNewManager,
      fieldOfficerOptions,
      newTeam.fieldOfficerIds
    )
      .filter((officer) => !newTeam.fieldOfficerIds.includes(officer.id))
      .filter((officer) => {
        if (!assignedSet) return true;
        return !assignedSet.has(officer.id);
      });
  }, [
    selectedNewManager,
    fieldOfficerOptions,
    newTeam.fieldOfficerIds,
    assignedFieldOfficerIdsByType,
  ]);

  const availableEditingTeamOfficers = useMemo(() => {
    const merged = filterFieldOfficersForManager(
      selectedEditingManager,
      fieldOfficerOptions,
      editingFieldOfficerIds
    );
    const managerRole = normalizeRoleValue(selectedEditingManager?.role ?? null);
    const targetCategory =
      managerRole === "COORDINATOR"
        ? "coordinator"
        : managerRole
        ? "regional"
        : null;
    const assignedSet = targetCategory
      ? new Set(
          targetCategory === "coordinator"
            ? assignedFieldOfficerIdsByType.coordinator
            : assignedFieldOfficerIdsByType.regional
        )
      : null;
    return merged
      .filter((officer) => !editingFieldOfficerIds.includes(officer.id))
      .filter((officer) => {
        if (!assignedSet) return true;
        return !assignedSet.has(officer.id);
      });
  }, [
    selectedEditingManager,
    fieldOfficerOptions,
    editingFieldOfficerIds,
    assignedFieldOfficerIdsByType,
  ]);

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchTeams(), fetchEmployees()]);
    };
    load().catch((err) => {
      console.error(err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTeams = async () => {
    setLoadingTeams(true);
    setError(null);
    try {
      const data = await API.getTeams();
      const sortedTeams = data.sort((a, b) => {
        const nameA = formatEmployeeName(a.officeManager).toLowerCase();
        const nameB = formatEmployeeName(b.officeManager).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setTeams(sortedTeams);
    } catch (err) {
      console.error("Failed to load teams", err);
      setError("Failed to load teams. Please try again.");
    } finally {
      setLoadingTeams(false);
    }
  };

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    setError(null);
    try {
      const directory = await API.getEmployeeDirectory();
      setManagers(
        directory.filter((employee) => {
          return ["COORDINATOR", "REGIONAL_MANAGER", "MANAGER", "OFFICE_MANAGER"].includes(
            normalizeRoleValue(employee.role) || ""
          );
        })
      );
      setAvps(directory.filter((employee) => normalizeRoleValue(employee.role) === "AVP"));

      let officers: EmployeeDto[] = [];
      try {
        if (
          userRole === "ADMIN" ||
          userRole === "DATA_MANAGER" ||
          userRole === "COORDINATOR"
        ) {
          officers = await apiService.getAllFieldOfficers();
        } else {
          officers = await apiService.getTeamFieldOfficers();
        }
      } catch (err) {
        console.warn("Falling back to employee list for field officers", err);
        officers = directory.filter(
          (employee) => normalizeRoleValue(employee.role) === "FIELD_OFFICER"
        );
      }
      setFieldOfficers(officers);
    } catch (err) {
      console.error("Failed to load employees", err);
      setError("Failed to load employees. Please try again.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const resetNewTeamForm = () => {
    setNewTeam(INITIAL_TEAM_FORM);
  };

  const handleCreateTeam = async () => {
    if (!newTeam.officeManagerId) {
      setError("Please select an office manager.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload: TeamCreateRequest = {
        officeManager: newTeam.officeManagerId,
        fieldOfficers: newTeam.fieldOfficerIds,
      };
      await API.createTeam(payload);
      await fetchTeams();
      setIsAddTeamOpen(false);
      resetNewTeamForm();
    } catch (err) {
      console.error("Failed to create team", err);
      setError("Failed to create team. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (team: TeamResponseDto) => {
    setEditingTeam(team);
    setEditingManagerId(team.officeManager?.id ?? null);
    setEditingFieldOfficerIds(team.fieldOfficers.map((officer) => officer.id));
    setIsEditTeamOpen(true);
  };

  const openAvpDialog = (team: TeamResponseDto) => {
    const resolved = resolveTeamAvp(team);
    setActiveAvpTeam(team);
    setSelectedAvpId(resolved.id ?? null);
    setIsAvpDialogOpen(true);
    setError(null);
  };

  const closeAvpDialog = () => {
    setIsAvpDialogOpen(false);
    setActiveAvpTeam(null);
    setSelectedAvpId(null);
    setIsUpdatingAvp(false);
  };

  const handleSaveAvp = async () => {
    if (!activeAvpTeam) return;
    setIsUpdatingAvp(true);
    setError(null);
    try {
      await API.updateTeamAvp(activeAvpTeam.id, selectedAvpId);
      await fetchTeams();
      closeAvpDialog();
    } catch (err) {
      console.error("Failed to update AVP", err);
      setError("Failed to update AVP. Please try again.");
    } finally {
      setIsUpdatingAvp(false);
    }
  };

  const handleSaveTeam = async () => {
    if (!editingTeam) return;

    const originalManagerId = editingTeam.officeManager?.id ?? null;
    const originalFieldOfficerIds = editingTeam.fieldOfficers.map(
      (officer) => officer.id
    );

    const toAdd = editingFieldOfficerIds.filter(
      (id) => !originalFieldOfficerIds.includes(id)
    );
    const toRemove = originalFieldOfficerIds.filter(
      (id) => !editingFieldOfficerIds.includes(id)
    );

    const managerChanged =
      editingManagerId !== null && editingManagerId !== originalManagerId;

    if (!managerChanged && toAdd.length === 0 && toRemove.length === 0) {
      setIsEditTeamOpen(false);
      setEditingTeam(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (managerChanged && editingManagerId !== null) {
        await API.updateTeamLead(editingTeam.id, editingManagerId);
      }

      if (toAdd.length) {
        await API.addTeamFieldOfficers(editingTeam.id, toAdd);
      }

      if (toRemove.length) {
        await API.removeTeamFieldOfficers(editingTeam.id, toRemove);
      }

      await fetchTeams();
      setIsEditTeamOpen(false);
      setEditingTeam(null);
    } catch (err) {
      console.error("Failed to update team", err);
      setError("Failed to update team. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    const canCreateTeam = userRole === "ADMIN";
    if (!canCreateTeam) return;
    showConfirmationDialog(
      "Delete Team",
      "Are you sure you want to delete this team? This action cannot be undone.",
      async () => {
        setDeleteInProgress(teamId);
        setError(null);
        try {
          await API.deleteTeam(teamId);
          await fetchTeams();
        } catch (err) {
          console.error("Failed to delete team", err);
          setError("Failed to delete team. Please try again.");
        } finally {
          setDeleteInProgress(null);
        }
      }
    );
  };

  const handleRemoveFieldOfficerFromTeam = async (
    teamId: number,
    officerId: number
  ) => {
    setError(null);
    try {
      await API.removeTeamFieldOfficers(teamId, [officerId]);
      await fetchTeams();
    } catch (err) {
      console.error("Failed to remove field officer from team", err);
      setError("Failed to remove field officer from team. Please try again.");
    }
  };

  const showConfirmationDialog = (
    title: string,
    description: string,
    onConfirm: () => void,
    isLoading = false
  ) => {
    setConfirmationDialog({
      open: true,
      title,
      description,
      onConfirm,
      isLoading,
    });
  };

  const [confirmationDialog, setConfirmationDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    isLoading: false,
  });

  const canCreateTeam = userRole === "ADMIN";
  const canModifyTeams =
    userRole === "ADMIN" ||
    userRole === "COORDINATOR" ||
    userRole === "REGIONAL_MANAGER";

  const selectedNewManagerRole = normalizeRoleValue(
    selectedNewManager?.role ?? null
  );

  const renderFieldOfficerBadge = (
    id: number,
    removeFn: (id: number) => void,
    officers: EmployeeDto[]
  ) => {
    const officer = officers.find((item) => item.id === id);
    return (
      <Badge key={id} variant="secondary" className="flex items-center gap-1">
        <User className="h-3 w-3" />
        {formatEmployeeName(officer ?? null)}
        <button
          onClick={() => removeFn(id)}
          className="ml-1 hover:bg-muted rounded-full p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    );
  };

  const removeOfficerFromNewTeam = (id: number) => {
    const officer = fieldOfficerOptions.find((o) => o.id === id);
    const officerName = formatEmployeeName(officer ?? null);
    showConfirmationDialog(
      "Remove Field Officer",
      `Are you sure you want to remove ${officerName} from this team?`,
      () => {
        setNewTeam((prev) => ({
          ...prev,
          fieldOfficerIds: prev.fieldOfficerIds.filter(
            (officerId) => officerId !== id
          ),
        }));
      }
    );
  };

  const removeOfficerFromEditingTeam = (id: number) => {
    const officer = fieldOfficerOptions.find((o) => o.id === id);
    const officerName = formatEmployeeName(officer ?? null);
    showConfirmationDialog(
      "Remove Field Officer",
      `Are you sure you want to remove ${officerName} from this team?`,
      () => {
        setEditingFieldOfficerIds((prev) =>
          prev.filter((officerId) => officerId !== id)
        );
      }
    );
  };

  // Expand into RM card + AVP card (if AVP exists). Order: RM first, then AVP.
  const expandedTeams = useMemo(() => {
    const out: TeamWithFlag[] = [];

    teamsForCurrentUser.forEach((team) => {
      const category = getTeamCategory(team);
      const resolvedAvp = resolveTeamAvp(team);
      const hasAvp =
        resolvedAvp.id != null || resolvedAvp.employee != null;
      const normalizedTeamType = (
        typeof team.teamType === "string" ? team.teamType : ""
      )
        .toUpperCase()
        .trim();

      const isRMish =
        category === "regional" ||
        normalizedTeamType === "REGIONAL_MANAGER_TEAM" ||
        (normalizedTeamType === "AVP_TEAM" && team.officeManager);

      if (isRMish) {
        out.push({ ...team, isAvpTeamCard: false });
        if (hasAvp) {
          out.push({
            ...team,
            isAvpTeamCard: true,
            teamType: "AVP_TEAM",
          });
        }
        return;
      }

      if (category === "coordinator") {
        out.push({ ...team, isAvpTeamCard: false });
        return;
      }

      if (normalizedTeamType === "AVP_TEAM") {
        if (team.officeManager) {
          out.push({
            ...team,
            isAvpTeamCard: false,
            teamType: "REGIONAL_MANAGER_TEAM",
          });
        }
        out.push({ ...team, isAvpTeamCard: true });
        return;
      }

      out.push({ ...team, isAvpTeamCard: false });
    });

    // Sort by display person name; keeps RM/AVP pairs adjacent overall
    return out.sort((a, b) => {
      const nameA = formatEmployeeName(
        (a.isAvpTeamCard
          ? resolveTeamAvp(a).employee
          : a.officeManager) as EmployeeDto | null
      ).toLowerCase();
      const nameB = formatEmployeeName(
        (b.isAvpTeamCard
          ? resolveTeamAvp(b).employee
          : b.officeManager) as EmployeeDto | null
      ).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [teamsForCurrentUser]);

  // Existing AVP filter continues to work on expanded set
  const filteredTeams = useMemo(() => {
    const sourceTeams = expandedTeams;
    if (avpFilter === "all") {
      return sourceTeams;
    }
    return sourceTeams.filter((team) => {
      const { id } = resolveTeamAvp(team);
      const category = getTeamCategory(team);
      const isAvpTeamCard =
        (team as TeamWithFlag).isAvpTeamCard === true;

      if (avpFilter === "with") {
        if (isAvpTeamCard) return true;
        return id != null;
      }
      if (avpFilter === "without") {
        if (isAvpTeamCard) return false;
        return id == null;
      }
      if (avpFilter === "avp-team") {
        return isAvpTeamCard || category === "avp";
      }
      if (avpFilter.startsWith("avp-")) {
        const targetId = Number(avpFilter.split("-")[1]);
        if (isAvpTeamCard) {
          return id === targetId;
        }
        return id === targetId;
      }
      return true;
    });
  }, [expandedTeams, avpFilter]);

  // Group into 3 sections for clearer UX
  const grouped = useMemo(() => {
    const avpCards: TeamWithFlag[] = [];
    const regionalCards: TeamWithFlag[] = [];
    const coordinatorCards: TeamWithFlag[] = [];

    filteredTeams.forEach((t) => {
      const isAvpCard = (t as TeamWithFlag).isAvpTeamCard === true;
      const cat = getTeamCategory(t);

      if (isAvpCard || cat === "avp") {
        avpCards.push(t);
      } else if (cat === "regional") {
        regionalCards.push(t);
      } else if (cat === "coordinator") {
        coordinatorCards.push(t);
      } else {
        // unknown → bucket with RM
        regionalCards.push(t);
      }
    });

    return { avpCards, regionalCards, coordinatorCards };
  }, [filteredTeams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-2xl">Teams</CardTitle>
          <CardDescription>
            Manage coordinator, regional manager, and AVP teams.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Select value={avpFilter} onValueChange={setAvpFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filter by AVP" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              <SelectItem value="with">Teams with AVP</SelectItem>
              <SelectItem value="without">Teams without AVP</SelectItem>
              <SelectItem value="avp-team">AVP Teams</SelectItem>
              {avpFilterOptions.map((avp) => (
                <SelectItem key={avp.id} value={`avp-${avp.id}`}>
                  {formatEmployeeName(avp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreateTeam && (
            <Dialog
              open={isAddTeamOpen}
              onOpenChange={(open) => {
                setIsAddTeamOpen(open);
                if (!open) resetNewTeamForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Team
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Team</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Office Manager</label>
                    <Select
                      value={newTeam.officeManagerId?.toString() ?? ""}
                      onValueChange={(value) => {
                        const id = Number(value);
                        setNewTeam({
                          officeManagerId: id,
                          fieldOfficerIds: [],
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select office manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managerOptions.map((manager) => (
                          <SelectItem
                            key={manager.id}
                            value={manager.id.toString()}
                          >
                            {formatEmployeeName(manager)} ({manager.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedNewManager &&
                    selectedNewManager.role?.toLowerCase() ===
                      "coordinator" ? (
                      <p className="text-xs text-muted-foreground">
                        Coordinators can manage field officers from any city.
                      </p>
                    ) : getAssignedCities(selectedNewManager).length ? (
                      <p className="text-xs text-muted-foreground">
                        Assigned cities:{" "}
                        {getAssignedCities(selectedNewManager).join(", ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Field Officers</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newTeam.fieldOfficerIds.map((id) =>
                        renderFieldOfficerBadge(
                          id,
                          removeOfficerFromNewTeam,
                          fieldOfficerOptions
                        )
                      )}
                    </div>
                    <Select
                      onValueChange={(value) =>
                        setNewTeam((prev) => ({
                          ...prev,
                          fieldOfficerIds: [
                            ...prev.fieldOfficerIds,
                            Number(value),
                          ],
                        }))
                      }
                      disabled={!selectedNewManager}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add field officer" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableNewTeamOfficers.map((officer) => (
                          <SelectItem
                            key={officer.id}
                            value={officer.id.toString()}
                          >
                            {formatEmployeeName(officer)}{" "}
                            {officer.city ? `(${officer.city})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedNewManager && (
                      <p className="text-xs text-muted-foreground">
                        Select an office manager first to add field officers.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddTeamOpen(false);
                        resetNewTeamForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTeam}
                      disabled={isSaving || !newTeam.officeManagerId}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        "Create Team"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive text-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loadingTeams || loadingEmployees ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading teams...
        </div>
      ) : grouped.avpCards.length +
          grouped.regionalCards.length +
          grouped.coordinatorCards.length ===
        0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No teams found</CardTitle>
            <CardDescription>
              {canCreateTeam
                ? "Get started by creating a new team."
                : "No teams are available for your account."}
            </CardDescription>
          </CardHeader> 
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.avpCards.length > 0 && (
            <Section
              title="AVP Teams (oversee RM teams)"
              count={grouped.avpCards.length}
            >
              {grouped.avpCards.map((team) => {
                const resolvedAvp = resolveTeamAvp(team);
                const avpEmployee =
                  resolvedAvp.employee ??
                  (resolvedAvp.id != null
                    ? avpLookupById.get(resolvedAvp.id) ?? null
                    : null);
                const avpLoading = isUpdatingAvp && activeAvpTeam?.id === team.id;
                return (
                  <TeamCard
                    key={`avp-${team.id}`}
                    team={{ ...team, isAvpTeamCard: true }}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteTeam}
                    onRemoveOfficer={handleRemoveFieldOfficerFromTeam}
                    avpEmployee={avpEmployee}
                    onManageAvp={openAvpDialog}
                    isUpdatingAvp={avpLoading}
                    canEdit={false}
                    canDelete={false}
                    canModify={canModifyTeams}
                    isDeleting={deleteInProgress === team.id}
                    showConfirmationDialog={showConfirmationDialog}
                  />
                );
              })}
            </Section>
          )}

          {grouped.regionalCards.length > 0 && (
            <Section
              title="Regional Manager Teams"
              count={grouped.regionalCards.length}
            >
              {grouped.regionalCards.map((team) => {
                const resolvedAvp = resolveTeamAvp(team);
                const avpEmployee =
                  resolvedAvp.employee ??
                  (resolvedAvp.id != null
                    ? avpLookupById.get(resolvedAvp.id) ?? null
                    : null);
                const avpLoading = isUpdatingAvp && activeAvpTeam?.id === team.id;
                return (
                  <TeamCard
                    key={`rm-${team.id}`}
                    team={{
                      ...team,
                      isAvpTeamCard: false,
                      teamType: "REGIONAL_MANAGER_TEAM",
                    }}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteTeam}
                    onRemoveOfficer={handleRemoveFieldOfficerFromTeam}
                    avpEmployee={avpEmployee}
                    onManageAvp={openAvpDialog}
                    isUpdatingAvp={avpLoading}
                    canEdit={canModifyTeams}
                    canDelete={canCreateTeam}
                    canModify={canModifyTeams}
                    isDeleting={deleteInProgress === team.id}
                    showConfirmationDialog={showConfirmationDialog}
                  />
                );
              })}
            </Section>
          )}

          {grouped.coordinatorCards.length > 0 && (
            <Section
              title="Coordinator Teams"
              count={grouped.coordinatorCards.length}
            >
              {grouped.coordinatorCards.map((team) => {
                const avpLoading = isUpdatingAvp && activeAvpTeam?.id === team.id;
                return (
                  <TeamCard
                    key={`coord-${team.id}`}
                    team={{
                      ...team,
                      isAvpTeamCard: false,
                      teamType: "COORDINATOR_TEAM",
                    }}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteTeam}
                    onRemoveOfficer={handleRemoveFieldOfficerFromTeam}
                    avpEmployee={null}
                    onManageAvp={openAvpDialog}
                    isUpdatingAvp={avpLoading}
                    canEdit={canModifyTeams}
                    canDelete={canCreateTeam}
                    canModify={canModifyTeams}
                    isDeleting={deleteInProgress === team.id}
                    showConfirmationDialog={showConfirmationDialog}
                  />
                );
              })}
            </Section>
          )}
        </div>
      )}

      {/* Edit Team */}
      <Dialog
        open={isEditTeamOpen}
        onOpenChange={(open) => {
          setIsEditTeamOpen(open);
          if (!open) {
            setEditingTeam(null);
            setEditingFieldOfficerIds([]);
            setEditingManagerId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          {editingTeam ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Office Manager</label>
                <Select
                  value={editingManagerId?.toString() ?? ""}
                  onValueChange={(value) => {
                    setEditingManagerId(Number(value));
                    setEditingFieldOfficerIds([]);
                  }}
                  disabled={!canModifyTeams}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select office manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {formatEmployeeName(manager)} ({manager.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEditingManager &&
                selectedEditingManager.role?.toLowerCase() ===
                  "coordinator" ? (
                  <p className="text-xs text-muted-foreground">
                    Coordinators can manage field officers from any city.
                  </p>
                ) : getAssignedCities(selectedEditingManager).length ? (
                  <p className="text-xs text-muted-foreground">
                    Assigned cities:{" "}
                    {getAssignedCities(selectedEditingManager).join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Field Officers</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editingFieldOfficerIds.map((id) =>
                    renderFieldOfficerBadge(
                      id,
                      removeOfficerFromEditingTeam,
                      fieldOfficerOptions
                    )
                  )}
                </div>
                <Select
                  onValueChange={(value) =>
                    setEditingFieldOfficerIds((prev) => [
                      ...prev,
                      Number(value),
                    ])
                  }
                  disabled={!canModifyTeams || !selectedEditingManager}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add field officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEditingTeamOfficers.map((officer) => (
                      <SelectItem
                        key={officer.id}
                        value={officer.id.toString()}
                      >
                        {formatEmployeeName(officer)}{" "}
                        {officer.city ? `(${officer.city})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditTeamOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTeam} disabled={isSaving || !canModifyTeams}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Unable to load team details.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign AVP */}
      <Dialog
        open={isAvpDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeAvpDialog();
          } else {
            setIsAvpDialogOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeAvpTeam
                ? `Assign AVP to ${formatEmployeeName(
                    activeAvpTeam.officeManager
                  )}`
                : "Assign AVP"}
            </DialogTitle>
          </DialogHeader>
          {activeAvpTeam ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select an AVP to oversee this regional manager team. You can also
                remove the assignment if needed.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="avp-select">
                  AVP
                </label>
                <Select
                  value={
                    selectedAvpId != null ? selectedAvpId.toString() : "__none__"
                  }
                  onValueChange={(value) =>
                    setSelectedAvpId(value === "__none__" ? null : Number(value))
                  }
                  disabled={isUpdatingAvp}
                >
                  <SelectTrigger id="avp-select">
                    <SelectValue placeholder="Select AVP" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No AVP</SelectItem>
                    {availableAvps.map((avp) => (
                      <SelectItem key={avp.id} value={avp.id.toString()}>
                        {formatEmployeeName(avp)}
                        {avp.city ? ` (${avp.city})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableAvps.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    All AVPs are currently assigned. Remove an assignment to free
                    up availability.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeAvpDialog} disabled={isUpdatingAvp}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAvp} disabled={isUpdatingAvp}>
                  {isUpdatingAvp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Unable to load team details.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmationDialog.open}
        onOpenChange={(open) => setConfirmationDialog((prev) => ({ ...prev, open }))}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        onConfirm={confirmationDialog.onConfirm}
        isLoading={confirmationDialog.isLoading}
        variant="destructive"
        confirmText="Remove"
        cancelText="Cancel"
      />
    </div>
  );
}
