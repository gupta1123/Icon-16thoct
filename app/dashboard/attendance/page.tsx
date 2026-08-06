"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchIcon, Loader2, Calendar, Sun, CloudSun, XCircle } from "lucide-react";
import EmployeeAttendanceCard from "@/components/employee-attendance-card";
import VisitDetailsModal, { type VisitDetail } from "@/components/visit-details-modal";
import { Text } from "@/components/ui/typography";
import { authService } from "@/lib/auth";
import {
  extractAuthorityRoles,
  hasAnyRole,
  normalizeRoleValue,
} from "@/lib/role-utils";
import { format } from "date-fns";

interface AttendanceData {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: string; // Can be: 'full day', 'half day', 'present', 'absent', 'paid leave', 'full day (activity)'
  checkinDate: string;
  checkoutDate: string;
  visitCount?: number;
  assignedVisits?: number;
  hasActivity?: boolean;
  activityCount?: number;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  department?: string;
  position?: string;
  role?: string;
}

interface CustomerVisitDetail {
  completedVisitCount: number;
  customerType: string;
  avgIntentLevel: number;
  avgStock?: number;
  avgMonthlySales?: number;
  visitCount: number;
  lastVisited: string;
  city: string;
  taluka: string | null;
  state: string;
  storeId: number;
  customerName: string;
}

interface Activity {
  id?: number;
  title?: string;
  name?: string;
  description?: string;
  notes?: string;
  date?: string;
  createdDate?: string;
  time?: string;
  createdTime?: string;
}

