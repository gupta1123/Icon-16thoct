"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  RefreshCcw,
  Search,
  User,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

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

const getInitials = (name: string) => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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

const hasValidCoordinates = (request: PendingLocationChangeRequest) => {
  const latitudeValue = request.houseLatitude;
  const longitudeValue = request.houseLongitude;
  if (
    latitudeValue === null ||
    latitudeValue === undefined ||
    String(latitudeValue).trim() === "" ||
    longitudeValue === null ||
    longitudeValue === undefined ||
    String(longitudeValue).trim() === ""
  ) {
    return false;
  }

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
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
      // Fallback
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        return text;
      }
    } catch {
      // Fallback
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

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : String(value);
  return <span className="block min-w-0 truncate" title={displayValue}>{displayValue}</span>;
}

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

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const fetchPendingRequests = useCallback(async () => {
    if (!token) {
      setFetchError("Authentication token not found. Please log in.");
      setRequests([]);
      return;
    }

    setIsLoading(true);
    setFetchError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/employee/pendingLocationChangeRequests`, {
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;
  const indexOfLastRow = currentPage * itemsPerPage;
  const indexOfFirstRow = indexOfLastRow - itemsPerPage;
  const currentRows = filteredRequests.slice(indexOfFirstRow, indexOfLastRow);

  const handleDecision = useCallback(
    async (request: PendingLocationChangeRequest, approve: boolean) => {
      if (!token) {
        toast.error("Authentication token not found. Please log in.");
        return;
      }

      const identifier = request.employeeId ?? request.id;

      if (identifier === null || identifier === undefined || identifier === "") {
        toast.error("Unable to identify the employee for this request.");
        return;
      }

      const identifierString = String(identifier);
      setActionInFlight(identifierString);
      setActionFeedback(null);

      try {
        const message = await callEndpointWithFallback(
          `${API_BASE_URL}/employee/approveLocationChange?employeeId=${encodeURIComponent(
            identifierString
          )}&approve=${approve}`,
          token,
          "PUT"
        );

        const succMsg = message || (approve ? "Location change request approved." : "Location change request rejected.");
        setActionFeedback({ type: "success", message: succMsg });
        toast.success(succMsg);

        await fetchPendingRequests();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to update the location change request.";
        setActionFeedback({ type: "error", message: errorMsg });
        toast.error(errorMsg);
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
    <div className="space-y-4">
      {actionFeedback && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${
            actionFeedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

          {/* Compact Filter & Summary Header */}
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, city..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="h-9 pl-9 text-sm shadow-none"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 shadow-none text-xs"
                onClick={() => {
                  void fetchPendingRequests();
                }}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {fetchError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {fetchError}
            </div>
          )}

          {!fetchError && (
            <>
              {/* Mobile View - Cards */}
              <div className="space-y-3 md:hidden">
                {isLoading ? (
                  Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-36 w-full rounded-xl" />
                  ))
                ) : currentRows.length === 0 ? (
                  <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
                    No location change requests found.
                  </div>
                ) : (
                  currentRows.map((request) => {
                    const identifier = String(request.employeeId ?? request.id);
                    const isProcessing = actionInFlight === identifier;
                    const statusDate =
                      parseDateFromParts(request.updatedAt, request.updatedTime) ??
                      parseDateFromParts(request.createdAt, request.createdTime);
                    const statusDateLabel = formatStatusDate(statusDate);
                    const fullAddress = buildAddress(request);
                    const name = getDisplayName(request);

                    return (
                      <Card key={`${identifier}-${request.id}`} className="overflow-hidden">
                        <div className="p-3 border-b flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8 bg-primary">
                              <AvatarFallback className="text-xs text-primary-foreground">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{name}</h4>
                              {request.role && (
                                <p className="text-xs text-muted-foreground">{request.role}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]">
                            Pending
                          </Badge>
                        </div>
                        <div className="p-3 space-y-2 text-xs">
                          <div className="flex items-start gap-1.5 text-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                            <span className="line-clamp-2">{fullAddress}</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {formatContactNumber(request.primaryContact)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {statusDateLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-end border-t pt-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`}>
                                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onSelect={() => handleOpenDetails(request)}>
                                  <User />
                                  Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={actionInFlight !== null}
                                  onSelect={() => void handleDecision(request, true)}
                                >
                                  <CheckCircle2 />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={actionInFlight !== null}
                                  onSelect={() => void handleDecision(request, false)}
                                >
                                  <XCircle />
                                  Reject
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden min-w-0 overflow-x-auto md:block">
                <TooltipProvider delayDuration={200}>
                  <Table className="min-w-[900px] table-fixed text-xs font-poppins">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[40%]" />
                      <col className="w-[17%]" />
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap">Employee</TableHead>
                        <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap">Requested Address</TableHead>
                        <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap">Contacts</TableHead>
                        <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap">Status</TableHead>
                        <TableHead className="overflow-hidden text-ellipsis whitespace-nowrap text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 3 }, (_, rowIndex) => (
                          <TableRow key={`homeloc-loading-${rowIndex}`}>
                            {Array.from({ length: 5 }, (_, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton className="h-4 w-full max-w-28" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : currentRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No location change requests found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentRows.map((request) => {
                          const identifier = String(request.employeeId ?? request.id);
                          const isProcessing = actionInFlight === identifier;
                          const statusDate =
                            parseDateFromParts(request.updatedAt, request.updatedTime) ??
                            parseDateFromParts(request.createdAt, request.createdTime);
                          const statusDateLabel = formatStatusDate(statusDate);
                          const fullAddress = buildAddress(request);
                          const name = getDisplayName(request);

                          return (
                            <TableRow key={`${identifier}-${request.id}`}>
                              <TableCell className="max-w-0 overflow-hidden font-medium">
                                <Ellipsis value={name} />
                                {request.role && (
                                  <span className="block text-[11px] text-muted-foreground truncate">{request.role}</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-0 overflow-hidden">
                                <Popover>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className="block w-full min-w-0 cursor-help truncate text-left text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          aria-label={`Show full address: ${fullAddress}`}
                                        >
                                          {fullAddress}
                                        </button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm break-words bg-black text-white">
                                      <p className="text-xs text-white">{fullAddress}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-3">
                                    <p className="break-words text-sm leading-relaxed">{fullAddress}</p>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="max-w-0 overflow-hidden">
                                <div className="space-y-0.5 text-xs">
                                  <p className="font-medium text-foreground truncate">
                                    {formatContactNumber(request.primaryContact)}
                                  </p>
                                  {request.email && (
                                    <p className="text-[11px] text-muted-foreground truncate">{request.email}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-0 overflow-hidden">
                                <Badge
                                  variant="outline"
                                  className="inline-flex items-center gap-1 border-amber-300 bg-amber-50 text-[11px] text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
                                >
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`}>
                                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onSelect={() => handleOpenDetails(request)}>
                                      <User />
                                      Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={actionInFlight !== null}
                                      onSelect={() => void handleDecision(request, true)}
                                    >
                                      <CheckCircle2 />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      variant="destructive"
                                      disabled={actionInFlight !== null}
                                      onSelect={() => void handleDecision(request, false)}
                                    >
                                      <XCircle />
                                      Reject
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </div>

              {/* Pagination Section */}
              {!isLoading && totalPages > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Label htmlFor="pageSize" className="text-xs">Rows per page:</Label>
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                      const next = parseInt(value, 10);
                      setItemsPerPage(next);
                      const nextTotal = Math.ceil(filteredRequests.length / next) || 1;
                      if (currentPage > nextTotal) setCurrentPage(nextTotal);
                    }}>
                      <SelectTrigger className="h-8 w-16 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                      </Button>

                      <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      <Dialog
        open={isDetailOpen && !!detailRequest}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDetails();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {detailRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">{getDisplayName(detailRequest)}</DialogTitle>
                {detailRequest.role && (
                  <DialogDescription className="text-xs">{detailRequest.role}</DialogDescription>
                )}
              </DialogHeader>
              <div className="grid gap-3 text-xs">
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px]">Contact</p>
                  <div className="mt-1.5 space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatContactNumber(detailRequest.primaryContact)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      Alt: {formatContactNumber(detailRequest.secondaryContact)}
                    </div>
                    {detailRequest.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {detailRequest.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="pt-1 font-semibold uppercase text-[10px] text-muted-foreground">Requested address</p>
                    {hasValidCoordinates(detailRequest) ? (
                      <Popover>
                        <PopoverTrigger className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <Badge
                            variant="outline"
                            className="cursor-pointer border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Coordinates available
                          </Badge>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="z-[70] w-72 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home coordinates</p>
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                            <dt className="text-muted-foreground">Latitude</dt>
                            <dd className="font-mono font-medium">{Number(detailRequest.houseLatitude).toFixed(6)}</dd>
                            <dt className="text-muted-foreground">Longitude</dt>
                            <dd className="font-mono font-medium">{Number(detailRequest.houseLongitude).toFixed(6)}</dd>
                          </dl>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-muted-foreground/30 bg-muted text-muted-foreground"
                      >
                        <XCircle className="h-3 w-3" />
                        Coordinates not available
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-xs text-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {buildAddress(detailRequest)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="font-semibold text-muted-foreground uppercase text-[10px]">Timeline</p>
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={handleCloseDetails}>
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
