import test from 'node:test';
import assert from 'node:assert/strict';
import { API } from '../lib/api.ts';

test('residential cities use the paginated v2 endpoint and normalize the page', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    content: [
      { id: 1, cityName: ' Pune ' },
      { id: 2, cityName: 'Mumbai' },
      { id: 3, cityName: 'pune' },
    ],
    number: 2,
    size: 100,
    totalElements: 245,
    totalPages: 3,
    first: false,
    last: true,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const page = await API.getResidentialCitiesPage(2, 100);
  const [url] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname + new URL(url).search, '/location/allCities/v2?page=2&size=100');
  assert.deepEqual(page, {
    cities: ['Pune', 'Mumbai'],
    page: 2,
    size: 100,
    totalElements: 245,
    totalPages: 3,
    first: false,
    last: true,
  });
});

test('residential city pagination clamps invalid page and oversized requests', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ content: [], totalPages: 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));

  const page = await API.getResidentialCitiesPage(-3, 500);
  const [url] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname + new URL(url).search, '/location/allCities/v2?page=0&size=100');
  assert.equal(page.page, 0);
  assert.equal(page.totalPages, 1);
  assert.equal(page.first, true);
  assert.equal(page.last, true);
});
