"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import { API, API_BASE_URL, formatStockQuantity, getStock, type SurveyDealerDto, type SurveyDealerPhotoResponse } from "@/lib/api";

type IconComponent = ComponentType<{ className?: string }>;

const EMPTY_VALUE = "-";

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

const formatDateValue = (value?: string | null) => {
  if (!isPresent(value)) return EMPTY_VALUE;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeValue = (value?: string | null) => {
  if (!isPresent(value)) return EMPTY_VALUE;

  const cleanTime = String(value).split(".")[0];
  const [hours, minutes, seconds] = cleanTime.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);

  const date = new Date();
  date.setHours(hours, minutes, Number.isFinite(seconds) ? seconds : 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const joinDateTime = (date?: string | null, time?: string | null) => {
  const formattedDate = formatDateValue(date);
  const formattedTime = formatTimeValue(time);
  const parts = [formattedDate, formattedTime].filter((value) => value !== EMPTY_VALUE);

  return parts.length ? parts.join(" - ") : EMPTY_VALUE;
};

const formatDateTimeValue = (dateValue?: string | null, timeValue?: string | null) => {
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

const formatNumber = (value?: number | string | null) => {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("en-IN");
  return formatText(value);
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

const getPhotoUrl = (photo?: SurveyDealerPhotoResponse | null) => {
  const rawUrl = photo?.fileDownloadUri?.trim();
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `${API_BASE_URL}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
};

const isImagePhoto = (photo?: SurveyDealerPhotoResponse | null) => {
  const fileType = photo?.fileType?.toLowerCase() ?? "";
  return !fileType || fileType.startsWith("image/");
};

const formatFileSize = (size?: number | null) => {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatPhotoCount = (count: number) => `${count} ${count === 1 ? "photo" : "photos"}`;

const getOwnerName = (dealer: SurveyDealerDto | null) => {
  const ownerName = [dealer?.ownerFirstName, dealer?.ownerLastName]
    .filter(isPresent)
    .join(" ");

  return ownerName || EMPTY_VALUE;
};

const getInitials = (value?: string | null) => {
  if (!isPresent(value)) return "DS";

  return String(value)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getAddress = (dealer: SurveyDealerDto) =>
  [
    dealer.addressLine1,
    dealer.addressLine2,
    dealer.landmark,
    dealer.subDistrict,
    dealer.district,
    dealer.city,
    dealer.state,
    dealer.country,
    dealer.pincode,
  ]
    .filter(isPresent)
    .join(", ");

const getMapUrl = (latitude?: number | null, longitude?: number | null) => {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load survey dealer details.";
};

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-muted/20">
      <div className="min-w-0 space-y-1">
        <Text size="xs" tone="muted" className="uppercase tracking-wide">
          {label}
        </Text>
        <div className="break-words text-base font-semibold text-foreground">
          {value}
        </div>
      </div>
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function SidebarRow({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value?: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "space-y-1" : "flex items-start justify-between gap-3"}>
      <Text size="xs" tone="muted" className="font-medium">
        {label}
      </Text>
      <div className={stacked ? "break-words text-sm font-medium text-foreground" : "max-w-[52%] break-words text-right text-sm font-medium text-foreground"}>
        {value ?? EMPTY_VALUE}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: IconComponent;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 border-b pb-3 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TimelineNode({
  title,
  meta,
  muted = false,
}: {
  title: string;
  meta: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="relative space-y-1 pl-5">
      <span
        className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
          muted ? "bg-muted-foreground/40" : "bg-primary"
        }`}
      />
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <Text size="sm" tone="muted">
        {meta}
      </Text>
    </div>
  );
}

function FieldBlock({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: ReactNode;
  wide?: boolean;
}) {
  const isEmptyText = value === EMPTY_VALUE || value === null || value === undefined;

  return (
    <div className={wide ? "space-y-1 md:col-span-2" : "space-y-1"}>
      <Text size="xs" tone="muted" className="font-semibold">
        {label}
      </Text>
      <div className={`break-words text-sm font-medium ${isEmptyText ? "text-muted-foreground" : "text-foreground"}`}>
        {value ?? EMPTY_VALUE}
      </div>
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

export default function DealerSurveyDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const dealerId = Number(idParam);

  const [dealer, setDealer] = useState<SurveyDealerDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);

  const fetchDealer = useCallback(async () => {
    if (!Number.isFinite(dealerId)) {
      setError("Invalid survey dealer id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await API.getSurveyDealerById(dealerId);
      setDealer(data);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, [dealerId]);

  useEffect(() => {
    void fetchDealer();
  }, [fetchDealer]);

  const brands = useMemo(() => {
    const detailedBrands =
      dealer?.brandDetails
        ?.map((brand) => brand.brandName)
        .filter(isPresent)
        .map(String) ?? [];

    if (detailedBrands.length > 0) return detailedBrands;
    return dealer?.brandsInUse?.filter(isPresent).map(String) ?? [];
  }, [dealer]);

  const status = normalizeSurveyStatus(dealer?.status);
  const completionDisplay = formatDateTimeValue(dealer?.completedAt, dealer?.completedTime);
  const startMapUrl = getMapUrl(dealer?.latitude, dealer?.longitude);
  const finalMapUrl = getMapUrl(dealer?.endLatitude, dealer?.endLongitude);
  const surveyPhoto =
    dealer?.photoResponse && isImagePhoto(dealer.photoResponse) && getPhotoUrl(dealer.photoResponse)
      ? dealer.photoResponse
      : null;
  const surveyPhotoUrl = getPhotoUrl(surveyPhoto);
  const photoCount =
    typeof dealer?.imageCount === "number" && Number.isFinite(dealer.imageCount)
      ? dealer.imageCount
      : surveyPhotoUrl
        ? 1
        : 0;

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <Text tone="muted">Loading survey dealer details...</Text>
        </div>
      </div>
    );
  }

  if (error || !dealer) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <Heading as="h1" size="xl">
                Survey Dealer Not Found
              </Heading>
              <Text tone="muted" className="mt-2">
                {error ?? "Unable to load survey dealer details."}
              </Text>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={() => void fetchDealer()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-3 sm:p-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => router.back()}
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
        <aside>
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center gap-6 p-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-primary/10 text-2xl font-bold text-primary">
                {getInitials(dealer.dealerName)}
              </div>

              <div className="space-y-2 text-center">
                <Heading as="h2" size="lg" className="break-words">
                  {formatText(dealer.dealerName)}
                </Heading>
                {isPresent(dealer.dealerType) && (
                  <Badge variant="outline" className="mx-auto">
                    {formatLabel(dealer.dealerType)}
                  </Badge>
                )}
              </div>

              <Separator className="w-full" />

              <div className="w-full space-y-4">
                <SidebarRow label="Survey Dealer ID" value={`#${dealer.id ?? dealerId}`} />
                <SidebarRow label="Primary Contact" value={formatText(dealer.primaryContact)} />
                <SidebarRow label="Email" value={formatText(dealer.email)} />
                <SidebarRow label="City" value={formatText(dealer.city)} />
                <SidebarRow label="Surveyed By" value={formatText(dealer.employeeName)} />
                <SidebarRow label="Status" value={<StatusBadge status={status} />} />
                <SidebarRow label="Completed" value={completionDisplay} />
                <SidebarRow label="Created" value={joinDateTime(dealer.createdAt, dealer.createdTime)} stacked />
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Building2} label="Stock" value={formatStockQuantity(getStock(dealer), EMPTY_VALUE)} />
            <MetricCard icon={CheckCircle} label="Status" value={<StatusBadge status={status} />} />
            <MetricCard icon={Clock} label="Completed" value={completionDisplay} />
            <MetricCard icon={ImageIcon} label="Photos" value={formatPhotoCount(photoCount)} />
          </div>

          <SectionCard icon={CheckCircle} title="Completion Evidence">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                <FieldBlock label="Completion Status" value={<StatusBadge status={status} />} />
                <FieldBlock label="Completed Timestamp" value={completionDisplay} />
                <FieldBlock
                  label="Starting Location"
                  value={
                    startMapUrl ? (
                      <div className="space-y-1.5">
                        <div>
                          {formatNumber(dealer.latitude)}, {formatNumber(dealer.longitude)}
                        </div>
                        <Button asChild variant="link" size="sm" className="h-auto px-0 text-primary">
                          <a href={startMapUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Start Location
                          </a>
                        </Button>
                      </div>
                    ) : (
                      EMPTY_VALUE
                    )
                  }
                />
                <FieldBlock
                  label="Final Location"
                  value={
                    finalMapUrl ? (
                      <div className="space-y-1.5">
                        <div>
                          {formatNumber(dealer.endLatitude)}, {formatNumber(dealer.endLongitude)}
                        </div>
                        <Button asChild variant="link" size="sm" className="h-auto px-0 text-primary">
                          <a href={finalMapUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Final Location
                          </a>
                        </Button>
                      </div>
                    ) : (
                      EMPTY_VALUE
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Text size="xs" tone="muted" className="font-semibold">
                  Survey Photo ({formatPhotoCount(photoCount)})
                </Text>
                {surveyPhoto && surveyPhotoUrl ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="group block w-full overflow-hidden rounded-xl border bg-muted text-left"
                      onClick={() => setIsPhotoPreviewOpen(true)}
                    >
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={surveyPhotoUrl}
                          alt={surveyPhoto.fileName || "Dealer survey photo"}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    </button>
                    <div className="space-y-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {surveyPhoto.fileName || "Survey photo"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[surveyPhoto.fileType, formatFileSize(surveyPhoto.size)].filter(Boolean).join(" - ") || "Image"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={surveyPhotoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open Original
                        </a>
                      </Button>
                      <Button asChild size="sm">
                        <a href={surveyPhotoUrl} download={surveyPhoto.fileName || undefined}>
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    <Text size="sm" tone="muted">
                      {photoCount > 0
                        ? `${formatPhotoCount(photoCount)} recorded, but the photo file was not returned by the backend.`
                        : "No survey photo is available."}
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <Card className="rounded-2xl">
            <CardContent className="p-6 sm:p-8">
              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="h-auto w-full justify-start gap-8 overflow-x-auto rounded-none border-b bg-transparent p-0">
                  <TabsTrigger
                    value="overview"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="address"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Address & Location
                  </TabsTrigger>
                  <TabsTrigger
                    value="brands"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Brands
                  </TabsTrigger>
                  <TabsTrigger
                    value="audit"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Audit
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                    <FieldBlock label="Dealer Name" value={formatText(dealer.dealerName)} />
                    <FieldBlock label="Owner Name" value={getOwnerName(dealer)} />
                    <FieldBlock label="Primary Contact" value={formatText(dealer.primaryContact)} />
                    <FieldBlock label="Secondary Contact" value={formatText(dealer.secondaryContact)} />
                    <FieldBlock label="Email" value={formatText(dealer.email)} />
                    <FieldBlock label="Dealer Type" value={formatLabel(dealer.dealerType)} />
                    <FieldBlock label="Dealer Sub-Type" value={formatLabel(dealer.dealerSubType)} />
                    <FieldBlock label="Stock" value={formatStockQuantity(getStock(dealer), EMPTY_VALUE)} />
                    <FieldBlock label="Notes" value={formatText(dealer.notes)} wide />
                  </div>
                </TabsContent>

                <TabsContent value="address" className="mt-0 space-y-5">
                  <FieldBlock label="Full Address" value={getAddress(dealer) || EMPTY_VALUE} wide />
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                    <FieldBlock label="Address Line 1" value={formatText(dealer.addressLine1)} />
                    <FieldBlock label="Address Line 2" value={formatText(dealer.addressLine2)} />
                    <FieldBlock label="Landmark" value={formatText(dealer.landmark)} />
                    <FieldBlock label="City" value={formatText(dealer.city)} />
                    <FieldBlock label="District" value={formatText(dealer.district)} />
                    <FieldBlock label="Sub-District" value={formatText(dealer.subDistrict)} />
                    <FieldBlock label="State" value={formatText(dealer.state)} />
                    <FieldBlock label="Country" value={formatText(dealer.country)} />
                    <FieldBlock label="Pincode" value={formatNumber(dealer.pincode)} />
                    <FieldBlock label="Start Latitude" value={formatNumber(dealer.latitude)} />
                    <FieldBlock label="Start Longitude" value={formatNumber(dealer.longitude)} />
                    <FieldBlock label="Final Latitude" value={formatNumber(dealer.endLatitude)} />
                    <FieldBlock label="Final Longitude" value={formatNumber(dealer.endLongitude)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {startMapUrl && (
                      <Button asChild variant="outline">
                        <a href={startMapUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open Start Location
                        </a>
                      </Button>
                    )}
                    {finalMapUrl && (
                      <Button asChild variant="outline">
                        <a href={finalMapUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Open Final Location
                        </a>
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="brands" className="mt-0 space-y-5">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                    <FieldBlock
                      label="Product Categories"
                      value={
                        dealer.productCategories && dealer.productCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {dealer.productCategories.map((category, index) => (
                              <Badge key={`${category}-${index}`} variant="secondary">
                                {formatLabel(category)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          EMPTY_VALUE
                        )
                      }
                    />
                    <FieldBlock
                      label="Assigned Brands"
                      value={
                        brands.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {brands.map((brand, index) => (
                              <Badge key={`${brand}-${index}`} variant="outline">
                                {brand}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          EMPTY_VALUE
                        )
                      }
                    />
                  </div>

                  {dealer.brandDetails && dealer.brandDetails.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {dealer.brandDetails.map((brand, index) => (
                        <div key={`${brand.brandName ?? "brand"}-${index}`} className="rounded-xl border bg-background p-4">
                          <Heading as="h3" size="sm">
                            {formatText(brand.brandName)}
                          </Heading>
                          <Badge variant="secondary" className="mt-2">
                            {formatLabel(brand.category)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="mt-0 space-y-6">
                  <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                    <FieldBlock label="Employee ID" value={formatNumber(dealer.employeeId)} />
                    <FieldBlock label="Employee Name" value={formatText(dealer.employeeName)} />
                    <FieldBlock label="Status" value={<StatusBadge status={status} />} />
                    <FieldBlock label="Completed" value={completionDisplay} />
                  </div>
                  <div className="relative space-y-5 border-l pl-4">
                    <TimelineNode title="Record Created" meta={joinDateTime(dealer.createdAt, dealer.createdTime)} />
                    <TimelineNode title="Last Updated" meta={joinDateTime(dealer.updatedAt, dealer.updatedTime)} muted />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={isPhotoPreviewOpen} onOpenChange={setIsPhotoPreviewOpen}>
        <DialogContent className="max-h-[95vh] max-w-[95vw] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{surveyPhoto?.fileName || "Dealer survey photo"}</DialogTitle>
          </DialogHeader>

          {surveyPhoto && surveyPhotoUrl && (
            <div className="flex max-h-[72vh] items-center justify-center overflow-hidden rounded-lg bg-muted">
              <img
                src={surveyPhotoUrl}
                alt={surveyPhoto.fileName || "Dealer survey photo preview"}
                className="max-h-[72vh] w-auto max-w-full object-contain"
              />
            </div>
          )}

          {surveyPhoto && surveyPhotoUrl && (
            <DialogFooter>
              <Button asChild variant="outline">
                <a href={surveyPhotoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Original
                </a>
              </Button>
              <Button asChild>
                <a href={surveyPhotoUrl} download={surveyPhoto.fileName || undefined}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
