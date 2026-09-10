import type { EmployeeDto, TeamHierarchyTransformedTeam } from './api';

export type SettingsTeam = TeamHierarchyTransformedTeam;
export const personName = (person?: Pick<EmployeeDto, 'id' | 'firstName' | 'lastName'> | null) =>
  person ? [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || `Employee ${person.id}` : 'Unassigned';
export const roleKey = (role?: string | null) => (role ?? '').trim().toUpperCase().replace(/^ROLE_/, '').replace(/[\s-]+/g, '_');
export const cityKey = (city: string) => city.trim().toLowerCase();
export const cityLabel = (city: string) => city.trim().toLowerCase().replace(/\b\p{L}/gu, letter => letter.toUpperCase());
export const teamCities = (team: SettingsTeam) => [...new Map((team.officeManager?.assignedCity ?? []).filter(Boolean).map(city => [cityKey(city), city.trim()])).values()];
export const isCoordinator = (team: SettingsTeam) => team.teamType === 'COORDINATOR_TEAM' || roleKey(team.officeManager?.role) === 'COORDINATOR';
export const teamLeadLabel = (team: SettingsTeam) => isCoordinator(team) ? 'Coordinator' : 'Regional Manager';
export const teamAvps = (team: SettingsTeam): EmployeeDto[] => {
  const values = Array.isArray(team.avp) ? team.avp : [team.avp];
  return values.filter((person): person is EmployeeDto => !!person && typeof person === 'object' && typeof person.id === 'number');
};
export function filterTeams(teams: SettingsTeam[], filters: { search: string; manager: string; city: string; officer: string }) {
  const query = filters.search.trim().toLowerCase();
  return teams.filter(team => {
    const people = [team.officeManager, ...teamAvps(team)].filter(Boolean);
    return (!filters.manager || people.some(person => String(person?.id) === filters.manager))
      && (!filters.city || teamCities(team).some(city => cityKey(city) === cityKey(filters.city)))
      && (!filters.officer || team.fieldOfficers.some(person => String(person.id) === filters.officer))
      && (!query || [String(team.id), `team #${team.id}`, teamLeadLabel(team), teamAvps(team).length ? 'AVP' : '', ...people.map(personName), ...teamCities(team), ...team.fieldOfficers.map(personName)].join(' ').toLowerCase().includes(query));
  }).sort((a, b) => personName(a.officeManager).localeCompare(personName(b.officeManager)) || a.id - b.id);
}

// Identity is the team ID, not the manager ID: a manager can own several teams.
export function eligibleOfficers(candidates: EmployeeDto[], team: SettingsTeam, teams: SettingsTeam[]) {
  const excluded = new Set(teams.filter(other => other.id === team.id || isCoordinator(other) === isCoordinator(team)).flatMap(other => other.fieldOfficers.map(person => person.id)));
  return [...new Map(candidates.filter(person => roleKey(person.role) === 'FIELD_OFFICER' && !excluded.has(person.id)).map(person => [person.id, person])).values()]
    .sort((a, b) => personName(a).localeCompare(personName(b)));
}
