import test from 'node:test';
import assert from 'node:assert/strict';
import { API } from '../lib/api.ts';

test('visit date pagination requests a unique tie-breaker as a separate sort parameter', async t => {
  t.mock.method(console, 'log', () => {});
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ content: [], totalPages: 0, totalElements: 0 }),
    { headers: { 'Content-Type': 'application/json' } },
  ));

  await API.getVisitsByDateSorted('2026-11-01', '2026-11-16', 1, 200, 'visitDate,desc', ' Sanjay & Sons ');

  const url = new URL(request.mock.calls[0].arguments[0]);
  assert.equal(url.pathname, '/visit/getByDateSorted');
  assert.deepEqual(url.searchParams.getAll('sort'), ['visitDate,desc', 'id,desc']);
  assert.equal(url.searchParams.get('page'), '1');
  assert.equal(url.searchParams.get('storeName'), 'Sanjay & Sons');
});
