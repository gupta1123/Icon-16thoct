"use client";

import { useState,useEffect,useCallback,use } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/components/auth-provider';
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { format,formatDuration,intervalToDuration } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowLeft,
  Calendar as CalendarIcon,
  Loader2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Receipt,
  Tag,
  Clock,
  Pencil,
  Building2,
  CalendarDays,
  CalendarCheck,
  IdCard,
  MapPinned,
  Navigation,
  User,
  Wallet
} from 'lucide-react';
import { Popover,PopoverContent,PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem
} from "@/components/ui/select";
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { Avatar,AvatarFallback } from '@/components/ui/avatar';
import { DateRangeError,isDateRangeInvalid } from '@/components/date-range-error';
import { useDashboardHeader } from '@/components/dashboard-header-context';
import { useEmployeeActivity } from '@/components/employee-activity-data';
import { getEmployeeVisitRange,localDate } from '@/lib/employee-detail';
import { API_BASE_URL, type DashboardEmployeeVisitPoint, type LiveLocationDto } from "@/lib/api";
import { DetailHero, DetailShell, EmptyState, Info, KpiCell, Pill, Section, type DetailTab } from "@/components/detail-ui";

const ACTIVITY_TABS=[{ value: 'visits',label: 'Visits' },{ value: 'attendance',label: 'Attendance' },{ value: 'expenses',label: 'Expenses' },{ value: 'daily-pricing',label: 'Daily Pricing' }];

type VisitFilterOption='today'|'yesterday'|'last-2-days'|'this-week'|'this-month'|'last-month';

const VALID_VISIT_FILTERS: Record<VisitFilterOption,true>={
  today: true,
  yesterday: true,
  "last-2-days": true,
  "this-week": true,
  "this-month": true,
  "last-month": true,
};

const VISIT_FILTER_STORAGE_PREFIX="employeeVisitFilter:";
const buildVisitFilterStorageKey=(employeeId: string) =>
  `${VISIT_FILTER_STORAGE_PREFIX}${employeeId}`;

const isValidVisitFilter=(value: string|null): value is VisitFilterOption =>
  !!value&&Object.prototype.hasOwnProperty.call(VALID_VISIT_FILTERS,value);

interface Visit {
  id: number;
  storeId: number;
  storeName: string;
  employeeName: string;
  visit_date: string;
  scheduledStartTime: string|null;
  scheduledEndTime: string|null;
  checkinDate: string|null;
  checkoutDate: string|null;
  checkinTime: string|null;
  checkoutTime: string|null;
  purpose: string;
  outcome: string|null;
}

interface StatsDto {
  visitCount: number;
  fullDays: number;
  halfDays: number;
  absences: number;
}

interface Expense {
  id: number;
  type: string;
  subType: string;
  amount: number;
  approvalStatus: string;
  description: string;
  approvalDate: string;
  expenseDate: string;
  employeeName: string;
}

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string|null;
  primaryContact: number|null;
  email: string|null;
  role: string|null;
  addressLine1: string|null;
  addressLine2: string|null;
  city: string|null;
  state: string|null;
  country: string|null;
  pincode: number|null;
  dateOfJoining: string;
  departmentName: string|null;
  assignedCity: string[]|null;
  houseLatitude: number|null;
  houseLongitude: number|null;
}

interface SalaryDay {
  date: string;
  dayType: string;
  dayOfWeek: string;
  hasAttendance: boolean;
  completedVisits: number;
  baseEarned: number;
  travelAllowance: number;
  dailyDearnessAllowance: number;
  totalDailySalary: number;
}

interface PricingData {
  id: number;
  brandName: string;
  price: number;
  city: string;
}

const EMPLOYEE_LIST_RETURN_CONTEXT_KEY='employeeListReturnContext';

const formatEmployeeRole=(role?: string|null): string => {
  if(!role) return 'Not specified';

  const normalized=role
    .trim()
    .replace(/^ROLE_/i,'')
    .replace(/_/g,' ')
    .replace(/\s+/g,' ')
    .toLowerCase();

  if(normalized==='avp') return 'AVP';
  if(normalized==='hr') return 'HR';

  return normalized.replace(/\b\w/g,(letter) => letter.toUpperCase());
};

