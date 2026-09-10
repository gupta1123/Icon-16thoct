export type EmployeeVisitFilter='today'|'yesterday'|'last-2-days'|'this-week'|'this-month'|'last-month';

export function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}

export function getEmployeeVisitRange(filter: EmployeeVisitFilter,now=new Date()) {
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const end=new Date(start);
  if(filter==='yesterday') { start.setDate(start.getDate()-1); end.setDate(end.getDate()-1); }
  if(filter==='last-2-days') start.setDate(start.getDate()-2);
  // Match the existing German Steel employee view's Sunday-start week.
  if(filter==='this-week') start.setDate(start.getDate()-start.getDay());
  if(filter==='this-month') { start.setDate(1); end.setMonth(end.getMonth()+1,0); }
  if(filter==='last-month') { start.setMonth(start.getMonth()-1,1); end.setDate(0); }
  return { start: localDate(start),end: localDate(end) };
}

export async function fetchEmployeeActivity<T>(url: string,token: string,signal: AbortSignal): Promise<T> {
  const response=await fetch(url,{ headers: { Authorization: `Bearer ${token}` },signal });
  if(!response.ok) {
    if(response.status===403) throw new Error('You do not have permission to view these records.');
    if(response.status===401) throw new Error('Your session has expired. Please sign in again.');
    throw new Error(`Unable to load records (${response.status}). Please try again.`);
  }
  return response.json();
}
