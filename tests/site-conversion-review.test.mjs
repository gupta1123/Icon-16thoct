import test from 'node:test';
import assert from 'node:assert/strict';
import { API } from '../lib/api.ts';
import { approvalQuantityError } from '../lib/site-conversion-review.ts';

test('approval quantity permits partial and full approval and rejects invalid values', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '0', '1000.1']) {
    assert.ok(approvalQuantityError(value, 1000), value);
  }
  assert.equal(approvalQuantityError('800', 1000), null);
  assert.equal(approvalQuantityError('1000', 1000), null);
  assert.equal(approvalQuantityError('0.25', 1), null);
});

test('conversion review sends an automatic approval reason and the entered rejection reason and accepts sparse rejection responses', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => new Response(JSON.stringify(
    String(url).endsWith('/approve')
      ? { id: 1, status: 'APPROVED', approvedSteelMt: 800 }
      : { id: 2, status: 'REJECTED', approvalReason: 'Could not verify' },
  ), { headers: { 'Content-Type': 'application/json' } }));
  const approved = await API.approveSiteConversion(1, 800);
  const rejected = await API.rejectSiteConversion(2, 'Could not verify');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(rejected.status, 'REJECTED');
  const [approveUrl, approveOptions] = fetch.mock.calls[0].arguments;
  const [rejectUrl, rejectOptions] = fetch.mock.calls[1].arguments;
  assert.equal(new URL(approveUrl).pathname, '/site-conversions/1/approve');
  assert.equal(approveOptions.method, 'PATCH');
  assert.deepEqual(JSON.parse(approveOptions.body), { approvedSteelMt: 800, reason: 'Approved' });
  assert.equal(new URL(rejectUrl).pathname, '/site-conversions/2/reject');
  assert.equal(rejectOptions.method, 'PATCH');
  assert.deepEqual(JSON.parse(rejectOptions.body), { reason: 'Could not verify' });
});

test('pending conversions use the admin queue endpoint and pass cancellation', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('[]', {
    headers: { 'Content-Type': 'application/json' },
  }));
  const controller = new AbortController();
  assert.deepEqual(await API.getPendingSiteConversions(controller.signal), []);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/site-conversions/pending');
  assert.equal(options.signal, controller.signal);
});

test('employee conversion report sends dates and explicit status filters', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('[]', {
    headers: { 'Content-Type': 'application/json' },
  }));
  await API.getSiteConversionSales({
    startDate: '2026-11-01', endDate: '2026-11-05', status: 'REJECTED', employeeId: 2,
  });
  const [url] = fetch.mock.calls[0].arguments;
  const parsed = new URL(url);
  assert.equal(parsed.pathname, '/site-conversions/sales');
  assert.deepEqual(Object.fromEntries(parsed.searchParams), {
    startDate: '2026-11-01', endDate: '2026-11-05', status: 'REJECTED', employeeId: '2',
  });
});

test('history preserves server pagination and supports repeated employee filters', async t => {
  t.mock.method(console, 'log', () => {});
  const response = { content: [{ id: 4, status: 'REJECTED' }], totalElements: 21, totalPages: 3, number: 2, last: true };
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  }));
  const controller = new AbortController();
  assert.deepEqual(await API.getSiteConversionHistory({
    startDate: '2026-11-01', endDate: '2026-11-05', status: 'REJECTED',
    employeeIds: [2, 5], brand: 'ICON', dealerName: 'ABC & Sons', page: 2, size: 10, signal: controller.signal,
  }), response);
  const [url, options] = fetch.mock.calls[0].arguments;
  const parsed = new URL(url);
  assert.equal(parsed.pathname, '/site-conversions/history');
  assert.deepEqual(parsed.searchParams.getAll('employeeIds'), ['2', '5']);
  assert.equal(parsed.searchParams.get('dealerName'), 'ABC & Sons');
  assert.equal(parsed.searchParams.get('page'), '2');
  assert.equal(parsed.searchParams.get('size'), '10');
  assert.equal(options.signal, controller.signal);
});

test('reviewed history reads all approved and rejected pages, excludes pending, deduplicates and sorts by review date', async t => {
  t.mock.method(console, 'log', () => {});
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url).searchParams;
    const status = params.get('status');
    const page = Number(params.get('page'));
    const content = status === 'REJECTED'
      ? [{ id: 3, status, approvedAt: '2026-11-05' }]
      : page === 0
        ? [{ id: 1, status, approvedAt: '2026-11-03' }]
        : [{ id: 1, status, approvedAt: '2026-11-03' }, { id: 2, status, approvedAt: '2026-11-04' }, { id: 9, status: 'PENDING' }];
    return new Response(JSON.stringify({ content, number: page, totalPages: status === 'APPROVED' ? 2 : 1, last: status === 'REJECTED' || page === 1 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const rows = await API.getReviewedSiteConversions({ startDate: '2026-11-01', endDate: '2026-11-05' });
  assert.deepEqual(rows.map(row => row.id), [3, 2, 1]);
  assert.equal(fetch.mock.callCount(), 3);
  for (const call of fetch.mock.calls) {
    const params = new URL(call.arguments[0]).searchParams;
    assert.equal(params.get('startDate'), '2026-11-01');
    assert.equal(params.get('endDate'), '2026-11-05');
    assert.equal(params.get('size'), '50');
  }
});

test('history does not present incomplete results if a later page fails', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url).searchParams;
    if (params.get('page') === '1') return new Response('History unavailable', { status: 500 });
    return new Response(JSON.stringify({ content: [], totalPages: 2, last: params.get('status') === 'REJECTED' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  await assert.rejects(API.getReviewedSiteConversions({ startDate: '2026-11-01', endDate: '2026-11-05' }));
});
