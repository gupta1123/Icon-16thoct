"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Building2, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
import { API, type VisitDto } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DashboardTotalVisitsViewProps {
  startDate: Date;
  endDate: Date;
}

const getVisitStatus = (visit: VisitDto): string => {
  if (visit.checkoutTime || visit.checkoutDate) return "Completed";
  if (visit.checkinTime || visit.checkinDate) return "In Progress";
  return visit.status || "Scheduled";
};

const getStatusClassName = (status: string): string => {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200";
    case "in progress":
    case "ongoing":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200";
    case "assigned":
    case "scheduled":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatVisitDate = (value?: string | null): string => {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "d MMM yyyy");
};

export function DashboardTotalVisitsView({
  startDate,
  endDate,
}: DashboardTotalVisitsViewProps) {
  const router = useRouter();
  const [visits, setVisits] = useState<VisitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    API.getVisitsByDateRange(start, end)
      .then((response) => {
        if (!cancelled) setVisits(Array.isArray(response) ? response : []);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load visits");
          setVisits([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const sortedVisits = useMemo(
    () =>
      [...visits].sort((a, b) => {
        const dateComparison = (b.visit_date || "").localeCompare(a.visit_date || "");
        if (dateComparison !== 0) return dateComparison;
        return b.id - a.id;
      }),
    [visits]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-md border bg-card text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading visits…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{start === end ? formatVisitDate(start) : `${formatVisitDate(start)} – ${formatVisitDate(end)}`}</span>
        <Badge variant="secondary">
          {visits.length} {visits.length === 1 ? "visit" : "visits"}
        </Badge>
      </div>

      <div className="w-full overflow-hidden rounded-md border bg-card">
        <div className="max-h-[65vh] w-full overflow-auto">
          <Table className="min-w-[950px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-14">Type</TableHead>
                <TableHead className="w-52">Customer</TableHead>
                <TableHead className="w-44">Employee</TableHead>
                <TableHead className="w-32">Date</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-44">Purpose</TableHead>
                <TableHead className="w-32">Location</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                    No visits found for the selected date range.
                  </TableCell>
                </TableRow>
              ) : (
                sortedVisits.map((visit) => {
                  const status = getVisitStatus(visit);
                  const location = [visit.city, visit.state].filter(Boolean).join(", ");
                  return (
                    <TableRow key={visit.id} className="hover:bg-muted/40">
                      <TableCell>
                        <span className="inline-flex rounded bg-blue-100 p-1 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                          <Building2 className="h-4 w-4" />
                        </span>
                      </TableCell>
                      <TableCell className="truncate font-medium" title={visit.storeName}>{visit.storeName || "—"}</TableCell>
                      <TableCell className="truncate" title={visit.employeeName}>{visit.employeeName || "—"}</TableCell>
                      <TableCell>{formatVisitDate(visit.visit_date)}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs", getStatusClassName(status))}>
                          {status}
                        </span>
                      </TableCell>
                      <TableCell className="truncate" title={visit.purpose}>{visit.purpose || "—"}</TableCell>
                      <TableCell className="truncate" title={location}>{location || "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="p-2"
                          title="View Visit Details"
                          onClick={() => router.push(`/dashboard/visits/${visit.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
