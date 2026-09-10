"use client";

import { useEffect,useState } from 'react';
import { fetchEmployeeActivity } from '@/lib/employee-detail';

/** Cancels superseded filters so a slow response cannot overwrite newer records. */
export function useEmployeeActivity<T>(url: string|null,token: string|null) {
  const [result,setResult]=useState<{ url: string; token: string; revision: number; data: T|null; error: string|null }|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(() => {
    if(!url||!token) return;
    const controller=new AbortController();
    fetchEmployeeActivity<T>(url,token,controller.signal).then(data => {
      if(!controller.signal.aborted) setResult({ url,token,revision,data,error: null });
    }).catch(error => {
      if(!controller.signal.aborted) setResult({ url,token,revision,data: null,error: error instanceof Error? error.message:'Unable to load records.' });
    });
    return () => controller.abort();
  },[url,token,revision]);
  const current=result?.url===url&&result?.token===token&&result?.revision===revision? result:null;
  return { data: current?.data??null,error: current?.error??null,loading: !!url&&!!token&&!current,retry: () => setRevision(value => value+1) };
}