export default function SalesExecutivePage({ params }: { params: Promise<{ id: string }> }) {
  const router=useRouter();
  const searchParams=useSearchParams();
  const resolvedParams=use(params);
  const id=resolvedParams.id;
  const { token }=useAuth();

  const [activeTab,setActiveTab]=useState('overview');
  const [visitPage,setVisitPage]=useState(1);
  const [visitPageSize,setVisitPageSize]=useState(5);

  const [employeeData,setEmployeeData]=useState<EmployeeData|null>(null);
  const [employeeLoading,setEmployeeLoading]=useState(true);
  const [employeeError,setEmployeeError]=useState<string|null>(null);

  const [visitFilter,setVisitFilter]=useState<VisitFilterOption>('today');
  const [isVisitFilterInitialized,setIsVisitFilterInitialized]=useState(false);
  const [selectedYear,setSelectedYear]=useState<number>(new Date().getFullYear());
  const [selectedMonth,setSelectedMonth]=useState<number>(new Date().getMonth()+1);
  const [expenseStartDate,setExpenseStartDate]=useState<Date|undefined>(new Date());
  const [expenseEndDate,setExpenseEndDate]=useState<Date|undefined>(new Date());
  const [pricingStartDate,setPricingStartDate]=useState<Date|undefined>(new Date());
  const [pricingEndDate,setPricingEndDate]=useState<Date|undefined>(new Date());

  const visitFilterParam=searchParams?.get('visitFilter')??null;

  const getInitials=(name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const getStatusInfo=(status: string) => {
    switch(status) {
      case 'Completed':
        return { icon: CheckCircle2,color: 'bg-green-100 text-green-800' };
      case 'In Progress':
        return { icon: Clock,color: 'bg-blue-100 text-blue-800' };
      default:
        return { icon: CalendarIcon,color: 'bg-gray-100 text-gray-800' };
    }
  };

  const handleBack=useCallback(() => {
    if(typeof window!=='undefined') {
      const visitReturnContext=window.localStorage.getItem('visitReturnContext');
      if(visitReturnContext) {
        try {
          const parsedContext=JSON.parse(visitReturnContext) as { route?: string|null; originalSource?: string };
          if(parsedContext?.originalSource==='employees') {
            window.localStorage.removeItem('visitReturnContext');
            router.push('/dashboard/employees');
            return;
          }
        } catch(error) {
          console.error('Failed to parse visit return context:',error);
        }
      }

      const storedContext=window.localStorage.getItem(EMPLOYEE_LIST_RETURN_CONTEXT_KEY);
      if(storedContext) {
        try {
          const parsedContext=JSON.parse(storedContext) as { route?: string|null };
          window.localStorage.removeItem(EMPLOYEE_LIST_RETURN_CONTEXT_KEY);
          if(parsedContext?.route) {
            router.push(parsedContext.route);
            return;
          }
        } catch(error) {
          console.error('Failed to parse employee list return context:',error);
          window.localStorage.removeItem(EMPLOYEE_LIST_RETURN_CONTEXT_KEY);
        }
      }

      const from=searchParams?.get('from');
      if(from==='visitDetail') {
        const visitFrom=window.localStorage.getItem('visitDetailFrom');
        if(visitFrom==='employees') {
          window.localStorage.removeItem('visitDetailFrom');
          router.push('/dashboard/employees');
          return;
        }
      }

      if(window.history.length<=1) {
        router.push('/dashboard/employees');
        return;
      }
    }

    router.back();
  },[router,searchParams]);

  useDashboardHeader({ heading: "Employee Details",subheading: employeeData? `${employeeData.firstName} ${employeeData.lastName} · ${formatEmployeeRole(employeeData.role)}`:`Employee #${id}`,onBack: handleBack });

  useEffect(() => {
    const fetchEmployeeData=async () => {
      setEmployeeLoading(true);
      setEmployeeError(null);
      setEmployeeData(null);

      try {
        const response=await fetch(`${API_BASE_URL}/employee/getAll`,{
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if(!response.ok) {
          throw new Error(`Failed to load employee details (${response.status})`);
        }

        const data: EmployeeData[]=await response.json();
        const employee=data.find((emp) => emp.id.toString()===id);

        if(!employee) {
          setEmployeeError('Employee not found.');
          return;
        }

        setEmployeeData({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId??null,
          primaryContact: employee.primaryContact??null,
          email: employee.email??null,
          role: employee.role??null,
          addressLine1: employee.addressLine1??null,
          addressLine2: employee.addressLine2??null,
          city: employee.city??null,
          state: employee.state??null,
          country: employee.country??null,
          pincode: employee.pincode??null,
          dateOfJoining: employee.dateOfJoining,
          departmentName: employee.departmentName??null,
          assignedCity: Array.isArray(employee.assignedCity)? employee.assignedCity:[],
          houseLatitude: employee.houseLatitude??null,
          houseLongitude: employee.houseLongitude??null,
        });
      } catch(error) {
        console.error("Error fetching employee data:",error);
        setEmployeeError(error instanceof Error? error.message:'Failed to load employee details.');
      } finally {
        setEmployeeLoading(false);
      }
    };

    if(token&&id) {
      fetchEmployeeData();
    }
  },[token,id]);

  useEffect(() => {
    if(!id) return;

    let nextFilter: VisitFilterOption='today';

    if(isValidVisitFilter(visitFilterParam)) {
      nextFilter=visitFilterParam;
    } else if(typeof window!=='undefined') {
      try {
        const storedFilter=window.localStorage.getItem(buildVisitFilterStorageKey(id));
        if(isValidVisitFilter(storedFilter)) {
          nextFilter=storedFilter;
        }
      } catch(error) {
        console.error('Failed to read stored visit filter:',error);
      }
    }

    setVisitFilter(prev => (prev===nextFilter? prev:nextFilter));
    setIsVisitFilterInitialized(prev => (prev? prev:true));
  },[id,visitFilterParam]);

  useEffect(() => {
    if(!id||typeof window==='undefined'||!isVisitFilterInitialized) return;

    try {
      window.localStorage.setItem(buildVisitFilterStorageKey(id),visitFilter);
    } catch(error) {
      console.error('Failed to persist visit filter selection:',error);
    }
  },[id,visitFilter,isVisitFilterInitialized]);

  const handleViewVisit=useCallback(
    (visitId: number) => {
      const params=new URLSearchParams({
        from: 'employee',
        employeeId: id,
      });

      const returnParams=new URLSearchParams();

      if(isVisitFilterInitialized&&VALID_VISIT_FILTERS[visitFilter]) {
        params.set('visitFilter',visitFilter);
        returnParams.set('visitFilter',visitFilter);
      }

      const returnRoute=returnParams.toString()
        ? `/dashboard/employee/${id}?${returnParams.toString()}`
        :`/dashboard/employee/${id}`;

      if(typeof window!=='undefined') {
        try {
          window.localStorage.setItem(
            'visitReturnContext',
            JSON.stringify({
              route: returnRoute,
              timestamp: Date.now(),
            }),
          );
        } catch(storageError) {
          console.error('Failed to store visit return context:',storageError);
        }
      }

      router.push(`/dashboard/visits/${visitId}?${params.toString()}`);
    },
    [id,visitFilter,isVisitFilterInitialized,router],
  );

  const visitRange=getEmployeeVisitRange(visitFilter);
  const visitsResource=useEmployeeActivity<{ visitDto?: Visit[]; statsDto?: StatsDto }>(
    isVisitFilterInitialized? `${API_BASE_URL}/visit/getByDateRangeAndEmployeeStats?id=${id}&start=${visitRange.start}&end=${visitRange.end}`:null,token);
  const visits=Array.isArray(visitsResource.data?.visitDto)? visitsResource.data.visitDto:[];
  const totalVisitPages=Math.max(1,Math.ceil(visits.length/visitPageSize));
  const safeVisitPage=Math.min(visitPage,totalVisitPages);
  const visitTotalElements=visits.length;
  const paginatedVisits=visits.slice((safeVisitPage-1)*visitPageSize,safeVisitPage*visitPageSize);
  const handleVisitFilterChange=(value: string) => { if(isValidVisitFilter(value)) { setVisitFilter(value); setVisitPage(1); } };
  const expenseDateRangeInvalid=isDateRangeInvalid(expenseStartDate,expenseEndDate);
  const pricingDateRangeInvalid=isDateRangeInvalid(pricingStartDate,pricingEndDate);
  const expenseResource=useEmployeeActivity<Expense[]>(expenseStartDate&&expenseEndDate&&!expenseDateRangeInvalid? `${API_BASE_URL}/expense/getByEmployeeAndDate?start=${localDate(expenseStartDate)}&end=${localDate(expenseEndDate)}&id=${id}`:null,token);
  const attendanceResource=useEmployeeActivity<Record<string,unknown>>(`${API_BASE_URL}/attendance-log/monthlyVisits?date=${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01&employeeId=${id}`,token);
  const pricingResource=useEmployeeActivity<PricingData[]>(pricingStartDate&&pricingEndDate&&!pricingDateRangeInvalid? `${API_BASE_URL}/brand/getByDateRangeForEmployee?start=${localDate(pricingStartDate)}&end=${localDate(pricingEndDate)}&id=${id}`:null,token);
  const expenses=Array.isArray(expenseResource.data)? expenseResource.data:[];
  const attendanceStats=attendanceResource.data;
  const dailyPricing=Array.isArray(pricingResource.data)? pricingResource.data:[];
  const monthPad=String(selectedMonth).padStart(2,'0');
  const monthStart=`${selectedYear}-${monthPad}-01`;
  const monthEnd=`${selectedYear}-${monthPad}-${String(new Date(selectedYear,selectedMonth,0).getDate()).padStart(2,'0')}`;
  const salaryResource=useEmployeeActivity<SalaryDay[]>(activeTab==='salary'? `${API_BASE_URL}/salary-calculation/daily-breakdown?employeeId=${id}&startDate=${monthStart}&endDate=${monthEnd}`:null,token);
  const liveResource=useEmployeeActivity<LiveLocationDto>(activeTab==='tracking'? `${API_BASE_URL}/employee/getLiveLocation?id=${id}`:null,token);
  const trailResource=useEmployeeActivity<DashboardEmployeeVisitPoint[]>(activeTab==='tracking'? `${API_BASE_URL}/dashboard/employees/${id}/visit-trail?startDate=${monthStart}&endDate=${monthEnd}`:null,token);
  const activeResource=activeTab==='visits'? visitsResource:activeTab==='attendance'? attendanceResource:activeTab==='expenses'? expenseResource:activeTab==='salary'? salaryResource:activeTab==='tracking'? (liveResource.loading||trailResource.loading? { ...trailResource,loading: true }:liveResource.error&&trailResource.error? trailResource:{ ...trailResource,error: null }):pricingResource;
  const activityFeedback=activeResource.loading
    ? <div role="status" className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading records…</div>
    :activeResource.error
      ? <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm"><p className="text-destructive">{activeResource.error}</p><Button size="sm" variant="outline" onClick={activeResource.retry}>Try again</Button></div>
      :null;

  if(employeeLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading employee details...</span>
        </div>
      </div>
    );
  }

  if(employeeError||!employeeData) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
            <div>
              <h2 className="font-semibold text-foreground">Unable to show employee details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {employeeError||'Employee not found.'}
              </p>
            </div>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to employees
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeeRole=formatEmployeeRole(employeeData.role);
  const hasHomeCoordinates=employeeData.houseLatitude!==null&&employeeData.houseLongitude!==null;

  const fmtDate=(value?: string|null) => {
    if(!value) return '—';
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())? value:format(parsed,'MMM dd, yyyy');
  };
  const fmtStamp=(value?: string|null) => {
    if(!value) return '—';
    const parsed=new Date(value);
    return Number.isNaN(parsed.getTime())? value:format(parsed,'MMM dd, h:mm a');
  };
  const inr=(value: number) => `₹${Number(value||0).toLocaleString('en-IN',{ maximumFractionDigits: 0 })}`;
  const monthLabel=format(new Date(selectedYear,selectedMonth-1,1),'MMM yyyy');
  const attendanceStatsDto=(attendanceStats as { statsDto?: { fullDays?: number; halfDays?: number; absences?: number } }|null)?.statsDto;
  const expenseTotal=expenses.reduce((sum,expense) => sum+(Number(expense.amount)||0),0);
  const assignedCities=(employeeData.assignedCity??[]).filter(Boolean);
  const locationLabel=[employeeData.city,employeeData.state].filter(Boolean).join(', ');
  const salaryRows=Array.isArray(salaryResource.data)? salaryResource.data:[];
  const salaryTotal=salaryRows.reduce((sum,row) => sum+(Number(row.totalDailySalary)||0),0);
  const trailPoints=Array.isArray(trailResource.data)? trailResource.data:[];
  const live=liveResource.data;
  const mapHref=(lat?: number|null,lng?: number|null) => lat!=null&&lng!=null? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`:undefined;

  const overviewContent=(
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Section icon={User} title="Work">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="Role" value={employeeRole} />
          <Info label="Employee ID" value={employeeData.employeeId||'Not provided'} />
          <Info label="Department" value={employeeData.departmentName||'Not provided'} />
          <Info label="Joined" value={fmtDate(employeeData.dateOfJoining)} />
        </dl>
      </Section>
      <Section icon={Phone} title="Contact">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="Phone" value={employeeData.primaryContact? <a className="hover:underline" href={`tel:${employeeData.primaryContact}`}>{String(employeeData.primaryContact)}</a>:'Not provided'} />
          <Info label="Email" value={employeeData.email? <a className="hover:underline" href={`mailto:${employeeData.email}`}>{employeeData.email}</a>:'Not provided'} />
        </dl>
      </Section>
      <Section icon={MapPin} title="Address">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info className="sm:col-span-2" label="Address" value={[employeeData.addressLine1,employeeData.addressLine2].filter(Boolean).join(', ')||'Not provided'} />
          <Info label="City / State" value={locationLabel||'Not provided'} />
          <Info label="Pin code" value={employeeData.pincode??'Not provided'} />
          <Info label="Home location" value={hasHomeCoordinates? <a className="inline-flex items-center gap-1 hover:underline" target="_blank" rel="noreferrer" href={mapHref(employeeData.houseLatitude,employeeData.houseLongitude)}>View on map</a>:'Not recorded'} />
        </dl>
      </Section>
      <Section icon={Building2} title={`Assigned cities · ${assignedCities.length}`}>
        {assignedCities.length===0
          ? <p className="text-sm text-muted-foreground">No cities assigned.</p>
          : <div className="flex flex-wrap gap-1.5">{assignedCities.map((city) => <Pill key={city}>{city}</Pill>)}</div>}
      </Section>
    </div>
  );

  const salaryContent=(
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
          <SelectTrigger className="h-9 w-[110px]"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>{Array.from({ length: 27 },(_,index) => <SelectItem key={index} value={(2023+index).toString()}>{2023+index}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>{["January","February","March","April","May","June","July","August","September","October","November","December"].map((month,index) => <SelectItem key={index} value={(index+1).toString()}>{month}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {activityFeedback}
      <div hidden={!!activityFeedback}>
        <Section icon={Wallet} title={`Daily salary · ${monthLabel}`} description={`${salaryRows.length} days · total ${inr(salaryTotal)}`} bodyClassName="p-0">
          {salaryRows.length===0? <EmptyState compact title="No salary breakdown for this month." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="px-4 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">Day</th><th className="px-2 py-2 text-right font-medium">Visits</th><th className="px-2 py-2 text-right font-medium">Base</th><th className="px-2 py-2 text-right font-medium">Travel</th><th className="px-2 py-2 text-right font-medium">DA</th><th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
                <tbody>
                  {salaryRows.map((row) => (
                    <tr key={row.date} className="border-b last:border-0">
                      <td className="px-4 py-2 tabular-nums">{fmtDate(row.date)}</td>
                      <td className="px-2 py-2"><Pill tone={row.hasAttendance? 'success':'neutral'}>{row.dayType||row.dayOfWeek}</Pill></td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.completedVisits??0}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(row.baseEarned)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(row.travelAllowance)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{inr(row.dailyDearnessAllowance)}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{inr(row.totalDailySalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );

  const trackingContent=(
    <div className="space-y-4">
      {activityFeedback}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" hidden={!!activityFeedback}>
        <Section icon={Navigation} title="Last known location">
          {live&&live.latitude!=null? (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Info label="Updated" value={fmtStamp(live.updatedAt&&live.updatedTime? `${String(live.updatedAt).slice(0,10)}T${live.updatedTime}`:live.updatedAt)} />
              <Info label="Position" value={<a className="hover:underline" target="_blank" rel="noreferrer" href={mapHref(live.latitude,live.longitude)}>View on map</a>} />
            </dl>
          ) : <EmptyState compact title="No location reported yet." />}
        </Section>
        <Section icon={MapPin} title={`Visit trail${trailPoints.length? ` · ${trailPoints.length}`:''}`} description={monthLabel} bodyClassName="p-0">
          {trailPoints.length===0? <EmptyState compact title="No visit trail for this month." /> : (
            <ul className="divide-y">
              {trailPoints.map((point,index) => (
                <li key={`${point.type}-${point.visitId??index}-${index}`} className="flex items-center gap-3 px-4 py-2">
                  <Pill tone={point.type==='CHECKIN'? 'success':point.type==='CHECKOUT'? 'info':'neutral'}>{point.type.toLowerCase()}</Pill>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{point.storeName||point.label||'—'}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtStamp(point.timestamp)}</p>
                  </div>
                  <a className="text-xs text-muted-foreground hover:text-foreground hover:underline" target="_blank" rel="noreferrer" href={mapHref(point.latitude,point.longitude)}>Map</a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );

  const employeeTabs: DetailTab[]=[
    { value: 'overview',label: 'Overview',icon: User,content: overviewContent },
    { value: 'visits',label: 'Visits',icon: MapPinned,count: visitsResource.loading? undefined:visits.length,content: (<div className="space-y-4">
                {activeTab==='visits'&&(
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={visitFilter} onValueChange={handleVisitFilterChange}>
                        <SelectTrigger aria-label="Visit period" className="h-9 min-w-[150px] flex-1 sm:flex-none">
                          <SelectValue placeholder="Select Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="last-2-days">Last 2 Days</SelectItem>
                          <SelectItem value="this-week">This Week</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="last-month">Last Month</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={visitPageSize.toString()}
                        onValueChange={(value) => { setVisitPageSize(parseInt(value,10)); setVisitPage(1); }}
                      >
                        <SelectTrigger aria-label="Visits per page" className="h-9 min-w-[140px] flex-1 sm:flex-none">
                          <SelectValue placeholder="Page size" />
                        </SelectTrigger>
                        <SelectContent>
                          {[5,10,20].map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size} per page
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground sm:ml-auto">
                        Showing {visits.length===0? 0:(safeVisitPage-1)*visitPageSize+1}-
                        {Math.min(safeVisitPage*visitPageSize,visitTotalElements)} of {visitTotalElements}
                      </p>
                    </div>
                    {activityFeedback}
                    <div className="space-y-3" hidden={!!activityFeedback}>
                      {paginatedVisits.length===0? (
                        <div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
                          No visits found for this filter
                        </div>
                      ):(
                        paginatedVisits.map((visit) => {
                          let status='Scheduled';
                          if(visit.checkinDate&&visit.checkinTime&&visit.checkoutDate&&visit.checkoutTime) {
                            status='Completed';
                          } else if(visit.checkinDate&&visit.checkinTime) {
                            status='In Progress';
                          }
                          const { icon: StatusIcon,color }=getStatusInfo(status);
                          return (
                            <div
                              key={visit.id}
                              className="rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <h4 className="font-semibold text-sm">{visit.storeName}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      Visit on {format(new Date(visit.visit_date),'MMM dd, yyyy')}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}
                                >
                                  <StatusIcon className="mr-1 h-3 w-3" />{status}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                <span className="font-medium">Purpose:</span> {visit.purpose}
                              </div>
                              {visit.checkinTime&&visit.checkoutTime&&(
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">Duration:</span>{' '}
                                  {formatDuration(
                                    intervalToDuration({
                                      start: new Date(`${visit.checkinDate}T${visit.checkinTime}`),
                                      end: new Date(`${visit.checkoutDate}T${visit.checkoutTime}`),
                                    })
                                  )}
                                </div>
                              )}
                              <div className="flex justify-end mt-4">
                                <Button variant="outline" size="sm" onClick={() => handleViewVisit(visit.id)}>
                                  View Visit
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {!activityFeedback&&paginatedVisits.length>0&&totalVisitPages>1&&(
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">
                          Page {safeVisitPage} of {totalVisitPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisitPage((prev) => Math.max(1,prev-1))}
                            disabled={safeVisitPage===1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisitPage(Math.min(totalVisitPages,safeVisitPage+1))}
                            disabled={visitPage===totalVisitPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
    </div>) },
    { value: 'attendance',label: 'Attendance',icon: CalendarCheck,content: (<div className="space-y-4">
                {activeTab==='attendance'&&(
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[150px] max-w-full">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 27 },(_,index) => (
                            <SelectItem key={index} value={(2023+index).toString()}>
                              {2023+index}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[150px] max-w-full">
                          <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {["January","February","March","April","May","June","July","August","September","October","November","December"].map((month,index) => (
                            <SelectItem key={index} value={(index+1).toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {activityFeedback}
                    <div className="rounded-lg border bg-card p-6" hidden={!!activityFeedback}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {(attendanceStats as { statsDto?: { fullDays?: number } })?.statsDto?.fullDays||0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Full Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600 mb-2">
                            {(attendanceStats as { statsDto?: { halfDays?: number } })?.statsDto?.halfDays||0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Half Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600 mb-2">
                            {(attendanceStats as { statsDto?: { absences?: number } })?.statsDto?.absences||0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Absences</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
    </div>) },
    { value: 'expenses',label: 'Expenses',icon: Receipt,count: expenseResource.loading? undefined:expenses.length,content: (<div className="space-y-4">
                {activeTab==='expenses'&&(
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start sm:w-[200px]">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseStartDate? format(expenseStartDate,'MMM dd, yyyy'):'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={expenseStartDate}
                            onSelect={setExpenseStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start sm:w-[200px]">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseEndDate? format(expenseEndDate,'MMM dd, yyyy'):'Select End Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={expenseEndDate}
                            onSelect={setExpenseEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <DateRangeError fromDate={expenseStartDate} toDate={expenseEndDate} />

                    {activityFeedback}
                    <div className="space-y-3" hidden={!!activityFeedback}>
                      {expenses.length===0&&!expenseDateRangeInvalid&&<div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">No expenses recorded for this period</div>}
                      {expenses.map((expense) => (
                        <div key={expense.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h4 className="font-semibold text-sm capitalize">{expense.type}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(expense.expenseDate),'MMM dd, yyyy')}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${(expense.approvalStatus||'').toLowerCase()==='approved'? 'bg-green-100 text-green-800':
                                (expense.approvalStatus||'').toLowerCase()==='pending'? 'bg-yellow-100 text-yellow-800':
                                  'bg-red-100 text-red-800'
                              }`}>
                              {expense.approvalStatus}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Amount:</span> ₹{Number(expense.amount).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
    </div>) },
    { value: 'salary',label: 'Salary',icon: Wallet,content: salaryContent },
    { value: 'tracking',label: 'Tracking',icon: Navigation,content: trackingContent },
    { value: 'daily-pricing',label: 'Daily pricing',icon: Tag,content: (<div className="space-y-4">
                {activeTab==='daily-pricing'&&(
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start sm:w-[200px]">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pricingStartDate? format(pricingStartDate,'MMM dd, yyyy'):'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={pricingStartDate}
                            onSelect={setPricingStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start sm:w-[200px]">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pricingEndDate? format(pricingEndDate,'MMM dd, yyyy'):'Select End Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <SpacedCalendar
                            mode="single"
                            selected={pricingEndDate}
                            onSelect={setPricingEndDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <DateRangeError fromDate={pricingStartDate} toDate={pricingEndDate} />

                    {activityFeedback}
                    <div className="space-y-3" hidden={!!activityFeedback}>
                      {dailyPricing.length===0&&!pricingDateRangeInvalid&&<div className="rounded-lg border bg-muted/30 p-5 text-center text-sm text-muted-foreground">No daily pricing recorded for this period</div>}
                      {dailyPricing.map((pricing) => (
                        <div key={pricing.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Tag className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h4 className="font-semibold text-sm capitalize">{pricing.brandName}</h4>
                                <p className="text-xs text-muted-foreground">{pricing.city}</p>
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              {pricing.city}
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-foreground">
                            ₹{Number(pricing.price).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
    </div>) },
  ];

  return (
    <div className="icon-employee-detail space-y-4 py-4">
      <Head>
        <title>{`${employeeData.firstName} ${employeeData.lastName}`}</title>
      </Head>
      <DetailHero
        name={`${employeeData.firstName} ${employeeData.lastName}`.trim()}
        onBack={handleBack}
        backLabel="Employees"
        badges={<>
          {employeeData.role&&<Pill>{employeeRole}</Pill>}
        </>}
        meta={[
          { icon: IdCard,label: employeeData.employeeId? `ID ${employeeData.employeeId}`:'No employee ID',title: 'Employee ID' },
          ...(employeeData.primaryContact? [{ icon: Phone,label: String(employeeData.primaryContact),href: `tel:${employeeData.primaryContact}` }]:[]),
          ...(employeeData.email? [{ icon: Mail,label: employeeData.email,href: `mailto:${employeeData.email}` }]:[]),
          ...(locationLabel? [{ icon: MapPin,label: locationLabel }]:[]),
          ...(employeeData.dateOfJoining? [{ icon: CalendarDays,label: `Joined ${fmtDate(employeeData.dateOfJoining)}`,title: 'Date of joining' }]:[]),
        ]}
        actions={<Button variant="outline" size="sm" className="h-8" onClick={() => router.push(`/dashboard/employees/${id}/edit`)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit employee</Button>}
        kpis={<>
          <KpiCell icon={MapPinned} label="Visits" value={visitsResource.loading? '…':(visitsResource.data?.statsDto?.visitCount??visits.length)} hint={visitFilter.replace(/-/g,' ')} />
          <KpiCell icon={CalendarCheck} label={`Full days · ${monthLabel}`} value={attendanceResource.loading? '…':(attendanceStatsDto?.fullDays??0)} hint={attendanceResource.loading? undefined:`${attendanceStatsDto?.halfDays??0} half · ${attendanceStatsDto?.absences??0} absent`} />
          <KpiCell icon={Receipt} label="Expenses" value={expenseResource.loading? '…':inr(expenseTotal)} hint={expenseResource.loading? undefined:`${expenses.length} claims in range`} />
          <KpiCell icon={Building2} label="Assigned cities" value={assignedCities.length} hint={assignedCities.slice(0,2).join(', ')||undefined} />
        </>}
      />
      <DetailShell value={activeTab} onValueChange={setActiveTab} tabs={employeeTabs} />
    </div>
  );
};
