export interface CustomerFilterValues {
  storeName: string;
  primaryContact: string;
  ownerName: string;
  city: string;
  state: string;
  clientType: string;
  dealerSubType: string;
  employeeName: string;
}

export interface CustomerFilterRecord {
  storeId: number;
  storeName?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  primaryContact?: number | string | null;
  stock?: number | string | null;
  monthlySale?: number | string | null;
  employeeName?: string | null;
  clientType?: string | null;
  dealerSubType?: string | null;
  totalVisitCount?: number | null;
  lastVisitDate?: string | null;
  city?: string | null;
  state?: string | null;
}

const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();

const includesFilter = (value: unknown, filter: string): boolean => {
  const normalizedFilter = normalize(filter);
  return normalizedFilter === "" || normalize(value).includes(normalizedFilter);
};

export const filterCustomers = <T extends CustomerFilterRecord>(
  customers: T[],
  filters: CustomerFilterValues,
): T[] => customers.filter((customer) => {
  const ownerName = `${customer.clientFirstName ?? ""} ${customer.clientLastName ?? ""}`.trim();
  const phoneFilter = filters.primaryContact.replace(/\D/g, "");
  const phone = String(customer.primaryContact ?? "").replace(/\D/g, "");

  return includesFilter(customer.storeName, filters.storeName)
    && includesFilter(ownerName, filters.ownerName)
    && includesFilter(customer.city, filters.city)
    && includesFilter(customer.state, filters.state)
    && includesFilter(customer.clientType, filters.clientType)
    && includesFilter(customer.dealerSubType, filters.dealerSubType)
    && includesFilter(customer.employeeName, filters.employeeName)
    && (phoneFilter === "" || phone.includes(phoneFilter));
});

const getSortValue = (customer: CustomerFilterRecord, sortColumn: string): string | number => {
  switch (sortColumn) {
    case "ownerFirstName":
    case "ownerName":
      return normalize(`${customer.clientFirstName ?? ""} ${customer.clientLastName ?? ""}`);
    case "visitCount":
    case "totalVisits":
      return Number(customer.totalVisitCount ?? 0);
    case "stock":
      return Number(customer.stock ?? customer.monthlySale ?? 0);
    case "primaryContact":
      return Number(customer.primaryContact ?? 0);
    case "lastVisitDate":
      return customer.lastVisitDate ? new Date(customer.lastVisitDate).getTime() : 0;
    case "city":
      return normalize(customer.city);
    case "state":
      return normalize(customer.state);
    case "employeeName":
      return normalize(customer.employeeName);
    case "clientType":
      return normalize(customer.clientType);
    case "storeName":
    default:
      return normalize(customer.storeName);
  }
};

export const sortCustomers = <T extends CustomerFilterRecord>(
  customers: T[],
  sortColumn: string,
  sortDirection: "asc" | "desc",
): T[] => [...customers].sort((left, right) => {
  const leftValue = getSortValue(left, sortColumn);
  const rightValue = getSortValue(right, sortColumn);
  const comparison = typeof leftValue === "number" && typeof rightValue === "number"
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue));

  if (comparison !== 0) return sortDirection === "asc" ? comparison : -comparison;
  return left.storeId - right.storeId;
});
