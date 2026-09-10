'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, DownloadIcon, Building, Loader } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select2";
import { DateRangeError, isDateRangeInvalid } from "@/components/date-range-error";
import { formatStockQuantity } from "@/lib/api";
import { cn } from "@/lib/utils";
import Link from "next/link";
import dayjs from "dayjs";
import {
  ADMIN_REPORT_EMPLOYEE_ROLES, normalizeEmployeeRole,
  DISPLAY_CUSTOMER_TYPES, getCustomerTypeLabel, getCustomerTypeFallbackRaw,
  summarizeCustomerTypes, getReportDateRange, fetchReportJson,
  type Employee, type FieldOfficerStatsResponse, type VisitDetail, type DisplayCustomerTypeKey,
} from "@/lib/visit-report";

export default function ReportsPage() {
  const { token, userData } = useAuth();
  const [fieldOfficers, setFieldOfficers] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeReload, setEmployeeReload] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [rangeSelect, setRangeSelect] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
  const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<FieldOfficerStatsResponse | null>(null);
  const [visitDetails, setVisitDetails] = useState<VisitDetail[] | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedCustomerTypeForDetails, setSelectedCustomerTypeForDetails] = useState<DisplayCustomerTypeKey | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const reportRequest = useRef<AbortController | null>(null);
  const detailsRequest = useRef<AbortController | null>(null);
  const today = dayjs().endOf("day").toDate();

  // Resolve access before loading officers. Team-scoped users never fall through
  // to the all-employees endpoint while their role request is still pending.
  useEffect(() => {
    const request = new AbortController();
    reportRequest.current?.abort();
    detailsRequest.current?.abort();
    setReportData(null);
    setSelectedCustomerTypeForDetails(null);
    setVisitDetails(null);
    setReportLoading(false);
    setDetailsLoading(false);
    setReportError(null);
    setDetailsError(null);
    setFieldOfficers([]);
    setSelectedEmployeeId("");
    setEmployeesLoading(true);
    setEmployeesError(null);
    if (!token) return () => request.abort();

    async function loadOfficers() {
      try {
        const currentUser = await fetchReportJson<{ authorities?: { authority: string }[] }>(
          "/user/manage/current-user", token!, request.signal,
        );
        const roles = new Set(currentUser.authorities?.map(({ authority }) => authority) ?? []);
        const isAdmin = roles.has("ROLE_ADMIN");
        const isTeamRole = ["ROLE_COORDINATOR", "ROLE_MANAGER", "ROLE_REGIONAL_MANAGER", "ROLE_AVP"].some(role => roles.has(role));
        let officers: Employee[];
        if (!isAdmin && isTeamRole) {
          if (!userData?.employeeId) throw new Error("Your employee profile is unavailable. Please sign in again.");
          const teams = await fetchReportJson<{ fieldOfficers?: Employee[] }[]>(
            `/employee/team/getByEmployee?id=${encodeURIComponent(userData.employeeId)}`, token!, request.signal,
          );
          // Preserve Icon's current team scope.
          officers = teams[0]?.fieldOfficers ?? [];
        } else {
          const [all, inactive] = await Promise.all([
            fetchReportJson<Employee[]>("/employee/getAll", token!, request.signal),
            fetchReportJson<Employee[]>("/employee/getAllInactive", token!, request.signal),
          ]);
          const inactiveIds = new Set(inactive.map(employee => employee.id));
          officers = all.filter(employee => !inactiveIds.has(employee.id) && (
            isAdmin
              ? ADMIN_REPORT_EMPLOYEE_ROLES.has(normalizeEmployeeRole(employee.role))
              : normalizeEmployeeRole(employee.role) === "FIELD OFFICER"
          ));
        }
        if (request.signal.aborted) return;
        setFieldOfficers([...officers].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        ));
      } catch (error) {
        if (!request.signal.aborted) setEmployeesError(error instanceof Error ? error.message : "Could not load field officers.");
      } finally {
        if (!request.signal.aborted) setEmployeesLoading(false);
      }
    }
    void loadOfficers();
    return () => request.abort();
  }, [token, userData?.employeeId, employeeReload]);

  useEffect(() => () => {
    reportRequest.current?.abort();
    detailsRequest.current?.abort();
  }, []);

  const categories = useMemo(() => summarizeCustomerTypes(reportData?.visitsByCustomerType ?? {}), [reportData]);
  const reportSummary = reportData ? { ...reportData, categorizedVisits: categories.counts } : null;
  const fieldOfficerOptions = fieldOfficers.map(officer => ({
    value: String(officer.id), label: [officer.firstName, officer.lastName].filter(Boolean).join(" "),
  }));
  const selectedEmployeeName = fieldOfficerOptions.find(officer => officer.value === selectedEmployeeId)?.label ?? "";
  const selectedCustomerTypeLabel = selectedCustomerTypeForDetails ? getCustomerTypeLabel(selectedCustomerTypeForDetails) : "";
  const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);

  function invalidateReport() {
    reportRequest.current?.abort();
    detailsRequest.current?.abort();
    setReportData(null);
    setReportLoading(false);
    setReportError(null);
    setSelectedCustomerTypeForDetails(null);
    setVisitDetails(null);
    setDetailsLoading(false);
    setDetailsError(null);
    setDateRangeError(null);
  }

  function handleRangeChange(value: string) {
    invalidateReport();
    setRangeSelect(value);
    const range = getReportDateRange(value);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function handleStartDateSelect(date: Date | undefined) {
    if (date) {
      invalidateReport();
      const value = dayjs(date).format("YYYY-MM-DD");
      setRangeSelect("custom");
      setStartDate(value);
      if (endDate && value > endDate) setEndDate("");
    }
    setIsStartDatePopoverOpen(false);
  }

  function handleEndDateSelect(date: Date | undefined) {
    if (date) {
      invalidateReport();
      setRangeSelect("custom");
      setEndDate(dayjs(date).format("YYYY-MM-DD"));
    }
    setIsEndDatePopoverOpen(false);
  }

  async function handleGenerateReport() {
    if (!token || !selectedEmployeeId || !startDate || !endDate || dateRangeInvalid) {
      setDateRangeError("Select a field officer and a valid date range.");
      return;
    }
    invalidateReport();
    const request = new AbortController();
    reportRequest.current = request;
    setReportLoading(true);
    try {
      const query = new URLSearchParams({ employeeId: selectedEmployeeId, startDate, endDate });
      const data = await fetchReportJson<FieldOfficerStatsResponse>(
        `/visit/field-officer-stats?${query}`, token, request.signal,
      );
      if (!request.signal.aborted) setReportData(data);
    } catch (error) {
      if (!request.signal.aborted) setReportError(error instanceof Error ? error.message : "Failed to load the report.");
    } finally {
      if (!request.signal.aborted) setReportLoading(false);
    }
  }

  async function fetchCustomerTypeDetails(category: DisplayCustomerTypeKey) {
    if (!token || !reportData) return;
    detailsRequest.current?.abort();
    const request = new AbortController();
    detailsRequest.current = request;
    setSelectedCustomerTypeForDetails(category);
    setVisitDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const rawTypes = categories.rawGroups[category];
      const apiTypes = rawTypes.length ? rawTypes : [getCustomerTypeFallbackRaw(category)];
      const rows = new Map<number, VisitDetail>();
      for (const customerType of apiTypes) {
        const query = new URLSearchParams({ employeeId: selectedEmployeeId, startDate, endDate, customerType });
        const data = await fetchReportJson<VisitDetail[]>(
          `/visit/customer-visit-details?${query}`, token, request.signal,
        );
        if (request.signal.aborted) return;
        for (const detail of data) {
          if (!rows.has(detail.storeId)) rows.set(detail.storeId, detail);
        }
      }
      if (!request.signal.aborted) setVisitDetails([...rows.values()]);
    } catch (error) {
      if (!request.signal.aborted) setDetailsError(error instanceof Error ? error.message : "Failed to load visit details.");
    } finally {
      if (!request.signal.aborted) setDetailsLoading(false);
    }
  }

  return (
    <div className="icon-reports min-w-0 space-y-4 overflow-visible [&_h3]:tracking-normal">
      <div className="space-y-5">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b pb-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(145px,.8fr)_minmax(155px,.9fr)_minmax(155px,.9fr)_minmax(180px,auto)] xl:items-end">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="employeeSelectTrigger" className="text-xs font-medium text-foreground">Field officer</Label>
              {employeesLoading ? (
                <div className="flex items-center justify-center h-10 w-full">
                  <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : employeesError ? (
                <div role="alert" className="space-y-2 text-xs text-destructive">
                  <p>{employeesError}</p>
                  <Button variant="outline" size="sm" onClick={() => setEmployeeReload(value => value + 1)}>Try again</Button>
                </div>
              ) : (
                <SearchableSelect
                  triggerId="employeeSelectTrigger"
                  placeholder={fieldOfficers.length ? "Select Field Officer" : "No officers available"}
                  options={fieldOfficerOptions}
                  value={selectedEmployeeId || undefined}
                  onSelect={(option) => { invalidateReport(); setSelectedEmployeeId(option?.value ?? ''); }}
                  searchPlaceholder="Search officers..."
                  emptyMessage="No officers available"
                  noResultsMessage="No matching officers"
                  allowClear
                  loading={employeesLoading}
                  disabled={fieldOfficerOptions.length === 0}
                  triggerClassName="h-9 w-full"
                  contentClassName="w-[min(360px,calc(100vw-2rem))]"
                />
              )}
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="rangeSelectTrigger" className="text-xs font-medium text-foreground">Date range</Label>
              <Select value={rangeSelect} onValueChange={handleRangeChange}>
                <SelectTrigger id="rangeSelectTrigger" className="h-9 w-full">
                  <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                  <SelectItem value="last-15-days">Last 15 Days</SelectItem>
                  <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="startDateTrigger" className="text-xs font-medium text-foreground">From date</Label>
              <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="startDateTrigger"
                    variant="outline"
                    className={cn("h-9 w-full justify-start text-left font-normal", !startDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                    disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? dayjs(startDate).format('MMM DD, YYYY') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar
                    mode="single"
                    selected={startDate ? dayjs(startDate).toDate() : undefined}
                    onSelect={handleStartDateSelect}
                    disabled={{ after: today }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="endDateTrigger" className="text-xs font-medium text-foreground">To date</Label>
              <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="endDateTrigger"
                    variant="outline"
                    className={cn("h-9 w-full justify-start text-left font-normal", !endDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                    disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? dayjs(endDate).format('MMM DD, YYYY') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <SpacedCalendar
                    mode="single"
                    selected={endDate ? dayjs(endDate).toDate() : undefined}
                    onSelect={handleEndDateSelect}
                    disabled={[{ after: today }, ...(startDate ? [{ before: dayjs(startDate).toDate() }] : [])]}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col justify-end gap-2 sm:col-span-2 xl:col-span-1">
              <DateRangeError fromDate={startDate} toDate={endDate} />
              <Button
                onClick={handleGenerateReport}
                className="h-9 w-full min-w-[160px] whitespace-nowrap"
                disabled={reportLoading || fieldOfficers.length === 0 || !selectedEmployeeId || !startDate || !endDate || dateRangeInvalid}
              >
                {reportLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    Generate report
                  </>
                )}
              </Button>
            </div>
          </div>

          {dateRangeError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {dateRangeError}
            </div>
          )}

          {reportLoading && (
            <div role="status" className="flex justify-center items-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Generating report...</p>
              </div>
            </div>
          )}

          {reportError && (
            <div role="alert" className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center justify-between">
                <p><strong>Error:</strong> {reportError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
          {reportSummary && !reportLoading && !reportError && (
            <section className="border-y bg-card/30">
              <div className="border-b px-1 py-3">
                <h3 className="text-sm font-semibold text-foreground">Report summary</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Visits and attendance for the selected period. Choose a customer type to inspect its visits.</p>
              </div>
              <div className="grid lg:grid-cols-[.8fr_1.15fr_2.1fr]">
                <div className="py-4 pr-5 lg:border-r">
                  <p className="text-[11px] leading-5 font-semibold uppercase tracking-wide text-muted-foreground">Visits</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.totalVisits}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Total</p></div>
                    <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.completedVisits}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Completed</p></div>
                  </div>
                </div>
                <div className="border-t py-4 lg:border-r lg:border-t-0 lg:px-5">
                  <p className="text-[11px] leading-5 font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.attendanceStats.fullDays}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Full days</p></div>
                    <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.attendanceStats.halfDays}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Half days</p></div>
                    <div className="flex min-h-16 flex-col items-center justify-center rounded-md bg-muted/35 px-2 py-2 text-center"><p className="text-xl font-semibold leading-none tabular-nums">{reportSummary.attendanceStats.absences}</p><p className="mt-1.5 text-xs leading-none text-muted-foreground">Absent</p></div>
                  </div>
                </div>
                <div className="border-t py-4 lg:border-t-0 lg:pl-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] leading-5 font-semibold uppercase tracking-wide text-muted-foreground">Customer types</p>
                    <p className="text-[11px] leading-5 text-muted-foreground">Select to view visits</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {DISPLAY_CUSTOMER_TYPES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selectedCustomerTypeForDetails === category}
                        disabled={reportLoading || detailsLoading}
                        onClick={() => fetchCustomerTypeDetails(category)}
                        className={cn(
                          "group flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-md border bg-background px-2 py-2 text-center transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60",
                          selectedCustomerTypeForDetails === category && "border-primary bg-primary/10 text-primary shadow-sm"
                        )}
                      >
                        <span className="block text-xl font-semibold leading-none tabular-nums">{reportSummary.categorizedVisits[category]}</span>
                        <span className={cn("mt-1.5 block max-w-full text-xs leading-tight sm:leading-none text-muted-foreground group-hover:text-foreground", selectedCustomerTypeForDetails === category && "text-primary")}>
                          {getCustomerTypeLabel(category).split("/").map((part, index, parts) => (
                            <span className="inline-block whitespace-nowrap" key={part}>{part}{index < parts.length - 1 ? "/" : ""}</span>
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {selectedCustomerTypeForDetails && (
            <section className="border-t bg-card/20">
              <div className="border-b px-1 py-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {selectedCustomerTypeLabel} visits
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedEmployeeName !== "Select Field Officer" && `${selectedEmployeeName} · ${dayjs(startDate).format('MMM DD, YYYY')} – ${dayjs(endDate).format('MMM DD, YYYY')}`}
                </p>
              </div>

              {detailsLoading && (
                <div className="flex justify-center items-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading visit details...</p>
                  </div>
                </div>
              )}

              {detailsError && (
                <div role="alert" className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md m-4">
                  <p><strong>Error:</strong> {detailsError}</p>
                  <Button className="mt-3" variant="outline" size="sm" onClick={() => fetchCustomerTypeDetails(selectedCustomerTypeForDetails)}>Try again</Button>
                </div>
              )}

              {!detailsLoading && !detailsError && visitDetails && (
                visitDetails.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table aria-label={`${selectedCustomerTypeLabel} visit details`}>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Taluka</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Last visited</TableHead>
                          <TableHead>Visits</TableHead>
                          <TableHead>Average stock</TableHead>
                          <TableHead>Intent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitDetails
                          .slice()
                          .sort((a, b) => {
                            const dateA = new Date(a.lastVisited).getTime();
                            const dateB = new Date(b.lastVisited).getTime();
                            return dateB - dateA;
                          })
                          .map((detail) => (
                            <TableRow key={detail.storeId}>
                              <TableCell className="font-medium">
                                <Link href={`/dashboard/customers/${detail.storeId}`} className="text-primary hover:text-primary/80 hover:underline">
                                  {detail.customerName}
                                </Link>
                              </TableCell>
                              <TableCell>{detail.city || "—"}</TableCell>
                              <TableCell>{detail.taluka || "—"}</TableCell>
                              <TableCell>{detail.state || "—"}</TableCell>
                              <TableCell>{dayjs(detail.lastVisited).format('MMM DD, YYYY')}</TableCell>
                              <TableCell>{detail.visitCount}</TableCell>
                              <TableCell>
                                {formatStockQuantity(detail.avgStock ?? detail.avgMonthlySales ?? 0, "0 tons")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {detail.avgIntentLevel == null ? "—" : Number(detail.avgIntentLevel).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No visit details found for {selectedCustomerTypeLabel}</p>
                  </div>
                )
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
