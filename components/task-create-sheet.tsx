"use client";

import React, { useEffect, useRef, useState } from "react";
import { ClipboardList, Image as ImageIcon, MessageSquare, Upload, X } from "lucide-react";

import { FormField, FormGroup, FormSheet, SegmentedChoice } from "@/components/detail-ui";
import { SearchableSelect } from "@/components/ui/searchable-select2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS } from "@/lib/requirement-complaint-category";
import { MAX_REQUIREMENT_IMAGES, MAX_REQUIREMENT_IMAGE_SIZE_BYTES } from "@/lib/requirements";

export interface TaskSheetValues {
  taskTitle: string;
  taskDescription: string;
  dueDate: string;
  assignedToId: number;
  assignedToName: string;
  priority: string;
  storeId: number;
  storeName: string;
}

export interface TaskSheetEmployee {
  id: number;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

export interface TaskSheetStore {
  id: number;
  storeName: string;
  storeCity?: string;
  city?: string;
}

interface Props {
  kind: "complaint" | "requirement";
  open: boolean;
  onClose: () => void;
  value: TaskSheetValues;
  onChange: (patch: Partial<TaskSheetValues>) => void;
  employees: TaskSheetEmployee[];
  stores: TaskSheetStore[];
  isStoresLoading?: boolean;
  onStoreOpenChange?: (open: boolean) => void;
  employeeHint?: string;
  /** When the assignee/customer are fixed by context (e.g. a visit), show them read-only instead of pickers. */
  locked?: { employee: string; store: string };
  isSubmitting?: boolean;
  error?: string | null;
  /** Requirements can carry photos; complaints on the web currently cannot. */
  withPhotos?: boolean;
  onSubmit: (photos: File[]) => void;
}

interface PickedPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "en", { sensitivity: "base" });

