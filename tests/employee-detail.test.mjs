import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, getEmployeeVisitRange, fetchEmployeeActivity } from '../lib/employee-detail.ts';

test('employee filters preserve local dates and Sunday-start weeks', () => {
  const now = new Date(2026, 8, 3, 0, 15);
  assert.equal(localDate(now), '2026-09-03');
  assert.deepEqual(getEmployeeVisitRange('today', now), { start: '2026-09-03', end: '2026-09-03' });
  assert.deepEqual(getEmployeeVisitRange('yesterday', now), { start: '2026-09-02', end: '2026-09-02' });
  assert.deepEqual(getEmployeeVisitRange('this-week', now), { start: '2026-08-30', end: '2026-09-03' });
  assert.deepEqual(getEmployeeVisitRange('last-2-days', now), { start: '2026-09-01', end: '2026-09-03' });
});

test('month ranges handle leap years and year boundaries', () => {
  assert.deepEqual(getEmployeeVisitRange('last-month', new Date(2024, 2, 31)), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(getEmployeeVisitRange('last-month', new Date(2026, 0, 1)), { start: '2025-12-01', end: '2025-12-31' });
  assert.deepEqual(getEmployeeVisitRange('this-month', new Date(2026, 8, 3)), { start: '2026-09-01', end: '2026-09-30' });
});

test('activity requests forward authorization and cancellation; forbidden responses are not retried', async (t) => {
  const signal = new AbortController().signal;
  const calls = [];
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify([{ id: 1 }]), { status: 200 });
  });
  assert.deepEqual(await fetchEmployeeActivity('/activity', 'test-token', signal), [{ id: 1 }]);
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  mock.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  await assert.rejects(fetchEmployeeActivity('/activity', 'test-token', signal), /permission/);
  assert.equal(mock.mock.callCount(), 2);
  mock.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  await assert.rejects(fetchEmployeeActivity('/activity', 'test-token', signal), /session has expired/);
});
