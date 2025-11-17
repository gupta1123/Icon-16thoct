"use client";

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Head from 'next/head';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, formatDuration, intervalToDuration, differenceInMinutes } from "date-fns";
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from "lucide-react";
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
  employeeId: string;
  primaryContact: number;
  email: string;
  role: string;
  city: string;
  state: string;
  country: string;
  dateOfJoining: string;
  departmentName: string;
}

interface PricingData {
  id: number;
  brandName: string;
  price: number;
  city: string;
}

const EMPLOYEE_LIST_RETURN_CONTEXT_KEY = 'employeeListReturnContext';

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
      try {
        const response = await fetch(`/api/proxy/employee/getAll`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        const employee = data.find((emp: EmployeeData) => emp.id.toString() === id);
        if (employee) {
          setEmployeeData(employee);
        }
      } catch (error) {
        console.error("Error fetching employee data:", error);
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
        const response = await fetch(`/api/proxy/visit/getByDateRangeAndEmployeeStats?id=${id}&start=${startDate}&end=${endDate}`, {
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
          const response = await fetch(`/api/proxy/expense/getByEmployeeAndDate?start=${start}&end=${end}&id=${id}`, {
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
          const response = await fetch(`/api/proxy/attendance-log/monthlyVisits?date=${selectedDate}&employeeId=${id}`, {
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
          const response = await fetch(`/api/proxy/brand/getByDateRangeForEmployee?start=${start}&end=${end}&id=${id}`, {
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

    return (
      <div className="space-y-6">
      <Head>
        <title>Sales Executive Detail Page</title>
      </Head>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Employee Profile */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Employee Details</CardTitle>
                  <p className="text-sm text-muted-foreground">Employee information and actions</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <i className="fas fa-arrow-left mr-2"></i> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl border-2 border-dashed bg-muted flex items-center justify-center">
                  <span className="text-lg font-semibold text-muted-foreground">
                    {employeeData ? getInitials(`${employeeData.firstName} ${employeeData.lastName}`) : 'AW'}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-lg font-semibold text-foreground truncate">
                    {employeeData ? `${employeeData.firstName} ${employeeData.lastName}` : 'Abhijeet Wagh'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {employeeData ? employeeData.role : 'Field Officer'}
                  </p>
                </div>
              </div>

        
            <div className="space-y-4">
                <div className="flex border-b">
                  <button
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeInfoTab === 'personal-info' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveInfoTab('personal-info')}
                  >
                    Personal Info
                  </button>
                  <button
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeInfoTab === 'work-info' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveInfoTab('work-info')}
                  >
                    Work Info
                  </button>
                </div>
                
                {activeInfoTab === 'personal-info' && (
                  <div className="space-y-3">
                    {employeeData?.email && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-envelope text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Email</p>
                          <p className="text-sm text-muted-foreground">{employeeData.email}</p>
                        </div>
                      </div>
                    )}
                    {employeeData?.primaryContact && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-phone text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Phone</p>
                          <p className="text-sm text-muted-foreground">{employeeData.primaryContact}</p>
                        </div>
                      </div>
                    )}
                    {(employeeData?.city || employeeData?.state || employeeData?.country) && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-map-marker-alt text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Location</p>
                          <p className="text-sm text-muted-foreground">
                            {[employeeData?.city, employeeData?.state, employeeData?.country].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                    {employeeData?.dateOfJoining && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-calendar text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Joined</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(employeeData.dateOfJoining), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeInfoTab === 'work-info' && (
                  <div className="space-y-3">
                    {employeeData?.departmentName && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-building text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Department</p>
                          <p className="text-sm text-muted-foreground">{employeeData.departmentName}</p>
                        </div>
                      </div>
                    )}
                    {employeeData?.role && (
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <i className="fas fa-user-tie text-sm text-muted-foreground"></i>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Role</p>
                          <p className="text-sm text-muted-foreground">{employeeData.role}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

        {/* Right Column - Activity Details */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Employee Activity</CardTitle>
                  <p className="text-sm text-muted-foreground">View visits, attendance, expenses, and daily pricing</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex border-b">
                  <button 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === 'visits' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('visits')}
                  >
                    <i className="fas fa-map-marked-alt"></i> Visits
                  </button>
                  <button 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === 'attendance' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('attendance')}
                  >
                    <i className="fas fa-calendar-check"></i> Attendance
                  </button>
                  <button 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === 'expenses' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('expenses')}
                  >
                    <i className="fas fa-receipt"></i> Expenses
                  </button>
                  <button 
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === 'daily-pricing' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setActiveTab('daily-pricing')}
                  >
                    <i className="fas fa-tags"></i> Daily Pricing
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
                    <div className="space-y-3">
                      {visits.map((visit) => {
                        let status = 'Scheduled';
                        if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
                          status = 'Completed';
                        } else if (visit.checkinDate && visit.checkinTime) {
                          status = 'In Progress';
                        }
                        const { color } = getStatusInfo(status);

    return (
                          <div 
                            key={visit.id} 
                            className="rounded-lg border bg-card p-4 cursor-pointer hover:shadow-sm transition-shadow"
                            onClick={() => handleViewVisit(visit.id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <h4 className="font-semibold text-sm">{visit.storeName}</h4>
                                  <p className="text-xs text-muted-foreground">Visit on {format(new Date(visit.visit_date), 'MMM dd, yyyy')}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                                {status}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              <span className="font-medium">Purpose:</span> {visit.purpose}
                            </div>
                            {visit.checkinTime && visit.checkoutTime && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Duration:</span> {formatDuration(intervalToDuration({
                                  start: new Date(`${visit.checkinDate}T${visit.checkinTime}`),
                                  end: new Date(`${visit.checkoutDate}T${visit.checkoutTime}`)
                                }))}
                              </div>
                            )}
                            <div className="flex justify-end mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleViewVisit(visit.id);
                                }}
                              >
                                View Visit
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 27 }, (_, index) => (
                            <SelectItem key={index} value={(2023 + index).toString()}>
                              {2023 + index}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, index) => (
                            <SelectItem key={index} value={(index + 1).toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-lg border bg-card p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {(attendanceStats?.statsDto as Record<string, unknown>)?.fullDays as number || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Full Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-yellow-600 mb-2">
                            {(attendanceStats?.statsDto as Record<string, unknown>)?.halfDays as number || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Half Days</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600 mb-2">
                            {(attendanceStats?.statsDto as Record<string, unknown>)?.absences as number || 0}
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">Absences</div>
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
