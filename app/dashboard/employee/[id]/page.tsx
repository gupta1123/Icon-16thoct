"use client";

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDuration, intervalToDuration, differenceInMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  AlertCircle, 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Loader2, 
  Mail, 
  Phone, 
  MapPin, 
  Home, 
  Crosshair, 
  Building, 
  UserCheck, 
  Globe, 
  CheckCircle2, 
  Receipt, 
  Tag,
  Target,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

type VisitFilterOption = 'today' | 'yesterday' | 'last-2-days' | 'this-month' | 'last-month';

const VALID_VISIT_FILTERS: Record<VisitFilterOption, true> = {
  today: true,
  yesterday: true,
  "last-2-days": true,
  "this-month": true,
  "last-month": true,
};

const VISIT_FILTER_STORAGE_PREFIX = "employeeVisitFilter:";
const buildVisitFilterStorageKey = (employeeId: string) =>
  `${VISIT_FILTER_STORAGE_PREFIX}${employeeId}`;

const isValidVisitFilter = (value: string | null): value is VisitFilterOption =>
  !!value && Object.prototype.hasOwnProperty.call(VALID_VISIT_FILTERS, value);

interface Visit {
  id: number;
  storeId: number;
  storeName: string;
  employeeName: string;
  visit_date: string;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  checkinDate: string | null;
  checkoutDate: string | null;
  checkinTime: string | null;
  checkoutTime: string | null;
  purpose: string;
  outcome: string | null;
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
  employeeId: string | null;
  primaryContact: number | null;
  email: string | null;
  role: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: number | null;
  dateOfJoining: string;
  departmentName: string | null;
  assignedCity: string[] | null;
  houseLatitude: number | null;
  houseLongitude: number | null;
}

interface PricingData {
  id: number;
  brandName: string;
  price: number;
  city: string;
}

const EMPLOYEE_LIST_RETURN_CONTEXT_KEY = 'employeeListReturnContext';

