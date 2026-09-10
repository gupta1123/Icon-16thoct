import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeVisitPurposes } from '../lib/visit-purpose-summary.ts';

test('distinct nonblank purpose labels remain separate chart bars', () => {
  assert.deepEqual(summarizeVisitPurposes([{ purpose: 'Follow Up', count: 4 }, { purpose: 'follow-up', count: 2 }]), [
    { purpose: 'Follow Up', visits: 4 }, { purpose: 'follow-up', visits: 2 },
  ]);
});

test('purpose summary preserves API labels and counts while grouping blanks', () => {
  const result = summarizeVisitPurposes([
    { purpose: ' FIRST_VISIT ', count: 2 }, { purpose: 'First Visit', count: 1 },
    { purpose: 'monthly-visit', count: 2 }, { purpose: 'Order', count: 5 },
    { purpose: 'Smoke Matrix Visit 20260812', count: 4 },
    { purpose: 'Others', count: 1 }, { purpose: null, count: 1 },
  ]);
  assert.deepEqual(result, [
    { purpose: 'Order', visits: 5 }, { purpose: 'Smoke Matrix Visit 20260812', visits: 4 },
    { purpose: 'FIRST_VISIT', visits: 2 }, { purpose: 'monthly-visit', visits: 2 },
    { purpose: 'First Visit', visits: 1 }, { purpose: 'Others', visits: 1 },
    { purpose: 'Unspecified', visits: 1 },
  ]);
  assert.equal(result.reduce((sum, row) => sum + row.visits, 0), 16);
});

test('empty and invalid counts do not render phantom bars; all-custom data stays visible', () => {
  assert.deepEqual(summarizeVisitPurposes([]), []);
  assert.deepEqual(summarizeVisitPurposes([{ purpose: 'Order', count: NaN }, { purpose: 'Order', count: -1 }, { purpose: 'Order', count: 0 }]), []);
  assert.deepEqual(summarizeVisitPurposes([{ purpose: 'Custom', count: 2 }]), [{ purpose: 'Custom', visits: 2 }]);
});
