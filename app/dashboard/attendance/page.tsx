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
          return;
        }

        // Use timeline API to get both visits AND activities for the date
        const url = `/api/proxy/timeline/getByDate?employeeId=${employee.id}&date=${date}`;
        
        console.log('Making timeline API request to:', url);
        console.log('Request params:', { date, employeeId: employee.id, employeeName, token: token ? 'Present' : 'Missing' });
        
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch timeline data");
        }

        const data = await response.json();
        
        console.log('Timeline API Response:', {
          date,
          employeeName,
          activityCount: data.activityCount,
          visitCount: data.visitCount,
          completedVisitCount: data.completedVisitCount,
          attendanceStatus: data.attendanceStatus,
          activities: data.activities,
          visits: data.visits
        });

        // Store only the visit list for the modal
        const visits = Array.isArray(data?.visits) ? (data.visits as VisitDetail[]) : [];
        setVisitData(visits);
        setSelectedDate(date);
        setSelectedEmployeeName(employeeName);
        setIsModalOpen(true);

      } catch (error) {
        console.error("Error fetching timeline data:", error);
        setVisitData([]);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
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
          <div>
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
          <div>
            <Input
              type="text"
              placeholder="Filter by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Legend:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 mr-1.5 rounded"></div>
              <p>Paid Leave</p>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-cyan-500 mr-1.5 rounded"></div>
              <p>Activity</p>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 mr-1.5 rounded"></div>
              <p>Full Day</p>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 mr-1.5 rounded"></div>
              <p>Half Day</p>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 mr-1.5 rounded"></div>
              <p>Present</p>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 mr-1.5 rounded"></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    name: `${employee.firstName} ${employee.lastName}`,
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
      />
    </div>
  );
}
