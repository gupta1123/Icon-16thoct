"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL } from "@/lib/api";
import {
  extractAuthorityRoles,
  hasAnyRole,
  normalizeRoleValue,
} from "@/lib/role-utils";

type AdminDocument = {
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

type DocumentForm = {
  title: string;
  description: string;
  category: string;
  file: File | null;
};

const initialForm: DocumentForm = {
  title: "",
  description: "",
  category: "",
  file: null,
};

const getDocumentFileName = (document: AdminDocument) =>
  document.fileName || document.originalFileName || document.blobName || "";

const getDocumentDate = (document: AdminDocument) =>
  document.uploadedAt || document.createdAt || document.updatedAt || "";

const isDocumentActive = (document: AdminDocument) => {
  const activeValue =
    typeof document.active === "string"
      ? document.active.trim().toLowerCase()
      : document.active;
  const statusValue = (document.status ?? "").trim().toLowerCase();

  return activeValue !== false && activeValue !== "false" && statusValue !== "inactive";
};

const parseDocumentsResponse = (data: unknown): AdminDocument[] => {
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

const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd MMM yyyy");
};

export default function DocumentsPage() {
  const { token, userRole, currentUser } = useAuth();
  const normalizedRole = normalizeRoleValue(userRole);
  const authorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);
  const isAdmin = hasAnyRole(normalizedRole, authorityRoles, ["ADMIN"]);

  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingId, setIsDownloadingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<DocumentForm>(initialForm);

  const loadDocuments = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin-documents/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Failed to load documents (${response.status})`);
      }

      const data = await response.json();
      setDocuments(parseDocumentsResponse(data).filter(isDocumentActive));
    } catch (error) {
      console.error("Failed to load documents:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const resetUploadForm = () => {
    setForm(initialForm);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAdmin) return;

    if (!form.file) {
      toast.error("Select a PDF file to upload.");
      return;
    }

    if (form.file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed.");
      return;
    }

    if (!form.title.trim() || !form.category.trim()) {
      toast.error("Title and category are required.");
      return;
    }

    const formData = new FormData();
    formData.append("file", form.file);
    formData.append("title", form.title.trim());
    formData.append("description", form.description.trim());
    formData.append("category", form.category.trim());

    setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin-documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Upload failed (${response.status})`);
      }

      toast.success("Document uploaded.");
      setIsUploadOpen(false);
      resetUploadForm();
      await loadDocuments();
    } catch (error) {
      console.error("Document upload failed:", error);
      toast.error(error instanceof Error ? error.message : "Document upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (document: AdminDocument) => {
    if (!token) return;

    const fileName = getDocumentFileName(document);
    if (!fileName) {
      toast.error("This document does not include a downloadable file name.");
      return;
    }

    setIsDownloadingId(document.id);
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin-documents/${document.id}/download/${encodeURIComponent(fileName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(link);
    } catch (error) {
      console.error("Document download failed:", error);
      toast.error(error instanceof Error ? error.message : "Document download failed");
    } finally {
      setIsDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!token || !deleteTarget || !isAdmin) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin-documents/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Delete failed (${response.status})`);
      }

      toast.success("Document deleted.");
      setDeleteTarget(null);
      await loadDocuments();
    } catch (error) {
      console.error("Document delete failed:", error);
      toast.error(error instanceof Error ? error.message : "Document delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Admin Access Required</h2>
              <p className="text-sm text-muted-foreground">
                Only Admin users can access document uploads and management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Document Library</h2>
          <p className="text-sm text-muted-foreground">
            Upload and manage PDF documents shared with dashboard users.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadDocuments} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
          <Badge variant="secondary">
            {documents.length} total
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p>No documents uploaded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => {
                  const fileName = getDocumentFileName(document);
                  return (
                    <TableRow key={document.id}>
                      <TableCell className="max-w-[260px] whitespace-normal">
                        <div className="font-medium">{document.title || "Untitled document"}</div>
                        {document.description && (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {document.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{document.category || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{fileName || "-"}</TableCell>
                      <TableCell>{formatDate(getDocumentDate(document))}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(document)}
                            disabled={!fileName || isDownloadingId === document.id}
                          >
                            {isDownloadingId === document.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span className="sr-only">Download</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(document)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          setIsUploadOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload PDF Document</DialogTitle>
            <DialogDescription>
              Add a PDF document for users to view and download.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-title">Title</Label>
              <Input
                id="document-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-category">Category</Label>
              <Input
                id="document-category"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-description">Description</Label>
              <Textarea
                id="document-description"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-file">PDF File</Label>
              <Input
                id="document-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setForm((prev) => ({ ...prev, file }));
                }}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Document"
        description={`This will deactivate "${deleteTarget?.title || "this document"}".`}
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
