import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { API } from '../lib/api.ts';

test('approval filters use the requested paginated endpoint and parameters', async t => {
  t.mock.method(console, 'log', () => {});
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    content: [], page: 2, size: 25, totalElements: 0, totalPages: 1, first: false, last: true, empty: true,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  await new API().getAttendanceRequestsByFiltersPaginated({
    status: 'pending', startDate: '2026-07-01', endDate: '2026-08-10', employeeName: 'Asha Rao',
  }, 2, 25, 'requestDate', 'desc');

  assert.equal(request.mock.callCount(), 1);
  const url = new URL(request.mock.calls[0].arguments[0]);
  assert.equal(url.pathname, '/request/getByFiltersPaginated');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    status: 'pending', startDate: '2026-07-01', endDate: '2026-08-10', employeeName: 'Asha Rao',
    page: '2', size: '25', sortBy: 'requestDate', sortDir: 'desc',
  });
});

test('approvals page wires server pagination, date range validation and stale-response protection', () => {
  const page = readFileSync(new URL('../app/dashboard/approvals/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /getAttendanceRequestsByFiltersPaginated/);
  assert.match(page, /formattedStartDate/);
  assert.match(page, /formattedEndDate/);
  assert.match(page, /requestSequence/);
  assert.match(page, /DateRangeError/);
  assert.match(page, /Page \{currentPage \+ 1\} of \{totalPages\}/);
});
