export interface EmployeeIdentity {
  id?: number | string | null;
  employeeId?: number | string | null;
  userDto?: {
    employeeId?: number | string | null;
  } | null;
}

const normalizeIdentifier = (value: number | string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
};

export const getEmployeeIdentifiers = (employee: EmployeeIdentity): Set<string> => {
  const identifiers = [employee.id, employee.employeeId, employee.userDto?.employeeId]
    .map(normalizeIdentifier)
    .filter((value): value is string => value !== null);
  return new Set(identifiers);
};

export const matchesSelectedEmployee = (
  rowEmployeeId: number | string | null | undefined,
  selectedEmployeeId: string,
  directory: EmployeeIdentity[],
): boolean => {
  if (!selectedEmployeeId || selectedEmployeeId === "all") return true;
  const rowIdentifier = normalizeIdentifier(rowEmployeeId);
  if (!rowIdentifier) return false;

  const selectedEmployee = directory.find((employee) =>
    getEmployeeIdentifiers(employee).has(selectedEmployeeId),
  );

  return selectedEmployee
    ? getEmployeeIdentifiers(selectedEmployee).has(rowIdentifier)
    : rowIdentifier === selectedEmployeeId;
};
