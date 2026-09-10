"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Loader2, MapPin, MoreHorizontal, Search, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import { API, API_BASE_URL, type EmployeeDto } from '@/lib/api';
import { cityKey, cityLabel, eligibleOfficers, filterTeams, isCoordinator, personName, roleKey, teamAvps, teamCities, teamLeadLabel, type SettingsTeam } from '@/lib/team-settings';
import { useAuth } from '@/components/auth-provider';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/searchable-select2';
import { TeamCreateSheet } from '@/components/team-create-sheet';
import { TeamCityPicker } from '@/components/team-city-picker';

type Section = 'overview' | 'managers' | 'cities' | 'officers';
type Confirmation = { title: string; description: string; action: () => Promise<void> };
const initials = (person: EmployeeDto | null) => `${person?.firstName?.[0] ?? ''}${person?.lastName?.[0] ?? ''}`.toUpperCase();
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
const emptyFilters = { search: '', manager: '', city: '', officer: '' };

export default function TeamsSettings() {
  const { token } = useAuth();
  const [teams, setTeams] = useState<SettingsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [panelId, setPanelId] = useState<number | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [officers, setOfficers] = useState<EmployeeDto[]>([]);
  const [managers, setManagers] = useState<EmployeeDto[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedOfficers, setSelectedOfficers] = useState<number[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [panelSearch, setPanelSearch] = useState('');
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const listVersion = useRef(0);
  const panelVersion = useRef(0);
  const panelTeam = teams.find(team => team.id === panelId);
  const dirty = panelId !== null && (selectedOfficers.length > 0 || selectedCities.length > 0 || (managerId !== null && managerId !== panelTeam?.officeManager?.id));
  const { requestDiscard, markSaved } = useUnsavedChanges(dirty);

  const fetchTeams = useCallback(async () => {
    const version = ++listVersion.current;
    setLoading(true);
    setError('');
    try {
      if (!token) throw new Error('Please sign in to view teams.');
      const data = await API.getTeams();
      if (version === listVersion.current) setTeams(data.map(team => ({ ...team, fieldOfficers: [...team.fieldOfficers].sort((a, b) => personName(a).localeCompare(personName(b))) })));
    } catch (err) {
      if (version === listVersion.current) setError(message(err));
    } finally {
      if (version === listVersion.current) setLoading(false);
    }
  }, [token]);
  useEffect(() => { void fetchTeams(); return () => { listVersion.current++; }; }, [fetchTeams]);

  const request = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    if (!token) throw new Error('Please sign in to manage teams.');
    const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error(`Team request failed (${response.status}). Please try again or check your permissions.`);
    return response;
  }, [token]);

  const loadSection = useCallback(async (team: SettingsTeam, next: Section) => {
    const version = ++panelVersion.current;
    setPanelError('');
    setOfficers([]);
    setManagers([]);
    setCities([]);
    setPanelLoading(next !== 'overview');
    try {
      if (next === 'officers') {
        const candidates = isCoordinator(team)
          ? await API.getAllFieldOfficers()
          : (await Promise.all(teamCities(team).map(async city => {
              const response = await request(`/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`);
              return await response.json() as EmployeeDto[];
            }))).flat();
        if (version === panelVersion.current) setOfficers(eligibleOfficers(candidates, team, teams));
      } else if (next === 'cities') {
        const options = await API.getCities();
        if (version === panelVersion.current) setCities([...new Map(options.filter(Boolean).map(city => [cityKey(city), city])).values()].sort((a, b) => a.localeCompare(b)));
      } else if (next === 'managers') {
        const directory = await API.getEmployeeDirectory();
        const occupied = new Set(teams.filter(other => other.id !== team.id).map(other => other.officeManager?.id));
        const available = directory.filter(person => {
          const role = roleKey(person.role);
          return person.id === team.officeManager?.id || (!occupied.has(person.id) && (isCoordinator(team) ? role === 'COORDINATOR' : ['MANAGER', 'OFFICE_MANAGER', 'REGIONAL_MANAGER'].includes(role)));
        });
        if (version === panelVersion.current) setManagers(available.sort((a, b) => personName(a).localeCompare(personName(b))));
      }
    } catch (err) {
      if (version === panelVersion.current) setPanelError(message(err));
    } finally {
      if (version === panelVersion.current) setPanelLoading(false);
    }
  }, [request, teams]);

  const resetDraft = (team?: SettingsTeam) => {
    setSelectedCities([]); setSelectedOfficers([]); setManagerId(team?.officeManager?.id ?? null); setPanelSearch(''); setPanelError('');
  };
  const openPanel = (team: SettingsTeam, next: Section) => {
    setPanelId(team.id); setSection(next); resetDraft(team);
  };
  const closePanel = () => {
    if (saving) return;
    requestDiscard(() => { panelVersion.current++; setPanelId(null); resetDraft(); });
  };
  const changeSection = (next: Section) => {
    if (!panelTeam || saving || next === section) return;
    requestDiscard(() => { setSection(next); resetDraft(panelTeam); });
  };
  useEffect(() => () => { panelVersion.current++; }, []);

  const save = async (action: () => Promise<unknown>, close = false) => {
    if (saving) return;
    setSaving(true); setPanelError('');
    try {
      await action();
      markSaved(); setSelectedOfficers([]); setSelectedCities([]); setManagerId(null);
      setConfirmation(null);
      if (close) { setPanelId(null); panelVersion.current++; }
      await fetchTeams();
      // Refresh eligibility against the updated hierarchy, not stale team members.
      setOfficers([]);
    } catch (err) {
      setPanelError(message(err));
    } finally { setSaving(false); }
  };
  // Refresh the active panel after a successful mutation/refetch.
  useEffect(() => {
    if (panelTeam) void loadSection(panelTeam, section);
  }, [panelTeam, loadSection, section]);

  const filtered = useMemo(() => filterTeams(teams, filters), [teams, filters]);
  const managerOptions = useMemo(() => [...new Map(teams.flatMap(team => [team.officeManager, ...teamAvps(team)]).filter((person): person is EmployeeDto => !!person).map(person => [String(person.id), { value: String(person.id), label: personName(person) }])).values()].sort((a, b) => a.label.localeCompare(b.label)), [teams]);
  const cityOptions = useMemo(() => [...new Map(teams.flatMap(teamCities).map(city => [cityKey(city), { value: cityKey(city), label: cityLabel(city) }])).values()].sort((a, b) => a.label.localeCompare(b.label)), [teams]);
  const officerOptions = useMemo(() => [...new Map(teams.flatMap(team => team.fieldOfficers).map(person => [String(person.id), { value: String(person.id), label: personName(person) }])).values()].sort((a, b) => a.label.localeCompare(b.label)), [teams]);
  const activeFilters = !!(filters.manager || filters.city || filters.officer);
  const filteredManagers = managers.filter(person => personName(person).toLowerCase().includes(panelSearch.toLowerCase()));
  const filteredOfficers = officers.filter(person => personName(person).toLowerCase().includes(panelSearch.toLowerCase()));

  return (
    <div className="icon-teams text-sm leading-5">
      <Card className="gap-0 border-border/70 py-0 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1.25fr)_repeat(3,minmax(150px,1fr))_auto] xl:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="team-search" className="text-xs">Search</Label>
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="team-search" placeholder="Search teams..." className="h-9 pl-9 pr-9 text-sm shadow-none" value={filters.search} disabled={loading || !teams.length} onChange={event => setFilters({ ...filters, search: event.target.value })} />
                  {filters.search && <Button aria-label="Clear team search" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" onClick={() => setFilters({ ...filters, search: '' })}><X className="h-4 w-4" /></Button>}
                </div>
              </div>
              {([
                ['manager', 'Regional manager', 'All regional managers', managerOptions],
                ['city', 'City', 'All cities', cityOptions],
                ['officer', 'Field officer', 'All field officers', officerOptions],
              ] as const).map(([key, label, placeholder, options]) => <div className="space-y-1.5 min-w-0" key={key}>
                <Label htmlFor={`team-${key}-filter`} className="text-xs">{label}</Label>
                <SearchableSelect triggerId={`team-${key}-filter`} options={options} value={filters[key] || undefined} onSelect={option => setFilters({ ...filters, [key]: option?.value || '' })} placeholder={placeholder} searchPlaceholder={`Search ${label.toLowerCase()}...`} allowClear triggerClassName="h-9 w-full min-w-0 text-sm font-normal" contentClassName="w-[var(--radix-popover-trigger-width)]" />
              </div>)}
              <div className="flex h-9 items-center justify-between gap-2 sm:col-span-2 xl:col-span-1 xl:justify-end">
                <TeamCreateSheet teams={teams} request={request} onCreated={fetchTeams} />
                {activeFilters && <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setFilters({ ...emptyFilters, search: filters.search })}>Clear</Button>}
                {!loading && <span className="whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">{filtered.length} of {teams.length}</span>}
              </div>
            </div>
          </div>
          {loading ? <div className="space-y-3" aria-label="Loading teams">{[0, 1, 2].map(key => <Skeleton key={key} className="h-40 rounded-xl" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><span>{error}</span><Button variant="outline" size="sm" onClick={fetchTeams}>Try Again</Button></div> : filtered.length ? <div className="space-y-3">
            {filtered.map(team => <Card key={team.id} className="gap-0 overflow-hidden border-border/70 py-0 shadow-sm transition-all hover:border-border hover:shadow-md">
              <CardContent className="p-3">
                <div className="grid min-h-[132px] gap-3 xl:grid-cols-[minmax(260px,1.1fr)_minmax(145px,0.7fr)_minmax(330px,1.5fr)_140px]">
                  <div className="min-w-0 px-2 py-2">
                    <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] leading-5 font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team #{team.id}</p><span className="text-[10px] leading-5 text-muted-foreground">1 {teamLeadLabel(team).toLowerCase()}</span></div>
                    <button type="button" className="flex w-full min-w-0 items-center rounded-lg border border-transparent px-1.5 py-1 text-left transition-colors hover:border-border/70 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openPanel(team, 'managers')}>
                      <span className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] leading-5 font-semibold text-primary-foreground">{initials(team.officeManager) || <User className="h-4 w-4" />}</span>
                      <span className="min-w-0"><span className="block truncate text-xs font-semibold">{personName(team.officeManager)}</span><span className="block text-[10px] leading-5 text-muted-foreground">{teamLeadLabel(team)}</span></span>
                    </button>
                    {teamAvps(team).map(avp => <div key={avp.id} className="mt-1.5 truncate pl-1.5 text-[10px] leading-5 text-muted-foreground" title={`AVP: ${personName(avp)}`}>AVP · {personName(avp)}</div>)}
                  </div>
                  <div className="rounded-lg bg-muted/25 p-3">
                    <p className="mb-2 text-[10px] leading-5 font-semibold uppercase tracking-[0.12em] text-muted-foreground">Coverage</p>
                    <div className="flex flex-wrap gap-1.5">{teamCities(team).slice(0, 2).map(city => <Badge key={city} variant="secondary" className="text-[11px] leading-5 font-normal"><Building2 size={12} className="mr-1" />{cityLabel(city)}</Badge>)}
                      {teamCities(team).length > 2 && <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-[11px] leading-5 font-normal" aria-label={`View all ${teamCities(team).length} cities for Team ${team.id}`} onClick={() => openPanel(team, 'cities')}>+{teamCities(team).length - 2} more</Button>}
                      {!teamCities(team).length && <span className="text-xs text-muted-foreground">{isCoordinator(team) ? 'Cross-city team' : 'No cities assigned'}</span>}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/25 p-3">
                    <p className="mb-2 text-[10px] leading-5 font-semibold uppercase tracking-[0.12em] text-muted-foreground">Field officers · {team.fieldOfficers.length}</p>
                    {team.fieldOfficers.length ? <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{team.fieldOfficers.slice(0, 6).map(officer => <button type="button" key={officer.id} title={personName(officer)} onClick={() => openPanel(team, 'officers')} className="flex h-7 min-w-0 items-center rounded-md bg-background/70 px-2 text-left hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><User size={14} className="mr-2 shrink-0 text-muted-foreground" /><span className="truncate text-[11px] leading-5 font-medium">{personName(officer)}</span></button>)}{team.fieldOfficers.length > 6 && <Button variant="ghost" size="sm" className="h-7 justify-start px-2 text-[11px] leading-5 text-primary" onClick={() => openPanel(team, 'officers')}>+{team.fieldOfficers.length - 6} more officers</Button>}</div> : <p className="text-xs text-muted-foreground">No field officers assigned</p>}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-1 py-2 xl:flex-col xl:items-stretch xl:justify-center">
                    <Button size="sm" className="h-9 flex-1 text-xs" onClick={() => openPanel(team, 'officers')}><UserPlus className="mr-1.5 h-3.5 w-3.5" />Add officer</Button>
                    <Button variant="outline" size="sm" className="h-9 px-2 text-xs xl:w-full" aria-label={`Manage Team ${team.id}`} onClick={() => openPanel(team, 'overview')}><MoreHorizontal className="mr-1.5 h-4 w-4" />Manage</Button>
                  </div>
                </div>
              </CardContent>
            </Card>)}
          </div> : <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center"><Users size={32} className="mb-3 text-muted-foreground" /><p className="text-sm font-semibold">{teams.length ? 'No teams match your search or filters' : 'No teams available'}</p><p className="mt-1 text-xs text-muted-foreground">{teams.length ? 'Try another search, regional manager, city, or field officer.' : 'Create your first team to get started.'}</p>{teams.length > 0 && <Button variant="outline" size="sm" className="mt-4 h-8" onClick={() => setFilters(emptyFilters)}>Clear search and filters</Button>}</div>}
        </CardContent>
      </Card>

      <Sheet open={panelId !== null} onOpenChange={open => { if (!open) closePanel(); }}>
        <SheetContent side="right" className="icon-teams text-sm leading-5 flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b px-5 py-4 pr-12 text-left">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials(panelTeam?.officeManager ?? null) || <User className="h-4 w-4" />}</div><div className="min-w-0"><SheetTitle className="truncate text-base">{personName(panelTeam?.officeManager)}</SheetTitle><SheetDescription>Team #{panelId} · Manage assignments and coverage</SheetDescription></div></div>
          </SheetHeader>
          <div className="grid grid-cols-4 border-b bg-muted/20 px-3 py-2">
            {(['overview', 'managers', 'cities', 'officers'] as const).map(value => <Button key={value} type="button" variant={section === value ? 'secondary' : 'ghost'} aria-pressed={section === value} className="h-8 min-w-0 px-1 text-[11px] leading-5 sm:text-xs" disabled={saving} onClick={() => changeSection(value)}>{value === 'managers' ? <><span className="sm:hidden">{panelTeam && isCoordinator(panelTeam) ? 'Coordinator' : 'Managers'}</span><span className="hidden sm:inline">{panelTeam && isCoordinator(panelTeam) ? 'Coordinator' : 'Regional managers'}</span></> : value[0].toUpperCase() + value.slice(1)}</Button>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto"><div className="space-y-5 p-5">
            {section === 'overview' && panelTeam && <>
              <div className="grid grid-cols-3 gap-3">{[[isCoordinator(panelTeam) ? 'Coordinator' : 'Regional managers', 1], ['Cities', teamCities(panelTeam).length], ['Officers', panelTeam.fieldOfficers.length]].map(([label, count]) => <div key={label} className="rounded-lg border bg-card p-3"><p className="text-[10px] leading-5 font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{count}</p></div>)}</div>
              <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team operations</p>
                {([
                  ['managers', isCoordinator(panelTeam) ? 'Manage coordinator' : 'Manage regional managers', 'Change who owns this team.', Users],
                  ['cities', 'Manage city coverage', 'Assign or remove covered cities.', MapPin],
                  ['officers', 'Manage field officers', 'Add or remove team members.', UserPlus],
                ] as const).map(([key, title, description, Icon]) => <button key={key} type="button" onClick={() => changeSection(key)} className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/35"><span><span className="block text-sm font-semibold">{title}</span><span className="text-xs text-muted-foreground">{description}</span></span><Icon className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}
              </div>
              <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4"><p className="text-sm font-semibold text-destructive">Delete team</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Permanently delete this team. Employees are not deleted.</p><Button variant="destructive" size="sm" className="mt-3" onClick={() => setConfirmation({ title: 'Delete team?', description: `Permanently delete Team #${panelTeam.id}? Employees are not deleted.`, action: async () => { await save(() => API.deleteTeam(panelTeam.id), true); } })}><Trash2 className="mr-2 h-4 w-4" />Delete team</Button></div>
            </>}
            {section === 'managers' && panelTeam && <>
              <div><h3 className="text-sm font-semibold">{teamLeadLabel(panelTeam)} assignment</h3><p className="mt-1 text-xs text-muted-foreground">Select who owns this team. Icon teams have one team lead.</p></div>
              {teamAvps(panelTeam).map(avp => <div key={avp.id} className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">AVP</p><p className="text-sm font-medium">{personName(avp)}</p></div>)}
              <Input aria-label="Search team managers" placeholder="Search regional managers..." value={panelSearch} onChange={event => setPanelSearch(event.target.value)} />
              <div className="space-y-1 rounded-lg border p-2" role="radiogroup" aria-label="Team lead">
                {filteredManagers.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/40"><input type="radio" name="team-lead" className="h-4 w-4 accent-current dark:[color-scheme:dark]" checked={(managerId ?? panelTeam.officeManager?.id) === person.id} onChange={() => setManagerId(person.id)} disabled={saving} /><div className="min-w-0"><p className="truncate text-sm font-medium">{personName(person)}</p><p className="text-xs text-muted-foreground">{teamLeadLabel(panelTeam)}</p></div></label>)}
                {!panelLoading && !panelError && !filteredManagers.length && <p className="p-6 text-center text-sm text-muted-foreground">No regional managers available</p>}
              </div>
              <div className="sticky bottom-0 flex items-center justify-between border-t bg-background py-3"><span className="text-xs text-muted-foreground">1 selected</span><Button disabled={saving || panelLoading || !managerId || managerId === panelTeam.officeManager?.id} onClick={() => { if (managerId) void save(() => API.updateTeamLead(panelTeam.id, managerId)); }}>{saving ? 'Saving...' : 'Save team lead'}</Button></div>
            </>}
            {section === 'cities' && panelTeam && <>
              <div><h3 className="text-sm font-semibold">City coverage</h3><p className="mt-1 text-xs text-muted-foreground">Cities are assigned to the selected {teamLeadLabel(panelTeam).toLowerCase()}.</p></div>
              <div className="space-y-2"><Label className="text-xs">Assigned cities</Label><div className="flex flex-wrap gap-2">{teamCities(panelTeam).map(city => <Badge key={city} variant="secondary" className="gap-1.5 py-1.5 pl-2 pr-1"><Building2 className="h-3.5 w-3.5" />{cityLabel(city)}<Button variant="ghost" size="icon" className="h-5 w-5 rounded-full text-muted-foreground hover:text-destructive" aria-label={`Remove ${cityLabel(city)}`} disabled={saving} onClick={() => setConfirmation({ title: 'Remove city?', description: `Remove ${cityLabel(city)} from ${personName(panelTeam.officeManager)}'s coverage?`, action: async () => { await save(() => request(`/employee/removeCity?id=${panelTeam.officeManager?.id}&city=${encodeURIComponent(city)}`, 'PUT')); } })}><X className="h-3 w-3" /></Button></Badge>)}{!teamCities(panelTeam).length && <p className="w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No cities assigned</p>}</div></div>
              <div className="space-y-2 border-t pt-4"><Label>Add cities</Label><TeamCityPicker cities={cities.filter(city => !teamCities(panelTeam).some(assigned => cityKey(assigned) === cityKey(city)))} selected={selectedCities} onChange={setSelectedCities} disabled={panelLoading || saving} />
                {selectedCities.length > 0 && <div className="flex flex-wrap gap-2">{selectedCities.map(city => <Badge key={city} variant="outline">{cityLabel(city)}<Button variant="ghost" size="icon" className="ml-1 h-5 w-5" aria-label={`Unselect ${cityLabel(city)}`} onClick={() => setSelectedCities(current => current.filter(item => item !== city))}><X className="h-3 w-3" /></Button></Badge>)}</div>}
                <Button className="w-full" disabled={!selectedCities.length || saving || !panelTeam.officeManager} onClick={() => void save(async () => { for (const city of selectedCities) { await request(`/employee/assignCity?id=${panelTeam.officeManager?.id}&city=${encodeURIComponent(city)}`, 'PUT'); setSelectedCities(current => current.filter(item => item !== city)); } })}>{saving ? 'Assigning...' : 'Assign selected cities'}</Button>
              </div>
            </>}
            {section === 'officers' && panelTeam && <>
              <div><h3 className="text-sm font-semibold">Field officers</h3><p className="mt-1 text-xs text-muted-foreground">Review current members or add eligible officers.</p></div>
              <div className="space-y-2"><Label className="text-xs">Assigned · {panelTeam.fieldOfficers.length}</Label>{panelTeam.fieldOfficers.map(person => <div key={person.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{personName(person)}</p><p className="text-xs text-muted-foreground">Field Officer</p></div><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Remove ${personName(person)}`} disabled={saving} onClick={() => setConfirmation({ title: 'Remove field officer?', description: `Remove ${personName(person)} from this team? This will not delete the employee.`, action: async () => { await save(() => API.removeTeamFieldOfficers(panelTeam.id, [person.id])); } })}><X className="h-4 w-4" /></Button></div>)}{!panelTeam.fieldOfficers.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No field officers assigned</p>}</div>
              <div className="space-y-2 border-t pt-4"><Label className="text-xs">Eligible officers</Label><Input aria-label="Search eligible officers" placeholder="Search field officers..." value={panelSearch} onChange={event => setPanelSearch(event.target.value)} /><div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">{filteredOfficers.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40"><Checkbox checked={selectedOfficers.includes(person.id)} disabled={saving} onCheckedChange={checked => setSelectedOfficers(current => checked ? [...new Set([...current, person.id])] : current.filter(id => id !== person.id))} /><div className="min-w-0"><p className="truncate text-sm font-medium">{personName(person)}</p><p className="text-xs text-muted-foreground">Field Officer</p></div></label>)}{!panelLoading && !panelError && !filteredOfficers.length && <p className="p-6 text-center text-sm text-muted-foreground">No eligible officers available</p>}</div><Button className="w-full" disabled={!selectedOfficers.length || saving || panelLoading} onClick={() => void save(() => API.addTeamFieldOfficers(panelTeam.id, selectedOfficers))}>{saving ? 'Adding...' : `Add selected officers${selectedOfficers.length ? ` (${selectedOfficers.length})` : ''}`}</Button></div>
            </>}
            {panelLoading && <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div>}
            {panelError && <div role="alert" className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><p>{panelError}</p>{!saving && <Button size="sm" variant="outline" onClick={() => { if (panelTeam) void loadSection(panelTeam, section); }}>Try Again</Button>}</div>}
          </div></div>
        </SheetContent>
      </Sheet>
      <Dialog open={!!confirmation} onOpenChange={open => { if (!open && !saving) setConfirmation(null); }}><DialogContent className="icon-teams text-sm leading-5"><DialogHeader><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription></DialogHeader>{panelError && <p role="alert" className="text-sm text-destructive">{panelError}</p>}<DialogFooter><Button variant="outline" disabled={saving} onClick={() => setConfirmation(null)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void confirmation?.action()}>{saving ? 'Saving...' : 'Confirm'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
