"use client";

import { useState, useEffect, useCallback } from "react";
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
  department: string;
  position: string;
}

interface CustomerVisitDetail {
  completedVisitCount: number;
  customerType: string;
  avgIntentLevel: number;
  avgMonthlySales: number;
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
      const response = await fetch("/api/proxy/employee/getAll", {
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
    setIsLoading(true);

    if (!token) {
      console.error("Auth token is missing");
      return;
    }

    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0);
    const nextDay = new Date(lastDayOfMonth);
    nextDay.setDate(lastDayOfMonth.getDate() + 1);
    const endDate = nextDay.toISOString().split("T")[0];

    try {
      const response = await fetch(
        `/api/proxy/attendance-log/getForRange1?start=${startDate}&end=${endDate}`,
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

      // Backend now returns correct status with activity-based logic
      // No normalization needed - use data as-is
      setAttendanceData(data);
      setNoDataMessage("");

      if (data.length === 0) {
        setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setAttendanceData([]);
      setNoDataMessage("No data available for the selected month and year. Please choose a different month or year.");
    }

    setIsLoading(false);
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
            const customerVisitUrl = `/api/proxy/visit/customer-visit-details?employeeId=${employee.id}&startDate=${date}&endDate=${date}&customerType=${encodeURIComponent(customerType)}`;
            
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
        const timelineUrl = `/api/proxy/timeline/getByDate?employeeId=${employee.id}&date=${date}`;
        
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
    <div className="container mx-auto py-8 px-4 sm:px-8">
      {/* Filters Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
        {/* Year, Month, and Search Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="w-full sm:w-auto">
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto">
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto">
            <Input
              type="text"
              placeholder="Filter by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="w-full sm:w-[180px]"
            />
          </div>
        </div>

        {/* Legend Section */}
        <div className="shrink-0">
          <p className="text-sm font-semibold mb-2">Legend:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <div className="flex items-center whitespace-nowrap">
              <div className="w-3 h-3 bg-purple-500 mr-1.5 rounded shrink-0"></div>
              <p>Paid Leave</p>
            </div>
            <div className="flex items-center whitespace-nowrap">
              <div className="w-3 h-3 bg-cyan-500 mr-1.5 rounded shrink-0"></div>
              <p>Activity</p>
            </div>
            <div className="flex items-center whitespace-nowrap">
              <div className="w-3 h-3 bg-green-500 mr-1.5 rounded shrink-0"></div>
              <p>Full Day</p>
            </div>
            <div className="flex items-center whitespace-nowrap">
              <div className="w-3 h-3 bg-yellow-500 mr-1.5 rounded shrink-0"></div>
              <p>Half Day</p>
            </div>
            <div className="flex items-center whitespace-nowrap">
              <div className="w-3 h-3 bg-blue-500 mr-1.5 rounded shrink-0"></div>
              <p>Present</p>
            </div>
            <div className="flex items-center whitespace-nowrap">
              <div className="w-3 h-3 bg-red-500 mr-1.5 rounded shrink-0"></div>
              <p>Absent</p>
            </div>
          </div>
        </div>
      </div>

      {noDataMessage && <p className="mb-4 text-red-500">{noDataMessage}</p>}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-48 bg-gray-200 animate-pulse rounded-lg"></div>
          ))
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    position: employee.position,
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
