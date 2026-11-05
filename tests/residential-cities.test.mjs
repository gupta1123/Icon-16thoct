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

test('residential states preserve API IDs and all returned states', async t => {
  t.mock.method(console, 'log', () => {});
  const states = [{ id: 21, stateName: 'Maharashtra' }, { id: 9, stateName: 'Delhi' }];
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(states), {
    headers: { 'Content-Type': 'application/json' },
  }));
  const controller = new AbortController();
  assert.deepEqual(await API.getResidentialStates(controller.signal), states);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/location/states');
  assert.equal(options.signal, controller.signal);
});

test('residential cities are scoped by state ID, use only city records, and deduplicate names', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([
    { id: 370, districtName: 'Mumbai', stateId: 21, cities: [
      { cityName: ' Juhu ' }, { cityName: 'Andheri' }, { cityName: 'juhu' }, { cityName: '' },
    ] },
    { id: 371, districtName: 'Pune', stateId: 21, cities: [{ cityName: 'Pune' }] },
    { id: 17, districtName: 'Mysuru', stateId: 16, cities: [{ cityName: 'Mysuru' }] },
    { id: 372, districtName: 'Thane', stateId: 21, cities: [] },
  ]), { headers: { 'Content-Type': 'application/json' } }));
  const controller = new AbortController();
  assert.deepEqual(await API.getResidentialCitiesByState(21, controller.signal), ['Andheri', 'Juhu', 'Pune']);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname + new URL(url).search, '/location/districts?stateId=21');
  assert.equal(options.signal, controller.signal);
  assert.equal(fetch.mock.callCount(), 1, 'embedded city data avoids redundant hierarchy requests');
});

test('selecting another state issues its own ID-scoped city request', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    const stateId = Number(new URL(url).searchParams.get('stateId'));
    const cityName = stateId === 11 ? 'Surat' : 'Indore';
    return new Response(JSON.stringify([{ stateId, cities: [{ cityName }] }]), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  assert.deepEqual(await API.getResidentialCitiesByState(11), ['Surat']);
  assert.deepEqual(await API.getResidentialCitiesByState(20), ['Indore']);
  assert.equal(new URL(fetch.mock.calls[1].arguments[0]).searchParams.get('stateId'), '20');
});

test('missing embedded city lists use the state to district to subdistrict to city hierarchy', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    const path = new URL(url).pathname;
    const data = path.endsWith('/districts') ? [{ id: 371, stateId: 21 }]
      : path.endsWith('/subDistricts') ? [{ id: 4044, districtId: 371 }, { id: 999, districtId: 99 }]
      : [{ cityName: 'Amade', subDistrictId: 4044 }, { cityName: 'Wrong city', subDistrictId: 999 }];
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  });
  const controller = new AbortController();
  assert.deepEqual(await API.getResidentialCitiesByState(21, controller.signal), ['Amade']);
  assert.deepEqual(fetch.mock.calls.map(call => new URL(call.arguments[0]).pathname + new URL(call.arguments[0]).search), [
    '/location/districts?stateId=21', '/location/subDistricts?districtId=371', '/location/cities?subDistrictId=4044',
  ]);
  assert.ok(fetch.mock.calls.every(call => call.arguments[1].signal === controller.signal));
});

test('a cancelled state selection stops further hierarchy requests', async t => {
  t.mock.method(console, 'log', () => {});
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    controller.abort();
    return new Response(JSON.stringify([{ id: 371, stateId: 21 }]), { headers: { 'Content-Type': 'application/json' } });
  });
  await assert.rejects(API.getResidentialCitiesByState(21, controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});
