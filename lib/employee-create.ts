export interface EmployeeDraft {
  employeeId: string; firstName: string; lastName: string; primaryContact: string;
  secondaryContact: string; departmentName: string; role: string; dateOfJoining: string;
  addressLine1: string; addressLine2: string; city: string; state: string;
  pincode: string; country: string; userName: string; password: string;
}

export const employeeRoles = ['HR', 'AVP', 'Regional Manager', 'Coordinator', 'Data Manager', 'Field Officer'] as const;
export const emptyEmployeeDraft: EmployeeDraft = {
  employeeId: '', firstName: '', lastName: '', primaryContact: '', secondaryContact: '',
  departmentName: 'Sales', role: '', dateOfJoining: '', addressLine1: '', addressLine2: '',
  city: '', state: '', pincode: '', country: 'India', userName: '', password: '',
};
export type EmployeeIdentity = { id?: number; employeeId?: string | number | null; userName?: string; userDto?: { username?: string } };

/** Business IDs are independent of the database and login IDs. */
export function suggestEmployeeId(records: EmployeeIdentity[]): string {
  const ids = [...new Set(records.map(record => String(record.employeeId ?? '').trim().toUpperCase()).filter(Boolean))];
  const series = new Map<string, { count: number; highest: bigint; width: number }>();
  for (const id of ids) {
    const match = /^(.*?)(\d+)$/.exec(id);
    if (!match) continue;
    const [, prefix, digits] = match;
    const value = BigInt(digits);
    const current = series.get(prefix);
    series.set(prefix, { count: (current?.count ?? 0) + 1, highest: current && current.highest > value ? current.highest : value, width: Math.max(current?.width ?? 0, digits.length) });
  }
  const chosen = [...series].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
  if (!chosen) return 'EMP-001';
  const [prefix, { highest, width }] = chosen;
  return prefix + (highest + BigInt(1)).toString().padStart(width, '0');
}

export const suggestUsername = (first: string, last: string) => [first, last]
  .map(part => part.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')).filter(Boolean).join('_');

export function generateEmployeePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('') + '@9';
}

export function employeeDraftErrors(draft: EmployeeDraft): Partial<Record<keyof EmployeeDraft, string>> {
  const errors: Partial<Record<keyof EmployeeDraft, string>> = {};
  for (const field of ['employeeId', 'firstName', 'lastName', 'userName', 'password'] as const) {
    if (!draft[field].trim()) errors[field] = 'Required';
  }
  if (!/^[1-9]\d{9}$/.test(draft.primaryContact)) errors.primaryContact = 'Enter a valid 10-digit contact number';
  if (draft.secondaryContact && !/^[1-9]\d{9}$/.test(draft.secondaryContact)) errors.secondaryContact = 'Enter a valid 10-digit contact number';
  if (draft.departmentName !== 'Sales') errors.departmentName = 'Select a department';
  if (!(employeeRoles as readonly string[]).includes(draft.role)) errors.role = 'Select a role';
  if (draft.pincode && !/^\d{6}$/.test(draft.pincode)) errors.pincode = 'Enter a 6-digit pincode';
  if (/\d/.test(draft.city)) errors.city = 'City cannot contain numbers';
  return errors;
}

export function employeeCreatePayload(draft: EmployeeDraft) {
  if (Object.keys(employeeDraftErrors(draft)).length) throw new Error('Please correct the required fields before saving.');
  const { userName, password, ...employee } = draft;
  return {
    user: { username: userName.trim(), password },
    employee: { ...Object.fromEntries(Object.entries(employee).map(([key, value]) => [key, value.trim()])), email: '', subDistrict: '' },
  };
}

export interface EmployeeCreateProgress { created: boolean; employeeId?: number; assignedCities: string[] }
export interface EmployeeCreateService {
  list: () => Promise<EmployeeIdentity[]>;
  create: (payload: ReturnType<typeof employeeCreatePayload>) => Promise<unknown>;
  assignCity: (id: number, city: string) => Promise<void>;
}

/** Keep progress after creation so retrying a city failure never creates a second account. */
export async function saveEmployeeDraft(draft: EmployeeDraft, cities: string[], progress: EmployeeCreateProgress, service: EmployeeCreateService) {
  const payload = employeeCreatePayload(draft);
  const key = (value: unknown) => String(value ?? '').trim().toLowerCase();
  if (!progress.created) {
    const existing = await service.list();
    if (existing.some(employee => key(employee.employeeId) === key(draft.employeeId))) throw new Error('Employee ID is already used. Please choose a different ID.');
    if (existing.some(employee => key(employee.userName || employee.userDto?.username) === key(draft.userName))) throw new Error('Username is already used. Please choose a different username.');
    await service.create(payload);
    progress.created = true;
  }
  const selectedCities = draft.role === 'Field Officer' ? [...new Map(cities.map(city => [key(city), city.trim()])).values()].filter(Boolean) : [];
  if (!selectedCities.length) return;
  if (!progress.employeeId) {
    const employee = (await service.list()).find(employee => key(employee.userName || employee.userDto?.username) === key(draft.userName));
    if (!employee?.id) throw new Error('Employee created, but its ID is not available yet. Retry city assignments; the account will not be created again.');
    progress.employeeId = employee.id;
  }
  for (const city of selectedCities) {
    if (progress.assignedCities.some(saved => key(saved) === key(city))) continue;
    await service.assignCity(progress.employeeId, city);
    progress.assignedCities.push(city);
  }
}
