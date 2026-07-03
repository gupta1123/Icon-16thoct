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
  Calendar,
  ClipboardList,
  ExternalLink,
  FileText,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Tag,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import { API, type SurveyDealerDto } from "@/lib/api";

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

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY_VALUE;
  return `Rs. ${value.toLocaleString("en-IN")}`;
};

const formatNumber = (value?: number | string | null) => {
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("en-IN");
  return formatText(value);
};

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

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <Text size="xs" tone="muted">
          {label}
        </Text>
        <div className="mt-0.5 break-words text-sm font-medium text-foreground">
          {value ?? EMPTY_VALUE}
        </div>
      </div>
    </div>
  );
}

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
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Text size="xs" tone="muted" className="uppercase">
          {label}
        </Text>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="break-words text-base font-semibold text-foreground sm:text-lg">
        {value}
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <Text size="xs" tone="muted" className="uppercase">
        {label}
      </Text>
      <div className="mt-2 break-words text-sm text-foreground">{value ?? EMPTY_VALUE}</div>
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

  const mapUrl = getMapUrl(dealer?.latitude, dealer?.longitude);

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
    <div className="container mx-auto p-3 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        <aside className="space-y-4 sm:space-y-6 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {isPresent(dealer.dealerSubType) && (
              <Badge variant="outline" className="capitalize">
                {formatLabel(dealer.dealerSubType)}
              </Badge>
            )}
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                  {getInitials(dealer.dealerName)}
                </div>
                <Heading as="h1" size="xl" className="break-words">
                  {formatText(dealer.dealerName)}
                </Heading>
                <Text tone="muted" className="mt-1 break-words">
                  {getOwnerName(dealer)}
                </Text>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <DetailItem icon={Hash} label="Survey Dealer ID" value={`#${dealer.id ?? dealerId}`} />
                <DetailItem icon={Phone} label="Primary Contact" value={formatText(dealer.primaryContact)} />
                <DetailItem icon={Mail} label="Email" value={formatText(dealer.email)} />
                <DetailItem icon={MapPin} label="City" value={formatText(dealer.city)} />
                <DetailItem icon={User} label="Surveyed By" value={formatText(dealer.employeeName)} />
                <DetailItem icon={Calendar} label="Created" value={joinDateTime(dealer.createdAt, dealer.createdTime)} />
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4 sm:space-y-6 lg:col-span-9">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Heading as="h2" size="2xl">
                    {formatText(dealer.dealerName)}
                  </Heading>
                  <Text tone="muted" className="mt-2 max-w-3xl">
                    {formatText(dealer.notes)}
                  </Text>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isPresent(dealer.dealerType) && (
                    <Badge variant="outline">{formatLabel(dealer.dealerType)}</Badge>
                  )}
                  {isPresent(dealer.dealerSubType) && (
                    <Badge variant="secondary">{formatLabel(dealer.dealerSubType)}</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Building2} label="Monthly Sale" value={formatCurrency(dealer.monthlySale)} />
                <MetricCard icon={Tag} label="Brands" value={brands.length} />
                <MetricCard icon={Package} label="Categories" value={dealer.productCategories?.length ?? 0} />
                <MetricCard icon={Calendar} label="Created" value={formatDateValue(dealer.createdAt)} />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="address">Address</TabsTrigger>
              <TabsTrigger value="brands">Brands</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Dealer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FieldBlock label="Dealer Name" value={formatText(dealer.dealerName)} />
                  <FieldBlock label="Owner Name" value={getOwnerName(dealer)} />
                  <FieldBlock label="Primary Contact" value={formatText(dealer.primaryContact)} />
                  <FieldBlock label="Secondary Contact" value={formatText(dealer.secondaryContact)} />
                  <FieldBlock label="Email" value={formatText(dealer.email)} />
                  <FieldBlock label="Dealer Type" value={formatLabel(dealer.dealerType)} />
                  <FieldBlock label="Dealer Sub-Type" value={formatLabel(dealer.dealerSubType)} />
                  <FieldBlock label="Monthly Sale" value={formatCurrency(dealer.monthlySale)} />
                  <FieldBlock label="Notes" value={formatText(dealer.notes)} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="address" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" />
                    Address And Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldBlock label="Full Address" value={getAddress(dealer) || EMPTY_VALUE} />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FieldBlock label="Address Line 1" value={formatText(dealer.addressLine1)} />
                    <FieldBlock label="Address Line 2" value={formatText(dealer.addressLine2)} />
                    <FieldBlock label="Landmark" value={formatText(dealer.landmark)} />
                    <FieldBlock label="City" value={formatText(dealer.city)} />
                    <FieldBlock label="District" value={formatText(dealer.district)} />
                    <FieldBlock label="Sub-District" value={formatText(dealer.subDistrict)} />
                    <FieldBlock label="State" value={formatText(dealer.state)} />
                    <FieldBlock label="Country" value={formatText(dealer.country)} />
                    <FieldBlock label="Pincode" value={formatNumber(dealer.pincode)} />
                    <FieldBlock label="Latitude" value={formatNumber(dealer.latitude)} />
                    <FieldBlock label="Longitude" value={formatNumber(dealer.longitude)} />
                  </div>
                  {mapUrl && (
                    <Button asChild variant="outline">
                      <a href={mapUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open Map
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="brands" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ClipboardList className="h-5 w-5" />
                    Brands And Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FieldBlock
                    label="Product Categories"
                    value={
                      dealer.productCategories && dealer.productCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {dealer.productCategories.map((category, index) => (
                            <Badge key={`${category}-${index}`} variant="outline">
                              {formatLabel(category)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        EMPTY_VALUE
                      )
                    }
                  />

                  {dealer.brandDetails && dealer.brandDetails.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {dealer.brandDetails.map((brand, index) => (
                        <div key={`${brand.brandName ?? "brand"}-${index}`} className="rounded-lg border bg-background p-4">
                          <Heading as="h3" size="sm">
                            {formatText(brand.brandName)}
                          </Heading>
                          <Badge variant="secondary" className="mt-2">
                            {formatLabel(brand.category)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : brands.length > 0 ? (
                    <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-4">
                      {brands.map((brand, index) => (
                        <Badge key={`${brand}-${index}`} variant="outline">
                          {brand}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border bg-background p-8 text-center">
                      <Text tone="muted">No brand details recorded.</Text>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    Audit Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FieldBlock label="Employee ID" value={formatNumber(dealer.employeeId)} />
                  <FieldBlock label="Employee Name" value={formatText(dealer.employeeName)} />
                  <FieldBlock label="Created" value={joinDateTime(dealer.createdAt, dealer.createdTime)} />
                  <FieldBlock label="Updated" value={joinDateTime(dealer.updatedAt, dealer.updatedTime)} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
