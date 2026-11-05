"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { API, type SiteConversionSales } from "@/lib/api";
import { EmptyState, Section } from "@/components/detail-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select2";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 10;
type EmployeeCounts = Pick<SiteConversionSales, "employeeId" | "employeeName" | "approvedCount" | "rejectedCount">;

export function ConversionEmployeeReport() {
  const [dates, setDates] = useState(() => {
    const today = new Date();
    return { startDate: format(subDays(today, 6), "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
  });
  const [appliedDates, setAppliedDates] = useState(dates);
  const [rows, setRows] = useState<EmployeeCounts[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    // Status filters select employees with matching conversions. Request both so employees
    // whose conversions were all rejected are included, and never add duplicate counts.
    Promise.all([
      API.getSiteConversionSales({ ...appliedDates, status: "APPROVED", signal: controller.signal }),
      API.getSiteConversionSales({ ...appliedDates, status: "REJECTED", signal: controller.signal }),
    ]).then(([approved, rejected]) => {
      if (controller.signal.aborted) return;
      const employees = new Map<number, EmployeeCounts>();
      approved.forEach(row => employees.set(row.employeeId, {
        employeeId: row.employeeId, employeeName: row.employeeName,
        approvedCount: row.approvedCount, rejectedCount: 0,
      }));
      rejected.forEach(row => {
        const previous = employees.get(row.employeeId);
        employees.set(row.employeeId, {
          employeeId: row.employeeId, employeeName: row.employeeName,
          approvedCount: previous?.approvedCount ?? 0, rejectedCount: row.rejectedCount,
        });
      });
      setRows([...employees.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName)));
    }).catch(error => {
      if (controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : "Could not load the employee summary.");
      setLoading(false);
      controller.abort();
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [appliedDates, retry]);

  const filtered = employeeId ? rows.filter(row => String(row.employeeId) === employeeId) : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const invalidRange = !dates.startDate || !dates.endDate || dates.startDate > dates.endDate;

  return <Section title="By employee" icon={Users} description="Approved and rejected conversion counts for the selected dates" bodyClassName="p-0">
    <form className="flex flex-wrap items-end gap-3 border-b bg-muted/30 px-4 py-3" onSubmit={event => {
      event.preventDefault();
      if (invalidRange) return;
      setPage(0);
      setEmployeeId("");
      setAppliedDates({ ...dates });
    }}>
      <label className="space-y-1 text-sm">From
        <Input type="date" required max={dates.endDate} value={dates.startDate} onChange={event => setDates({ ...dates, startDate: event.target.value })} />
      </label>
      <label className="space-y-1 text-sm">To
        <Input type="date" required min={dates.startDate} value={dates.endDate} onChange={event => setDates({ ...dates, endDate: event.target.value })} />
      </label>
      <Button type="submit" variant="outline" disabled={invalidRange}>Apply dates</Button>
      <div className="space-y-1 text-sm">
        <label htmlFor="conversion-report-employee">Employee</label>
        <SearchableSelect triggerId="conversion-report-employee" value={employeeId}
          options={[{ value: "", label: "All employees" }, ...rows.map(row => ({ value: String(row.employeeId), label: row.employeeName }))]}
          onSelect={option => { setEmployeeId(option?.value ?? ""); setPage(0); }} placeholder="All employees"
          searchPlaceholder="Search employees" disabled={loading || !!error} allowClear triggerClassName="h-9" />
      </div>
    </form>
    {!loading && !error && <div className="flex flex-wrap gap-4 border-b px-4 py-3 text-sm">
      <span>Approved <strong className="tabular-nums">{filtered.reduce((total, row) => total + row.approvedCount, 0)}</strong></span>
      <span>Rejected <strong className="tabular-nums">{filtered.reduce((total, row) => total + row.rejectedCount, 0)}</strong></span>
    </div>}
    <Table>
      <TableHeader><TableRow className="bg-muted/30">
        {["Employee", "Approved", "Rejected"].map(label => <TableHead scope="col" key={label} className="px-4">{label}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>
          {Array.from({ length: 3 }, (_, column) => <TableCell key={column} className="px-4"><Skeleton className="h-4 w-20" /></TableCell>)}
        </TableRow>) : !error && visible.map(row => <TableRow key={row.employeeId}>
          <TableCell className="px-4 font-medium">{row.employeeName}<span className="ml-2 text-xs font-normal text-muted-foreground">#{row.employeeId}</span></TableCell>
          <TableCell className="px-4 tabular-nums">{row.approvedCount}</TableCell>
          <TableCell className="px-4 tabular-nums">{row.rejectedCount}</TableCell>
        </TableRow>)}
      </TableBody>
    </Table>
    {loading && <span role="status" className="sr-only">Loading employee summary…</span>}
    {!loading && error && <div role="alert"><EmptyState title="Could not load employee summary" text={error}
      action={<Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry</Button>} /></div>}
    {!loading && !error && !filtered.length && <EmptyState title="No reviewed conversions for these dates" />}
    {!loading && !error && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
      <span>Showing {start + 1}–{start + visible.length} of {filtered.length} employees</span>
      {pages > 1 && <nav aria-label="Employee summary pagination" className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-3.5 w-3.5" />Previous</Button>
        <span>Page {currentPage + 1} of {pages}</span>
        <Button size="sm" variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight className="h-3.5 w-3.5" /></Button>
      </nav>}
    </div>}
  </Section>;
}
