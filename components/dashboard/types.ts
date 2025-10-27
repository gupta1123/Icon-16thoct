export type Employee = {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
};

export type ExtendedEmployee = Employee & {
  listId: string;
  visitsInRange: number;
  formattedLastUpdated?: string;
};

export type StateItem = {
  id: number;
  name: string;
  activeEmployeeCount: number;
  ongoingVisitCount: number;
  completedVisitCount: number;
  color: string;
};

export type SelectedState = StateItem | null;

export type DateRangeValue = {
  start: Date;
  end: Date;
};

export type DateRangeKey = "today" | "yesterday" | "thisWeek" | "thisMonth";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  timestamp?: string | null;
  storeName?: string | null;
  description?: string | null;
  variant?: "current" | "home" | "checkin" | "checkout" | "visit" | "store";
  number?: number;
  employeeColor?: string;
};