const formatEmployeeRole = (role?: string | null): string => {
  if (!role) return 'Not specified';

  const normalized = role
    .trim()
    .replace(/^ROLE_/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (normalized === 'avp') return 'AVP';
  if (normalized === 'hr') return 'HR';

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function SalesExecutivePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState('visits');
  const [activeInfoTab, setActiveInfoTab] = useState('personal-info');
  const [showExpenseStartCalendar, setShowExpenseStartCalendar] = useState(false);
  const [showExpenseEndCalendar, setShowExpenseEndCalendar] = useState(false);

  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<StatsDto | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<Record<string, unknown> | null>(null);
  const [dailyPricing, setDailyPricing] = useState<PricingData[]>([]);

  const [visitFilter, setVisitFilter] = useState<VisitFilterOption>('today');
  const [isVisitFilterInitialized, setIsVisitFilterInitialized] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [expenseStartDate, setExpenseStartDate] = useState<Date | undefined>(new Date());
  const [expenseEndDate, setExpenseEndDate] = useState<Date | undefined>(new Date());
  const [pricingStartDate, setPricingStartDate] = useState<Date | undefined>(new Date());
  const [pricingEndDate, setPricingEndDate] = useState<Date | undefined>(new Date());

  const [showPricingStartCalendar, setShowPricingStartCalendar] = useState(false);
  const [showPricingEndCalendar, setShowPricingEndCalendar] = useState(false);
  const visitFilterParam = searchParams?.get('visitFilter') ?? null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'Completed':
        return { emoji: '✅', color: 'bg-green-100 text-green-800' };
      case 'In Progress':
        return { emoji: '🟡', color: 'bg-blue-100 text-blue-800' };
      default:
        return { emoji: '⏳', color: 'bg-gray-100 text-gray-800' };
    }
  };
  
  const handleBack = () => {
    if (typeof window !== 'undefined') {
      // Check if we came from visit detail that came from employees
      const visitReturnContext = window.localStorage.getItem('visitReturnContext');
      if (visitReturnContext) {
        try {
          const parsedContext = JSON.parse(visitReturnContext) as { route?: string | null; originalSource?: string };
          // If the visit detail came from employees, go back to employees
          if (parsedContext?.originalSource === 'employees') {
            window.localStorage.removeItem('visitReturnContext');
            router.push('/dashboard/employees');
            return;
          }
        } catch (error) {
          console.error('Failed to parse visit return context:', error);
        }
      }

      const storedContext = window.localStorage.getItem(EMPLOYEE_LIST_RETURN_CONTEXT_KEY);
      if (storedContext) {
        try {
          const parsedContext = JSON.parse(storedContext) as { route?: string | null };
          window.localStorage.removeItem(EMPLOYEE_LIST_RETURN_CONTEXT_KEY);
          if (parsedContext?.route) {
            router.push(parsedContext.route);
            return;
          }
        } catch (error) {
          console.error('Failed to parse employee list return context:', error);
          window.localStorage.removeItem(EMPLOYEE_LIST_RETURN_CONTEXT_KEY);
        }
      }

      // Check searchParams to see if we came from visit detail
      const from = searchParams?.get('from');
      if (from === 'visitDetail') {
        // Check if visit detail came from employees by checking the referrer or localStorage
        const visitFrom = window.localStorage.getItem('visitDetailFrom');
        if (visitFrom === 'employees') {
          window.localStorage.removeItem('visitDetailFrom');
          router.push('/dashboard/employees');
          return;
        }
      }

      if (window.history.length <= 1) {
        router.push('/dashboard/employees');
        return;
      }
    }

    router.back();
  };

  useEffect(() => {
    const fetchEmployeeData = async () => {
      setEmployeeLoading(true);
      setEmployeeError(null);
      setEmployeeData(null);

      try {
        const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/employee/getAll`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load employee details (${response.status})`);
        }

        const data: EmployeeData[] = await response.json();
        const employee = data.find((emp) => emp.id.toString() === id);

        if (!employee) {
          setEmployeeError('Employee not found.');
          return;
        }

        // Retain only the fields used by this page. In particular, do not keep
        // sensitive nested user credentials returned by the collection API.
        setEmployeeData({
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId ?? null,
          primaryContact: employee.primaryContact ?? null,
          email: employee.email ?? null,
          role: employee.role ?? null,
          addressLine1: employee.addressLine1 ?? null,
          addressLine2: employee.addressLine2 ?? null,
          city: employee.city ?? null,
          state: employee.state ?? null,
          country: employee.country ?? null,
          pincode: employee.pincode ?? null,
          dateOfJoining: employee.dateOfJoining,
          departmentName: employee.departmentName ?? null,
          assignedCity: Array.isArray(employee.assignedCity) ? employee.assignedCity : [],
          houseLatitude: employee.houseLatitude ?? null,
          houseLongitude: employee.houseLongitude ?? null,
        });
      } catch (error) {
        console.error("Error fetching employee data:", error);
        setEmployeeError(error instanceof Error ? error.message : 'Failed to load employee details.');
      } finally {
        setEmployeeLoading(false);
      }
    };

    if (token && id) {
      fetchEmployeeData();
    }
  }, [token, id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let nextFilter: VisitFilterOption = 'today';

    if (isValidVisitFilter(visitFilterParam)) {
      nextFilter = visitFilterParam;
    } else if (typeof window !== 'undefined') {
      try {
        const storedFilter = window.localStorage.getItem(buildVisitFilterStorageKey(id));
        if (isValidVisitFilter(storedFilter)) {
          nextFilter = storedFilter;
        }
      } catch (error) {
        console.error('Failed to read stored visit filter:', error);
      }
    }

    setVisitFilter(prev => (prev === nextFilter ? prev : nextFilter));
    setIsVisitFilterInitialized(prev => (prev ? prev : true));
  }, [id, visitFilterParam]);

  useEffect(() => {
    if (!id || typeof window === 'undefined' || !isVisitFilterInitialized) {
      return;
    }

    try {
      window.localStorage.setItem(
        buildVisitFilterStorageKey(id),
        visitFilter,
      );
    } catch (error) {
      console.error('Failed to persist visit filter selection:', error);
    }
  }, [id, visitFilter, isVisitFilterInitialized]);

  const handleViewVisit = useCallback(
    (visitId: number) => {
      const params = new URLSearchParams({
        from: 'employee',
        employeeId: id,
      });

      const returnParams = new URLSearchParams();

      if (isVisitFilterInitialized && VALID_VISIT_FILTERS[visitFilter]) {
        params.set('visitFilter', visitFilter);
        returnParams.set('visitFilter', visitFilter);
      }

      const returnRoute = returnParams.toString()
        ? `/dashboard/employee/${id}?${returnParams.toString()}`
        : `/dashboard/employee/${id}`;

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            'visitReturnContext',
            JSON.stringify({
              route: returnRoute,
              timestamp: Date.now(),
            }),
          );
        } catch (storageError) {
          console.error('Failed to store visit return context:', storageError);
        }
      }

      router.push(`/dashboard/visits/${visitId}?${params.toString()}`);
    },
    [id, visitFilter, isVisitFilterInitialized, router],
  );

  useEffect(() => {
    const fetchVisitsAndStats = async () => {
      if (!token || !id || !isVisitFilterInitialized) {
        return;
      }

      let startDate: string | undefined;
      let endDate: string | undefined;
      const now = new Date();

      // Determine date range based on visitFilter
      if (visitFilter === 'today') {
        startDate = now.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = yesterday.toISOString().split('T')[0];
      } else if (visitFilter === 'last-2-days') {
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        startDate = twoDaysAgo.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (visitFilter === 'this-month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (visitFilter === 'last-month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      }

      try {
        console.log(`Fetching visit data for employee ${id} from ${startDate} to ${endDate}`);
        const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/visit/getByDateRangeAndEmployeeStats?id=${id}&start=${startDate}&end=${endDate}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`No visit data found for employee ${id} in date range ${startDate} to ${endDate}`);
            setVisits([]);
            setStats({
              visitCount: 0,
              fullDays: 0,
              halfDays: 0,
              absences: 0
            });
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVisits(data.visitDto || []);
        setStats(data.statsDto || {
          visitCount: 0,
          fullDays: 0,
          halfDays: 0,
          absences: 0
        });
      } catch (error) {
        console.error("Error fetching visits and stats:", error);
        setVisits([]);
        setStats({
          visitCount: 0,
          fullDays: 0,
          halfDays: 0,
          absences: 0
        });
      }
    };

    fetchVisitsAndStats();
  }, [token, id, visitFilter, isVisitFilterInitialized]);

  useEffect(() => {
    const fetchExpenses = async () => {
      if (token && id) {
        const start = expenseStartDate ? expenseStartDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
        const end = expenseEndDate ? expenseEndDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-30`;
        try {
          const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/getByEmployeeAndDate?start=${start}&end=${end}&id=${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setExpenses(data);
        } catch (error) {
          console.error("Error fetching expenses:", error);
        }
      }
    };

    fetchExpenses();
  }, [token, id, expenseStartDate, expenseEndDate]);

  useEffect(() => {
    const fetchAttendanceStats = async () => {
      if (token && id) {
        try {
          const selectedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
          const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/attendance-log/monthlyVisits?date=${selectedDate}&employeeId=${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setAttendanceStats(data);
        } catch (error) {
          console.error("Error fetching attendance stats:", error);
        }
      }
    };

    fetchAttendanceStats();
  }, [token, id, selectedYear, selectedMonth]);

  useEffect(() => {
    const fetchDailyPricing = async () => {
      if (token && id) {
        const start = pricingStartDate ? pricingStartDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
        const end = pricingEndDate ? pricingEndDate.toISOString().split('T')[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-30`;
        try {
          const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/brand/getByDateRangeForEmployee?start=${start}&end=${end}&id=${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          setDailyPricing(data);
        } catch (error) {
          console.error("Error fetching daily pricing:", error);
        }
      }
    };

    fetchDailyPricing();
  }, [token, id, pricingStartDate, pricingEndDate]);


  const calculateStats = () => {
    const totalVisits = visits.length;
    const now = new Date();
    const currentMonthVisits = visits.filter(visit => {
      const visitDate = new Date(visit.visit_date);
      return visitDate.getMonth() === now.getMonth() && visitDate.getFullYear() === now.getFullYear();
    }).length;

    const totalDuration = visits.reduce((acc, visit) => {
      if (visit.checkinTime && visit.checkoutTime) {
        const checkinDate = new Date(`${visit.checkinDate}T${visit.checkinTime}`);
        const checkoutDate = new Date(`${visit.checkoutDate}T${visit.checkoutTime}`);
        const duration = differenceInMinutes(checkoutDate, checkinDate);
        return acc + duration;
      }
      return acc;
    }, 0);

    const avgDuration = totalVisits > 0 ? totalDuration / totalVisits : 0;
    const hours = Math.floor(avgDuration / 60);
    const minutes = Math.floor(avgDuration % 60);

    return {
      totalVisits,
      currentMonthVisits,
      avgDuration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    };
  };

  const { totalVisits, currentMonthVisits, avgDuration } = calculateStats();

  if (employeeLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading employee details...</span>
        </div>
      </div>
    );
  }

  if (employeeError || !employeeData) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
            <div>
              <h2 className="font-semibold text-foreground">Unable to show employee details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {employeeError || 'Employee not found.'}
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

  const employeeName = `${employeeData.firstName} ${employeeData.lastName}`.trim();
  const employeeRole = formatEmployeeRole(employeeData.role);
  const hasHomeCoordinates =
    employeeData.houseLatitude !== null && employeeData.houseLongitude !== null;

    return (
      <div className="space-y-6">
      <Head>
        <title>{employeeName} - Employee Details</title>
      </Head>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Employee Profile */}
        <div className="lg:col-span-1">
          <Card className="border border-border/60 shadow-sm rounded-xl overflow-hidden bg-card">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Employee Profile</CardTitle>
                  <p className="text-xs text-muted-foreground">Information and details</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleBack} className="h-8 text-xs font-medium rounded-lg gap-1.5 border-border/80">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3.5 pb-3 border-b border-border/30">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-primary/90 to-primary text-primary-foreground font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                  {getInitials(employeeName)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-base font-bold text-foreground truncate leading-tight">
                    {employeeName}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {employeeRole}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex border-b border-border/40 gap-4 text-xs font-medium">
                  <button
                    className={`pb-2 transition-colors relative ${
                      activeInfoTab === 'personal-info' 
                        ? 'text-primary font-semibold border-b-2 border-primary -mb-px' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveInfoTab('personal-info')}
                  >
                    Personal Info
                  </button>
                  <button
                    className={`pb-2 transition-colors relative ${
                      activeInfoTab === 'work-info' 
                        ? 'text-primary font-semibold border-b-2 border-primary -mb-px' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveInfoTab('work-info')}
                  >
                    Work Info
                  </button>
                </div>
                
                {activeInfoTab === 'personal-info' && (
                  <div className="space-y-1.5 pt-1">
                    {employeeData?.email && (
                      <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Email</span>
                        </div>
                        <span className="font-medium text-foreground truncate max-w-[180px]" title={employeeData.email}>
                          {employeeData.email}
                        </span>
                      </div>
                    )}
                    {employeeData?.primaryContact && (
                      <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Phone</span>
                        </div>
                        <span className="font-semibold text-foreground">{employeeData.primaryContact}</span>
                      </div>
                    )}
                    {(employeeData?.city || employeeData?.state || employeeData?.country) && (
                      <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Location</span>
                        </div>
                        <span className="font-medium text-foreground text-right truncate max-w-[180px]">
                          {[employeeData?.city, employeeData?.state, employeeData?.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Home className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Address</span>
                      </div>
                      <span className="font-medium text-foreground text-right truncate max-w-[180px]">
                        {[employeeData.addressLine1, employeeData.addressLine2].filter(Boolean).join(', ') || 'Not provided'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Pin Code</span>
                      </div>
                      <span className="font-medium text-foreground">{employeeData.pincode ?? 'Not provided'}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Crosshair className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span>Home Coordinates</span>
                      </div>
                      <span className={`font-semibold text-xs ${hasHomeCoordinates ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {hasHomeCoordinates ? 'Available' : 'Not available'}
                      </span>
                    </div>
                    {employeeData?.dateOfJoining && (
                      <div className="flex items-center justify-between py-1.5 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <CalendarIcon className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                          <span>Joined</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {format(new Date(employeeData.dateOfJoining), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                {activeInfoTab === 'work-info' && (
                  <div className="space-y-1.5 pt-1">
                    {employeeData?.departmentName && (
                      <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <Building className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Department</span>
                        </div>
                        <span className="font-medium text-foreground">{employeeData.departmentName}</span>
                      </div>
                    )}
                    {employeeData?.role && (
                      <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Role</span>
                        </div>
                        <span className="font-medium text-foreground">{employeeRole}</span>
                      </div>
                    )}
                    <div className="py-1.5 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-muted-foreground font-medium">
                        <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>Assigned Cities</span>
                      </div>
                      {employeeData.assignedCity && employeeData.assignedCity.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {employeeData.assignedCity.map((city) => (
                            <span
                              key={city}
                              className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground font-medium"
                            >
                              {city}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground block text-xs">Not assigned</span>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Right Column - Activity Details */}
        <div className="lg:col-span-2">
          <Card className="border border-border/60 shadow-sm rounded-xl overflow-hidden bg-card">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Employee Activity</CardTitle>
                  <p className="text-xs text-muted-foreground">View visits, attendance, expenses, and daily pricing</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex border-b border-border/40 gap-2 text-xs font-medium overflow-x-auto">
                  <button 
                    className={`pb-2.5 px-3 transition-colors flex items-center gap-1.5 whitespace-nowrap relative ${
                      activeTab === 'visits' 
                        ? 'border-b-2 border-primary text-primary font-semibold -mb-px' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('visits')}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>Visits</span>
                  </button>
                  <button 
                    className={`pb-2.5 px-3 transition-colors flex items-center gap-1.5 whitespace-nowrap relative ${
                      activeTab === 'attendance' 
                        ? 'border-b-2 border-primary text-primary font-semibold -mb-px' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('attendance')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Attendance</span>
                  </button>
                  <button 
                    className={`pb-2.5 px-3 transition-colors flex items-center gap-1.5 whitespace-nowrap relative ${
                      activeTab === 'expenses' 
                        ? 'border-b-2 border-primary text-primary font-semibold -mb-px' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('expenses')}
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span>Expenses</span>
                  </button>
                  <button 
                    className={`pb-2.5 px-3 transition-colors flex items-center gap-1.5 whitespace-nowrap relative ${
                      activeTab === 'daily-pricing' 
                        ? 'border-b-2 border-primary text-primary font-semibold -mb-px' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('daily-pricing')}
                  >
                    <Tag className="w-3.5 h-3.5 shrink-0" />
                    <span>Daily Pricing</span>
                  </button>
                </div>

                {activeTab === 'visits' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Select
                        value={visitFilter}
                        onValueChange={(value) => setVisitFilter(value as VisitFilterOption)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="last-2-days">Last 2 Days</SelectItem>
                          <SelectItem value="this-month">This Month</SelectItem>
                          <SelectItem value="last-month">Last Month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      {visits.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p className="text-xs font-medium">No visits found for this period</p>
                        </div>
                      ) : (
                        visits.map((visit) => {
                          let status = 'Scheduled';
                          if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
                            status = 'Completed';
                          } else if (visit.checkinDate && visit.checkinTime) {
                            status = 'In Progress';
                          }
                          const { color } = getStatusInfo(status);

                          let durationStr = '';
                          if (visit.checkinTime && visit.checkoutTime) {
                            durationStr = formatDuration(intervalToDuration({
                              start: new Date(`${visit.checkinDate}T${visit.checkinTime}`),
                              end: new Date(`${visit.checkoutDate}T${visit.checkoutTime}`)
                            }));
                          }

                          return (
                            <div 
                              key={visit.id} 
                              className="group border border-border/60 hover:border-primary/40 bg-card p-3 space-y-2 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer"
                              onClick={() => handleViewVisit(visit.id)}
                            >
                              {/* Header: Store Name, Date, Status Pill & Arrow */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <Building className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs text-foreground truncate group-hover:text-primary transition-colors">
                                      {visit.storeName}
                                    </h4>
                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-0.5">
                                      <CalendarIcon className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                      <span>{format(new Date(visit.visit_date), 'MMM d, yyyy')}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${color}`}>
                                    {status}
                                  </span>
                                  <div className="h-6 w-6 rounded-md bg-muted/60 group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground flex items-center justify-center transition-all">
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              </div>

                              {/* Details Strip: Purpose & Duration */}
                              <div className="bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border/30 text-xs flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <Target className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                  <span className="text-muted-foreground">Purpose:</span>
                                  <span className="font-semibold text-foreground truncate">{visit.purpose || 'N/A'}</span>
                                </div>

                                {durationStr && (
                                  <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span className="font-medium text-foreground">{durationStr}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[130px] h-8 text-xs font-medium rounded-lg border-border">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {Array.from({ length: 27 }, (_, index) => (
                            <SelectItem key={index} value={(2023 + index).toString()} className="text-xs">
                              {2023 + index}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[140px] h-8 text-xs font-medium rounded-lg border-border">
                          <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => (
                            <SelectItem key={index} value={(index + 1).toString()} className="text-xs">
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Full Days Card */}
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block">Full Days</span>
                          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                            {(attendanceStats?.statsDto as Record<string, unknown>)?.fullDays as number || 0}
                          </span>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Half Days Card */}
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 block">Half Days</span>
                          <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                            {(attendanceStats?.statsDto as Record<string, unknown>)?.halfDays as number || 0}
                          </span>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Absences Card */}
                      <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400 block">Absences</span>
                          <span className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                            {(attendanceStats?.statsDto as Record<string, unknown>)?.absences as number || 0}
                          </span>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'expenses' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseStartDate ? format(expenseStartDate, 'MMM d, yyyy') : 'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={expenseStartDate}
                            onSelect={setExpenseStartDate}
                            showOutsideDays
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {expenseEndDate ? format(expenseEndDate, 'MMM d, yyyy') : 'Select End Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={expenseEndDate}
                            onSelect={setExpenseEndDate}
                            showOutsideDays
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-3">
                      {expenses.map((expense) => (
                        <div key={expense.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">💰</span>
                              <div>
                                <h4 className="font-semibold text-sm capitalize">{expense.type}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(expense.expenseDate), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.approvalStatus.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                              expense.approvalStatus.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {expense.approvalStatus}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Amount:</span> ₹{expense.amount.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'daily-pricing' && (
                  <div className="space-y-4">
        <div className="flex items-center gap-4">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pricingStartDate ? format(pricingStartDate, 'MMM d, yyyy') : 'Select Start Date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={pricingStartDate}
                            onSelect={setPricingStartDate}
                            showOutsideDays
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-[200px] justify-start">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {pricingEndDate ? format(pricingEndDate, 'MMM d, yyyy') : 'Select End Date'}
          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={pricingEndDate}
                            onSelect={setPricingEndDate}
                            showOutsideDays
                          />
                        </PopoverContent>
                      </Popover>
        </div>
        
                    <div className="space-y-3">
                      {dailyPricing.map((pricing) => (
                        <div key={pricing.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏷️</span>
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
                            ₹{pricing.price.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
