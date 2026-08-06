export type AdminDocument = {
  id: number;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  fileName?: string | null;
  originalFileName?: string | null;
  blobName?: string | null;
  active?: boolean | string | null;
  status?: string | null;
  createdAt?: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
};

export const getDocumentFileName = (document: AdminDocument) =>
  document.fileName || document.originalFileName || document.blobName || "";

export const getDocumentDate = (document: AdminDocument) =>
  document.uploadedAt || document.createdAt || document.updatedAt || "";

export const isDocumentActive = (document: AdminDocument) => {
  const activeValue =
    typeof document.active === "string"
      ? document.active.trim().toLowerCase()
      : document.active;
  const statusValue = (document.status ?? "").trim().toLowerCase();

  return activeValue !== false && activeValue !== "false" && statusValue !== "inactive";
};

export const parseDocumentsResponse = (data: unknown): AdminDocument[] => {
  if (Array.isArray(data)) {
    return data as AdminDocument[];
  }

  if (data && typeof data === "object") {
    const maybeContent = (data as { content?: unknown }).content;
    if (Array.isArray(maybeContent)) {
      return maybeContent as AdminDocument[];
    }
  }

  return [];
};
