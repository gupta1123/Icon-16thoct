import { API_BASE_URL } from "@/lib/api";

export const MAX_REQUIREMENT_IMAGES = 5;
export const MAX_REQUIREMENT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export interface RequirementCreatePayload {
  taskTitle: string;
  taskDesciption: string;
  dueDate: string;
  assignedToId: number;
  assignedById: number;
  storeId: number;
  taskType: "requirement";
  status: string;
  priority: string;
}

export class RequirementPhotoUploadError extends Error {
  taskId: number;
  nextPhotoIndex: number;

  constructor(message: string, taskId: number, nextPhotoIndex: number) {
    super(message);
    this.name = "RequirementPhotoUploadError";
    this.taskId = taskId;
    this.nextPhotoIndex = nextPhotoIndex;
  }
}

interface TaskAttachmentResponse {
  fileName?: string | null;
  fileDownloadUri?: string | null;
  fileType?: string | null;
  tag?: string | null;
}

const isRequirementImageAttachment = (attachment: TaskAttachmentResponse) => {
  const fileType = attachment.fileType?.toLowerCase() ?? "";
  const tag = attachment.tag?.toLowerCase() ?? "requirement";

  return (!fileType || fileType.startsWith("image/")) && ["requirement", "check-in", "check-out"].includes(tag);
};

const normalizeDownloadUri = (rawUri: string) => {
  try {
    const parsedUrl = new URL(rawUri);
    const backendUrl = new URL(API_BASE_URL);

    if (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1") {
      parsedUrl.protocol = backendUrl.protocol;
      parsedUrl.host = backendUrl.host;
    }

    return parsedUrl.toString();
  } catch {
    return `${API_BASE_URL}${rawUri.startsWith("/") ? rawUri : `/${rawUri}`}`;
  }
};

const getTaskImageAttachments = (attachmentResponse: unknown): TaskAttachmentResponse[] => {
  if (!Array.isArray(attachmentResponse)) return [];

  return attachmentResponse.map((attachment) => attachment as TaskAttachmentResponse).filter(isRequirementImageAttachment);
};

const getTaskImageUrlCandidates = (taskId: number, attachment: TaskAttachmentResponse): string[] => {
  const candidates: string[] = [];
  const rawUri = attachment.fileDownloadUri?.trim();

  if (rawUri) {
    candidates.push(normalizeDownloadUri(rawUri));
  }

  if (attachment.fileName) {
    const tag = attachment.tag || "requirement";
    candidates.push(`${API_BASE_URL}/task/downloadFile/${taskId}/${encodeURIComponent(tag)}/${encodeURIComponent(attachment.fileName)}`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

export const getTaskImageUrls = (taskId: number, attachmentResponse: unknown): string[] => {
  return getTaskImageAttachments(attachmentResponse)
    .map((attachment) => getTaskImageUrlCandidates(taskId, attachment)[0] ?? "")
    .filter(Boolean);
};

export const revokeTaskImageUrls = (urls: string[]) => {
  urls.forEach((url) => {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  });
};

export const loadTaskImageUrls = async ({
  token,
  taskId,
  attachmentResponse,
}: {
  token: string;
  taskId: number;
  attachmentResponse: unknown;
}): Promise<string[]> => {
  const urlCandidateGroups = getTaskImageAttachments(attachmentResponse).map((attachment) =>
    getTaskImageUrlCandidates(taskId, attachment)
  );

  const resolvedUrls = await Promise.all(
    urlCandidateGroups.map(async (urls) => {
      for (const url of urls) {
        try {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) continue;

          const blob = await response.blob();
          return URL.createObjectURL(blob);
        } catch {
          continue;
        }
      }

      return urls[0] ?? "";
    })
  );

  return resolvedUrls.filter(Boolean);
};

const parseCreatedTaskId = (responseText: string): number | null => {
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const candidates = [record.id, record.taskId, record.taskID, record.data, record.result];

      for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          return candidate;
        }
        if (typeof candidate === "string" && /^\d+$/.test(candidate.trim())) {
          return Number(candidate.trim());
        }
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const uploadRequirementPhotos = async ({
  token,
  taskId,
  photos,
  startPhotoIndex = 0,
}: {
  token: string;
  taskId: number;
  photos: File[];
  startPhotoIndex?: number;
}) => {
  for (let index = startPhotoIndex; index < photos.length; index += 1) {
    const photo = photos[index];
    const formData = new FormData();
    formData.append("file", photo);

    const uploadResponse = await fetch(`${API_BASE_URL}/task/uploadFile?id=${taskId}&tag=requirement`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const uploadText = await uploadResponse.text();
      throw new RequirementPhotoUploadError(uploadText || `Failed to upload ${photo.name}`, taskId, index);
    }
  }
};

export const createRequirementWithPhotos = async ({
  token,
  payload,
  photos,
  taskId,
  startPhotoIndex = 0,
}: {
  token: string;
  payload: RequirementCreatePayload;
  photos: File[];
  taskId?: number | null;
  startPhotoIndex?: number;
}) => {
  let resolvedTaskId = taskId ?? null;

  if (!resolvedTaskId) {
    const createResponse = await fetch(`${API_BASE_URL}/task/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const createText = await createResponse.text();

    if (!createResponse.ok) {
      throw new Error(createText || "Failed to create requirement");
    }

    resolvedTaskId = parseCreatedTaskId(createText);
  }

  if (photos.length > 0 && !resolvedTaskId) {
    throw new Error("Requirement was created, but the task ID was not returned, so photos could not be uploaded.");
  }

  if (resolvedTaskId) {
    await uploadRequirementPhotos({ token, taskId: resolvedTaskId, photos, startPhotoIndex });
  }

  return { taskId: resolvedTaskId };
};
