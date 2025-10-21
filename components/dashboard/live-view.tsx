"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Building, Calendar } from "lucide-react";
import type { ExtendedEmployee, MapMarker, StateItem } from "./types";

const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
});

interface DashboardKpis {
  totalVisits: number;
  activeEmployees: number;
  liveLocations: number;
}

interface DashboardLiveViewProps {
  kpis: DashboardKpis;
  states: StateItem[];
  onStateSelect: (state: StateItem) => void;
  isLoadingTrail: boolean;
  mapCenter: [number, number];
  mapZoom: number;
  highlightedEmployee: ExtendedEmployee | null;
  mapMarkers: MapMarker[];
  onResetMap: () => void;
  selectedEmployeeForMap: ExtendedEmployee | null;
  employeeSearchTerm: string;
  onEmployeeSearch: (value: string) => void;
  employeeList: ExtendedEmployee[];
  filteredEmployeeList: ExtendedEmployee[];
  onEmployeeSelect: (employee: ExtendedEmployee) => void;
  getInitials: (name: string) => string;
}

export function DashboardLiveView({
  kpis,
  states,
  onStateSelect,
  isLoadingTrail,
  mapCenter,
  mapZoom,
  highlightedEmployee,
  mapMarkers,
  onResetMap,
  selectedEmployeeForMap,
  employeeSearchTerm,
  onEmployeeSearch,
  employeeList,
  filteredEmployeeList,
  onEmployeeSelect,
  getInitials,
}: DashboardLiveViewProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Visits</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.totalVisits}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.activeEmployees}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Live Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.liveLocations}
            </Heading>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          State-wise Employee Distribution
        </Heading>
        {states.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No active states</p>
            <p className="text-sm mt-1">No states have visit activity in this date range.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {states.map((state) => (
              <Card
                key={state.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => onStateSelect(state)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>{state.name}</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Heading as="p" size="xl" weight="bold">
                    {state.activeEmployeeCount}
                  </Heading>
                  <Text size="xs" tone="muted">
                    Employees with assigned or ongoing visits
                  </Text>
                  <Text size="xs" tone="muted" className="mt-1">
                    Ongoing: {state.ongoingVisitCount} • Completed: {state.completedVisitCount}
                  </Text>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          Live Employee Locations
        </Heading>
        <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
          <Text tone="muted">Click on an employee to zoom to their location</Text>
          <Button variant="outline" size="sm" onClick={onResetMap}>
            Reset View
          </Button>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <Card className="relative h-[600px] overflow-hidden rounded-xl">
              {isLoadingTrail && (
                <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-muted-foreground shadow">
                  Loading trail...
                </div>
              )}
              <LeafletMap
                center={mapCenter}
                zoom={mapZoom}
                highlightedEmployee={highlightedEmployee}
                markers={mapMarkers}
              />
            </Card>
          </div>

          <div className="w-full lg:w-96">
            <Card className="flex h-[600px] flex-col overflow-hidden rounded-xl">
              <CardHeader className="border-b space-y-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  <span>
                    {selectedEmployeeForMap
                      ? `${selectedEmployeeForMap.name}'s Data`
                      : "Active Employees"}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {selectedEmployeeForMap && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onResetMap}
                        className="h-7 px-2 text-xs"
                      >
                        Reset
                      </Button>
                    )}
                    <Badge variant="secondary">
                      {selectedEmployeeForMap
                        ? "1 selected"
                        : employeeSearchTerm.trim()
                        ? `${filteredEmployeeList.length} of ${employeeList.length}`
                        : `${employeeList.length} active`}
                    </Badge>
                  </div>
                </CardTitle>
                <Input
                  type="search"
                  value={employeeSearchTerm}
                  onChange={(event) => onEmployeeSearch(event.target.value)}
                  placeholder="Search employees by name, role, or location..."
                  className="h-9"
                  aria-label="Search employees"
                />
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="divide-y">
                  {employeeList.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No employees with location data</p>
                      <p className="text-sm mt-1">
                        No employees have location information available.
                      </p>
                    </div>
                  ) : filteredEmployeeList.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No matches found</p>
                      <p className="text-sm mt-1">
                        Try adjusting your search to find specific employees.
                      </p>
                    </div>
                  ) : (
                    filteredEmployeeList.map((employee) => (
                      <button
                        type="button"
                        key={employee.listId}
                        className={`w-full p-4 text-left transition-colors ${
                          highlightedEmployee?.listId === employee.listId
                            ? "border-l-4 border-primary bg-accent"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => onEmployeeSelect(employee)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                                {getInitials(employee.name)}
                              </div>
                              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                            </div>
                            <div>
                              <Heading as="p" size="md" className="text-foreground">
                                {employee.name}
                              </Heading>
                              <Text size="sm" tone="muted">
                                {employee.position}
                              </Text>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{employee.location}</span>
                            </div>
                            <Text as="div" size="xs" tone="muted" className="mt-1">
                              {employee.formattedLastUpdated ?? "—"}
                            </Text>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {employee.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {employee.visitsInRange} visits in range
                          </Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
