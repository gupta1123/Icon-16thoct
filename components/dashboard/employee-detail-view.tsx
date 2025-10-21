"use client";

import EmployeeDetailCard from "@/components/employee-detail-card";
import type { Employee, DateRangeValue, DateRangeKey } from "./types";

interface DashboardEmployeeDetailViewProps {
  employee: Employee;
  dateRange: DateRangeValue;
  selectedDateRangeKey: DateRangeKey;
}

export function DashboardEmployeeDetailView({
  employee,
  dateRange,
  selectedDateRangeKey,
}: DashboardEmployeeDetailViewProps) {
  return (
    <EmployeeDetailCard
      employee={employee}
      dateRange={dateRange}
      selectedDateRangeKey={selectedDateRangeKey}
    />
  );
}
