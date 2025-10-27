"use client";

import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Clock,
  Eye,
  Home,
  MapPin,
  Search,
  Undo2,
  User,
  XCircle,
} from "lucide-react";

type RequestStatus = "pending" | "approved" | "rejected";

interface LocationSnapshot {
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

interface DecisionEntry {
  status: RequestStatus | "submitted";
  decidedAt: string;
  decidedBy: string;
  note?: string;
}

interface HomeLocationRequest {
  id: string;
  officerId: string;
  officerName: string;
  role: string;
  currentLocation: LocationSnapshot;
  requestedLocation: LocationSnapshot;
  requestReason: string;
  submittedAt: string;
  effectiveFrom: string;
  distanceDeltaKm: number;
  weeklyVisitAverage: number;
  lastCheckIn: string;
  territory: string;
  status: RequestStatus;
  decisionHistory: DecisionEntry[];
}

const INITIAL_REQUESTS: HomeLocationRequest[] = [
  {
    id: "REQ-2404-118",
    officerId: "EMP-0921",
    officerName: "Anita Sharma",
    role: "Senior Field Officer",
    currentLocation: {
      address: "302, Green Vistas, Wakad",
      city: "Pune",
      state: "Maharashtra",
      latitude: 18.5921,
      longitude: 73.7689,
    },
    requestedLocation: {
      address: "A702, Riverfront Residences, Kharadi",
      city: "Pune",
      state: "Maharashtra",
      latitude: 18.5518,
      longitude: 73.9445,
    },
    requestReason:
      "Moved to Kharadi to be closer to the healthcare cluster. This cuts commute by 45 minutes and helps me cover Pune East efficiently.",
    submittedAt: "2024-04-18T05:15:00.000Z",
    effectiveFrom: "2024-04-22",
    distanceDeltaKm: 18.4,
    weeklyVisitAverage: 32,
    lastCheckIn: "2024-04-21T13:10:00.000Z",
    territory: "Pune East - Healthcare & Retail",
    status: "pending",
    decisionHistory: [
      {
        status: "submitted",
        decidedAt: "2024-04-18T05:15:00.000Z",
        decidedBy: "Anita Sharma",
        note: "Requested address update",
      },
    ],
  },
  {
    id: "REQ-2404-104",
    officerId: "EMP-0778",
    officerName: "Rahul Menon",
    role: "Field Officer",
    currentLocation: {
      address: "D-203, Sunrise Meadows, Koramangala",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: 12.9344,
      longitude: 77.6126,
    },
    requestedLocation: {
      address: "408, Crestline Heights, HSR Layout",
      city: "Bengaluru",
      state: "Karnataka",
      latitude: 12.9114,
      longitude: 77.6412,
    },
    requestReason:
      "Shifted residence to HSR Layout. This aligns better with my south Bengaluru beat and reduces backtracking while covering pharmacies.",
    submittedAt: "2024-04-16T11:45:00.000Z",
    effectiveFrom: "2024-04-25",
    distanceDeltaKm: 6.2,
    weeklyVisitAverage: 24,
    lastCheckIn: "2024-04-20T09:32:00.000Z",
    territory: "Bengaluru South - Pharma",
    status: "approved",
    decisionHistory: [
      {
        status: "submitted",
        decidedAt: "2024-04-16T11:45:00.000Z",
        decidedBy: "Rahul Menon",
      },
      {
        status: "approved",
        decidedAt: "2024-04-19T15:05:00.000Z",
        decidedBy: "Priya D'Souza",
        note: "Aligned with new territory assignment. Update shared with payroll.",
      },
    ],
  },
  {
    id: "REQ-2403-089",
    officerId: "EMP-0643",
    officerName: "Mohammed Faiz",
    role: "Field Associate",
    currentLocation: {
      address: "B-11, Coastal View, Mylapore",
      city: "Chennai",
      state: "Tamil Nadu",
      latitude: 13.0314,
      longitude: 80.2682,
    },
    requestedLocation: {
      address: "52/4, Grand Park, Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      latitude: 13.0066,
      longitude: 80.2573,
    },
    requestReason:
      "Family relocation due to children's schooling. Travel distance reduces slightly and keeps the southern retail beat intact.",
    submittedAt: "2024-03-28T08:05:00.000Z",
    effectiveFrom: "2024-04-01",
    distanceDeltaKm: 4.1,
    weeklyVisitAverage: 19,
    lastCheckIn: "2024-04-18T17:20:00.000Z",
    territory: "Chennai South - General Trade & Modern Trade",
    status: "rejected",
    decisionHistory: [
      {
        status: "submitted",
        decidedAt: "2024-03-28T08:05:00.000Z",
        decidedBy: "Mohammed Faiz",
      },
      {
        status: "rejected",
        decidedAt: "2024-03-30T14:40:00.000Z",
        decidedBy: "Sridhar Narayanan",
        note: "Awaiting proof of new utility bill. Please resubmit with updated documentation.",
      },
    ],
  },
];

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_TONE: Record<RequestStatus, string> = {
  pending:
    "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300",
  approved:
    "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
  rejected:
    "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-200",
};

const STATUS_ICONS: Record<RequestStatus, typeof CheckCircle2> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});

