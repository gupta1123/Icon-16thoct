"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  AlertCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  AdminDocument,
  getDocumentDate,
  getDocumentFileName,
  isDocumentActive,
  parseDocumentsResponse,
} from "@/lib/admin-documents";
import {
  extractAuthorityRoles,
  hasAnyRole,
  normalizeRoleValue,
} from "@/lib/role-utils";

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
  const uploadDraftIsDirty = isUploadOpen && Boolean(
    form.title.trim() || form.description.trim() || form.category.trim() || form.file
  );
  const { markSaved: markUploadSaved, requestDiscard: requestUploadDiscard } = useUnsavedChanges(uploadDraftIsDirty);

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

  const resetUploadForm = useCallback(() => {
    setForm(initialForm);
  }, []);

  const closeUploadDialog = useCallback(() => {
    if (isUploading) return;
    requestUploadDiscard(() => {
      setIsUploadOpen(false);
      resetUploadForm();
    }, uploadDraftIsDirty);
  }, [isUploading, requestUploadDiscard, resetUploadForm, uploadDraftIsDirty]);

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
      markUploadSaved();
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
      <div className="flex flex-wrap justify-end gap-2">
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

      <div className="w-full space-y-4">
        <div>
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
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/documents/${document.id}`}>
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </Button>
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
        </div>
      </div>

      <Sheet
        open={isUploadOpen}
        onOpenChange={(open) => {
          if (open) setIsUploadOpen(true);
          else closeUploadDialog();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-0 border-b px-6 py-5 pr-14 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-foreground" />
              </div>
              <div className="min-w-0 space-y-1">
                <SheetTitle className="text-lg font-semibold leading-tight tracking-tight">
                  Upload PDF document
                </SheetTitle>
                <SheetDescription className="text-sm leading-snug">
                  Add a PDF that users can view and download.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <form onSubmit={handleUpload} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="space-y-2">
                <Label htmlFor="document-title" className="text-sm font-medium">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="document-title"
                  className="h-10"
                  placeholder="e.g. Product brochure 2026"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-category" className="text-sm font-medium">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="document-category"
                  className="h-10"
                  placeholder="e.g. Brochure, Leaflet, Price list"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">Shown in the Category column of the documents list.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-description" className="text-sm font-medium">
                  Description <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="document-description"
                  placeholder="A short note about what this document contains"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-file" className="text-sm font-medium">
                  PDF file <span className="text-destructive">*</span>
                </Label>
                <label
                  htmlFor="document-file"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring"
                >
                  {form.file ? (
                    <>
                      <FileText className="h-6 w-6 text-foreground" />
                      <span className="max-w-full truncate text-sm font-medium">{form.file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(form.file.size / 1024 / 1024).toFixed(2)} MB · Click to replace
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm font-medium">Click to choose a PDF</span>
                      <span className="text-xs text-muted-foreground">PDF files only</span>
                    </>
                  )}
                  <input
                    id="document-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setForm((prev) => ({ ...prev, file }));
                    }}
                    required
                  />
                </label>
              </div>
            </div>
            <SheetFooter className="gap-2 border-t bg-background px-6 py-4 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                onClick={closeUploadDialog}
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
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

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
