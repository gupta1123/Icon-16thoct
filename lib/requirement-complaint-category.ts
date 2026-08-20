export const REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS = [
  { value: "high", label: "Technical" },
  { value: "medium", label: "Commercial" },
  { value: "low", label: "ADVT" },
] as const;

export type RequirementComplaintPriority =
  (typeof REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS)[number]["value"];

export function getRequirementComplaintCategoryLabel(
  priority: string | null | undefined,
): string {
  const trimmedPriority = priority?.trim();
  const normalizedPriority = trimmedPriority?.toLowerCase();
  const option = REQUIREMENT_COMPLAINT_CATEGORY_OPTIONS.find(
    ({ value }) => value === normalizedPriority,
  );

  return option?.label ?? (trimmedPriority || "Not specified");
}
