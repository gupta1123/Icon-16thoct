"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { API, type EmployeeDto, type SurveyDealerDto } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const EMPTY_VALUE = "-";
const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "COMPLETED", label: "Completed" },
] as const;

const isPresent = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== "";

const formatText = (value?: string | number | null) =>
  isPresent(value) ? String(value) : EMPTY_VALUE;

const formatLabel = (value?: string | null) => {
  if (!isPresent(value)) return EMPTY_VALUE;

  return String(value)
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatDate = (value?: string | null) => {
  if (!isPresent(value)) return EMPTY_VALUE;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (dateValue?: string | null, timeValue?: string | null) => {
  if (!isPresent(dateValue)) return EMPTY_VALUE;

  const dateText = String(dateValue);
  const timeText = isPresent(timeValue) ? String(timeValue).split(".")[0] : "";
  const parsedDate = dateText.includes("T")
    ? new Date(dateText)
    : new Date(`${dateText}T${timeText || "00:00:00"}`);

  if (Number.isNaN(parsedDate.getTime())) {
    return [dateText, timeText].filter(isPresent).join(" - ") || EMPTY_VALUE;
  }

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(timeText || dateText.includes("T")
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : {}),
  });
};

const getOwnerName = (dealer: SurveyDealerDto) => {
  const ownerName = [dealer.ownerFirstName, dealer.ownerLastName]
    .filter(isPresent)
    .join(" ");

  return ownerName || EMPTY_VALUE;
};

const getBrandNames = (dealer: SurveyDealerDto) => {
  const detailedBrands =
    dealer.brandDetails
      ?.map((brand) => brand.brandName)
      .filter(isPresent)
      .map(String) ?? [];

  if (detailedBrands.length > 0) return detailedBrands;

  return dealer.brandsInUse?.filter(isPresent).map(String) ?? [];
};

const getEmployeeName = (employee: EmployeeDto) => {
  const fullName = [employee.firstName, employee.lastName].filter(isPresent).join(" ");
  return fullName || employee.employeeId || employee.email || `Employee #${employee.id}`;
};

const normalizeSurveyStatus = (status?: string | null) => {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (normalized === "DRAFT" || normalized === "COMPLETED") {
    return normalized;
  }

  return null;
};

const getPhotoCount = (dealer: SurveyDealerDto) => {
  if (typeof dealer.imageCount === "number" && Number.isFinite(dealer.imageCount)) {
    return dealer.imageCount;
  }

  return dealer.photoResponse?.fileDownloadUri ? 1 : 0;
};

