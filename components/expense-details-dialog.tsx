"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Download, FileText, Folder, ImageIcon, IndianRupee, Maximize2 } from "lucide-react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ICON_API_BASE_URL = "https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net";

export interface ExpensePhotoAttachment {
  fileName: string;
  fileDownloadUri?: string;
  fileType: string;
  tag?: string;
  size?: number;
}

export interface ExpenseViewModel {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: "approved" | "pending" | "rejected";
  employeeName: string;
  employeePosition: string;
  attachments: ExpensePhotoAttachment[];
}

interface ExpenseDetailsDialogProps {
  expense: ExpenseViewModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];

function isImageAttachment(attachment: ExpensePhotoAttachment) {
  const fileType = attachment.fileType?.toLowerCase() ?? "";
  const fileName = attachment.fileName?.toLowerCase() ?? "";

  return fileType.startsWith("image/") || imageExtensions.some((extension) => fileName.endsWith(extension));
}

export default function ExpenseDetailsDialog({
  expense,
  open,
  onOpenChange,
}: ExpenseDetailsDialogProps) {
  const photos = useMemo(
    () => (expense?.attachments ?? []).filter(isImageAttachment),
    [expense],
  );
  const selectedPhoto = photos[0] ?? null;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    setPhotoUrl(null);
    setPhotoLoadFailed(false);
    setIsPhotoLoading(Boolean(open && expense && selectedPhoto));

    if (!open || !expense || !selectedPhoto) {
      return () => controller.abort();
    }

    // Prefer a direct download URI when the backend provides one.
    if (selectedPhoto.fileDownloadUri) {
      setPhotoUrl(selectedPhoto.fileDownloadUri);
      setIsPhotoLoading(false);
      return () => controller.abort();
    }

    const loadPhoto = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        setIsPhotoLoading(false);
        setPhotoLoadFailed(true);
        return;
      }

      try {
        const response = await fetch(
          `${ICON_API_BASE_URL}/expense/downloadFile/${expense.id}/expense/${encodeURIComponent(selectedPhoto.fileName)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to load expense photo (${response.status}).`);
        }

        objectUrl = URL.createObjectURL(await response.blob());
        setPhotoUrl(objectUrl);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setPhotoLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsPhotoLoading(false);
      }
    };

    loadPhoto();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [expense, open, selectedPhoto]);

  const downloadPhoto = () => {
    if (!selectedPhoto || !photoUrl) return;

    const link = document.createElement("a");
    link.href = photoUrl;
    link.download = selectedPhoto.fileName || `expense-${expense?.id}-photo`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!expense) return null;

  const statusStyles = {
    approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("p-0 gap-0 overflow-hidden border-border/80 bg-card shadow-2xl transition-all", selectedPhoto ? "sm:max-w-4xl" : "sm:max-w-md")}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pl-5 pr-10 py-3">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-bold text-foreground">Expense Details</DialogTitle>
            <Badge variant="outline" className={cn("uppercase text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-md", statusStyles[expense.status])}>
              {expense.status}
            </Badge>
            {!selectedPhoto && (
              <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                No image uploaded
              </Badge>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className={cn("grid grid-cols-1", selectedPhoto && "md:grid-cols-12 md:divide-x divide-border/60")}>
          {/* Left Column: Details */}
          <div className={cn("p-5 flex flex-col space-y-4", selectedPhoto ? "md:col-span-5" : "col-span-1")}>
            <div className="space-y-4">
              {/* Submitted By */}
              <div>
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">SUBMITTED BY</p>
                <h4 className="text-base font-bold text-foreground mt-0.5">{expense.employeeName}</h4>
              </div>

              {/* Key Value Metadata */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pt-1">
                {/* Date */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Date</span>
                  </div>
                  <span className="font-semibold text-foreground text-xs block pl-5">{format(new Date(expense.date), "dd MMM")}</span>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <IndianRupee className="h-3.5 w-3.5 text-blue-500 shrink-0" strokeWidth={2.5} />
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Amount</span>
                  </div>
                  <span className="font-bold text-foreground text-xs block pl-5">₹{(expense.amount || 0).toFixed(2)}</span>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Category</span>
                  </div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border/40 inline-block ml-5">
                    {expense.category || "General"}
                  </span>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Description</span>
                  </div>
                  <span className="font-medium text-foreground text-xs whitespace-pre-wrap leading-relaxed block pl-5">
                    {expense.description || "No description provided."}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-3 border-t border-border/40 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 text-xs font-semibold shadow-none"
              >
                Close Verification
              </Button>
            </div>
          </div>

          {/* Right Column: Receipt Preview (Only when photo exists) */}
          {selectedPhoto && (
            <div className="p-5 md:col-span-7 flex flex-col justify-between space-y-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">EXPENSE RECEIPT PREVIEW</p>
                <div className="flex items-center gap-1.5">
                  {photoUrl && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={downloadPhoto}
                        title="Download photo"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => window.open(photoUrl, "_blank")}
                        title="Open photo in new tab"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Image Frame */}
              <div className="relative flex min-h-[200px] max-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-3">
                {isPhotoLoading && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}

                {photoUrl && !photoLoadFailed ? (
                  <img
                    key={photoUrl}
                    src={photoUrl}
                    alt={`Receipt for ${expense.category}`}
                    className={cn(
                      "max-h-[240px] w-full object-contain rounded-md transition-opacity",
                      isPhotoLoading ? "opacity-0" : "opacity-100",
                    )}
                    onLoad={() => setIsPhotoLoading(false)}
                    onError={() => {
                      setIsPhotoLoading(false);
                      setPhotoLoadFailed(true);
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center p-6 text-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-xs font-semibold text-foreground">Unable to load receipt photo</p>
                  </div>
                )}
              </div>

              {/* Filename Footer */}
              <p className="text-[11px] font-mono text-muted-foreground text-center truncate">
                {selectedPhoto.fileName}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
