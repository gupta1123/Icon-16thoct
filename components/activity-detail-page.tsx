"use client";

import { ActivityLinkDetails } from "@/components/activity-link-details";
import { SidePanel, SidePanelContent, SidePanelFooter, SidePanelHeader, SidePanelTitle } from "@/components/ui/side-panel";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  Star,
  User,
} from "lucide-react";

import { DetailHero, DetailShell, DetailSkeleton, EmptyState, Info, KpiCell, Pill, Section, type Tone } from "@/components/detail-ui";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { API, API_BASE_URL, type ActivityAttachmentResponse, type ActivityDto } from "@/lib/api";


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

const getAttachmentUrl = (attachment: ActivityAttachmentResponse) => {
  const rawUrl = attachment.fileDownloadUri?.trim();
  if (rawUrl) {
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    return `${API_BASE_URL}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  }

  const fileName = attachment.fileName?.trim();
  return fileName ? `${API_BASE_URL}/downloadFile/${encodeURIComponent(fileName)}` : "";
};

const isImageAttachment = (attachment: ActivityAttachmentResponse) => {
  const fileType = attachment.fileType?.toLowerCase() ?? "";
  return fileType.startsWith("image/");
};

const formatFileSize = (size?: number | null) => {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatPhotoCount = (count: number) => `${count} ${count === 1 ? "photo" : "photos"}`;

const getStatusLabel = (activity: ActivityDto | null) => {
  if (activity?.status) return activity.status;

  const hasCheckout =
    isPresent(activity?.checkoutDate) ||
    isPresent(activity?.checkoutTime) ||
    isPresent(activity?.endDate) ||
    isPresent(activity?.endTime);

  return hasCheckout ? "Completed" : "Ongoing";
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to load activity details.";
};

export default function ActivityDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const activityId = Number(idParam);

  const [tab, setTab] = useState("overview");
  const [activity, setActivity] = useState<ActivityDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

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
  const activityPhotos = useMemo(() => {
    const attachments = Array.isArray(activity?.attachmentResponse) ? activity.attachmentResponse : [];
    return attachments.filter((attachment) => isImageAttachment(attachment) && getAttachmentUrl(attachment));
  }, [activity?.attachmentResponse]);
  const photoCount =
    typeof activity?.imageCount === "number" && Number.isFinite(activity.imageCount)
      ? activity.imageCount
      : activityPhotos.length;
  const selectedPhoto =
    selectedPhotoIndex !== null ? activityPhotos[selectedPhotoIndex] ?? null : null;
  const selectedPhotoUrl = selectedPhoto ? getAttachmentUrl(selectedPhoto) : "";

  const backToActivities = () => router.push("/dashboard/activities");
  if (isLoading) return <DetailSkeleton />;
  if (error || !activity) return (
    <Section>
      <EmptyState icon={AlertCircle} title="Could not load activity" text={error ?? undefined}
        action={<div className="flex gap-2"><Button variant="outline" onClick={backToActivities}>Back to Activities</Button><Button onClick={() => void fetchActivity()}>Try again</Button></div>} />
    </Section>
  );

  const statusKey = status.toLowerCase();
  const tone: Tone = statusKey.includes("complet") ? "success" : statusKey === "ongoing" ? "info" : "neutral";
  const overview = (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Section icon={FileText} title="Activity details" className="lg:col-span-2">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Info label="Activity date" value={formatDateValue(activity.activityDate)} />
          <Info label="Employee role" value={formatLabel(activity.employeeRole)} />
          <Info label="Description" value={formatText(activity.description)} className="sm:col-span-2" />
        </dl>
      </Section>
      <Section icon={Clock} title="Audit">
        <dl className="space-y-4">
          <Info label="Created by" value={formatText(activity.createdByName)} />
          <Info label="Created" value={createdDisplay} />
          <Info label="Last updated" value={updatedDisplay} />
        </dl>
      </Section>
    </div>
  );
  const photos = (
    <Section icon={ImageIcon} title="Photos" description={formatPhotoCount(photoCount)}>
      {activityPhotos.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {activityPhotos.map((photo, index) => {
            const url = getAttachmentUrl(photo);
            const fileSize = formatFileSize(photo.size);

            return (
              <button
                key={`${photo.fileName}-${index}`}
                type="button"
                className="group overflow-hidden rounded-lg border bg-background text-left transition hover:border-primary hover:shadow-sm"
                onClick={() => setSelectedPhotoIndex(index)}
              >
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={url}
                    alt={photo.fileName || `Activity photo ${index + 1}`}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-1 p-2">
                  <p className="truncate text-xs font-medium text-foreground">
                    {photo.fileName || `Photo ${index + 1}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[photo.fileType, fileSize].filter(Boolean).join(" · ") || "Image"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : photoCount > 0 ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <Text size="sm" tone="muted">
            {formatPhotoCount(photoCount)} are recorded, but the image files were not returned by the backend.
          </Text>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-4">
          <Text size="sm" tone="muted">
            No activity photos are saved yet.
          </Text>
        </div>
      )}
    </Section>
  );

  return (
    <div className="space-y-4">
      <DetailHero
        name={activity.title || `Activity #${activity.id}`}
        onBack={backToActivities}
        backLabel="Activities"
        badges={<Pill tone={tone}>{status}</Pill>}
        meta={[
          { icon: Hash, label: `#${activity.id}` },
          { icon: User, label: formatText(activity.employeeName) },
          { icon: Calendar, label: formatDateValue(activity.activityDate) },
        ]}
        kpis={<>
          <KpiCell icon={Clock} label="Check-in" value={checkinDisplay} />
          <KpiCell icon={CheckCircle} label="Check-out" value={checkoutDisplay} />
          <KpiCell icon={Star} label="Rating" value={formatNumber(activity.rating)} />
          <KpiCell icon={ImageIcon} label="Photos" value={photoCount} />
        </>}
      />
      <DetailShell value={tab} onValueChange={setTab} tabs={[
        { value: "overview", label: "Overview", icon: FileText, content: overview },
        { value: "links", label: "Linked records", icon: ClipboardList, content: <ActivityLinkDetails key={activity.id} activity={activity} refresh={fetchActivity} /> },
        { value: "photos", label: "Photos", icon: ImageIcon, count: photoCount, content: photos },
      ]} />

      <SidePanel open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhotoIndex(null)}>
        <SidePanelContent size="4xl">
          <SidePanelHeader>
            <SidePanelTitle>{selectedPhoto?.fileName || "Activity photo"}</SidePanelTitle>
          </SidePanelHeader>

          {selectedPhoto && selectedPhotoUrl && (
            <div className="space-y-4">
              <div className="flex max-h-[72vh] items-center justify-center overflow-hidden rounded-lg bg-muted">
                <img
                  src={selectedPhotoUrl}
                  alt={selectedPhoto.fileName || "Activity photo preview"}
                  className="max-h-[72vh] w-auto max-w-full object-contain"
                />
              </div>
              <Text size="sm" tone="muted" className="text-center">
                Photo {(selectedPhotoIndex ?? 0) + 1} of {activityPhotos.length}
              </Text>
            </div>
          )}

          {selectedPhoto && selectedPhotoUrl && (
            <SidePanelFooter>
              <Button asChild variant="outline">
                <a href={selectedPhotoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open Original
                </a>
              </Button>
              <Button asChild>
                <a href={selectedPhotoUrl} download={selectedPhoto.fileName || undefined}>
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
