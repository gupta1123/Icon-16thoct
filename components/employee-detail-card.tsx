"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, CalendarCheck2, Clock3, UserRoundX } from "lucide-react";
import { API, type EmployeeStatsWithVisits } from "@/lib/api";
import { summarizeVisitPurposes } from "@/lib/visit-purpose-summary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/dashboard/performance-primitives";
import { KPICard, VisitsTable, VisitsByPurposeChart, type VisitRow } from "@/components/dashboard/employee-performance";
import type { Employee, DateRangeKey } from "@/components/dashboard/types";

interface EmployeeDetailCardProps {
  employee: Employee;
  dateRange: { start: Date; end: Date };
  selectedDateRangeKey?: DateRangeKey;
}

export default function EmployeeDetailCard(props: EmployeeDetailCardProps) {
  // A new employee/period must not briefly display the previous employee's totals.
  return <EmployeePerformanceData key={`${props.employee.id}:${format(props.dateRange.start, "yyyy-MM-dd")}:${format(props.dateRange.end, "yyyy-MM-dd")}`} {...props} />;
}

function EmployeePerformanceData({ employee, dateRange, selectedDateRangeKey }: EmployeeDetailCardProps) {
  const [details, setDetails] = useState<EmployeeStatsWithVisits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const start = format(dateRange.start, "yyyy-MM-dd");
  const end = format(dateRange.end, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // Keep Icon's endpoint; German's optimized/summary endpoints are not assumed.
        const data = await API.getEmployeeStatsWithVisits(employee.id, start, end);
        if (!cancelled) setDetails(data);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof Error && cause.message.includes("404")) {
          setDetails({ visitDto: [], statsDto: { visitCount: 0, fullDays: 0, halfDays: 0, absences: 0 } });
        } else setError(cause instanceof Error ? cause.message : "Failed to load employee details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [employee.id, start, end, retry]);

  const visits: VisitRow[] = useMemo(() => (details?.visitDto || []).map(visit => ({
    id: visit.id, date: visit.visit_date, customer: visit.storeName, purpose: visit.purpose || "—",
    status: "completed", duration: "-", checkinTime: visit.checkinTime,
    checkoutTime: visit.checkoutTime, employeeState: visit.state,
  })), [details]);
  const completedVisits = useMemo(() => visits.filter(visit => visit.checkinTime && visit.checkoutTime), [visits]);
  const chartData = useMemo(() => summarizeVisitPurposes(completedVisits.map(visit => ({
    purpose: visit.purpose, count: 1,
  }))), [completedVisits]);
  const totalPages = Math.max(1, Math.ceil(completedVisits.length / 10));

  const handleViewDetails = (visitId: number) => {
    const params = new URLSearchParams({ from: "dashboardEmployee", employeeId: String(employee.id) });
    if (selectedDateRangeKey) params.set("dateRange", selectedDateRangeKey);
    // Preserve state, custom dates, and the originating dashboard view on return.
    const returnRoute = window.location.pathname === "/dashboard"
      ? window.location.pathname + window.location.search
      : `/dashboard?view=employeeDetail&employeeId=${employee.id}${selectedDateRangeKey ? `&dateRange=${selectedDateRangeKey}` : ""}`;
    try { localStorage.setItem("visitReturnContext", JSON.stringify({ route: returnRoute, timestamp: Date.now() })); } catch { /* Navigation works when storage is disabled. */ }
    router.push(`/dashboard/visits/${visitId}?${params.toString()}`);
  };

  if (error) return <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
    <span>{error}</span><Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Retry</Button>
  </div>;

  if (loading) return <div aria-label="Loading employee performance" role="status" className="space-y-4">
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <Card key={index} className="rounded-lg shadow-none">
        <CardContent className="flex min-h-[82px] items-center justify-between p-4">
          <div><Skeleton className="h-3 w-28" /><Skeleton className="mt-2 h-6 w-12" /></div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </CardContent>
      </Card>)}
    </div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
      {[0, 1].map(index => <Card key={index} className="rounded-lg shadow-none"><CardHeader className="border-b px-4 py-3"><Skeleton className="h-4 w-36" /></CardHeader><CardContent className="p-4"><Skeleton className="h-[210px] w-full" /></CardContent></Card>)}
    </div>
  </div>;

  return <div className="space-y-4 pb-12 md:pb-0">
    <section aria-label="Performance snapshot" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <KPICard title="Completed visits" value={completedVisits.length} icon={<CheckCircle2 className="h-4 w-4" />} />
      <KPICard title="Full days" value={details?.statsDto?.fullDays ?? 0} icon={<CalendarCheck2 className="h-4 w-4" />} />
      <KPICard title="Half days" value={details?.statsDto?.halfDays ?? 0} icon={<Clock3 className="h-4 w-4" />} />
      <KPICard title="Absences" value={details?.statsDto?.absences ?? 0} icon={<UserRoundX className="h-4 w-4" />} />
    </section>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
      <VisitsTable visits={visits} onViewDetails={handleViewDetails} currentPage={currentPage} onPageChange={setCurrentPage} totalPages={totalPages} totalElements={visits.length} />
      <VisitsByPurposeChart data={chartData} />
    </div>
  </div>;
}
