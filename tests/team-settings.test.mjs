import test from 'node:test';
import assert from 'node:assert/strict';
import { cityKey, cityLabel, eligibleOfficers, filterTeams, teamAvps, teamCities, teamLeadLabel } from '../lib/team-settings.ts';
import { API, transformTeamHierarchyResponse } from '../lib/api.ts';

const person = (id, name, role = 'FIELD_OFFICER') => ({ id, firstName: name, lastName: '', role });
const team = (id, lead, officers = [], cities = [], type = 'REGIONAL_MANAGER_TEAM') => ({ id, officeManager: { ...lead, assignedCity: cities }, fieldOfficers: officers, teamType: type });
const noFilters = { search: '', manager: '', city: '', officer: '' };

test('hierarchy keeps distinct teams with the same manager and preserves AVP/coordinator relationships', () => {
  const manager = { id: 2, name: 'Manager Two' };
  const data = transformTeamHierarchyResponse({ regionalManagerTeams: [{ teamId: 1, manager, fieldOfficers: [person(3, 'Officer')] }, { teamId: 2, manager }], coordinatorTeams: [{ teamId: 3, manager: { id: 4, name: 'Coordinator', role: 'COORDINATOR' } }], avpTeams: [{ avp: { id: 5, name: 'AVP Five' }, managers: [{ teamId: 1, manager }] }] });
  assert.deepEqual(data.map(row => row.id), [1, 2, 3]);
  assert.equal(teamAvps(data[0])[0].id, 5);
  assert.equal(data[0].fieldOfficers[0].id, 3);
  assert.equal(teamLeadLabel(data[2]), 'Coordinator');
});
test('team search matches cities, officers, IDs and AVP names without mutating the list', () => {
  const a = team(12, person(2, 'Zed'), [person(3, 'Meera')], ['Pune']); a.avp = person(8, 'Priya', 'AVP');
  const b = team(9, person(4, 'Aaron'));
  for (const search of ['PUNE', 'meera', '#12', ' priya ']) assert.deepEqual(filterTeams([a, b], { ...noFilters, search }).map(t => t.id), [12]);
  assert.deepEqual(filterTeams([a, b], noFilters).map(t => t.id), [9, 12]);
  assert.equal(a.officeManager.firstName, 'Zed');
});
test('manager, city and officer filters intersect, including AVP ownership', () => {
  const a = team(1, person(2, 'Lead'), [person(3, 'Officer')], ['PUNE']); a.avp = person(7, 'AVP');
  assert.equal(filterTeams([a], { search: '', manager: '7', city: 'pune', officer: '3' }).length, 1);
  assert.equal(filterTeams([a], { search: '', manager: '7', city: 'mumbai', officer: '3' }).length, 0);
});
test('cities normalize spaces/case and deduplicate without inventing coverage', () => {
  assert.equal(cityKey(' Pune '), 'pune');
  assert.equal(cityLabel('new DELHI'), 'New Delhi');
  assert.deepEqual(teamCities(team(1, person(2, 'Lead'), [], ['Pune', ' pune ', '', 'Mumbai'])), ['pune', 'Mumbai']);
  assert.deepEqual(teamCities({ officeManager: null }), []);
});
test('eligibility uses team ID, excludes same-role team assignments and deduplicates city results', () => {
  const first = team(1, person(2, 'Same Lead'), [person(10, 'Assigned')]);
  const second = team(2, person(2, 'Same Lead'), [person(11, 'Other')]);
  const coord = team(3, person(3, 'Coord'), [person(12, 'Cross-role')], [], 'COORDINATOR_TEAM');
  const candidates = [person(10, 'Assigned'), person(11, 'Other'), person(12, 'Cross-role'), person(13, 'Free'), person(13, 'Free'), person(14, 'Manager', 'MANAGER')];
  assert.deepEqual(eligibleOfficers(candidates, first, [first, second, coord]).map(p => p.id), [12, 13]);
});
test('coordinator eligibility is cross-city but cannot reuse another coordinator membership', () => {
  const coord = team(1, person(2, 'Coord'), [person(10, 'Current')], [], 'COORDINATOR_TEAM');
  const other = team(2, person(3, 'Other'), [person(11, 'Assigned')], [], 'COORDINATOR_TEAM');
  assert.deepEqual(eligibleOfficers([person(10, 'Current'), person(11, 'Assigned'), person(12, 'Available', 'Field Officer')], coord, [coord, other]).map(p => p.id), [12]);
});

for (const [label, invoke, path, method, payload] of [
  ['create', () => API.createTeam({ officeManager: 4, fieldOfficers: [10] }), '/employee/team/create', 'POST', { officeManager: 4, fieldOfficers: [10] }],
  ['change lead', () => API.updateTeamLead(8, 4), '/employee/team/editOfficeManager?id=8', 'PUT', { officeManager: 4 }],
  ['add officers', () => API.addTeamFieldOfficers(8, [10]), '/employee/team/addFieldOfficer?id=8', 'PUT', { fieldOfficers: [10] }],
  ['remove officers', () => API.removeTeamFieldOfficers(8, [10]), '/employee/team/deleteFieldOfficer?id=8', 'DELETE', { fieldOfficers: [10] }],
  ['delete team', () => API.deleteTeam(8), '/employee/team/delete?id=8', 'DELETE', undefined],
]) {
  test(`Icon ${label} API retains its existing endpoint and payload`, async t => {
    t.mock.method(console, 'log', () => {});
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(1), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await invoke();
    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(new URL(url).pathname + new URL(url).search, path);
    assert.equal(options.method, method);
    assert.deepEqual(options.body ? JSON.parse(options.body) : undefined, payload);
    assert.equal(fetch.mock.callCount(), 1);
  });
}
