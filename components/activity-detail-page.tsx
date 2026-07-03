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
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  FileText,
  Hash,
  Loader2,
  Star,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Heading, Text } from "@/components/ui/typography";
import { API, type ActivityDto } from "@/lib/api";
import { cn } from "@/lib/utils";

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

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return String(value);
  }

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

const formatNumber = (value?: number | null, suffix = "") => {
  if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY_VALUE;
  return `${value.toLocaleString("en-IN")}${suffix}`;
};

const getStatusLabel = (activity: ActivityDto | null) => {
  if (activity?.status) return activity.status;

  const hasCheckout =
    isPresent(activity?.checkoutDate) ||
    isPresent(activity?.checkoutTime) ||
    isPresent(activity?.endDate) ||
    isPresent(activity?.endTime);

  return hasCheckout ? "Completed" : "Ongoing";
};

const getStatusClassName = (status?: string | null) => {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized.includes("complete")) {
    return "border-green-200 bg-green-100 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200";
  }

  if (normalized.includes("ongoing") || normalized.includes("progress")) {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-200";
};

const getInitials = (value?: string | null) => {
  if (!isPresent(value)) return "A";

  return String(value)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load activity details.";
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
      <div className="break-words text-base font-semibold text-foreground sm:text-lg">{value}</div>
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

export default function ActivityDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const activityId = Number(idParam);

  const [activity, setActivity] = useState<ActivityDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!Number.isFinite(activityId)) {
      setError("Invalid activity id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await API.getActivityById(activityId);
      setActivity(data);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  const status = useMemo(() => getStatusLabel(activity), [activity]);
  const checkinDisplay = joinDateTime(
    activity?.checkinDate ?? activity?.activityDate,
    activity?.checkinTime ?? activity?.startTime
  );
  const checkoutDisplay = joinDateTime(
    activity?.checkoutDate ?? activity?.endDate,
    activity?.checkoutTime ?? activity?.endTime
  );
  const createdDisplay = joinDateTime(activity?.createdDate, activity?.createdTime);
  const updatedDisplay = joinDateTime(activity?.updatedDate, activity?.updatedTime);

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[55vh] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <Text tone="muted">Loading activity details...</Text>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="container mx-auto p-3 sm:p-6">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <Heading as="h1" size="xl">
                Activity Not Found
              </Heading>
              <Text tone="muted" className="mt-2">
                {error ?? "Unable to load activity details."}
              </Text>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={() => void fetchActivity()}>Try Again</Button>
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
            <Badge variant="outline" className={cn("capitalize", getStatusClassName(status))}>
              {status}
            </Badge>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-purple-100 text-2xl font-semibold text-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
                  {getInitials(activity.title)}
                </div>
                <Heading as="h1" size="xl" className="break-words">
                  {formatText(activity.title)}
                </Heading>
                <Text tone="muted" className="mt-1 break-words">
                  {formatText(activity.employeeName)}
                </Text>
              </div>

              <Separator className="my-6" />

              <div className="space-y-4">
                <DetailItem icon={Hash} label="Activity ID" value={`#${activity.id ?? activityId}`} />
                <DetailItem icon={Calendar} label="Activity Date" value={formatDateValue(activity.activityDate)} />
                <DetailItem icon={Clock} label="Check-in" value={checkinDisplay} />
                <DetailItem icon={CheckCircle} label="Check-out" value={checkoutDisplay} />
                <DetailItem icon={User} label="Employee" value={formatText(activity.employeeName)} />
                <DetailItem icon={ClipboardList} label="Role" value={formatLabel(activity.employeeRole)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailItem icon={User} label="Created By" value={formatText(activity.createdByName)} />
              <DetailItem icon={Calendar} label="Created" value={createdDisplay} />
              <DetailItem icon={Clock} label="Last Updated" value={updatedDisplay} />
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4 sm:space-y-6 lg:col-span-9">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Heading as="h2" size="2xl">
                    {formatText(activity.title)}
                  </Heading>
                  <Text tone="muted" className="mt-2 max-w-3xl">
                    {formatText(activity.description)}
                  </Text>
                </div>
                <Badge variant="outline" className={cn("capitalize", getStatusClassName(status))}>
                  {status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard icon={Clock} label="Started" value={checkinDisplay} />
                <MetricCard icon={CheckCircle} label="Completed" value={checkoutDisplay} />
                <MetricCard icon={Star} label="Rating" value={formatNumber(activity.rating)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FieldBlock label="Description" value={formatText(activity.description)} />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
