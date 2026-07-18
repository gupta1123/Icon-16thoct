"use client";

import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";

import SearchableSelect from "@/components/searchable-select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAX_REQUIREMENT_IMAGES, MAX_REQUIREMENT_IMAGE_SIZE_BYTES } from "@/lib/requirements";

export interface RequirementFormValues {
  taskTitle: string;
  taskDescription: string;
  dueDate: string;
  assignedToId: number;
  assignedToName: string;
  assignedById: number;
  status: string;
  priority: string;
  taskType: "requirement";
  storeId: number;
  storeName: string;
  category?: string;
}

export interface RequirementEmployeeOption {
  id: number;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

export interface RequirementStoreOption {
  id: number;
  storeName: string;
  storeCity?: string;
  city?: string;
}

interface SelectedRequirementPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

interface RequirementCreationFormProps {
  value: RequirementFormValues;
  onChange: (value: RequirementFormValues) => void;
  employees: RequirementEmployeeOption[];
  stores?: RequirementStoreOption[];
  storeMode: "fixed" | "select";
  fixedStoreName?: string;
  isEmployeesLoading?: boolean;
  isStoresLoading?: boolean;
  isSubmitting?: boolean;
  error?: string | null;
  employeeHint?: React.ReactNode;
  onStoreOpenChange?: (open: boolean) => void;
  onCancel: () => void;
  onSubmit: (photos: File[]) => void;
}

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function RequirementCreationForm({
  value,
  onChange,
  employees,
  stores = [],
  storeMode,
  fixedStoreName,
  isEmployeesLoading = false,
  isStoresLoading = false,
  isSubmitting = false,
  error,
  employeeHint,
  onStoreOpenChange,
  onCancel,
  onSubmit,
}: RequirementCreationFormProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [isDueDatePickerOpen, setIsDueDatePickerOpen] = useState(false);
  const [photos, setPhotos] = useState<SelectedRequirementPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photosRef = useRef<SelectedRequirementPhoto[]>([]);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const updateValue = (patch: Partial<RequirementFormValues>) => {
    onChange({ ...value, ...patch });
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setPhotoError(null);

    if (photos.length + incoming.length > MAX_REQUIREMENT_IMAGES) {
      setPhotoError(`Maximum ${MAX_REQUIREMENT_IMAGES} photos allowed.`);
      return;
    }

    const rejectedType = incoming.find((file) => file.type && !file.type.startsWith("image/"));
    if (rejectedType) {
      setPhotoError("Only image files can be added.");
      return;
    }

    const oversized = incoming.find((file) => file.size > MAX_REQUIREMENT_IMAGE_SIZE_BYTES);
    if (oversized) {
      setPhotoError(`${oversized.name} is larger than 10 MB.`);
      return;
    }

    const nextPhotos = incoming.map((file) => {
      const randomId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${randomId}`,
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });

    setPhotos((current) => [...current, ...nextPhotos]);
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((photo) => photo.id !== id);
    });
    setPhotoError(null);
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="general" disabled={isSubmitting}>
          General
        </TabsTrigger>
        <TabsTrigger value="details" disabled={isSubmitting}>
          Details
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="requirement-title">Requirement Title</Label>
            <Input
              id="requirement-title"
              placeholder="Enter requirement title"
              value={value.taskTitle}
              onChange={(event) => updateValue({ taskTitle: event.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="requirement-description">Requirement Description</Label>
            <Input
              id="requirement-description"
              placeholder="Enter requirement description"
              value={value.taskDescription}
              onChange={(event) => updateValue({ taskDescription: event.target.value })}
              disabled={isSubmitting}
            />
          </div>

          {storeMode === "fixed" && (
            <div className="grid gap-2">
              <Label htmlFor="requirement-store-fixed">Store</Label>
              <Input
                id="requirement-store-fixed"
                value={fixedStoreName || value.storeName || "Loading..."}
                disabled
                className="bg-muted text-muted-foreground font-medium cursor-not-allowed"
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="requirement-category">Category</Label>
            <Select value="Requirement" disabled>
              <SelectTrigger id="requirement-category">
                <SelectValue placeholder="Requirement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Requirement">Requirement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => setActiveTab("details")} disabled={isSubmitting}>
              Next
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="details">
        {error && (
          <div className="mb-3 rounded border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="requirement-due-date">Due Date</Label>
              <Popover open={isDueDatePickerOpen} onOpenChange={setIsDueDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${!value.dueDate && "text-muted-foreground"}`}
                    disabled={isSubmitting}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value.dueDate ? format(new Date(`${value.dueDate}T00:00:00`), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={value.dueDate ? new Date(`${value.dueDate}T00:00:00`) : undefined}
                    onSelect={(date) => {
                      if (!date) {
                        updateValue({ dueDate: "" });
                        return;
                      }

                      updateValue({ dueDate: format(date, "yyyy-MM-dd") });
                      setIsDueDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="requirement-priority">Priority</Label>
              <Select value={value.priority} onValueChange={(priority) => updateValue({ priority })} disabled={isSubmitting}>
                <SelectTrigger id="requirement-priority">
                  <SelectValue placeholder="Select a priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="requirement-assigned-to">Assigned To {employeeHint}</Label>
            <SearchableSelect<RequirementEmployeeOption>
              options={employees.map((employee) => ({
                value: employee.id.toString(),
                label: `${employee.firstName} ${employee.lastName}${employee.employeeId ? ` (${employee.employeeId})` : ""}`.trim(),
                data: employee,
              }))}
              value={value.assignedToId ? value.assignedToId.toString() : undefined}
              onSelect={(option) => {
                if (!option) {
                  updateValue({ assignedToId: 0, assignedToName: "", storeId: storeMode === "select" ? 0 : value.storeId, storeName: storeMode === "select" ? "" : value.storeName });
                  return;
                }

                const employee = option.data ?? employees.find((item) => item.id === Number(option.value));
                updateValue({
                  assignedToId: Number(option.value),
                  assignedToName: employee ? `${employee.firstName} ${employee.lastName}`.trim() : option.label,
                  storeId: storeMode === "select" ? 0 : value.storeId,
                  storeName: storeMode === "select" ? "" : value.storeName,
                });
              }}
              placeholder={isEmployeesLoading ? "Loading employees..." : "Select an employee"}
              emptyMessage="No employees available"
              noResultsMessage="No employees match your search"
              searchPlaceholder="Search employees..."
              disabled={isSubmitting || isEmployeesLoading || employees.length === 0}
              allowClear={value.assignedToId > 0}
              loading={isEmployeesLoading}
              loadingMessage="Loading employees..."
            />
          </div>

          {storeMode === "select" && (
            <div className="grid gap-2">
              <Label htmlFor="requirement-store">Store</Label>
              <SearchableSelect<RequirementStoreOption>
                options={stores.map((store) => ({
                  value: store.id.toString(),
                  label: (store.storeCity || store.city)
                    ? `${store.storeName} (${store.storeCity || store.city})`
                    : store.storeName,
                  data: store,
                }))}
                value={value.storeId ? value.storeId.toString() : undefined}
                onSelect={(option) => {
                  if (!option) {
                    updateValue({ storeId: 0, storeName: "" });
                    return;
                  }

                  const store = option.data ?? stores.find((item) => item.id === Number(option.value));
                  updateValue({
                    storeId: Number(option.value),
                    storeName: store?.storeName ?? option.label,
                  });
                }}
                placeholder={!value.assignedToId ? "Select employee first" : "Select a store"}
                emptyMessage="No stores available for this employee"
                noResultsMessage="No stores match your search"
                searchPlaceholder="Search stores..."
                disabled={isSubmitting || !value.assignedToId}
                allowClear={value.storeId > 0}
                loading={isStoresLoading}
                loadingMessage="Loading stores..."
                onOpenChange={onStoreOpenChange}
              />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Photos</Label>
              <span className="text-xs text-muted-foreground">
                {photos.length} of {MAX_REQUIREMENT_IMAGES} photos
              </span>
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isSubmitting || photos.length >= MAX_REQUIREMENT_IMAGES}
              >
                <Upload className="h-4 w-4" />
                Choose Image
              </Button>
            </div>

            {photoError && <p className="text-sm text-destructive">{photoError}</p>}

            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative overflow-hidden rounded-lg border bg-muted">
                    <div className="aspect-square">
                      <img src={photo.previewUrl} alt={photo.file.name} className="h-full w-full object-cover" />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7"
                      onClick={() => removePhoto(photo.id)}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="absolute inset-x-0 bottom-0 bg-background/90 px-2 py-1">
                      <p className="truncate text-xs text-foreground">{photo.file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && (
              <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed bg-muted/20">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setActiveTab("general")} disabled={isSubmitting}>
              Back
            </Button>
            <Button onClick={() => onSubmit(photos.map((photo) => photo.file))} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Create Requirement"
              )}
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default RequirementCreationForm;
