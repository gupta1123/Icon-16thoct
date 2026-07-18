"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Text } from "@/components/ui/typography";
import { API, type EmployeeDto, type SurveyDealerDto } from "@/lib/api";

const PAGE_SIZE = 10;
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

const getStatusClassName = (status?: string | null) => {
  const normalized = normalizeSurveyStatus(status);

  if (normalized === "COMPLETED") {
    return "border-green-200 bg-green-100 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200";
  }

  if (normalized === "DRAFT") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200";
};

const getPhotoCount = (dealer: SurveyDealerDto) => {
  if (typeof dealer.imageCount === "number" && Number.isFinite(dealer.imageCount)) {
    return dealer.imageCount;
  }

  return dealer.photoResponse?.fileDownloadUri ? 1 : 0;
};

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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text size="xs" tone="muted" className="uppercase">
              {label}
            </Text>
            <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
          </div>
          <div className="rounded-md bg-muted p-2 text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BrandBadges({ dealer }: { dealer: SurveyDealerDto }) {
  const brands = getBrandNames(dealer);

  if (brands.length === 0) {
    return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {brands.slice(0, 3).map((brand, index) => (
        <Badge key={`${brand}-${index}`} variant="outline" className="max-w-[140px] truncate">
          {brand}
        </Badge>
      ))}
      {brands.length > 3 && <Badge variant="secondary">+{brands.length - 3}</Badge>}
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeSurveyStatus(status);

  if (!normalized) {
    return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;
  }

  return (
    <Badge variant="outline" className={getStatusClassName(normalized)}>
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

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

  const filteredDealers = useMemo(() => {
    if (selectedStatus === "all") return dealers;

    return dealers.filter((dealer) => normalizeSurveyStatus(dealer.status) === selectedStatus);
  }, [dealers, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredDealers.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const visibleDealers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDealers.slice(start, start + PAGE_SIZE);
  }, [filteredDealers, currentPage]);

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

  const openDetail = (id: number) => {
    setIsNavigating(true);
    router.push(`/dashboard/dealer-survey/${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Survey Dealers" value={stats.total} />
        <StatCard icon={CheckCircle} label="Completed" value={stats.completed} />
        <StatCard icon={Clock} label="Draft" value={stats.draft} />
        <StatCard icon={ImageIcon} label="With Photo" value={stats.withPhoto} />
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Dealer Survey</CardTitle>
            <Text tone="muted" size="sm" className="mt-1">
              Survey dealer records captured separately from customer stores.
            </Text>
          </div>
          <div className="relative z-20 grid w-full gap-3 sm:grid-cols-[minmax(180px,220px)_minmax(160px,200px)]">
            <Select
              value={selectedEmployeeId}
              onValueChange={(value) => {
                setSelectedEmployeeId(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by employee" />
              </SelectTrigger>
              <SelectContent className="z-[100] max-h-72" sideOffset={8}>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {getEmployeeName(employee)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="z-[100] max-h-60" sideOffset={8}>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">{error}</div>
              <Button variant="outline" size="sm" onClick={() => void fetchDealers()}>
                Retry
              </Button>
            </div>
          )}

          <div className="relative z-0 hidden overflow-x-auto rounded-md border md:block">
            <Table className="min-w-[1020px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Surveyed By</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading survey dealers...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : visibleDealers.length > 0 ? (
                  visibleDealers.map((dealer) => (
                    <TableRow
                      key={dealer.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(dealer.id)}
                    >
                      <TableCell className="font-medium">{formatText(dealer.dealerName)}</TableCell>
                      <TableCell>
                        <StatusBadge status={dealer.status} />
                      </TableCell>
                      <TableCell>{getOwnerName(dealer)}</TableCell>
                      <TableCell>{formatText(dealer.primaryContact)}</TableCell>
                      <TableCell>{[dealer.city, dealer.state].filter(isPresent).join(", ") || EMPTY_VALUE}</TableCell>
                      <TableCell>{formatText(dealer.employeeName)}</TableCell>
                      <TableCell>{formatDateTime(dealer.completedAt, dealer.completedTime)}</TableCell>
                      <TableCell>{formatDate(dealer.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="p-2"
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
                      No survey dealers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                Loading survey dealers...
              </div>
            ) : visibleDealers.length > 0 ? (
              visibleDealers.map((dealer) => (
                <Card
                  key={dealer.id}
                  className="cursor-pointer border-l-4 border-l-primary shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => openDetail(dealer.id)}
                >
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{formatText(dealer.dealerName)}</div>
                        <Text size="sm" tone="muted" className="truncate">
                          {getOwnerName(dealer)}
                        </Text>
                      </div>
                      <StatusBadge status={dealer.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{formatText(dealer.primaryContact)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{formatText(dealer.city)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{formatText(dealer.employeeName)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{formatDateTime(dealer.completedAt, dealer.completedTime)}</span>
                      </div>
                    </div>

                    <BrandBadges dealer={dealer} />

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(dealer.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                No survey dealers found.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Text size="sm" tone="muted">
              Showing {visibleDealers.length} of {filteredDealers.length} survey dealers
            </Text>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
