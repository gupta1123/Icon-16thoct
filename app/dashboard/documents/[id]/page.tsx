"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const formatDate = (value: string) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd MMM yyyy, hh:mm a");
};

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { token, userRole, currentUser } = useAuth();
  const normalizedRole = normalizeRoleValue(userRole);
  const authorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);
  const isAdmin = hasAnyRole(normalizedRole, authorityRoles, ["ADMIN"]);

  const [document, setDocument] = useState<AdminDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadDocument = useCallback(async () => {
    if (!token || !params.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const documentsResponse = await fetch(`${API_BASE_URL}/admin-documents/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!documentsResponse.ok) {
        const message = await documentsResponse.text();
        throw new Error(message || `Failed to load document (${documentsResponse.status})`);
      }

      const data = await documentsResponse.json();
      const matchingDocument = parseDocumentsResponse(data)
        .filter(isDocumentActive)
        .find((item) => String(item.id) === String(params.id));

      if (!matchingDocument) {
        throw new Error("Document not found or no longer available.");
      }

      setDocument(matchingDocument);
      const fileName = getDocumentFileName(matchingDocument);

      if (fileName) {
        const previewResponse = await fetch(
          `${API_BASE_URL}/admin-documents/${matchingDocument.id}/download/${encodeURIComponent(fileName)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!previewResponse.ok) {
          throw new Error(`Failed to load PDF preview (${previewResponse.status})`);
        }

        const blob = await previewResponse.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (loadError) {
      console.error("Failed to load document:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load document");
    } finally {
      setIsLoading(false);
    }
  }, [params.id, token]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDownload = async () => {
    if (!token || !document) return;

    const fileName = getDocumentFileName(document);
    if (!fileName) {
      toast.error("This document does not include a downloadable file name.");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin-documents/${document.id}/download/${encodeURIComponent(fileName)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Download failed (${response.status})`);
      }

      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement("a");
      link.href = url;
      link.download = fileName;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("Document download failed:", downloadError);
      toast.error(downloadError instanceof Error ? downloadError.message : "Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !document || !isAdmin) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin-documents/${document.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Delete failed (${response.status})`);
      }

      toast.success("Document deleted.");
      setIsDeleteOpen(false);
      router.push("/dashboard/documents");
      router.refresh();
    } catch (deleteError) {
      console.error("Document delete failed:", deleteError);
      toast.error(deleteError instanceof Error ? deleteError.message : "Delete failed");
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
            <h2 className="text-lg font-semibold">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">
              Only Admin users can view document details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading document...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-5">
        <Button variant="outline" asChild>
          <Link href="/dashboard/documents">
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
        <Card>
          <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Unable to open document</h2>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={loadDocument}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fileName = getDocumentFileName(document);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" asChild>
          <Link href="/dashboard/documents">
            <ArrowLeft className="h-4 w-4" />
            Back to Documents
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} disabled={!fileName || isDownloading}>
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex min-w-0 gap-3">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-xl">{document.title || "Untitled document"}</CardTitle>
                  <CardDescription className="break-all">{fileName || "No file attached"}</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit">
                {document.category || "Uncategorized"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-4 border-t pt-5">
              <div className="flex gap-3">
                <FolderOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</p>
                  <p className="mt-1 text-sm">{document.category || "Not specified"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Uploaded</p>
                  <p className="mt-1 text-sm">{formatDate(getDocumentDate(document))}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {document.description || "No description provided."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PDF Preview</CardTitle>
            <CardDescription>Review the document without leaving this page.</CardDescription>
          </CardHeader>
          <CardContent>
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title={`${document.title || "Document"} PDF preview`}
                className="h-[70vh] min-h-[520px] w-full rounded-lg border bg-muted"
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 text-center text-sm text-muted-foreground">
                <FileText className="h-9 w-9" />
                <p>No PDF preview is available for this document.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Document"
        description={`This will deactivate "${document.title || "this document"}" and remove it from the document library.`}
        confirmText="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
