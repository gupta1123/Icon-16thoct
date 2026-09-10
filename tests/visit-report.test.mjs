import test from 'node:test';
import assert from 'node:assert/strict';
import { getReportDateRange, summarizeCustomerTypes, normalizeEmployeeRole, fetchReportJson, REPORT_API_BASE } from '../lib/visit-report.ts';

test('rolling report ranges include today and cross month/year boundaries', () => {
  const today = new Date(2026, 0, 3);
  assert.deepEqual(getReportDateRange('last-7-days', today), { startDate: '2025-12-28', endDate: '2026-01-03' });
  assert.deepEqual(getReportDateRange('last-15-days', today), { startDate: '2025-12-20', endDate: '2026-01-03' });
  assert.deepEqual(getReportDateRange('last-30-days', today), { startDate: '2025-12-05', endDate: '2026-01-03' });
});

test('weeks start Monday including on Sunday and last week is the previous full week', () => {
  assert.deepEqual(getReportDateRange('this-week', new Date(2026, 8, 6)), { startDate: '2026-08-31', endDate: '2026-09-06' });
  assert.deepEqual(getReportDateRange('last-week', new Date(2026, 8, 6)), { startDate: '2026-08-24', endDate: '2026-08-30' });
  assert.deepEqual(getReportDateRange('last-week', new Date(2026, 8, 7)), { startDate: '2026-08-31', endDate: '2026-09-06' });
});

test('calendar month presets handle leap years and custom clears both dates', () => {
  assert.deepEqual(getReportDateRange('last-month', new Date(2024, 2, 4)), { startDate: '2024-02-01', endDate: '2024-02-29' });
  assert.deepEqual(getReportDateRange('this-month', new Date(2026, 8, 3)), { startDate: '2026-09-01', endDate: '2026-09-03' });
  assert.deepEqual(getReportDateRange('custom'), { startDate: '', endDate: '' });
});

test('Icon customer aliases retain their totals and normalized detail query types', () => {
  const result = summarizeCustomerTypes({ Shop: 2, DEALER: '3', ' Engineer ': 4, Contractor: 1, 'Site Visit / Project': 7, 'shop ': 1 });
  assert.deepEqual(result.counts, { dealer: 6, professional: 5, siteVisit: 7 });
  assert.deepEqual(result.rawGroups, { dealer: ['shop', 'dealer'], professional: ['engineer', 'contractor'], siteVisit: ['site visit/project'] });
  assert.deepEqual(summarizeCustomerTypes({}).counts, { dealer: 0, professional: 0, siteVisit: 0 });
});

test('report roles preserve Icon normalization', () => {
  assert.equal(normalizeEmployeeRole('ROLE_REGIONAL_MANAGER'), 'REGIONAL MANAGER');
  assert.equal(normalizeEmployeeRole(' Field   Officer '), 'FIELD OFFICER');
});

test('requests preserve the Icon endpoint, bearer authentication, and cancellation signal', async t => {
  const request = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, REPORT_API_BASE + '/visit/field-officer-stats?employeeId=42');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.signal, request.signal);
    return Response.json({ totalVisits: 12 });
  });
  assert.deepEqual(await fetchReportJson('/visit/field-officer-stats?employeeId=42', 'test-token', request.signal), { totalVisits: 12 });
});

test('403 is not retried or bypassed and server error bodies are not exposed', async t => {
  const mocked = t.mock.method(globalThis, 'fetch', async () => new Response('<html>internal error body</html>', { status: 403 }));
  await assert.rejects(fetchReportJson('/visit/field-officer-stats', 'test-token', new AbortController().signal), /permission/);
  assert.equal(mocked.mock.callCount(), 1);
});

test('an aborted request remains aborted instead of being retried', async t => {
  const mocked = t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('Aborted', 'AbortError'); });
  await assert.rejects(fetchReportJson('/visit/field-officer-stats', 'test-token', new AbortController().signal), { name: 'AbortError' });
  assert.equal(mocked.mock.callCount(), 1);
});