export function TaskCreateSheet({
  kind, open, onClose, value, onChange, employees, stores, isStoresLoading = false, onStoreOpenChange,
  employeeHint, locked, isSubmitting = false, error, withPhotos = false, onSubmit,
}: Props) {
  const isComplaint = kind === "complaint";
  const noun = isComplaint ? "complaint" : "requirement";
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photosRef = useRef<PickedPhoto[]>([]);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);
  // A closed panel starts clean next time.
  useEffect(() => {
    if (open) return;
    setPhotos((current) => { current.forEach((p) => URL.revokeObjectURL(p.previewUrl)); return []; });
    setPhotoError(null);
  }, [open]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    if (!incoming.length) return;
    setPhotoError(null);
    if (photos.length + incoming.length > MAX_REQUIREMENT_IMAGES) return setPhotoError(`Maximum ${MAX_REQUIREMENT_IMAGES} photos allowed.`);
    if (incoming.some((f) => f.type && !f.type.startsWith("image/"))) return setPhotoError("Only image files can be added.");
    const big = incoming.find((f) => f.size > MAX_REQUIREMENT_IMAGE_SIZE_BYTES);
    if (big) return setPhotoError(`${big.name} is larger than 10 MB.`);
    setPhotos((current) => [
      ...current,
      ...incoming.map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return current.filter((p) => p.id !== id);
    });
    setPhotoError(null);
  };

  const employeeOptions = employees
    .map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName}${e.employeeId ? ` (${e.employeeId})` : ""}`.trim(), data: e }))
    .sort(byLabel);
  const storeOptions = stores
    .map((s) => ({ value: String(s.id), label: (s.storeCity || s.city) ? `${s.storeName} (${s.storeCity || s.city})` : s.storeName, data: s }))
    .sort(byLabel);
  const categoryChosen = REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS.some((o) => o.value === String(value.priority).toLowerCase());

  return (
    <FormSheet
      wide
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      icon={isComplaint ? MessageSquare : ClipboardList}
      title={isComplaint ? "Log complaint" : "Add requirement"}
      description={`Create a new ${noun} and assign it to an employee.`}
      errors={error ? [error] : photoError ? [photoError] : undefined}
      footerNote={`Assigned employees see this ${noun} in their task list.`}
      onSubmit={() => onSubmit(photos.map((p) => p.file))}
      submitLabel={isComplaint ? "Create complaint" : "Add requirement"}
      submitting={isSubmitting}
      submitDisabled={!value.taskTitle.trim() || !categoryChosen || (!locked && (!value.assignedToId || !value.storeId))}
    >
      <FormGroup title="Details">
        <FormField label={isComplaint ? "Complaint Title" : "Requirement Title"} required>
          <Input autoFocus value={value.taskTitle} onChange={(e) => onChange({ taskTitle: e.target.value })} placeholder="Enter title" className="h-10 text-sm" disabled={isSubmitting} />
        </FormField>
        <FormField label={isComplaint ? "Complaint Description" : "Requirement Description"} required>
          <Textarea value={value.taskDescription} onChange={(e) => onChange({ taskDescription: e.target.value })} placeholder="Enter description" className="min-h-[120px] resize-none text-sm leading-relaxed" disabled={isSubmitting} />
        </FormField>
      </FormGroup>

      <FormGroup title="Type">
        <SegmentedChoice
          value={String(value.priority || "").toLowerCase() as "high" | "medium" | "low"}
          onChange={(priority) => onChange({ priority })}
          options={[
            { value: "high", label: "Technical", dot: "bg-red-500" },
            { value: "medium", label: "Commercial", dot: "bg-amber-500" },
            { value: "low", label: "ADVT", dot: "bg-slate-400" },
          ]}
        />
      </FormGroup>

      <FormGroup title="Assignment" columns={2}>
        {locked ? (
          <>
            <FormField label="Assigned to" className="sm:col-span-2"><Input value={locked.employee} disabled className="h-10 text-sm" /></FormField>
            <FormField label="Customer" className="sm:col-span-2"><Input value={locked.store} disabled className="h-10 text-sm" /></FormField>
          </>
        ) : (
          <>
        <FormField label={`Assign to${employeeHint ? ` ${employeeHint}` : ""}`} required className="sm:col-span-2">
          <SearchableSelect
            modal
            triggerId={`${kind}-assignee`}
            options={employeeOptions}
            value={value.assignedToId ? String(value.assignedToId) : undefined}
            placeholder={employees.length === 0 ? "No employees available" : "Choose employee"}
            searchPlaceholder="Search employees…"
            disabled={isSubmitting || employees.length === 0}
            allowClear={value.assignedToId > 0}
            triggerClassName="h-10 w-full text-sm font-normal"
            contentClassName="w-[var(--radix-popover-trigger-width)]"
            onSelect={(option) => {
              // Stores are per employee, so changing the assignee resets the store.
              if (!option) return onChange({ assignedToId: 0, assignedToName: "", storeId: 0, storeName: "" });
              const emp = employees.find((e) => e.id === Number(option.value));
              onChange({ assignedToId: Number(option.value), assignedToName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : option.label, storeId: 0, storeName: "" });
            }}
          />
        </FormField>
        <FormField label="Customer" required hint={!value.assignedToId ? "Choose an employee first." : undefined} className="sm:col-span-2">
          <SearchableSelect
            modal
            triggerId={`${kind}-store`}
            options={storeOptions}
            value={value.storeId ? String(value.storeId) : undefined}
            placeholder={!value.assignedToId ? "Select employee first" : "Select a customer"}
            searchPlaceholder="Search customers…"
            emptyMessage="No customers for this employee"
            loading={isStoresLoading}
            disabled={isSubmitting || !value.assignedToId}
            allowClear={value.storeId > 0}
            triggerClassName="h-10 w-full text-sm font-normal"
            contentClassName="w-[var(--radix-popover-trigger-width)]"
            onOpenChange={onStoreOpenChange}
            onSelect={(option) => {
              if (!option) return onChange({ storeId: 0, storeName: "" });
              const store = stores.find((s) => s.id === Number(option.value));
              onChange({ storeId: Number(option.value), storeName: store?.storeName ?? option.label });
            }}
          />
        </FormField>
          </>
        )}
        <FormField label="Due date" required>
          <Input type="date" value={(value.dueDate || "").split("T")[0]} onChange={(e) => onChange({ dueDate: e.target.value })} className="h-10 text-sm" disabled={isSubmitting} />
        </FormField>
      </FormGroup>

      {withPhotos && (
        <FormGroup title={`Photos · ${photos.length}/${MAX_REQUIREMENT_IMAGES}`}>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          {photos.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={isSubmitting}
              className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/20 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
            >
              <ImageIcon className="h-5 w-5" />
              Add photos (optional)
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.previewUrl} alt={photo.file.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      disabled={isSubmitting}
                      aria-label={`Remove ${photo.file.name}`}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow ring-1 ring-border hover:bg-background"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileInput.current?.click()} disabled={isSubmitting || photos.length >= MAX_REQUIREMENT_IMAGES}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />Add more
              </Button>
            </div>
          )}
        </FormGroup>
      )}
    </FormSheet>
  );
}

export default TaskCreateSheet;