const statusFilters: Array<{ value: "all" | RequestStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const HomeLocationRequests = () => {
  const [requests, setRequests] = useState<HomeLocationRequest[]>(INITIAL_REQUESTS);
  const [statusFilter, setStatusFilter] = useState<"all" | RequestStatus>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [detailRequest, setDetailRequest] = useState<HomeLocationRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const filteredRequests = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();

    return requests
      .filter((request) => {
        const matchesStatus =
          statusFilter === "all" ? true : request.status === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!searchValue) {
          return true;
        }

        const haystack = [
          request.officerName,
          request.role,
          request.currentLocation.city,
          request.currentLocation.state,
          request.requestedLocation.city,
          request.requestedLocation.state,
          request.territory,
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        return haystack.some((value) => value.includes(searchValue));
      })
      .sort((a, b) => {
        const aTime = new Date(a.submittedAt).getTime();
        const bTime = new Date(b.submittedAt).getTime();
        return bTime - aTime;
      });
  }, [requests, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        acc.total += 1;
        acc[request.status] += 1;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      } as { total: number; pending: number; approved: number; rejected: number }
    );
  }, [requests]);

  const rejectRequest = useMemo(() => {
    if (!rejectRequestId) {
      return null;
    }

    return requests.find((request) => request.id === rejectRequestId) ?? null;
  }, [rejectRequestId, requests]);

  const handleOpenDetails = useCallback(
    (requestId: string) => {
      const request = requests.find((item) => item.id === requestId);
      if (!request) {
        return;
      }
      setDetailRequest(request);
      setIsDetailOpen(true);
    },
    [requests]
  );

  const handleApprove = useCallback(
    (requestId: string) => {
      let updatedRequest: HomeLocationRequest | null = null;

      setRequests((prev) =>
        prev.map((request) => {
          if (request.id !== requestId) {
            return request;
          }

          const next: HomeLocationRequest = {
            ...request,
            status: "approved",
            decisionHistory: [
              ...request.decisionHistory,
              {
                status: "approved",
                decidedAt: new Date().toISOString(),
                decidedBy: "You",
                note: "Approved and shared with HRMS.",
              },
            ],
          };

          updatedRequest = next;
          return next;
        })
      );

      if (detailRequest?.id === requestId && updatedRequest) {
        setDetailRequest(updatedRequest);
      }
    },
    [detailRequest]
  );

  const handleOpenReject = useCallback((requestId: string) => {
    setRejectRequestId(requestId);
    setRejectNote("");
    setIsRejectDialogOpen(true);
  }, []);

  const handleRejectSubmit = useCallback(() => {
    if (!rejectRequestId) {
      return;
    }

    const note = rejectNote.trim();
    if (!note) {
      return;
    }

    let updatedRequest: HomeLocationRequest | null = null;

    setRequests((prev) =>
      prev.map((request) => {
        if (request.id !== rejectRequestId) {
          return request;
        }

        const next: HomeLocationRequest = {
          ...request,
          status: "rejected",
          decisionHistory: [
            ...request.decisionHistory,
            {
              status: "rejected",
              decidedAt: new Date().toISOString(),
              decidedBy: "You",
              note,
            },
          ],
        };

        updatedRequest = next;
        return next;
      })
    );

    if (detailRequest?.id === rejectRequestId && updatedRequest) {
      setDetailRequest(updatedRequest);
    }

    setIsRejectDialogOpen(false);
    setRejectNote("");
    setRejectRequestId(null);
  }, [detailRequest, rejectNote, rejectRequestId]);

  const handleReopen = useCallback(
    (requestId: string) => {
      let updatedRequest: HomeLocationRequest | null = null;

      setRequests((prev) =>
        prev.map((request) => {
          if (request.id !== requestId) {
            return request;
          }

          const next: HomeLocationRequest = {
            ...request,
            status: "pending",
            decisionHistory: [
              ...request.decisionHistory,
              {
                status: "pending",
                decidedAt: new Date().toISOString(),
                decidedBy: "You",
                note: "Moved back to pending for re-evaluation.",
              },
            ],
          };

          updatedRequest = next;
          return next;
        })
      );

      if (detailRequest?.id === requestId && updatedRequest) {
        setDetailRequest(updatedRequest);
      }
    },
    [detailRequest]
  );

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">
            Home Location Requests
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Approve or reject address updates from your field team before they sync with payroll.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="text-lg font-semibold text-foreground">{summary.total}</p>
            </div>
            <div className="rounded-lg border bg-amber-100 px-3 py-2 text-center text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
              <p className="text-xs uppercase tracking-wide">Pending</p>
              <p className="text-lg font-semibold">{summary.pending}</p>
            </div>
            <div className="rounded-lg border bg-emerald-100 px-3 py-2 text-center text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
              <p className="text-xs uppercase tracking-wide">Approved</p>
              <p className="text-lg font-semibold">{summary.approved}</p>
            </div>
            <div className="rounded-lg border bg-rose-100 px-3 py-2 text-center text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
              <p className="text-xs uppercase tracking-wide">Rejected</p>
              <p className="text-lg font-semibold">{summary.rejected}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, territory, or city"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
                aria-label="Search requests"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as "all" | RequestStatus)}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Pending requests auto-escalate if unattended for 48 hours.</span>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Home className="h-10 w-10 opacity-30" />
              <p className="font-medium">No requests match your filters</p>
              <p className="text-sm">Try changing the status filter or search term.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[480px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Field officer</TableHead>
                    <TableHead className="min-w-[200px]">Location change</TableHead>
                    <TableHead className="min-w-[160px]">Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[240px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const StatusIcon = STATUS_ICONS[request.status];
                    return (
                      <TableRow key={request.id} className="align-top">
                        <TableCell>
                          <p className="text-sm font-semibold text-foreground">
                            {request.officerName}
                          </p>
                          <p className="text-xs text-muted-foreground">{request.role}</p>
                          <p className="text-xs text-muted-foreground">{request.officerId}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">
                            {request.currentLocation.city} → {request.requestedLocation.city}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {numberFormatter.format(request.distanceDeltaKm)} km difference ·{" "}
                            {request.territory}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium text-foreground">
                            {formatDateTime(request.submittedAt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Effective {formatDate(request.effectiveFrom)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`inline-flex items-center gap-1 ${STATUS_TONE[request.status]}`}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {STATUS_LABEL[request.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleOpenDetails(request.id)}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            {request.status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleApprove(request.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => handleOpenReject(request.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleReopen(request.id)}
                              >
                                <Undo2 className="h-4 w-4" />
                                Reopen
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDetailOpen && !!detailRequest}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) {
            setDetailRequest(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {detailRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{detailRequest.officerName}</DialogTitle>
                <DialogDescription>
                  {detailRequest.role} · {detailRequest.officerId}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Current address
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {detailRequest.currentLocation.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detailRequest.currentLocation.city},{" "}
                      {detailRequest.currentLocation.state}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {numberFormatter.format(detailRequest.currentLocation.latitude)},{" "}
                      {numberFormatter.format(detailRequest.currentLocation.longitude)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-primary/5 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Requested address
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {detailRequest.requestedLocation.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detailRequest.requestedLocation.city},{" "}
                      {detailRequest.requestedLocation.state}
                    </p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {numberFormatter.format(detailRequest.requestedLocation.latitude)},{" "}
                      {numberFormatter.format(detailRequest.requestedLocation.longitude)}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Officer note
                  </p>
                  <p className="mt-2 leading-relaxed text-foreground">
                    {detailRequest.requestReason}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Weekly visits
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {detailRequest.weeklyVisitAverage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Average visits over the last four weeks.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Last check-in
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatDateTime(detailRequest.lastCheckIn)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Captured from live tracking reports.
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Decision history
                  </p>
                  <div className="mt-2 space-y-2">
                    {detailRequest.decisionHistory
                      .slice()
                      .reverse()
                      .map((entry, index) => {
                        const status =
                          entry.status === "submitted"
                            ? "pending"
                            : (entry.status as RequestStatus);
                        const HistoryIcon = STATUS_ICONS[status];
                        return (
                          <div
                            key={`${entry.decidedAt}-${index}`}
                            className="rounded-md border bg-background/70 p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <HistoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground">
                                  {entry.status === "submitted"
                                    ? "Submitted"
                                    : STATUS_LABEL[entry.status as RequestStatus]}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(entry.decidedAt)}
                              </p>
                            </div>
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              {entry.decidedBy}
                            </p>
                            {entry.note && (
                              <p className="mt-1 text-xs leading-relaxed text-foreground">
                                {entry.note}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRejectDialogOpen}
        onOpenChange={(open) => {
          setIsRejectDialogOpen(open);
          if (!open) {
            setRejectNote("");
            setRejectRequestId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>
              {rejectRequest
                ? `Share a short note for ${rejectRequest.officerName}.`
                : "Share a short note so the officer knows what to fix before resubmitting."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Example: Utility bill missing. Please upload the latest proof of address."
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This message is shared with the officer and recorded in the audit log.
            </p>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectNote("");
                setRejectRequestId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectNote.trim().length === 0}
              onClick={handleRejectSubmit}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeLocationRequests;
