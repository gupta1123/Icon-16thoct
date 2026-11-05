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
