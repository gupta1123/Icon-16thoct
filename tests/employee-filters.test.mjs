import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getEmployeeIdentifiers, matchesSelectedEmployee } from '../lib/employee-filter.ts';
import { filterCustomers, sortCustomers } from '../lib/customer-filter.ts';

const directory = [
  { id: 17, employeeId: 'EMP-042', userDto: { employeeId: 42 } },
  { id: 18, employeeId: 'EMP-043', userDto: { employeeId: 43 } },
];

test('employee filters match database, business and nested user identifiers', () => {
  assert.deepEqual([...getEmployeeIdentifiers(directory[0])], ['17', 'EMP-042', '42']);
  assert.equal(matchesSelectedEmployee(17, '17', directory), true);
  assert.equal(matchesSelectedEmployee(42, '17', directory), true);
  assert.equal(matchesSelectedEmployee('EMP-042', '17', directory), true);
  assert.equal(matchesSelectedEmployee(43, '17', directory), false);
});

test('all and empty selections preserve rows while unknown values use direct matching', () => {
  assert.equal(matchesSelectedEmployee(99, 'all', directory), true);
  assert.equal(matchesSelectedEmployee(99, '', directory), true);
  assert.equal(matchesSelectedEmployee(99, '99', directory), true);
});

test('visit and approval lists apply employee filters at the server-backed dataset level', () => {
  const visits = readFileSync(new URL('../components/visits-table.tsx', import.meta.url), 'utf8');
  const approvals = readFileSync(new URL('../app/dashboard/approvals/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(visits, /getVisitsByEmployeeAndDateRange/);
  assert.match(visits, /getEmployeeStatsByDateRange/);
  assert.match(visits, /needsLocalPagination/);
  assert.match(visits, /visitsRequestSequenceRef/);
  assert.doesNotMatch(approvals, /String\(req\.employeeId\) === selectedEmployeeId/);
});

test('team customer filters run against the complete dataset and preserve sorting', () => {
  const filters = {
    storeName: '', primaryContact: '222', ownerName: '', city: 'pune', state: '',
    clientType: '', dealerSubType: '', employeeName: 'asha',
  };
  const customers = [
    { storeId: 2, storeName: 'Beta', city: 'Pune', primaryContact: '222000', employeeName: 'Asha Rao' },
    { storeId: 1, storeName: 'Alpha', city: 'Pune', primaryContact: '222999', employeeName: 'Asha Rao' },
    { storeId: 3, storeName: 'Gamma', city: 'Mumbai', primaryContact: '222111', employeeName: 'Asha Rao' },
  ];

  assert.deepEqual(
    sortCustomers(filterCustomers(customers, filters), 'storeName', 'asc').map((customer) => customer.storeId),
    [1, 2],
  );

  const customerPage = readFileSync(new URL('../app/dashboard/customers/page.tsx', import.meta.url), 'utf8');
  assert.match(customerPage, /firstPage\.totalPages/);
  assert.match(customerPage, /filterCustomers\(uniqueStores, desktopFilters\)/);
});