function Ellipsis({ value }: { value: React.ReactNode }) {
  const title = typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  return (
    <span className="block min-w-0 truncate" title={title}>
      {value ?? EMPTY_VALUE}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function BrandBadges({ dealer }: { dealer: SurveyDealerDto }) {
  const brands = getBrandNames(dealer);

  if (brands.length === 0) {
    return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {brands.slice(0, 2).map((brand, index) => (
        <Badge key={`${brand}-${index}`} variant="outline" className="max-w-[120px] truncate text-[11px] px-1.5 py-0">
          {brand}
        </Badge>
      ))}
      {brands.length > 2 && <Badge variant="secondary" className="text-[11px] px-1 py-0">+{brands.length - 2}</Badge>}
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeSurveyStatus(status);

  if (!normalized) {
    return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;
  }

  let colorClass = "border-border bg-muted/50 text-muted-foreground";
  if (normalized === "COMPLETED") {
    colorClass = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300";
  } else if (normalized === "DRAFT") {
    colorClass = "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-300";
  }

  return (
    <Badge className={cn("capitalize whitespace-nowrap text-xs", colorClass)}>
      {formatLabel(normalized)}
    </Badge>
  );
}

export default function DealerSurveyListPage() {
  const router = useRouter();
  const [dealers, setDealers] = useState<SurveyDealerDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Employee Search Popover
  const [isEmployeePopoverOpen, setIsEmployeePopoverOpen] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");

  const fetchDealers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const employeeId = Number(selectedEmployeeId);
      const data =
        selectedEmployeeId === "all" || !Number.isFinite(employeeId)
          ? await API.getAllSurveyDealers()
          : await API.getSurveyDealersByEmployee(employeeId);
      setDealers(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error && fetchError.message
          ? fetchError.message
          : "Unable to load survey dealers.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    void fetchDealers();
  }, [fetchDealers]);

  useEffect(() => {
    let isMounted = true;

    API.getEmployeeDirectory()
      .then((data) => {
        if (isMounted) {
          setEmployees(Array.isArray(data) ? data : []);
        }
      })
      .catch((employeeError) => {
        console.error("Unable to load employees for survey dealer filter:", employeeError);
        if (isMounted) {
          setEmployees([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm.trim()) return employees;
    const term = employeeSearchTerm.toLowerCase();
    return employees.filter((e) => getEmployeeName(e).toLowerCase().includes(term));
  }, [employees, employeeSearchTerm]);

  const selectedEmployeeLabel = useMemo(() => {
    if (selectedEmployeeId === "all") return "All employees";
    const found = employees.find((e) => String(e.id) === selectedEmployeeId);
    return found ? getEmployeeName(found) : "All employees";
  }, [selectedEmployeeId, employees]);

  const filteredDealers = useMemo(() => {
    return dealers.filter((dealer) => {
      // Status filter
      if (selectedStatus !== "all" && normalizeSurveyStatus(dealer.status) !== selectedStatus) {
        return false;
      }
      // Text search query filter (dealer name, owner name, city)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const dealerName = String(dealer.dealerName ?? "").toLowerCase();
        const ownerName = getOwnerName(dealer).toLowerCase();
        const city = String(dealer.city ?? "").toLowerCase();
        const contact = String(dealer.primaryContact ?? "").toLowerCase();

        if (!dealerName.includes(query) && !ownerName.includes(query) && !city.includes(query) && !contact.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [dealers, selectedStatus, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDealers.length / pageSize));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const visibleDealers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDealers.slice(start, start + pageSize);
  }, [filteredDealers, currentPage, pageSize]);

  const stats = useMemo(() => {
    const completed = dealers.filter((dealer) => normalizeSurveyStatus(dealer.status) === "COMPLETED").length;
    const draft = dealers.filter((dealer) => normalizeSurveyStatus(dealer.status) === "DRAFT").length;
    const withPhoto = dealers.filter((dealer) => getPhotoCount(dealer) > 0).length;

    return {
      total: dealers.length,
      completed,
      draft,
      withPhoto,
    };
  }, [dealers]);

  const isFilterActive = selectedEmployeeId !== "all" || selectedStatus !== "all" || searchQuery.trim() !== "";

  const handleResetFilters = () => {
    setSelectedEmployeeId("all");
    setSelectedStatus("all");
    setSearchQuery("");
    setEmployeeSearchTerm("");
    setCurrentPage(1);
  };

  const openDetail = (id: number) => {
    setIsNavigating(true);
    router.push(`/dashboard/dealer-survey/${id}`);
  };

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatCard icon={Building2} label="Survey Dealers" value={stats.total} />
        <StatCard icon={CheckCircle} label="Completed" value={stats.completed} />
        <StatCard icon={Clock} label="Draft" value={stats.draft} />
        <StatCard icon={ImageIcon} label="With Photo" value={stats.withPhoto} />
      </div>

      {/* Main Container */}
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardContent className="space-y-4 p-4">
          {/* Header & Filter Controls Section */}
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-2">
              {/* Text Search Input */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Search Dealer / Owner / City</Label>
                <div className="relative">
                  <Input
                    placeholder="Search dealer, owner, city, phone..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 bg-background pl-8 text-xs shadow-none"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Employee Searchable Popover */}
              <div className="min-w-0 space-y-1.5 lg:w-[220px] lg:shrink-0">
                <Label className="text-xs font-medium text-foreground">Assigned Employee</Label>
                <Popover open={isEmployeePopoverOpen} onOpenChange={setIsEmployeePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 w-full justify-between bg-background px-3 text-xs font-normal shadow-none">
                      <span className="flex min-w-0 items-center gap-2 truncate">
                        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{selectedEmployeeLabel}</span>
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="border-b p-2">
                      <Input
                        placeholder="Search employees..."
                        value={employeeSearchTerm}
                        onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeId("all");
                          setIsEmployeePopoverOpen(false);
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-muted/50",
                          selectedEmployeeId === "all" && "bg-primary/10 font-medium text-primary"
                        )}
                      >
                        All employees {selectedEmployeeId === "all" && <Check className="h-3 w-3" />}
                      </button>
                      {filteredEmployees.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            setSelectedEmployeeId(String(e.id));
                            setIsEmployeePopoverOpen(false);
                            setCurrentPage(1);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-muted/50",
                            selectedEmployeeId === String(e.id) && "bg-primary/10 font-medium text-primary"
                          )}
                        >
                          <span className="truncate">{getEmployeeName(e)}</span>
                          {selectedEmployeeId === String(e.id) && <Check className="h-3 w-3 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status Select */}
              <div className="min-w-0 space-y-1.5 lg:w-[160px] lg:shrink-0">
                <Label className="text-xs font-medium text-foreground">Status</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => {
                    setSelectedStatus(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 bg-background text-xs shadow-none">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((status) => (
                      <SelectItem key={status.value} value={status.value} className="text-xs">
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Filters Button */}
              {isFilterActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-9 px-3 text-xs shadow-none shrink-0"
                  title="Reset filters"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchDealers()} className="h-7 text-xs">
                Retry
              </Button>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden min-w-0 overflow-x-auto rounded-md border md:block">
            <Table className="table-fixed text-xs font-poppins">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[4%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Dealer Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Surveyed By</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-6 rounded-full mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : visibleDealers.length > 0 ? (
                  visibleDealers.map((dealer) => (
                    <TableRow
                      key={dealer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(dealer.id)}
                    >
                      <TableCell className="font-medium overflow-hidden">
                        <Ellipsis value={dealer.dealerName} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={dealer.status} />
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <Ellipsis value={getOwnerName(dealer)} />
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <Ellipsis value={dealer.primaryContact} />
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <Ellipsis value={[dealer.city, dealer.state].filter(isPresent).join(", ")} />
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <Ellipsis value={dealer.employeeName} />
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <Ellipsis value={formatDateTime(dealer.completedAt, dealer.completedTime)} />
                      </TableCell>
                      <TableCell>
                        <BrandBadges dealer={dealer} />
                      </TableCell>
                      <TableCell className="text-center px-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="View Details"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail(dealer.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No survey dealers match your search or filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-36 w-full rounded-xl" />
              ))
            ) : visibleDealers.length > 0 ? (
              visibleDealers.map((dealer) => (
                <Card
                  key={dealer.id}
                  className="cursor-pointer overflow-hidden border shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => openDetail(dealer.id)}
                >
                  <div className="p-3 border-b bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate">{formatText(dealer.dealerName)}</h4>
                        <p className="text-xs text-muted-foreground truncate">{getOwnerName(dealer)}</p>
                      </div>
                      <StatusBadge status={dealer.status} />
                    </div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{formatText(dealer.primaryContact)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{formatText(dealer.city)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{formatText(dealer.employeeName)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate text-foreground">{formatDate(dealer.completedAt)}</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t">
                      <BrandBadges dealer={dealer} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 shrink-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetail(dealer.id);
                        }}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="rounded-lg border py-8 text-center text-xs text-muted-foreground">
                No survey dealers match your search or filters.
              </div>
            )}
          </div>

          {/* Pagination & Counter Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2 text-xs">
              <Label htmlFor="pageSize" className="text-xs">Rows per page:</Label>
              <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(parseInt(value, 10)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-16 text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-2">
                Showing {visibleDealers.length} of {filteredDealers.length} survey dealers
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs shadow-none"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
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
                className="h-8 px-2 text-xs shadow-none"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigating Loader Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Opening dealer survey...</span>
          </div>
        </div>
      )}
    </div>
  );
}
