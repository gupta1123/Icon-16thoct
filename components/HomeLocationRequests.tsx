"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  Search,
  User,
  XCircle,
} from "lucide-react";

type FeedbackIntent = "success" | "error";

interface Feedback {
  type: FeedbackIntent;
  message: string;
}

interface PendingLocationChangeRequest {
  id: number;
  employeeId?: number | string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  primaryContact?: number | string | null;
  secondaryContact?: number | string | null;
  role?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: number | string | null;
  houseLatitude?: number | string | null;
  houseLongitude?: number | string | null;
  locationChangeRequested?: boolean | null;
  status?: string | null;
  createdAt?: string | null;
  createdTime?: string | null;
  updatedAt?: string | null;
  updatedTime?: string | null;
}

const formatContactNumber = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
};

const getDisplayName = (request: PendingLocationChangeRequest) => {
  const parts = [request.firstName, request.lastName].filter(
    (part): part is string => Boolean(part && part.trim())
  );

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if (request.email) {
    return request.email;
  }

  const identifier = request.employeeId ?? request.id;
  return `Employee ${identifier}`;
};

const buildAddress = (request: PendingLocationChangeRequest) => {
  const parts = [
    request.addressLine1,
    request.addressLine2,
    request.city,
    request.state,
    request.country,
    request.pincode ? String(request.pincode) : null,
  ].filter((value): value is string => Boolean(value && String(value).trim()));

  return parts.length > 0 ? parts.join(", ") : "Address details not provided";
};

const parseDateFromParts = (date?: string | null, time?: string | null): Date | null => {
  if (!date) {
    return null;
  }

  const isoString = time && time.trim().length > 0 ? `${date}T${time}` : date;
  const parsed = new Date(isoString);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value: Date | null) => {
  if (!value) {
    return "—";
  }

  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatStatusDate = (value: Date | null) => {
  if (!value) {
    return "—";
  }

  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const lookup: Record<"day" | "month" | "year", string> = {
    day: "",
    month: "",
    year: "",
  };

  parts.forEach((part) => {
    if (part.type === "day" || part.type === "month" || part.type === "year") {
      lookup[part.type] = part.value;
    }
  });

  return `${lookup.day} ${lookup.month} '${lookup.year}`;
};

const readResponseMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      if (typeof data === "string") {
        return data;
      }
      if (data && typeof data === "object") {
        if ("message" in data && data.message) {
          return String(data.message);
        }
        if ("error" in data && data.error) {
          return String(data.error);
        }
        return JSON.stringify(data);
      }
    } catch {
      // Fallback to status code if parsing fails
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch {
      // Ignore parsing errors and fall through to default message
    }
  }

  return "Unexpected response from server.";
};

const callEndpointWithFallback = async (
  url: string,
  token: string,
  preferredMethod: "POST" | "GET" | "PUT" = "POST"
): Promise<string> => {
  const baseHeaders: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
  };

  const makeRequest = (method: "POST" | "GET" | "PUT") =>
    fetch(url, {
      method,
      headers: baseHeaders,
    });

  let response = await makeRequest(preferredMethod);

  if (
    !response.ok &&
    response.status === 405 &&
    preferredMethod !== "GET"
  ) {
    response = await makeRequest("GET");
  }

  const message = await readResponseMessage(response);

  if (!response.ok) {
    throw new Error(message);
  }

  return message;
};