const years = Array.from({ length: 27 }, (_, index) => 2024 + index);
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatRoleDisplay = (role?: string, position?: string): string => {
  const raw = role || position;
  if (!raw) return 'Field Officer';
  
  const cleaned = raw.replace(/^ROLE_/i, '').replace(/_/g, ' ');
  return cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function AttendancePage() {
  const router = useRouter();
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [noDataMessage, setNoDataMessage] = useState<string>("");
  const [nameFilter, setNameFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [visitData, setVisitData] = useState<VisitDetail[]>([]);
  const [customerVisitDetails, setCustomerVisitDetails] = useState<CustomerVisitDetail[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');

  const selectedYearRef = useRef(selectedYear);
  const selectedMonthRef = useRef(selectedMonth);

  useEffect(() => {
    selectedYearRef.current = selectedYear;
    selectedMonthRef.current = selectedMonth;
  }, [selectedYear, selectedMonth]);

  // Get token from localStorage (you may need to adjust this based on your auth setup)
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  // Redirect users without attendance access (e.g., coordinators, regional managers)
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    const userRole = authService.getUserRole();

    const normalizedRole = normalizeRoleValue(userRole);
    const authorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);

    const isCoordinator = hasAnyRole(normalizedRole, authorityRoles, ['COORDINATOR']);
    const isRegionalManager = hasAnyRole(normalizedRole, authorityRoles, [
      'MANAGER',
      'OFFICE_MANAGER',
      'REGIONAL_MANAGER',
      'AVP',
    ]);

    if (isCoordinator || isRegionalManager) {
      router.push('/dashboard');
    }
  }, [router]);

  const fetchEmployees = useCallback(async () => {
    if (!token) {
      console.error("Auth token is missing");
      return;
    }

    try {
      const response = await fetch("https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/employee/getAll", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }

      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, [token]);

  const fetchAttendanceData = useCallback(async () => {
    const reqYear = selectedYear;
    const reqMonth = selectedMonth;

    // Immediately trigger loading state and clear stale data from previous month
    setIsLoading(true);
    setAttendanceData([]);
    setNoDataMessage("");

    if (!token) {
      console.error("Auth token is missing");
      setIsLoading(false);
      return;
    }

    // Keep month boundaries in the user's local calendar. Converting local
    // midnight to UTC shifts these dates back one day in positive timezones.
    const startDate = format(new Date(reqYear, reqMonth, 1), "yyyy-MM-dd");
    const endDate = format(new Date(reqYear, reqMonth + 1, 0), "yyyy-MM-dd");

    try {
      const response = await fetch(
        `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/attendance-log/getForRange1?start=${startDate}&end=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch attendance data");
      }

      const data = await response.json();

      // Race-condition guard: only set data if user hasn't switched to a different month/year during request
      if (selectedYearRef.current === reqYear && selectedMonthRef.current === reqMonth) {
        setAttendanceData(data);
        if (data.length === 0) {
          setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
        }
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      if (selectedYearRef.current === reqYear && selectedMonthRef.current === reqMonth) {
        setAttendanceData([]);
        setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
      }
    } finally {
      if (selectedYearRef.current === reqYear && selectedMonthRef.current === reqMonth) {
        setIsLoading(false);
      }
    }
  }, [token, selectedYear, selectedMonth]);

  const fetchVisitData = useCallback(
    async (date: string, employeeName: string) => {
      if (!token) {
        console.error("Auth token is missing");
        return;
      }

      try {
        // Find the employee ID from the name
        const employee = employees.find(emp => 
          `${emp.firstName} ${emp.lastName}` === employeeName
        );
        
        if (!employee) {
          console.error('Employee not found:', employeeName);
          setVisitData([]);
          setCustomerVisitDetails([]);
          setActivities([]);
          return;
        }

        // Fetch customer visit details for all customer types
        const customerTypes = ['dealer', 'shop', 'others'];
        const allCustomerVisits: CustomerVisitDetail[] = [];

        for (const customerType of customerTypes) {
          try {
            const customerVisitUrl = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/visit/customer-visit-details?employeeId=${employee.id}&startDate=${date}&endDate=${date}&customerType=${encodeURIComponent(customerType)}`;
            
            const customerResponse = await fetch(customerVisitUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (customerResponse.ok) {
              const customerData: CustomerVisitDetail[] = await customerResponse.json();
              allCustomerVisits.push(...customerData);
            }
          } catch (err) {
            console.error(`Error fetching customer visit details for ${customerType}:`, err);
          }
        }

        // Also fetch timeline data for activities and individual visits
        const timelineUrl = `https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/timeline/getByDate?employeeId=${employee.id}&date=${date}`;
        
        const timelineResponse = await fetch(timelineUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let timelineData = null;
        if (timelineResponse.ok) {
          timelineData = await timelineResponse.json();
        }

        console.log('Customer Visit Details Response:', {
          date,
          employeeName,
          customerVisitsCount: allCustomerVisits.length,
          customerVisits: allCustomerVisits
        });

        console.log('Timeline API Response:', {
          date,
          employeeName,
          activityCount: timelineData?.activityCount,
          visitCount: timelineData?.visitCount,
          completedVisitCount: timelineData?.completedVisitCount,
          attendanceStatus: timelineData?.attendanceStatus,
          activities: timelineData?.activities,
          visits: timelineData?.visits
        });

        // Store data for the modal
        const visits = Array.isArray(timelineData?.visits) ? (timelineData.visits as VisitDetail[]) : [];
        const activitiesData = Array.isArray(timelineData?.activities) ? timelineData.activities : [];
        
        setVisitData(visits);
        setCustomerVisitDetails(allCustomerVisits);
        setActivities(activitiesData);
        setSelectedDate(date);
        setSelectedEmployeeName(employeeName);
        setIsModalOpen(true);

      } catch (error) {
        console.error("Error fetching visit data:", error);
        setVisitData([]);
        setCustomerVisitDetails([]);
        setActivities([]);
      }
    },
    [token, employees]
  );

  useEffect(() => {
    fetchAttendanceData();
    fetchEmployees();
  }, [selectedYear, selectedMonth, token, fetchAttendanceData, fetchEmployees]);

  // Filter employees by name, then sort
  const filteredEmployees = employees
    .filter((employee) =>
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(nameFilter.toLowerCase())
    )
    .sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  return (
    <div className="max-w-[1400px] mx-auto p-2 sm:p-4 space-y-4">
      {/* Compact Filters & Legend Header Bar */}
      <div className="bg-card p-3.5 sm:p-4 rounded-xl border border-border/60 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Controls: Year, Month, Name Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(value) => {
                setIsLoading(true);
                setAttendanceData([]);
                setSelectedYear(parseInt(value));
              }}
            >
              <SelectTrigger className="w-[120px] h-9 text-xs font-semibold rounded-lg border-border/80">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()} className="text-xs">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(value) => {
                setIsLoading(true);
                setAttendanceData([]);
                setSelectedMonth(parseInt(value));
              }}
            >
              <SelectTrigger className="w-[130px] h-9 text-xs font-semibold rounded-lg border-border/80">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()} className="text-xs">
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-border/80"
              />
            </div>
          </div>

          {/* Inline Legend Pills */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-medium text-muted-foreground pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
            <span className="text-xs font-semibold text-foreground mr-1">Legend:</span>
            <div className="flex items-center gap-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-md border border-purple-500/20">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>Paid Leave</span>
            </div>
            <div className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-500/20">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              <span>Activity</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Full Day</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Half Day</span>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-md border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Absent</span>
            </div>
          </div>
        </div>
      </div>

      {noDataMessage && <p className="mb-4 text-red-500">{noDataMessage}</p>}

      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-72 bg-card border border-border/60 animate-pulse rounded-xl p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-muted shrink-0"></div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="h-3.5 bg-muted rounded w-28"></div>
                    <div className="h-2.5 bg-muted rounded w-20"></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="h-10 bg-muted rounded-lg"></div>
                  <div className="h-10 bg-muted rounded-lg"></div>
                  <div className="h-10 bg-muted rounded-lg"></div>
                </div>
                <div className="h-40 bg-muted/80 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEmployees.map((employee) => {
              const initialSummary = { fullDays: 0, halfDays: 0, absentDays: 0 };
              const employeeAttendance = attendanceData.filter((data) => data.employeeId === employee.id);
              
              // Console log the dates for this employee
              const employeeDates = employeeAttendance.map(item => new Date(item.checkinDate).getDate());
              console.log(`Dates passed to AttendanceCard for ${employee.firstName} ${employee.lastName}:`, employeeDates);
              
              return (
                <EmployeeAttendanceCard
                  key={employee.id}
                  employee={{
                    id: employee.id,
                    name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Unknown Employee',
                    position: formatRoleDisplay(employee.role, employee.position),
                    avatar: "/placeholder.svg?height=40&width=40",
                    fullDays: 0,
                    halfDays: 0,
                    absent: 0,
                    attendance: employeeAttendance.map(att => ({
                      date: att.checkinDate,
                      status: att.attendanceStatus === 'full day' ? 'present' as const : 'absent' as const,
                      visits: [{
                        id: att.id,
                        customer: `Visit #${att.id}`,
                        time: '09:00',
                        purpose: "Field Visit"
                      }]
                    }))
                  }}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  attendanceData={employeeAttendance}
                  onDateClick={(date, employeeName) => fetchVisitData(date, employeeName)}
                />
              );
            })}
          </div>
        )}
      </div>

      <VisitDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        visitData={visitData}
        selectedDate={selectedDate}
        employeeName={selectedEmployeeName}
        customerVisitDetails={customerVisitDetails}
        activities={activities}
      />
    </div>
  );
}
