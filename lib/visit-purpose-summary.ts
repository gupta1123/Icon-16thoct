// Every distinct visit purpose gets its own bar; only blank/unspecified
// purposes are grouped under Unspecified. This does not change saved data.
export function summarizeVisitPurposes(rows: ReadonlyArray<{ purpose?: string | null; count: number }>) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!Number.isFinite(row.count) || row.count <= 0) continue;
    const raw = (row.purpose || '').trim().replace(/\s+/g, ' ');
    const purpose = (!raw || raw === '—' || raw === '-') ? 'Unspecified' : raw;
    totals.set(purpose, (totals.get(purpose) || 0) + row.count);
  }
  return [...totals].map(([purpose, visits]) => ({ purpose, visits })).sort((a, b) =>
    a.purpose === 'Unspecified' ? 1 : b.purpose === 'Unspecified' ? -1 : b.visits - a.visits || a.purpose.localeCompare(b.purpose));
}
