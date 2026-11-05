"use client";

import { useEffect, useRef, useState } from "react";
import { ConversionEmployeeReport } from "@/components/conversion-employee-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { API, type SiteConversion } from "@/lib/api";
import { approvalQuantityError } from "@/lib/site-conversion-review";
import { useAuth } from "@/components/auth-provider";
import { extractAuthorityRoles, hasAnyRole, normalizeRoleValue } from "@/lib/role-utils";
import { EmptyState, FormSheet, Info, Pill, Section } from "@/components/detail-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 10;
type Decision = "approve" | "reject";

export default function ConversionReviewPage() {
  const { userRole, currentUser, isLoading: authLoading } = useAuth();
  const isAdmin = hasAnyRole(normalizeRoleValue(userRole), extractAuthorityRoles(currentUser?.authorities), ["ADMIN"]);
  const [requests, setRequests] = useState<SiteConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<SiteConversion | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    API.getPendingSiteConversions(controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      setRequests(rows.filter(row => row.status === "PENDING"));
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Could not load pending conversions.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [authLoading, isAdmin, refresh]);

  const filtered = requests.filter(row =>
    [row.siteName, row.dealerName, row.employeeName, row.number, row.convertedBrand, String(row.id)]
      .some(value => value?.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const quantityError = selected ? approvalQuantityError(quantity, selected.requestedSteelMt) : null;

  const openReview = (row: SiteConversion) => {
    setSelected(row);
    setDecision(null);
    setQuantity(String(row.requestedSteelMt));
    setReason("");
    setSaveError("");
  };

  const submit = async () => {
    if (!selected || !decision || savingRef.current || !isAdmin) return;
    if (decision === "approve" && quantityError) return;
    if (decision === "reject" && !reason.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = decision === "approve"
        ? await API.approveSiteConversion(selected.id, Number(quantity))
        : await API.rejectSiteConversion(selected.id, reason.trim());
      const expectedStatus = decision === "approve" ? "APPROVED" : "REJECTED";
      if (response.id !== selected.id || response.status !== expectedStatus) {
        throw new Error("The server did not confirm the decision. Close this panel and refresh the queue before trying again.");
      }
      setRequests(rows => rows.filter(row => row.id !== selected.id));
      setSelected(null);
      toast.success(decision === "approve" ? "Conversion approved" : "Conversion rejected");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the decision. Refresh the queue before retrying.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (authLoading) return <p role="status">Loading…</p>;
  if (!isAdmin) return <Section><EmptyState icon={ShieldCheck} title="Admin access required" text="Only administrators can review site conversions." /></Section>;

  return <div className="space-y-4">
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="employees">By employee</TabsTrigger>
      </TabsList>
      <TabsContent value="pending">
    <Section title="Pending conversions" icon={ShieldCheck}
      description="Review site details and requested steel quantities"
      action={<Button variant="outline" size="sm" disabled={loading || saving || selected !== null} onClick={() => setRefresh(value => value + 1)}>
        <RefreshCw className="h-3.5 w-3.5" />Refresh
      </Button>} bodyClassName="p-0">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" aria-label="Search pending conversions" placeholder="Search site, dealer, employee or phone" value={search}
            onChange={event => { setSearch(event.target.value); setPage(0); }} />
        </div>
      </div>
      <Table>
        <TableHeader><TableRow className="bg-muted/30">
          {["Site", "Dealer", "Employee", "Brand", "Requested (MT)", "Status", "Action"].map(label => <TableHead scope="col" key={label} className="px-4">{label}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>
            {Array.from({ length: 7 }, (_, column) => <TableCell key={column} className="px-4"><Skeleton className="h-4 w-20" /></TableCell>)}
          </TableRow>) : !loadError && visible.map(row => <TableRow key={row.id}>
            <TableCell className="px-4"><span className="font-medium">{row.siteName}</span><p className="text-xs text-muted-foreground">#{row.id} · {row.number}</p></TableCell>
            <TableCell className="px-4">{row.dealerName}</TableCell>
            <TableCell className="px-4">{row.employeeName}</TableCell>
            <TableCell className="px-4">{row.convertedBrand}</TableCell>
            <TableCell className="px-4 tabular-nums">{row.requestedSteelMt}</TableCell>
            <TableCell className="px-4"><Pill tone="warning">Pending</Pill></TableCell>
            <TableCell className="px-4"><Button variant="outline" size="sm" disabled={saving} onClick={() => openReview(row)}>Review</Button></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
      {loading && <p role="status" className="sr-only">Loading pending conversions…</p>}
      {!loading && loadError && <div role="alert"><EmptyState title="Could not load conversions" text={loadError}
        action={<Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Retry</Button>} /></div>}
      {!loading && !loadError && !filtered.length && <EmptyState title={search ? "No matching conversions" : "No pending conversions"} text={search ? "Try a different search." : "Submitted conversions will appear here for review."} />}
      {!loading && !loadError && filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
        <span>Showing {start + 1}–{start + visible.length} of {filtered.length} pending conversions</span>
        {pages > 1 && <nav aria-label="Conversion pagination" className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-3.5 w-3.5" />Previous</Button>
          <span>Page {currentPage + 1} of {pages}</span>
          <Button size="sm" variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight className="h-3.5 w-3.5" /></Button>
        </nav>}
      </div>}
    </Section>

      </TabsContent>
      <TabsContent value="employees"><ConversionEmployeeReport /></TabsContent>
    </Tabs>

    <FormSheet open={selected !== null} onOpenChange={open => { if (!open && !savingRef.current) setSelected(null); }}
      title="Review conversion" description={selected ? `${selected.siteName} · #${selected.id}` : undefined} icon={ShieldCheck}
      onSubmit={() => void submit()} submitLabel={decision === "reject" ? "Confirm rejection" : "Confirm approval"}
      submitting={saving} submitDisabled={!decision || (decision === "approve" ? !!quantityError : !reason.trim())}
      errors={saveError ? [saveError] : undefined}>
      {selected && <>
        <dl className="grid grid-cols-2 gap-4">
          <Info label="Site" value={selected.siteName} />
          <Info label="Phone" value={selected.number} />
          <Info label="Dealer" value={selected.dealerName} />
          <Info label="Brand" value={selected.convertedBrand} />
          <Info label="Employee" value={selected.employeeName} />
          <Info label="Requested steel" value={`${selected.requestedSteelMt} MT`} />
          {selected.submittedAt && <Info label="Submitted" value={[selected.submittedAt, selected.submittedTime].filter(Boolean).join(" · ")} />}
        </dl>
        <fieldset disabled={saving} className="space-y-4">
          <legend className="mb-2 text-sm font-medium">Decision</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2"><input type="radio" name="conversion-decision" checked={decision === "approve"} onChange={() => { setDecision("approve"); setSaveError(""); }} />Approve</label>
            <label className="flex items-center gap-2"><input type="radio" name="conversion-decision" checked={decision === "reject"} onChange={() => { setDecision("reject"); setSaveError(""); }} />Reject</label>
          </div>
          {decision === "approve" && <div className="space-y-2">
            <Label htmlFor="approved-quantity">Approved steel (MT)</Label>
            <Input id="approved-quantity" type="number" step="any" min="0" max={selected.requestedSteelMt} value={quantity}
              onChange={event => setQuantity(event.target.value)} aria-invalid={!!quantityError} aria-describedby="quantity-help" />
            <p id="quantity-help" className={`text-xs ${quantityError ? "text-destructive" : "text-muted-foreground"}`}>{quantityError || `Maximum ${selected.requestedSteelMt} MT. Partial approval is allowed.`}</p>
          </div>}
          {decision === "reject" && <div className="space-y-2">
            <Label htmlFor="conversion-reason">Reason for rejection (required)</Label>
            <Textarea id="conversion-reason" value={reason} onChange={event => setReason(event.target.value)} />
          </div>}
        </fieldset>
      </>}
    </FormSheet>
  </div>;
}
