"use client";

import { format } from "date-fns";
import { Eye, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Employee } from "./types";

interface DashboardStateViewProps {
  employees: Employee[];
  onEmployeeSelect: (employee: Employee) => void;
  emptyDescription?: string;
}

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

const formatLastUpdated = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : format(date, "d MMM yyyy, h:mm a");
};

const getStatusClassName = (status: string): string => {
  switch (status.toLowerCase()) {
    case "ongoing":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:hover:bg-yellow-950/60";
    case "assigned":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60";
    case "completed":
      return "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-200 dark:hover:bg-green-950/60";
    default:
      return "bg-muted text-muted-foreground hover:bg-muted/80";
  }
};

export function DashboardStateView({
  employees,
  onEmployeeSelect,
  emptyDescription = "No employees had visits in this state for the selected range.",
}: DashboardStateViewProps) {
  return (
    <div className="w-full overflow-hidden rounded-md border bg-card">
      <div className="w-full overflow-x-auto">
        <Table className="w-full min-w-[850px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-56">Employee</TableHead>
              <TableHead className="w-24">Total Visits</TableHead>
              <TableHead className="w-44">Location</TableHead>
              <TableHead className="w-40">Current Visit Status</TableHead>
              <TableHead className="w-48">Last Updated</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Users className="mb-2 h-7 w-7 opacity-60" />
                    <span className="font-medium text-foreground">No employees found</span>
                    <span className="mt-1 text-xs">
                      {emptyDescription}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow
                  key={employee.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onEmployeeSelect(employee)}
                >
                  <TableCell className="w-56">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                        {getInitials(employee.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
                        <p className="truncate text-xs capitalize text-muted-foreground">{employee.position}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-24 font-semibold">
                    <Badge variant="outline" className="min-w-9 justify-center">
                      {employee.totalVisits ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-44 truncate text-muted-foreground">
                    {employee.location || "—"}
                  </TableCell>
                  <TableCell className="w-40">
                    <span
                      className={cn(
                        "inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs capitalize transition-colors",
                        getStatusClassName(employee.status)
                      )}
                    >
                      {employee.status || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="w-48 text-muted-foreground">
                    {formatLastUpdated(employee.lastUpdated)}
                  </TableCell>
                  <TableCell className="w-20">
                    <Button
                      variant="outline"
                      size="sm"
                      className="p-2"
                      title="View Employee Details"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEmployeeSelect(employee);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
