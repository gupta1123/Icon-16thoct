"use client";

import { SidePanel, SidePanelContent, SidePanelFooter, SidePanelHeader, SidePanelTitle } from "@/components/ui/side-panel";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Hash,
  History,
  Image as ImageIcon,
  MapPin,
  Package,
  Phone,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailHero, DetailShell, DetailSkeleton, EmptyState, Info, KpiCell, Pill, Section, type DetailTab, type Tone } from "@/components/detail-ui";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { API, API_BASE_URL, formatStockQuantity, getStock, type SurveyDealerDto, type SurveyDealerPhotoResponse } from "@/lib/api";

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

const getStatusTone = (status?: string | null): Tone => {
  const normalized = normalizeSurveyStatus(status);
  if (normalized === "COMPLETED") return "success";
  if (normalized === "DRAFT") return "warning";
  return "neutral";
};

const getPhotoUrl = (photo?: SurveyDealerPhotoResponse | null) => {
  const rawUrl = photo?.fileDownloadUri?.trim();
  if (!rawUrl) return "";
  const absoluteUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `${API_BASE_URL}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  // Backend file URLs require auth; <img>/anchors send no token, so serve
  // backend-hosted files through the authenticated image proxy instead.
  // Third-party (e.g. presigned storage) URLs keep loading directly.
  try {
    const backendHost = new URL(API_BASE_URL).hostname;
    if (new URL(absoluteUrl).hostname === backendHost) {
      return `/api/image-proxy?url=${encodeURIComponent(absoluteUrl)}`;
    }
  } catch {
    // Fall through to the direct URL when parsing fails.
  }
  return absoluteUrl;
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

function StatusPill({ status }: { status?: string | null }) {
  const normalized = normalizeSurveyStatus(status);
  if (!normalized) return <span className="text-muted-foreground">{EMPTY_VALUE}</span>;
  return <Pill tone={getStatusTone(normalized)}>{formatLabel(normalized)}</Pill>;
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>;
}

function TimelineNode({ title, meta, muted = false }: { title: string; meta: ReactNode; muted?: boolean }) {
  return (
    <div className="relative space-y-0.5 pl-5">
      <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${muted ? "bg-muted-foreground/40" : "bg-primary"}`} />
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{meta}</div>
    </div>
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
  const [activeTab, setActiveTab] = useState("overview");
  const handleBack = useCallback(() => router.back(), [router]);
  useDashboardHeader({
    heading: 'Survey Dealer Detail',
    subheading: dealer?.dealerName || 'View surveyed dealer information',
    onBack: handleBack,
  });

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
      <div className="icon-survey-detail mx-auto w-full max-w-[1600px]">
        <DetailSkeleton />
      </div>
    );
  }

  if (error || !dealer) {
    return (
      <div className="icon-survey-detail mx-auto w-full max-w-2xl py-6">
        <Section>
          <EmptyState
            icon={AlertCircle}
            title="Survey dealer not found"
            text={error ?? "Unable to load survey dealer details."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => router.back()}>
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Go back
                </Button>
                <Button size="sm" onClick={() => void fetchDealer()}>Try again</Button>
              </div>
            }
          />
        </Section>
      </div>
    );
  }

  const mapLink = (url: string, label: string) => (
    <Button asChild variant="outline" size="sm" className="h-8">
      <a href={url} target="_blank" rel="noreferrer">
        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );

  const overviewContent = (
    <div className="space-y-4">
      <Section icon={ClipboardList} title="Dealer">
        <InfoGrid>
          <Info label="Dealer name" value={formatText(dealer.dealerName)} />
          <Info label="Owner name" value={getOwnerName(dealer)} />
          <Info label="Dealer type" value={formatLabel(dealer.dealerType)} />
          <Info label="Dealer sub-type" value={formatLabel(dealer.dealerSubType)} />
          <Info label="Primary contact" value={formatText(dealer.primaryContact)} />
          <Info label="Secondary contact" value={formatText(dealer.secondaryContact)} />
          <Info label="Email" value={formatText(dealer.email)} />
          <Info label="Stock" value={formatStockQuantity(getStock(dealer), EMPTY_VALUE)} />
          <Info label="Notes" value={formatText(dealer.notes)} className="sm:col-span-2 xl:col-span-3" />
        </InfoGrid>
      </Section>
      <Section icon={CheckCircle} title="Survey">
        <InfoGrid>
          <Info label="Survey dealer ID" value={`#${dealer.id ?? dealerId}`} />
          <Info label="Surveyed by" value={formatText(dealer.employeeName)} />
          <Info label="Status" value={<StatusPill status={status} />} />
          <Info label="Completed" value={completionDisplay} />
          <Info label="Created" value={joinDateTime(dealer.createdAt, dealer.createdTime)} />
        </InfoGrid>
      </Section>
    </div>
  );

  const photosContent = (
    <Section icon={ImageIcon} title={`Survey photo (${formatPhotoCount(photoCount)})`}>
      {surveyPhoto && surveyPhotoUrl ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:items-start">
          <button
            type="button"
            className="group block w-full overflow-hidden rounded-lg border bg-muted text-left"
            aria-label="Preview survey photo"
            onClick={() => setIsPhotoPreviewOpen(true)}
          >
            <div className="h-64 overflow-hidden">
              <img
                src={surveyPhotoUrl}
                alt={surveyPhoto.fileName || "Dealer survey photo"}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            </div>
          </button>
          <div className="space-y-3">
            <div className="space-y-0.5">
              <p className="truncate text-sm font-medium text-foreground">{surveyPhoto.fileName || "Survey photo"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[surveyPhoto.fileType, formatFileSize(surveyPhoto.size)].filter(Boolean).join(" - ") || "Image"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="h-8">
                <a href={surveyPhotoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open original
                </a>
              </Button>
              <Button asChild size="sm" className="h-8">
                <a href={surveyPhotoUrl} download={surveyPhoto.fileName || undefined}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={ImageIcon}
          title={photoCount > 0 ? "Photo file unavailable" : "No survey photo"}
          text={
            photoCount > 0
              ? `${formatPhotoCount(photoCount)} recorded, but the photo file was not returned by the backend.`
              : "No survey photo is available for this dealer."
          }
        />
      )}
    </Section>
  );

  const categories = dealer.productCategories ?? [];
  const brandsContent = (
    <div className="space-y-4">
      <Section icon={Package} title="Product categories">
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((category, index) => (
              <Pill key={`${category}-${index}`}>{formatLabel(category)}</Pill>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No product categories recorded." />
        )}
      </Section>
      <Section icon={Building2} title="Brands">
        {dealer.brandDetails && dealer.brandDetails.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dealer.brandDetails.map((brand, index) => (
              <div key={`${brand.brandName ?? "brand"}-${index}`} className="rounded-lg border bg-background p-3">
                <p className="text-sm font-medium">{formatText(brand.brandName)}</p>
                <Pill className="mt-1.5">{formatLabel(brand.category)}</Pill>
              </div>
            ))}
          </div>
        ) : brands.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {brands.map((brand, index) => (
              <Pill key={`${brand}-${index}`} tone="info">{brand}</Pill>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No brands recorded." />
        )}
      </Section>
    </div>
  );

  const locationContent = (
    <div className="space-y-4">
      <Section icon={MapPin} title="Address">
        <InfoGrid>
          <Info label="Full address" value={getAddress(dealer) || EMPTY_VALUE} className="sm:col-span-2 xl:col-span-3" />
          <Info label="Address line 1" value={formatText(dealer.addressLine1)} />
          <Info label="Address line 2" value={formatText(dealer.addressLine2)} />
          <Info label="Landmark" value={formatText(dealer.landmark)} />
          <Info label="City" value={formatText(dealer.city)} />
          <Info label="District" value={formatText(dealer.district)} />
          <Info label="Sub-district" value={formatText(dealer.subDistrict)} />
          <Info label="State" value={formatText(dealer.state)} />
          <Info label="Country" value={formatText(dealer.country)} />
          <Info label="Pincode" value={formatNumber(dealer.pincode)} />
        </InfoGrid>
      </Section>
      <Section
        icon={MapPin}
        title="GPS coordinates"
        action={
          <>
            {startMapUrl && mapLink(startMapUrl, "Start location")}
            {finalMapUrl && mapLink(finalMapUrl, "Final location")}
          </>
        }
      >
        <InfoGrid>
          <Info label="Start latitude" value={formatNumber(dealer.latitude)} />
          <Info label="Start longitude" value={formatNumber(dealer.longitude)} />
          <span className="hidden xl:block" />
          <Info label="Final latitude" value={formatNumber(dealer.endLatitude)} />
          <Info label="Final longitude" value={formatNumber(dealer.endLongitude)} />
        </InfoGrid>
      </Section>
    </div>
  );

  const auditContent = (
    <Section icon={History} title="Audit">
      <div className="space-y-5">
        <InfoGrid>
          <Info label="Employee ID" value={formatNumber(dealer.employeeId)} />
          <Info label="Employee name" value={formatText(dealer.employeeName)} />
          <Info label="Status" value={<StatusPill status={status} />} />
          <Info label="Completed" value={completionDisplay} />
        </InfoGrid>
        <div className="relative space-y-4 border-l pl-4">
          <TimelineNode title="Record created" meta={joinDateTime(dealer.createdAt, dealer.createdTime)} />
          <TimelineNode title="Last updated" meta={joinDateTime(dealer.updatedAt, dealer.updatedTime)} muted />
        </div>
      </div>
    </Section>
  );

  const tabs: DetailTab[] = [
    { value: "overview", label: "Overview", icon: ClipboardList, content: overviewContent },
    { value: "photos", label: "Photos", icon: ImageIcon, count: photoCount, content: photosContent },
    { value: "brands", label: "Brands", icon: Building2, count: brands.length, content: brandsContent },
    { value: "location", label: "Location", icon: MapPin, content: locationContent },
    { value: "audit", label: "Audit", icon: History, content: auditContent },
  ];

  return (
    <div className="icon-survey-detail mx-auto w-full max-w-[1600px] space-y-4">
      <DetailHero
        name={formatText(dealer.dealerName)}
        onBack={handleBack}
        backLabel="Back"
        badges={
          <>
            {status && <Pill tone={getStatusTone(status)}>{formatLabel(status)}</Pill>}
            {isPresent(dealer.dealerType) && <Pill>{formatLabel(dealer.dealerType)}</Pill>}
          </>
        }
        meta={[
          { icon: User, label: formatText(dealer.employeeName), title: "Surveyed by" },
          ...(isPresent(dealer.city) ? [{ icon: MapPin, label: String(dealer.city), title: "City" }] : []),
          ...(isPresent(dealer.primaryContact) ? [{ icon: Phone, label: String(dealer.primaryContact), title: "Primary contact" }] : []),
          { icon: Clock, label: joinDateTime(dealer.createdAt, dealer.createdTime), title: "Created" },
          { icon: Hash, label: `#${dealer.id ?? dealerId}`, title: "Survey dealer ID" },
        ]}
        actions={
          <>
            {startMapUrl && mapLink(startMapUrl, "Start location")}
            {finalMapUrl && mapLink(finalMapUrl, "Final location")}
            {surveyPhoto && surveyPhotoUrl && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setIsPhotoPreviewOpen(true)}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                Photo
              </Button>
            )}
          </>
        }
        kpis={
          <>
            <KpiCell icon={Package} label="Stock" value={formatStockQuantity(getStock(dealer), EMPTY_VALUE)} />
            <KpiCell icon={CheckCircle} label="Status" value={<StatusPill status={status} />} />
            <KpiCell icon={Clock} label="Completed" value={completionDisplay} />
            <KpiCell icon={ImageIcon} label="Photos" value={formatPhotoCount(photoCount)} />
          </>
        }
        nextStep={
          status === "COMPLETED"
            ? { done: true, text: `Survey completed ${completionDisplay}.` }
            : status === "DRAFT"
              ? { done: false, text: "This survey is still a draft and has not been completed." }
              : null
        }
      />

      <DetailShell value={activeTab} onValueChange={setActiveTab} tabs={tabs} />

      <SidePanel open={isPhotoPreviewOpen} onOpenChange={setIsPhotoPreviewOpen}>
        <SidePanelContent size="4xl">
          <SidePanelHeader>
            <SidePanelTitle>{surveyPhoto?.fileName || "Dealer survey photo"}</SidePanelTitle>
          </SidePanelHeader>

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
            <SidePanelFooter>
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
            </SidePanelFooter>
          )}
        </SidePanelContent>
      </SidePanel>
    </div>
  );
}
