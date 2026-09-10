"use client";

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Briefcase, CalendarIcon, CheckCircle2, ChevronsUpDown, Loader2, MapPin, Search, User, X } from 'lucide-react';
import { API, API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { useDashboardHeader } from '@/components/dashboard-header-context';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { toast } from 'sonner';
import { emptyEmployeeDraft, employeeDraftErrors, employeeRoles, type EmployeeDraft } from '@/lib/employee-create';

function SectionHeading({ icon: Icon, title, children }: { icon: typeof User; title: string; children: ReactNode }) {
  return <div className="flex items-start gap-2.5"><Icon className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><h3 className="text-sm font-semibold tracking-tight">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{children}</p></div></div>;
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(item => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
};

const baselineCitiesOf = (record: Record<string, unknown>): string[] => {
  const combined = [
    ...toStringArray(record.assignedCity),
    ...toStringArray(record.assignedCities),
    ...toStringArray(record.cities),
  ];
  if (typeof record.city === 'string' && record.city.trim()) combined.push(record.city.trim());
  return [...new Map(combined.map(city => [city.toLowerCase(), city])).values()];
};

/** Map any stored role label onto the create-form role options. */
const toFormRole = (role: unknown): string => {
  const normalized = String(role ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  const map: Record<string, string> = {
    hr: 'HR',
    avp: 'AVP',
    'regional manager': 'Regional Manager',
    'office manager': 'Regional Manager',
    manager: 'Regional Manager',
    coordinator: 'Coordinator',
    'data manager': 'Data Manager',
    'field officer': 'Field Officer',
  };
  return map[normalized] ?? String(role ?? '').trim();
};

const formatRoleForPayload = (role: string) => {
  const normalizedRole = role.trim().replace(/\s+/g, '_').toUpperCase();
  const roleMap: Record<string, string> = {
    HR: 'HR',
    AVP: 'AVP',
    REGIONAL_MANAGER: 'Regional Manager',
    OFFICE_MANAGER: 'Office Manager',
    MANAGER: 'Manager',
    COORDINATOR: 'Coordinator',
    DATA_MANAGER: 'Data Manager',
    FIELD_OFFICER: 'Field Officer',
  };
  return roleMap[normalizedRole] || role.trim().replace(/_/g, ' ');
};

export default function EmployeeEditPage({ employeeId }: { employeeId: number }) {
  const router = useRouter();
  const { token, userRole, currentUser, isLoading: authLoading } = useAuth();
  const denied = [userRole, ...(currentUser?.authorities ?? []).map(item => item.authority)].some(role => role?.replace(/^ROLE_/, '').replace(/ /g, '_').toUpperCase() === 'DATA_MANAGER');
  const [draft, setDraft] = useState<EmployeeDraft>(emptyEmployeeDraft);
  const [email, setEmail] = useState('');
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [baselineAssigned, setBaselineAssigned] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [cityError, setCityError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { markSaved, requestDiscard } = useUnsavedChanges(dirty);
  const back = useCallback(() => { requestDiscard(() => router.push('/dashboard/employees')); }, [requestDiscard, router]);
  useDashboardHeader({ heading: 'Edit Employee', subheading: 'Update the user profile', onBack: back });

  useEffect(() => {
    if (!token || denied || ready) return;
    let active = true;
    (async () => {
      try {
        const employee = await API.getEmployeeById(employeeId);
        if (!active) return;
        const record = employee as unknown as Record<string, unknown>;
        const doj = typeof employee.dateOfJoining === 'string' ? employee.dateOfJoining.split('T')[0] : '';
        setDraft({
          ...emptyEmployeeDraft,
          employeeId: employee.employeeId ? String(employee.employeeId) : '',
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          primaryContact: employee.primaryContact ? String(employee.primaryContact) : '',
          departmentName: employee.departmentName || 'Sales',
          role: toFormRole(employee.role),
          city: employee.city || '',
          state: employee.state || '',
          dateOfJoining: doj,
          userName: employee.userName || employee.userDto?.username || '',
          password: '',
        });
        setEmail(employee.email || '');
        const baseline = baselineCitiesOf(record);
        setAssigned(baseline);
        setBaselineAssigned(baseline);
        setReady(true);
      } catch {
        if (active) setLoadError('Could not load this employee. Please try again.');
      }
    })();
    API.getCities().then(result => { if (active) setCities(result); }).catch(() => { if (active) setCityError('Could not load assigned cities. You can use the residence city or retry.'); });
    return () => { active = false; };
  }, [token, denied, ready, employeeId]);

  const change = (field: keyof EmployeeDraft, value: string) => {
    setDirty(true);
    if (field === 'primaryContact' || field === 'secondaryContact') value = value.replace(/\D/g, '').slice(0, 10);
    if (field === 'pincode') value = value.replace(/\D/g, '').slice(0, 6);
    setDraft(current => ({ ...current, [field]: value }));
  };
  // Password is managed via Reset Password; it is not part of the edit form.
  const errors = (() => { const all = employeeDraftErrors({ ...draft, password: 'x'.repeat(12) }); return all; })();
  const field = (name: keyof EmployeeDraft, label: string, options: { required?: boolean; placeholder?: string; className?: string; type?: string; disabled?: boolean; hint?: string } = {}) => {
    const error = draft[name] ? errors[name] : undefined;
    return <div className={`space-y-2 ${options.className ?? ''}`}><Label htmlFor={`employee-${name}`}>{label}{options.required && <span className="text-red-500"> *</span>}</Label><Input id={`employee-${name}`} name={name} value={draft[name]} onChange={event => change(name, event.target.value)} placeholder={options.placeholder} required={options.required} type={options.type ?? 'text'} inputMode={['primaryContact', 'secondaryContact', 'pincode'].includes(name) ? 'numeric' : undefined} disabled={options.disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `employee-${name}-error` : undefined} className={`h-9 bg-background ${name === 'employeeId' ? 'font-mono uppercase' : ''}`} />{options.hint && <p className="text-xs text-muted-foreground">{options.hint}</p>}{error && <span id={`employee-${name}-error`} className="text-xs text-destructive">{error}</span>}</div>;
  };
  const roleOptions = draft.role && !(employeeRoles as readonly string[]).includes(draft.role) ? [...employeeRoles, draft.role] : [...employeeRoles];
  const cityOptions = [...new Map([...cities, draft.city, ...assigned].map(city => city.trim()).filter(Boolean).map(city => [city.toLowerCase(), city])).values()].sort((a, b) => a.localeCompare(b));
  const toggleCity = (city: string) => { setDirty(true); setAssigned(current => current.includes(city) ? current.filter(item => item !== city) : [...current, city]); };
  const submit = async () => {
    if (!token || denied || Object.keys(errors).length) return;
    setSaving(true); setSaveError(null);
    try {
      const trimmedEntries = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]));
      await API.updateEmployee(employeeId, {
        firstName: trimmedEntries.firstName,
        lastName: trimmedEntries.lastName,
        email: email.trim(),
        role: formatRoleForPayload(trimmedEntries.role),
        departmentName: trimmedEntries.departmentName,
        userName: trimmedEntries.userName,
        primaryContact: trimmedEntries.primaryContact,
        secondaryContact: trimmedEntries.secondaryContact,
        city: trimmedEntries.city,
        state: trimmedEntries.state,
        addressLine1: trimmedEntries.addressLine1,
        addressLine2: trimmedEntries.addressLine2,
        pincode: trimmedEntries.pincode,
        dateOfJoining: trimmedEntries.dateOfJoining,
      });
      const key = (value: string) => value.trim().toLowerCase();
      const baselineKeys = new Set(baselineAssigned.map(key));
      const selectedKeys = new Map(assigned.map((city): [string, string] => [key(city), city.trim()]).filter(([, city]) => city));
      for (const [cityKey, city] of selectedKeys) {
        if (baselineKeys.has(cityKey)) continue;
        const response = await fetch(`${API_BASE_URL}/employee/assignCity?id=${employeeId}&city=${encodeURIComponent(city)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Profile saved, but assigning ${city} failed (${response.status}). Reopen this page to retry the remaining cities.`);
      }
      for (const city of baselineAssigned) {
        if (selectedKeys.has(key(city))) continue;
        const response = await fetch(`${API_BASE_URL}/employee/removeCity?id=${employeeId}&city=${encodeURIComponent(city)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Profile saved, but removing ${city} failed (${response.status}). Reopen this page to retry the remaining cities.`);
      }
      markSaved(); setDirty(false); toast.success('Employee updated'); router.push('/dashboard/employees');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save employee. Please try again.');
    } finally { setSaving(false); }
  };

  if (authLoading || (!ready && !loadError)) return <div className="py-12 text-center text-sm text-muted-foreground">Loading employee form…</div>;
  if (denied) return <div role="alert">You do not have permission to edit employees.<Button variant="link" onClick={back}>Back to Employees</Button></div>;
  if (loadError || !ready) return <div role="alert" className="py-12 text-center text-sm text-muted-foreground">{loadError ?? 'Could not load this employee.'}<div><Button variant="link" onClick={back}>Back to Employees</Button></div></div>;
  return <div className="icon-employee-create mx-auto w-full max-w-6xl pb-3 pt-0 text-sm leading-5 text-foreground">
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border/60 px-5 pb-[18px] pt-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><User className="h-4 w-4" /></div><div><h2 className="text-base font-semibold tracking-tight">Employee profile</h2><p className="text-xs text-muted-foreground">Identity, work assignment, address, and account access</p></div></div></div>
      <div className="px-5 pb-5 pt-4">
        <fieldset disabled={saving} className="min-w-0 space-y-5 disabled:opacity-70">
          <section className="grid gap-4"><SectionHeading icon={User} title="Personal details">Basic identity and contact information</SectionHeading><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{field('firstName', 'First Name', { required: true, placeholder: 'e.g. John' })}{field('lastName', 'Last Name', { required: true, placeholder: 'e.g. Doe' })}{field('employeeId', 'Employee ID', { required: true, disabled: true, hint: 'Business IDs cannot be changed after creation.' })}</div><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{field('primaryContact', 'Primary Contact', { required: true, placeholder: '9876543210', type: 'tel' })}{field('secondaryContact', 'Secondary Contact', { placeholder: 'Optional', type: 'tel' })}</div><div className="space-y-2"><Label htmlFor="employee-email">Email</Label><Input id="employee-email" name="email" type="email" value={email} onChange={event => { setEmail(event.target.value); setDirty(true); }} placeholder="name@example.com" className="h-9 bg-background" /></div></section>
          <section className="space-y-4 border-t pt-4"><SectionHeading icon={Briefcase} title="Work and role">Department, designation, and operational assignments</SectionHeading><div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="employee-department">Department <span className="text-red-500">*</span></Label><Select value={draft.departmentName} onValueChange={value => change('departmentName', value)}><SelectTrigger id="employee-department" className="h-9 w-full bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Sales">Sales</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="employee-role">Assigned Role <span className="text-red-500">*</span></Label><Select value={draft.role} onValueChange={value => change('role', value)}><SelectTrigger id="employee-role" className="h-9 w-full bg-background"><SelectValue placeholder="Select Role" /></SelectTrigger><SelectContent>{roleOptions.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="employee-joining">Date of Joining</Label><Popover><PopoverTrigger asChild><Button id="employee-joining" type="button" variant="outline" className="h-9 w-full justify-start bg-background text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{draft.dateOfJoining ? format(new Date(`${draft.dateOfJoining}T00:00:00`), 'MMM dd, yyyy') : 'Pick a date'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><SpacedCalendar mode="single" selected={draft.dateOfJoining ? new Date(`${draft.dateOfJoining}T00:00:00`) : undefined} onSelect={date => { if (date) change('dateOfJoining', format(date, 'yyyy-MM-dd')); }} /></PopoverContent></Popover></div>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4"><div><Label>Assign Cities to Field Officer</Label><p className="mt-1 text-xs text-muted-foreground">Select one or more operational cities. Changes are saved with the profile.</p></div>{cityError && <p role="alert" className="text-xs text-destructive">{cityError} <button type="button" className="underline" onClick={() => { API.getCities().then(result => { setCities(result); setCityError(null); }).catch(() => setCityError('Could not load assigned cities. Please retry.')); }}>Retry</button></p>}{assigned.length > 0 && <div className="flex flex-wrap gap-2">{assigned.map(city => <Badge key={city} variant="secondary" className="gap-1 pr-1">{city}<button type="button" aria-label={`Remove ${city}`} onClick={() => toggleCity(city)} className="rounded-sm p-0.5 hover:bg-background/70"><X className="h-3 w-3" /></button></Badge>)}</div>}<Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="w-full justify-between">{assigned.length ? `${assigned.length} ${assigned.length === 1 ? 'city' : 'cities'} selected` : 'Select assigned cities'}<ChevronsUpDown className="h-4 w-4 text-muted-foreground" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1"><div className="relative border-b p-1.5"><Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search assigned cities" placeholder="Search cities" value={citySearch} onChange={event => setCitySearch(event.target.value)} className="h-8 border-0 bg-transparent pl-8 shadow-none" /></div><div className="max-h-56 overflow-y-auto">{cityOptions.filter(city => city.toLowerCase().includes(citySearch.trim().toLowerCase())).map(city => <label key={city} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"><Checkbox checked={assigned.includes(city)} onCheckedChange={() => toggleCity(city)} />{city}</label>)}</div></PopoverContent></Popover></div>
          </section>
          <section className="space-y-4 border-t pt-4"><SectionHeading icon={MapPin} title="Residency">Home address and location details</SectionHeading><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{field('addressLine1', 'Address line 1', { placeholder: 'Street address' })}{field('addressLine2', 'Address line 2', { placeholder: 'Optional' })}</div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{field('city', 'City')}{field('state', 'State')}{field('pincode', 'Pincode')}<div className="space-y-2"><Label htmlFor="employee-country">Country</Label><Input id="employee-country" value="India" disabled className="h-9 border-input/50 bg-muted/20 text-muted-foreground" /></div></div></section>
          <section className="!mt-6 space-y-4 border-t pt-4"><SectionHeading icon={User} title="Account access">Username is managed separately via Edit Username.</SectionHeading>{field('userName', 'Username', { required: true, disabled: true, hint: 'Use Edit Username on the employee list to change this.' })}</section>
        </fieldset>
        {saveError && <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</div>}
        <div className="-mx-5 -mb-5 mt-6 border-t border-border/60 bg-muted/15 px-5 py-4"><div className="flex items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={back} disabled={saving} className="text-muted-foreground">Cancel</Button><Button type="submit" disabled={Object.keys(errors).length > 0 || saving || !token} size="sm" className="min-w-[140px]">{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <>Save Changes<CheckCircle2 className="ml-2 h-4 w-4" /></>}</Button></div></div>
      </div>
    </form>
  </div>;
}