const HomeLocationRequests = () => {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const [requests, setRequests] = useState<PendingLocationChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Feedback | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [detailRequest, setDetailRequest] = useState<PendingLocationChangeRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const fetchPendingRequests = useCallback(async () => {
    if (!token) {
      setFetchError("Authentication token not found. Please log in.");
      setRequests([]);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      const response = await fetch("/api/proxy/employee/pendingLocationChangeRequests", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const message = await readResponseMessage(response);
        throw new Error(message || "Failed to fetch location change requests.");
      }

      const data = (await response.json()) as unknown;

      if (Array.isArray(data)) {
        setRequests(data as PendingLocationChangeRequest[]);
      } else {
        setRequests([]);
        setFetchError("Unexpected response format while fetching location change requests.");
      }
    } catch (error) {
      setRequests([]);
      setFetchError(
        error instanceof Error
          ? error.message
          : "Failed to fetch location change requests."
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchPendingRequests();
  }, [fetchPendingRequests]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      return requests;
    }

    return requests.filter((request) => {
      const values: Array<string | null | undefined> = [
        request.firstName,
        request.lastName,
        request.email,
        request.role,
        request.city,
        request.state,
        request.country,
        request.addressLine1,
        request.addressLine2,
        request.status,
        request.employeeId ? String(request.employeeId) : null,
        request.id ? String(request.id) : null,
      ];

      return values
        .filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [requests, searchTerm]);

  const summary = useMemo(() => {
    const withCoordinates = requests.filter(
      (request) =>
        request.houseLatitude !== null &&
        request.houseLatitude !== undefined &&
        request.houseLongitude !== null &&
        request.houseLongitude !== undefined
    ).length;

    return {
      pending: requests.length,
      withCoordinates,
    };
  }, [requests]);

  const handleDecision = useCallback(
    async (request: PendingLocationChangeRequest, approve: boolean) => {
      if (!token) {
        setActionFeedback({
          type: "error",
          message: "Authentication token not found. Please log in.",
        });
        return;
      }

      const identifier = request.employeeId ?? request.id;

      if (identifier === null || identifier === undefined || identifier === "") {
        setActionFeedback({
          type: "error",
          message: "Unable to identify the employee for this request.",
        });
        return;
      }

      const identifierString = String(identifier);
      setActionInFlight(identifierString);
      setActionFeedback(null);

      try {
        const message = await callEndpointWithFallback(
          `/api/proxy/employee/approveLocationChange?employeeId=${encodeURIComponent(
            identifierString
          )}&approve=${approve}`,
          token,
          "PUT"
        );

        setActionFeedback({
          type: "success",
          message:
            message ||
            (approve
              ? "Location change request approved."
              : "Location change request rejected."),
        });

        await fetchPendingRequests();
      } catch (error) {
        setActionFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update the location change request.",
        });
      } finally {
        setActionInFlight(null);
      }
    },
    [fetchPendingRequests, token]
  );

  const handleOpenDetails = useCallback((request: PendingLocationChangeRequest) => {
    setDetailRequest(request);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setIsDetailOpen(false);
    setDetailRequest(null);
  }, []);

  return (
    <div className="space-y-6">
      {actionFeedback && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            actionFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">
            Pending Requests Overview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Monitor the current queue of home location updates awaiting admin review.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-center text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="text-xs uppercase tracking-wide">Pending requests</p>
              <p className="text-lg font-semibold">{summary.pending}</p>
            </div>
            <div className="rounded-lg border bg-primary/5 px-3 py-2 text-center text-primary">
              <p className="text-xs uppercase tracking-wide">With coordinates</p>
              <p className="text-lg font-semibold">{summary.withCoordinates}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, city, or status"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void fetchPendingRequests();
                }}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Approve or reject requests to update employee home locations.</span>
          </div>
        </CardHeader>
        <CardContent>
          {fetchError && (
            <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fetchError}
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading pending location requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Home className="h-10 w-10 opacity-30" />
              <p className="font-medium">No location change requests found</p>
              <p className="text-sm">Try refreshing or adjusting your search criteria.</p>
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                    <TableHead className="min-w-[200px]">Employee</TableHead>
                    <TableHead className="min-w-[220px]">Requested address</TableHead>
                    <TableHead className="min-w-[160px]">Contacts</TableHead>
                    <TableHead className="min-w-[160px]">Status</TableHead>
                    <TableHead className="w-[220px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const identifier = String(request.employeeId ?? request.id);
                    const isProcessing = actionInFlight === identifier;
                    const statusDate =
                      parseDateFromParts(request.updatedAt, request.updatedTime) ??
                      parseDateFromParts(request.createdAt, request.createdTime);
                    const statusDateLabel = formatStatusDate(statusDate);
                    const fullAddress = buildAddress(request);

                    return (
                      <TableRow key={`${identifier}-${request.id}`}>
                        <TableCell>
                          <p className="text-sm font-semibold text-foreground">
                            {getDisplayName(request)}
                          </p>
                          {request.role && (
                            <p className="text-xs text-muted-foreground">{request.role}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block max-w-[260px] cursor-help truncate text-sm font-medium text-foreground">
                                {fullAddress}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs break-words bg-black text-white">
                              <p className="text-sm text-white">{fullAddress}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">
                            {formatContactNumber(request.primaryContact)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Alt: {formatContactNumber(request.secondaryContact)}
                          </p>
                          {request.email && (
                            <p className="text-xs text-muted-foreground">{request.email}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant="outline"
                              className="inline-flex w-fit items-center gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              Pending approval
                            </Badge>
                            <p className="text-xs text-muted-foreground">{statusDateLabel}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleOpenDetails(request)}
                            >
                              <User className="h-4 w-4" />
                              Details
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                void handleDecision(request, true);
                              }}
                              disabled={actionInFlight !== null}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                void handleDecision(request, false);
                              }}
                              disabled={actionInFlight !== null}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </ScrollArea>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDetailOpen && !!detailRequest}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDetails();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {detailRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{getDisplayName(detailRequest)}</DialogTitle>
                {detailRequest.role && (
                  <DialogDescription>{detailRequest.role}</DialogDescription>
                )}
              </DialogHeader>
              <div className="grid gap-4 text-sm">
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Contact
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      {formatContactNumber(detailRequest.primaryContact)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      Alt: {formatContactNumber(detailRequest.secondaryContact)}
                    </div>
                    {detailRequest.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        {detailRequest.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Requested address
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {buildAddress(detailRequest)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Timeline
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Submitted:{" "}
                    {formatDateTime(
                      parseDateFromParts(detailRequest.createdAt, detailRequest.createdTime)
                    )}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Last updated:{" "}
                    {formatDateTime(
                      parseDateFromParts(detailRequest.updatedAt, detailRequest.updatedTime)
                    )}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Location change requested flag:{" "}
                    {detailRequest.locationChangeRequested ? "Yes" : "No"}
                  </p>
                </div>
                {detailRequest.status && (
                  <div className="rounded-lg border bg-muted/10 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Employment status
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {String(detailRequest.status)}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDetails}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeLocationRequests;
