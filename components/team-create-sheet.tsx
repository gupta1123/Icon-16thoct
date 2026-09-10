"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, UsersRound } from 'lucide-react';
import { API, type EmployeeDto } from '@/lib/api';
import { cityKey, cityLabel, eligibleOfficers, isCoordinator, personName, roleKey, teamAvps, type SettingsTeam } from '@/lib/team-settings';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamCityPicker } from '@/components/team-city-picker';

function Step({ number, title, description, children }: { number: number; title: string; description: string; children: ReactNode }) {
  return <section className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{number}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div>{children}</section>;
}

export function TeamCreateSheet({ teams, onCreated, request }: { teams: SettingsTeam[]; onCreated: () => Promise<void>; request: (path: string, method?: string, body?: unknown) => Promise<Response> }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('regional');
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [lead, setLead] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [officers, setOfficers] = useState<EmployeeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [officersError, setOfficersError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const { requestDiscard, markSaved } = useUnsavedChanges(open && (!!lead || !!selectedCities.length || !!selected.length || !!selectedTeams.length));
  const reset = () => { setLead(null); setSelected([]); setSelectedCities([]); setSelectedTeams([]); setOfficers([]); setError(''); setOfficersError(''); };
  const close = () => { if (!saving) requestDiscard(() => { setOpen(false); reset(); }); };

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError('');
    Promise.all([API.getEmployeeDirectory(), API.getCities()]).then(([people, locations]) => {
      if (!active) return;
      setEmployees(people);
      setCities([...new Map(locations.filter(Boolean).map(city => [cityKey(city), city])).values()].sort((a, b) => a.localeCompare(b)));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load team options.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, retry]);

  useEffect(() => {
    const version = ++requestVersion.current;
    setOfficers([]); setSelected([]); setOfficersError('');
    if (!open || type !== 'regional' || !selectedCities.length) { setOfficersLoading(false); return; }
    setOfficersLoading(true);
    const draft = { id: -1, officeManager: null, fieldOfficers: [], teamType: 'REGIONAL_MANAGER_TEAM' } as SettingsTeam;
    Promise.all(selectedCities.map(async city => {
      const response = await request(`/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`);
      return await response.json() as EmployeeDto[];
    })).then(results => {
      if (version === requestVersion.current) setOfficers(eligibleOfficers(results.flat(), draft, teams));
    }).catch(err => { if (version === requestVersion.current) setOfficersError(err instanceof Error ? err.message : 'Unable to load field officers.'); }).finally(() => { if (version === requestVersion.current) setOfficersLoading(false); });
    return () => { requestVersion.current++; };
  }, [open, type, selectedCities, request, teams]);

  const occupied = new Set(teams.map(team => team.officeManager?.id));
  const managers = employees.filter(person => {
    const role = roleKey(person.role);
    if (type === 'avp') return role === 'AVP';
    return !occupied.has(person.id) && (type === 'coordinator' ? role === 'COORDINATOR' : ['MANAGER', 'OFFICE_MANAGER', 'REGIONAL_MANAGER'].includes(role));
  }).sort((a, b) => personName(a).localeCompare(personName(b)));
  const availableTeams = teams.filter(team => !isCoordinator(team) && !teamAvps(team).length);
  const canSave = !!lead && !loading && !officersLoading && !officersError && !saving && (type === 'avp' ? selectedTeams.length > 0 : type === 'coordinator' || (selectedCities.length > 0 && selected.length > 0));
  const create = async () => {
    if (!canSave || !lead) return;
    setSaving(true); setError('');
    try {
      if (type === 'avp') {
        // Use Icon's existing AVP assignment endpoint and preserve its team-ID contract.
        await request('/employee/team/assignAvpToTeams', 'PUT', { avpId: lead, teamIds: selectedTeams });
      } else {
        for (const city of selectedCities) await request(`/employee/assignCity?id=${lead}&city=${encodeURIComponent(city)}`, 'PUT');
        await API.createTeam({ officeManager: lead, fieldOfficers: type === 'coordinator' ? [] : selected });
      }
      markSaved(); setOpen(false); reset(); await onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to create team. Please try again.'); }
    finally { setSaving(false); }
  };

  return <><Button size="sm" className="gap-2" onClick={() => { reset(); setType('regional'); setOpen(true); }}><UsersRound className="h-4 w-4" />Add team</Button>
    <Sheet open={open} onOpenChange={value => { if (!value) close(); }}><SheetContent side="right" className="icon-teams text-sm leading-5 w-full overflow-y-auto p-0 sm:max-w-xl">
      <SheetHeader className="sticky top-0 z-10 border-b bg-background px-5 py-4 pr-12 text-left"><SheetTitle className="text-lg">Create team</SheetTitle><SheetDescription className="text-xs">Build the team by assigning ownership, coverage, and members.</SheetDescription></SheetHeader>
      <div className="space-y-4 p-5 pb-0">
        <div className="space-y-2"><Label htmlFor="create-team-type" className="text-xs">Team type</Label><Select value={type} onValueChange={value => requestDiscard(() => { reset(); setType(value); })} disabled={saving}><SelectTrigger id="create-team-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regional">Regional Manager</SelectItem><SelectItem value="coordinator">Coordinator</SelectItem><SelectItem value="avp">AVP assignment</SelectItem></SelectContent></Select></div>
        <Step number={1} title={type === 'avp' ? 'AVP' : type === 'coordinator' ? 'Coordinator' : 'Regional managers'} description={type === 'avp' ? 'Choose an AVP to lead existing regional teams.' : 'Choose the team lead who will own and coordinate this team.'}>
          <><div className="h-36 overflow-y-auto rounded-lg border" role="radiogroup" aria-label="New team lead">{loading ? <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading...</div> : managers.length ? <div className="space-y-1 p-2">{managers.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"><input type="radio" className="h-4 w-4 accent-current dark:[color-scheme:dark]" name="new-team-lead" checked={lead === person.id} onChange={() => setLead(person.id)} disabled={saving} /><span className="text-sm">{personName(person)}</span></label>)}</div> : <div className="flex h-full flex-col items-center justify-center px-5 text-center"><UsersRound className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-sm font-medium">No {type === 'coordinator' ? 'coordinators' : type === 'avp' ? 'AVPs' : 'regional managers'} available</p><p className="mt-1 text-xs text-muted-foreground">Every eligible team lead is already assigned to a team.</p></div>}</div>
          {lead && <Badge variant="secondary" className="text-xs">{personName(employees.find(person => person.id === lead))}</Badge>}</>
        </Step>
        {type === 'regional' && <>
          <Step number={2} title="City coverage" description="Select the cities this team will be responsible for."><>{selectedCities.length > 0 && <div className="flex flex-wrap gap-2">{selectedCities.map(city => <Badge key={city} variant="secondary" className="text-xs">{cityLabel(city)}</Badge>)}</div>}<TeamCityPicker cities={cities} selected={selectedCities} onChange={setSelectedCities} disabled={loading || saving} /><p className="text-xs text-muted-foreground">Coverage is saved when the team is created.</p></></Step>
          <Step number={3} title="Field officers" description="Choose eligible officers from the selected cities."><>{!selectedCities.length ? <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/15 px-6 text-center text-sm text-muted-foreground">Select city coverage first to see eligible field officers.</div> : officersLoading ? <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading officers...</div> : <div className="max-h-72 overflow-y-auto">{officers.map(person => <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50"><Checkbox checked={selected.includes(person.id)} disabled={saving} onCheckedChange={checked => setSelected(current => checked ? [...new Set([...current, person.id])] : current.filter(id => id !== person.id))} /><span className="text-sm">{personName(person)}</span></label>)}{!officers.length && <p className="text-sm text-muted-foreground">No eligible officers available</p>}</div>}{officersError && <p role="alert" className="text-sm text-destructive">{officersError}</p>}</></Step>
        </>}
        {type === 'coordinator' && <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Coordinator teams work across cities. Add field officers from the team management panel after creating the team.</div>}
        {type === 'avp' && <Step number={2} title="Regional manager teams" description="Select the teams this AVP will lead."><><div className="max-h-72 overflow-y-auto">{availableTeams.map(team => <label key={team.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50"><Checkbox checked={selectedTeams.includes(team.id)} disabled={saving} onCheckedChange={checked => setSelectedTeams(current => checked ? [...new Set([...current, team.id])] : current.filter(id => id !== team.id))} /><span className="text-sm">{personName(team.officeManager)} · Team #{team.id}</span></label>)}{!availableTeams.length && <p className="text-sm text-muted-foreground">No regional teams available for AVP assignment.</p>}</div></></Step>}
        {error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p>{!employees.length && <Button size="sm" variant="outline" onClick={() => setRetry(value => value + 1)}>Try Again</Button>}</div>}
        <div className="sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur"><p className="text-xs text-muted-foreground">{lead ? 1 : 0} team lead · {type === 'avp' ? `${selectedTeams.length} teams` : `${selectedCities.length} cities · ${selected.length} officers`}</p><div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto"><Button variant="outline" disabled={saving} onClick={close}>Cancel</Button><Button disabled={!canSave} onClick={() => void create()}>{saving ? 'Saving...' : type === 'avp' ? 'Assign AVP' : 'Create team'}</Button></div></div>
      </div>
    </SheetContent></Sheet>
  </>;
}
