"use client";

import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, History, RefreshCw, Search } from "lucide-react";
import { API, type SiteConversion } from "@/lib/api";
import { EmptyState, Info, Pill, Section } from "@/components/detail-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select2";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SidePanel, SidePanelContent, SidePanelDescription, SidePanelHeader, SidePanelTitle } from "@/components/ui/side-panel";

const PAGE_SIZE = 10;

export function ConversionHistory() {
  const [dates, setDates] = useState(() => {
    const today = new Date();
    return { startDate: format(subDays(today, 6), "yyyy-MM-dd"), endDate: format(today, "yyyy-MM-dd") };
  });
  const [appliedDates, setAppliedDates] = useState(dates);
  const [rows, setRows] = useState<SiteConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SiteConversion | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    API.getReviewedSiteConversions({ ...appliedDates, signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setRows(result);
      setPage(0);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setError(error instanceof Error ? error.message : "Could not load conversion history.");
      setLoading(false);
      controller.abort();
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [appliedDates, refresh]);

  const employees = [...new Map(rows.map(row => [row.employeeId, row.employeeName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const query = search.trim().toLowerCase();
  const filtered = rows.filter(row => (!status || row.status === status)
    && (!employeeId || String(row.employeeId) === employeeId)
    && [row.siteName, row.dealerName, row.employeeName, row.number, row.convertedBrand, String(row.id)]
      .some(value => value?.toLowerCase().includes(query)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const invalidRange = !dates.startDate || !dates.endDate || dates.startDate > dates.endDate;

  return <>
    <Section title="Conversion history" icon={History} description="Approved and rejected site conversions"
      action={<Button variant="outline" size="sm" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>}
      bodyClassName="p-0">
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
        <label className="space-y-1 text-sm">Status
          <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={status}
            onChange={event => { setStatus(event.target.value); setPage(0); }}>
            <option value="">Approved and rejected</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <div className="space-y-1 text-sm">
          <label className="block" htmlFor="conversion-history-employee">Employee</label>
          <SearchableSelect triggerId="conversion-history-employee" value={employeeId}
            options={[{ value: "", label: "All employees" }, ...employees.map(([id, name]) => ({ value: String(id), label: `${name} · #${id}` }))]}
            onSelect={option => { setEmployeeId(option?.value ?? ""); setPage(0); }} placeholder="All employees"
            searchPlaceholder="Search employees" disabled={loading || !!error} allowClear triggerClassName="h-9" />
        </div>
      </form>
      <div className="border-b px-4 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search conversion history" className="pl-9" placeholder="Search site, dealer, brand or phone" value={search}
            onChange={event => { setSearch(event.target.value); setPage(0); }} />
        </div>
      </div>
      <Table>
        <TableHeader><TableRow className="bg-muted/30">
          {["Site / Dealer", "Employee", "Requested (MT)", "Approved (MT)", "Status", "Reviewed", "Action"].map(label => <TableHead scope="col" key={label} className="px-4">{label}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>
            {Array.from({ length: 7 }, (_, column) => <TableCell key={column} className="px-4"><Skeleton className="h-4 w-20" /></TableCell>)}
          </TableRow>) : !error && visible.map(row => <TableRow key={row.id}>
            <TableCell className="px-4 font-medium"><span className="block max-w-[14rem] truncate" title={row.siteName}>{row.siteName}</span>
              <span className="block max-w-[14rem] truncate text-xs font-normal text-muted-foreground" title={row.dealerName}>{row.dealerName}</span>
              <span className="block text-xs font-normal text-muted-foreground">#{row.id} · {row.number}</span></TableCell>
            <TableCell className="px-4">{row.employeeName}</TableCell>
            <TableCell className="px-4 tabular-nums">{row.requestedSteelMt}</TableCell>
            <TableCell className="px-4 tabular-nums">{row.approvedSteelMt ?? "—"}</TableCell>
            <TableCell className="px-4"><Pill tone={row.status === "APPROVED" ? "success" : "danger"}>{row.status === "APPROVED" ? "Approved" : "Rejected"}</Pill></TableCell>
            <TableCell className="px-4 whitespace-nowrap">{row.approvedAt || "—"}<span className="block text-xs text-muted-foreground">{row.approvedByName}</span></TableCell>
            <TableCell className="px-4"><Button variant="outline" size="sm" onClick={() => setSelected(row)}>View</Button></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
      {loading && <p role="status" className="px-4 py-3 text-sm text-muted-foreground">Loading conversion history…</p>}
      {!loading && error && <div role="alert"><EmptyState title="Could not load conversion history" text={error}
        action={<Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Retry</Button>} /></div>}
      {!loading && !error && !filtered.length && <EmptyState title="No reviewed conversions found" text="Try different dates or filters." />}
      {!loading && !error && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
        <span>Showing {start + 1}–{start + visible.length} of {filtered.length} reviewed conversions</span>
        {pages > 1 && <nav aria-label="Conversion history pagination" className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-3.5 w-3.5" />Previous</Button>
          <span>Page {currentPage + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight className="h-3.5 w-3.5" /></Button>
        </nav>}
      </div>}
    </Section>
    <SidePanel open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <SidePanelContent size="xl">
        <SidePanelHeader><SidePanelTitle>Conversion details</SidePanelTitle><SidePanelDescription>{selected?.siteName} · #{selected?.id}</SidePanelDescription></SidePanelHeader>
        {selected && <dl className="grid grid-cols-2 gap-4">
          <Info label="Status" value={<Pill tone={selected.status === "APPROVED" ? "success" : "danger"}>{selected.status === "APPROVED" ? "Approved" : "Rejected"}</Pill>} />
          <Info label="Site" value={selected.siteName} />
          <Info label="Phone" value={selected.number} />
          <Info label="Dealer" value={selected.dealerName} />
          <Info label="Brand" value={selected.convertedBrand} />
          <Info label="Employee" value={`${selected.employeeName} · #${selected.employeeId}`} />
          <Info label="Requested steel" value={`${selected.requestedSteelMt} MT`} />
          <Info label="Approved steel" value={selected.approvedSteelMt == null ? "—" : `${selected.approvedSteelMt} MT`} />
          <Info label="Submitted" value={[selected.submittedAt, selected.submittedTime].filter(Boolean).join(" · ") || "—"} />
          <Info label="Reviewed" value={[selected.approvedAt, selected.approvedTime].filter(Boolean).join(" · ") || "—"} />
          <Info label="Reviewed by" value={selected.approvedByName || "—"} />
          <Info className="col-span-2 whitespace-pre-wrap break-words" label={selected.status === "REJECTED" ? "Reason for rejection" : "Approval reason"} value={selected.approvalReason || "—"} />
        </dl>}
      </SidePanelContent>
    </SidePanel>
  </>;
}
