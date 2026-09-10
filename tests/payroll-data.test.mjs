import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPayrollRows, canExportPayroll, settlePayrollUpdates, getPayrollQueryState } from '../lib/payroll-data.ts';

const request = { url: 'https://example.test/payroll?startDate=2026-09-01&endDate=2026-09-30', token: 'test-token' };
const neverUntilAborted = signal => new Promise((resolve, reject) => {
  if (signal.aborted) reject(signal.reason);
  else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});

test('payroll loads the exact authenticated endpoint and accepts empty results', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, request.url);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json([]);
  });
  assert.deepEqual(await fetchPayrollRows(request, new AbortController().signal), []);
});

test('hanging response headers time out and stop the underlying fetch', async t => {
  let sentSignal;
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => {
    sentSignal = signal;
    return neverUntilAborted(signal);
  });
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal, 10), /took too long/);
  assert.equal(sentSignal.aborted, true);
});

test('hanging JSON body also times out', async t => {
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => ({ ok: true, json: () => neverUntilAborted(signal) }));
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal, 10), /took too long/);
});

test('filter/reset cancellation aborts the request without automatic retries', async t => {
  const controller = new AbortController();
  const mock = t.mock.method(globalThis, 'fetch', async (_, { signal }) => neverUntilAborted(signal));
  const pending = fetchPayrollRows(request, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(mock.mock.callCount(), 1);
});

test('permission failures surface clearly without retrying or exposing server bodies', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('private backend detail', { status: 403 }));
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal), /permission/);
  assert.equal(mock.mock.callCount(), 1);
  mock.mock.mockImplementation(async () => new Response(null, { status: 401 }));
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal), /session has expired/);
  mock.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal), /503/);
});

test('invalid payroll payloads are not treated as successful empty data', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'bad data' }));
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal), /invalid result/);
  mock.mock.mockImplementation(async () => Response.json([null]));
  await assert.rejects(fetchPayrollRows(request, new AbortController().signal), /invalid result/);
});

test('Export requires successful current data, never loading, failed, stale, or empty data', () => {
  assert.equal(canExportPayroll(true, false, null, 2), true);
  assert.equal(canExportPayroll(true, true, null, 2), false);
  assert.equal(canExportPayroll(false, false, null, 2), false);
  assert.equal(canExportPayroll(true, false, 'timeout', 2), false);
  assert.equal(canExportPayroll(true, false, null, 0), false);
});

test('status success always refreshes server-calculated salary totals', async () => {
  let refreshed = 0;
  await settlePayrollUpdates([Promise.resolve(), Promise.resolve()], () => refreshed++);
  assert.equal(refreshed, 1);
});

test('changed or invalid filters never expose old rows or allow Export', () => {
  const completed = { request, data: [{ employeeId: 1 }], error: null };
  const nextRequest = { ...request, url: request.url + '&employeeId=2' };
  assert.deepEqual(getPayrollQueryState(nextRequest, completed), { data: [], error: null, loading: true, loaded: false });
  assert.deepEqual(getPayrollQueryState(null, completed), { data: [], error: null, loading: false, loaded: false });
  assert.equal(getPayrollQueryState(request, completed).loaded, true);
});

test('Retry on the same URL is a new request; stale success/errors cannot end its loading state', () => {
  const retry = { ...request };
  const oldSuccess = { request, data: [{ employeeId: 1 }], error: null };
  const oldError = { request, data: [], error: 'timed out' };
  assert.equal(getPayrollQueryState(retry, oldSuccess).loading, true);
  assert.equal(getPayrollQueryState(retry, oldError).error, null);
  const failure = getPayrollQueryState(retry, { request: retry, data: [], error: 'timed out' });
  assert.equal(failure.loading, false);
  assert.equal(failure.loaded, false);
});

test('a partially failed batch waits for remaining writes before refreshing once', async () => {
  let finishSecond;
  let refreshed = 0;
  const second = new Promise(resolve => { finishSecond = resolve; });
  const pending = settlePayrollUpdates([Promise.reject(new Error('failed')), second], () => refreshed++);
  const assertion = assert.rejects(pending, /1 of 2 status updates failed/);
  await Promise.resolve();
  assert.equal(refreshed, 0);
  finishSecond();
  await assertion;
  assert.equal(refreshed, 1);
});
