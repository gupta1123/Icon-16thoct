export interface PayrollRequest {
  url: string;
  token: string;
}

export const PAYROLL_TIMEOUT_MS = 30_000;

/** Bound both response headers and body reads; never retry payroll writes automatically. */
export async function fetchPayrollRows<T>(
  request: PayrollRequest,
  signal: AbortSignal,
  timeoutMs = PAYROLL_TIMEOUT_MS,
): Promise<T[]> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal.aborted) cancel();
  else signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error(
    'The payroll server took too long to respond. Please try again. If this continues, the server needs attention.',
  )), timeoutMs);

  try {
    const response = await fetch(request.url, {
      headers: { Authorization: `Bearer ${request.token}` },
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your session has expired. Please sign in again.');
      if (response.status === 403) throw new Error('You do not have permission to view these payroll records.');
      throw new Error(`Unable to load payroll records (${response.status}). Please try again.`);
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('The payroll server returned an invalid result. Please try again.');
    }
    return data as T[];
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export function canExportPayroll(loaded: boolean, loading: boolean, error: string | null, rowCount: number) {
  return loaded && !loading && !error && rowCount > 0;
}

export interface PayrollResult<T> {
  request: PayrollRequest;
  data: T[];
  error: string | null;
}

export function getPayrollQueryState<T>(request: PayrollRequest | null, result: PayrollResult<T> | null) {
  const current = request && result?.request === request ? result : null;
  return {
    data: current?.data ?? [],
    error: current?.error ?? null,
    loading: !!request && !current,
    loaded: !!current && !current.error,
  };
}

/** Wait for every write before re-reading totals, including partially failed batches. */
export async function settlePayrollUpdates(updates: Promise<unknown>[], refresh: () => void) {
  const results = await Promise.allSettled(updates);
  refresh();
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) {
    throw new Error(`${failed.length} of ${results.length} status updates failed. Records are being reloaded; review them before trying again.`);
  }
}
