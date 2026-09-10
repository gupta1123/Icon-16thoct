"use client";

import { useEffect, useState } from 'react';
import { fetchPayrollRows, getPayrollQueryState, type PayrollRequest, type PayrollResult } from '@/lib/payroll-data';

/** Results belong to one request, never to whichever filters happen to be visible later. */
export function usePayrollRows<T>(request: PayrollRequest | null) {
  const [result, setResult] = useState<PayrollResult<T> | null>(null);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    fetchPayrollRows<T>(request, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ request, data, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ request, data: [], error: error instanceof Error ? error.message : 'Unable to load payroll records.' });
    });
    return () => controller.abort();
  }, [request]);
  return getPayrollQueryState(request, result);
}
