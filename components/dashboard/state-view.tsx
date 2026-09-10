"use client";

import { MapPin, UserRound, Users } from "lucide-react";
import type { Employee } from "./types";

interface DashboardStateViewProps {
  employees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
  emptyDescription?: string;
}

export function DashboardStateView({
  employees, onEmployeeSelect,
  emptyDescription = "No employees had visits in this state for the selected range.",
}: DashboardStateViewProps) {
  if (!employees.length) return <div className="rounded-lg border bg-card p-8 text-center">
    <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
    <p className="text-sm font-medium">No employees found</p>
    <p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p>
  </div>;
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {employees.map(employee => <button key={employee.id} type="button"
      aria-label={`View details for ${employee.name}`} onClick={() => onEmployeeSelect(employee)}
      className="rounded-xl border bg-card px-4 py-9 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-dashed border-border bg-gray-200 text-gray-600">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0"><h3 className="text-sm font-semibold tracking-normal">{employee.name}</h3><p className="text-sm text-muted-foreground">{employee.position}</p></div>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span>{employee.location || "Location not set"}</span></div>
      </div>
    </button>)}
  </div>;
}
