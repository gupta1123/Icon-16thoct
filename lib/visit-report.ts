interface AttendanceStats {
  absences: number;
  halfDays: number;
  fullDays: number;
}

interface VisitsByCustomerType {
  [key: string]: number;
}

export interface FieldOfficerStatsResponse {
  totalVisits: number;
  attendanceStats: AttendanceStats;
  completedVisits: number;
  visitsByCustomerType: VisitsByCustomerType;
}

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

export const ADMIN_REPORT_EMPLOYEE_ROLES = new Set([
  'FIELD OFFICER',
  'COORDINATOR',
  'MANAGER',
  'OFFICE MANAGER',
  'REGIONAL MANAGER',
  'REGIONAL OFFICER',
  'AVP',
]);

export const normalizeEmployeeRole = (role?: string | null): string =>
  (role ?? '')
    .trim()
    .replace(/^ROLE_/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase();

export interface VisitDetail {
  avgIntentLevel: number;
  avgStock?: number;
  avgMonthlySales?: number;
  visitCount: number;
  lastVisited: string;
  city: string;
  taluka: string;
  state: string;
  customerName: string;
  customerType: string;
  storeId: number;
}

export type DisplayCustomerTypeKey = "dealer" | "professional" | "siteVisit";

const CUSTOMER_TYPE_CONFIG: Record<DisplayCustomerTypeKey, { label: string; fallback: string }> = {
  dealer: { label: "Dealer/Shop", fallback: "dealer" },
  professional: { label: "Engineer/Architect/Contractor", fallback: "professional" },
  siteVisit: { label: "Site Visit/Project", fallback: "site visit" },
};

export const DISPLAY_CUSTOMER_TYPES: DisplayCustomerTypeKey[] = ["dealer", "professional", "siteVisit"];

const RAW_TO_DISPLAY_CUSTOMER_TYPE_KEY: Record<string, DisplayCustomerTypeKey> = {
  dealer: "dealer",
  "dealer/shop": "dealer",
  shop: "dealer",
  retailer: "dealer",
  wholesaler: "dealer",
  distributor: "dealer",
  "dealer shop": "dealer",
  "dealer (shop)": "dealer",
  professional: "professional",
  architect: "professional",
  engineer: "professional",
  contractor: "professional",
  builder: "professional",
  "engineer/architect": "professional",
  "architect/engineer": "professional",
  "engineer architect": "professional",
  "engineer/architect/contractor": "professional",
  "engineer architect contractor": "professional",
  "site visit": "siteVisit",
  site: "siteVisit",
  project: "siteVisit",
  "site_visit": "siteVisit",
  "site visit/project": "siteVisit",
  "site visit - project": "siteVisit",
  "site visit/project site": "siteVisit",
  "site visit/project site visit": "siteVisit",
  "site visit/project visit": "siteVisit",
};

export const normalizeCustomerTypeKey = (value: string): string => (value ?? "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, " ")
  .replace(/\s*\/\s*/g, "/");

export const mapCustomerTypeToDisplayKey = (rawType: string): DisplayCustomerTypeKey => {
  const normalized = normalizeCustomerTypeKey(rawType);
  return RAW_TO_DISPLAY_CUSTOMER_TYPE_KEY[normalized] ?? "dealer";
};

export const getCustomerTypeLabel = (key: DisplayCustomerTypeKey): string =>
  CUSTOMER_TYPE_CONFIG[key].label;

export const getCustomerTypeFallbackRaw = (key: DisplayCustomerTypeKey): string =>
  CUSTOMER_TYPE_CONFIG[key].fallback;

export const createEmptyVisitCounts = (): Record<DisplayCustomerTypeKey, number> =>
  DISPLAY_CUSTOMER_TYPES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<DisplayCustomerTypeKey, number>);

export const createEmptyRawGroups = (): Record<DisplayCustomerTypeKey, string[]> =>
  DISPLAY_CUSTOMER_TYPES.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<DisplayCustomerTypeKey, string[]>);


export function summarizeCustomerTypes(values: Record<string, number | string>) {
  const counts = createEmptyVisitCounts();
  const rawGroups = createEmptyRawGroups();
  for (const [rawType, value] of Object.entries(values)) {
    const normalized = normalizeCustomerTypeKey(rawType);
    if (!normalized) continue;
    const category = mapCustomerTypeToDisplayKey(normalized);
    const count = Number(value);
    counts[category] += Number.isFinite(count) ? count : 0;
    if (!rawGroups[category].includes(normalized)) rawGroups[category].push(normalized);
  }
  return { counts, rawGroups };
}

function localDate(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function getReportDateRange(preset: string, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  const mondayOffset = (start.getDay() + 6) % 7;
  switch (preset) {
    case "last-7-days": start.setDate(start.getDate() - 6); break;
    case "last-15-days": start.setDate(start.getDate() - 14); break;
    case "last-30-days": start.setDate(start.getDate() - 29); break;
    case "this-week": start.setDate(start.getDate() - mondayOffset); break;
    case "this-month": start.setDate(1); break;
    case "last-week":
      start.setDate(start.getDate() - mondayOffset - 7);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      break;
    case "last-month":
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      end.setDate(0);
      break;
    default: return { startDate: "", endDate: "" };
  }
  return { startDate: localDate(start), endDate: localDate(end) };
}

export const REPORT_API_BASE = "https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net";

export async function fetchReportJson<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(REPORT_API_BASE + path, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
    if (response.status === 403) throw new Error("You don’t have permission to view this report.");
    throw new Error(`Unable to load report data (${response.status}). Please try again.`);
  }
  return response.json();
}

