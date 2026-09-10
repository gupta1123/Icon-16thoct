import test from 'node:test';
import assert from 'node:assert/strict';
import { API } from '../lib/api.ts';

const visits = [
  { id: 2, visit_date: '2026-08-01' },
  { id: 5, visit_date: '2026-09-03' },
  { id: 1, visit_date: '2026-07-01' },
  { id: 3, visit_date: '2026-09-01' },
  { id: 4, visit_date: '2026-09-03' },
];

function mockRequest(t, payload = visits, status = 200) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  return t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(payload), {
    status, statusText: status === 403 ? 'Forbidden' : status === 401 ? 'Unauthorized' : 'OK',
    headers: { 'Content-Type': 'application/json' },
  }));
}

test('customer pagination uses only Icon getByStore, sorting newest visits before slicing', async t => {
  const request = mockRequest(t);
  const page = await API.getVisitsByStorePaged(1416, 0, 2);
  assert.deepEqual(page.content.map(visit => visit.id), [5, 4]);
  assert.equal(page.totalElements, 5);
  assert.equal(page.totalPages, 3);
  assert.equal(request.mock.callCount(), 1);
  const url = new URL(request.mock.calls[0].arguments[0]);
  assert.equal(url.pathname, '/visit/getByStore');
  assert.equal(url.search, '?id=1416');
  assert.deepEqual(visits.map(visit => visit.id), [2, 5, 1, 3, 4]);
});

test('later pages retain full totals and deterministic ordering', async t => {
  mockRequest(t);
  const page = await API.getVisitsByStorePaged(1416, 1, 2);
  assert.deepEqual(page.content.map(visit => visit.id), [3, 2]);
  assert.equal(page.totalElements, 5);
  assert.equal(page.totalPages, 3);
});

test('ascending visit dates and ID ordering are honored', async t => {
  mockRequest(t);
  assert.deepEqual((await API.getVisitsByStorePaged(1416, 0, 2, 'visitDate,asc')).content.map(v => v.id), [1, 2]);
  assert.deepEqual((await API.getVisitsByStorePaged(1416, 0, 2, 'id,desc')).content.map(v => v.id), [5, 4]);
});

test('empty results return a valid empty page', async t => {
  mockRequest(t, []);
  assert.deepEqual(await API.getVisitsByStorePaged(1416), { content: [], totalPages: 1, totalElements: 0 });
});

test('invalid pagination arguments cannot divide by zero or use negative slices', async t => {
  mockRequest(t);
  const page = await API.getVisitsByStorePaged(1416, -2, 0);
  assert.equal(page.content.length, 5);
  assert.equal(page.totalPages, 1);
});

for (const status of [401, 403]) {
  test(`real ${status} responses are propagated without an alternate endpoint retry`, async t => {
    const request = mockRequest(t, { message: 'Not permitted' }, status);
    await assert.rejects(API.getVisitsByStorePaged(1416), new RegExp(String(status)));
    assert.equal(request.mock.callCount(), 1);
  });
}

test('malformed success responses do not masquerade as no visits', async t => {
  mockRequest(t, { message: 'Unexpected response' });
  await assert.rejects(API.getVisitsByStorePaged(1416), /Invalid customer visits response/);
});

test('invalid customer IDs are rejected before making a request', async t => {
  const request = mockRequest(t);
  await assert.rejects(API.getVisitsByStorePaged(NaN), /valid customer ID/);
  assert.equal(request.mock.callCount(), 0);
});
