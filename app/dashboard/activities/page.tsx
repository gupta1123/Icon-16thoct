"use client";

import { ChevronLeft, ChevronRight, ClipboardList, Plus } from "lucide-react";
import { EmptyState, Pill, Section } from "@/components/detail-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { API, type ActivityDto } from "@/lib/api";
import { useActivityAccess } from "@/components/activity-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Filter = {
  start: string;
  end: string;
  scope: "all" | "store" | "professional";
  id: string;
  employeeId: string;
  status: "" | "COMPLETED" | "ONGOING";
};

const PAGE_SIZE = 10;

export default function ActivitiesPage() {
  const access = useActivityAccess();
  const [draft, setDraft] = useState<Filter>(() => {
    const today = new Date();
    return {
      start: format(subDays(today, 6), "yyyy-MM-dd"),
      end: format(today, "yyyy-MM-dd"),
      scope: "all",
      id: "",
      employeeId: "",
      status: "",
    };
  });
  const [filter, setFilter] = useState(draft);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ActivityDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (access.isLoading) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError("");

    async function load() {
      if (filter.scope !== "all") {
        return API.getLinkedActivities(filter.scope, Number(filter.id));
      }

      const activities = await API.getActivities({
        start: filter.start,
        end: filter.end,
        employeeId: filter.employeeId ? Number(filter.employeeId) : undefined,
        status: filter.status || undefined,
        signal,
      });
      return [...activities].sort((a, b) => {
        const dateOrder = (b.activityDate ?? "").localeCompare(a.activityDate ?? "");
        return dateOrder || (b.startTime ?? "").localeCompare(a.startTime ?? "") || b.id - a.id;
      });
    }

    load().then(activities => {
      if (!signal.aborted) setRows(activities);
    }).catch(error => {
      if (!signal.aborted) {
        setError(error instanceof Error ? error.message : "Could not load activities.");
      }
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [access.isLoading, filter, retry]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const startIndex = page * PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + PAGE_SIZE);

  return <div className="space-y-4">
    <Section title="Activities" icon={ClipboardList} description="Browse employee activity records"
      action={access.create && !!access.employeeId ? <Button size="sm" asChild><Link href="/dashboard/activities/new"><Plus className="h-4 w-4" />Create activity</Link></Button> : undefined}
      bodyClassName="p-0">
    <form className="flex flex-wrap items-end gap-3 border-b bg-muted/30 px-4 py-3" onSubmit={event => {
      event.preventDefault();
      setRows([]);
      setLoading(true);
      setPage(0);
      setFilter({ ...draft });
    }}>
      <label className="text-sm">Show<select className="block h-9 rounded border bg-background px-2" value={draft.scope} onChange={e => setDraft({ ...draft, scope: e.target.value as Filter["scope"] })}>
        <option value="all">By date range</option><option value="store">By store</option><option value="professional">By professional</option>
      </select></label>
      {draft.scope === "all" ? <>
        <label className="text-sm">From<Input required type="date" max={draft.end} value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
        <label className="text-sm">To<Input required type="date" min={draft.start} value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label>
        <label className="text-sm">Employee ID<Input type="number" min={1} step={1} placeholder="All employees" value={draft.employeeId} onChange={e => setDraft({ ...draft, employeeId: e.target.value })} /></label>
        <label className="text-sm">Status
          <select className="block h-9 rounded border bg-background px-2" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Filter["status"] })}>
            <option value="">All statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="ONGOING">Ongoing</option>
          </select>
        </label>
      </> : <label className="text-sm">{draft.scope === "store" ? "Store ID" : "Professional ID"}<Input required type="number" min={1} step={1} value={draft.id} onChange={e => setDraft({ ...draft, id: e.target.value })} /></label>}
      <Button type="submit" variant="outline">Apply</Button>
    </form>
    <Table>
      <TableHeader><TableRow className="bg-muted/30">
        {["Activity", "Date", "Employee", "Status", "Action"].map(label => <TableHead scope="col" key={label} className="px-4">{label}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>
          {Array.from({ length: 5 }, (_, column) => <TableCell key={column} className="px-4"><Skeleton className="h-4 w-20" /></TableCell>)}
        </TableRow>) : !error && visibleRows.map(activity => {
          const href = `/dashboard/activities/${activity.id}`;
          const title = activity.title || `Activity #${activity.id}`;
          return <TableRow key={activity.id}>
            <TableCell className="px-4"><Link className="font-medium hover:underline" href={href}>{title}</Link></TableCell>
            <TableCell className="px-4">{activity.activityDate ?? "—"}</TableCell>
            <TableCell className="px-4">{activity.employeeName ?? "—"}</TableCell>
            <TableCell className="px-4">{activity.status ? <Pill tone={activity.status.toLowerCase().includes("complet") ? "success" : activity.status.toLowerCase() === "ongoing" ? "info" : "neutral"}>{activity.status}</Pill> : "—"}</TableCell>
            <TableCell className="px-4"><Button asChild variant="ghost" size="sm"><Link href={href} aria-label={`View ${title}`}>View<ChevronRight className="h-4 w-4" /></Link></Button></TableCell>
          </TableRow>;
        })}
      </TableBody>
    </Table>
    {loading && <span className="sr-only" role="status">Loading activities…</span>}
    {!loading && error && <div role="alert"><EmptyState title="Could not load activities" text={error}
      action={<Button variant="outline" size="sm" onClick={() => setRetry(value => value + 1)}>Retry</Button>} /></div>}
    {!loading && !error && rows.length === 0 && <EmptyState title="No activities found" />}
    {!loading && !error && rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
      <span>Showing {startIndex + 1}–{startIndex + visibleRows.length} of {rows.length} activities</span>
      {totalPages > 1 && <nav aria-label="Activities pagination" className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />Previous
        </Button>
        <span>Page {page + 1} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
          Next<ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </nav>}
    </div>}
    </Section>
  </div>;
}
