import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyEmployeeDraft, employeeCreatePayload, employeeDraftErrors, generateEmployeePassword, saveEmployeeDraft, suggestEmployeeId, suggestUsername } from '../lib/employee-create.ts';

const valid = { ...emptyEmployeeDraft, employeeId: 'EMP-003', firstName: 'Test', lastName: 'Person', primaryContact: '9876543210', role: 'Regional Manager', userName: 'test_person', password: 'ExampleOnly@9' };
const progress = () => ({ created: false, assignedCities: [] });

test('ID suggestions continue the business series including archived IDs, not database IDs', () => {
  assert.equal(suggestEmployeeId([{ id: 9000, employeeId: 'EMP-001' }, { employeeId: 'EMP-002' }, { employeeId: 'TEMP-900' }]), 'EMP-003');
  assert.equal(suggestEmployeeId([]), 'EMP-001');
  assert.equal(suggestEmployeeId([{ employeeId: '99999999999999999999' }]), '100000000000000000000');
});
test('suggested usernames normalize names and generated passwords use secure random values', () => {
  assert.equal(suggestUsername(' Test ', 'Person Smith'), 'test_person_smith');
  assert.equal(generateEmployeePassword().length, 14);
  assert.notEqual(generateEmployeePassword(), generateEmployeePassword());
});
test('optional invalid phone and pincode prevent submission', () => {
  assert.deepEqual(employeeDraftErrors(valid), {});
  assert.ok(employeeDraftErrors({ ...valid, secondaryContact: '12' }).secondaryContact);
  assert.ok(employeeDraftErrors({ ...valid, primaryContact: '0000000000' }).primaryContact);
  assert.ok(employeeDraftErrors({ ...valid, pincode: '123' }).pincode);
  assert.ok(employeeDraftErrors({ ...valid, role: 'Admin' }).role);
});
test('payload retains Icon role and string contact contract with separate account credentials', () => {
  const payload = employeeCreatePayload(valid);
  assert.equal(payload.employee.role, 'Regional Manager');
  assert.equal(payload.employee.primaryContact, '9876543210');
  assert.equal(payload.employee.employeeId, 'EMP-003');
  assert.equal(payload.user.username, 'test_person');
  assert.equal('password' in payload.employee, false);
});
test('duplicate employee IDs or usernames do not submit a create request', async () => {
  for (const record of [{ employeeId: ' emp-003 ' }, { userDto: { username: 'TEST_PERSON' } }]) {
    let calls = 0;
    await assert.rejects(saveEmployeeDraft(valid, [], progress(), { list: async () => [record], create: async () => calls++, assignCity: async () => {} }), /already used/);
    assert.equal(calls, 0);
  }
});
test('a city failure retries assignments without creating another employee or reassigning successful cities', async () => {
  let creates = 0;
  let fail = true;
  const assignments = [];
  const state = progress();
  const service = { list: async () => creates ? [{ id: 23, userName: 'test_person' }] : [], create: async () => { creates++; }, assignCity: async (id, city) => { assert.equal(id, 23); if (city === 'Pune' && fail) throw new Error('assignment failed'); assignments.push(city); } };
  await assert.rejects(saveEmployeeDraft({ ...valid, role: 'Field Officer' }, ['Surat', 'Pune'], state, service), /assignment failed/);
  fail = false;
  await saveEmployeeDraft({ ...valid, role: 'Field Officer' }, ['Surat', 'Pune'], state, service);
  assert.equal(creates, 1);
  assert.deepEqual(assignments, ['Surat', 'Pune']);
});
test('unresolved created employee retries lookup only, and non-field roles ignore hidden city selection', async () => {
  let creates = 0;
  const state = progress();
  const service = { list: async () => [], create: async () => { creates++; }, assignCity: async () => assert.fail('unexpected assignment') };
  await assert.rejects(saveEmployeeDraft({ ...valid, role: 'Field Officer' }, ['Pune'], state, service), /not available yet/);
  await assert.rejects(saveEmployeeDraft({ ...valid, role: 'Field Officer' }, ['Pune'], state, service), /not available yet/);
  assert.equal(creates, 1);
  await saveEmployeeDraft(valid, ['Pune'], progress(), service);
  assert.equal(creates, 2);
});
