"use client";

import EmployeeCard from "@/components/employee-card";
import type { Employee } from "./types";

interface DashboardStateViewProps {
  employees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
}

export function DashboardStateView({
  employees,
  onEmployeeSelect,
}: DashboardStateViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {employees.map((employee) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            onClick={() => onEmployeeSelect(employee)}
            hideState={true}
          />
        ))}
      </div>
    </div>
  );
}
