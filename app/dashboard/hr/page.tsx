"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  Users, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  Clock,
  UserCheck,
  Building,
  FileText,
  AlertCircle
} from "lucide-react";
import { Heading, Text } from "@/components/ui/typography";
import { useAuth } from "@/components/auth-provider";
import { API, type EmployeeUserDto, type ReportCountsItem, type AttendanceLogItem } from "@/lib/api";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function HRDashboard() {
  const { userRole, currentUser, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0
  });
  const [salaryStats, setSalaryStats] = useState({
    totalSalary: 0,
    averageSalary: 0,
    pendingApprovals: 0
  });
  const [expenseStats, setExpenseStats] = useState({
    totalExpenses: 0,
    pendingExpenses: 0,
    approvedExpenses: 0
  });

  // Check if user is HR
  const isHR = userRole === 'HR' || currentUser?.authorities?.some((auth: { authority: string }) => auth.authority === 'ROLE_HR');

  useEffect(() => {
    const loadHRData = async () => {
      if (!isHR || !token) return;

      try {
        setIsLoading(true);
        
        // Load employees
        const employeeData = await API.getAllEmployees();
        setEmployees(employeeData || []);

        // Load attendance data for today
        const today = format(new Date(), 'yyyy-MM-dd');
        const attendanceData = await API.getAttendanceByDate(today);
        
        // Calculate attendance stats
        const totalEmployees = employeeData?.length || 0;
        const presentToday = attendanceData?.filter(att => 
          att.attendanceStatus === 'PRESENT' || att.attendanceStatus === 'FULL_DAY'
        ).length || 0;
        const absentToday = attendanceData?.filter(att => 
          att.attendanceStatus === 'ABSENT'
        ).length || 0;
        const lateToday = attendanceData?.filter(att => 
          att.attendanceStatus === 'HALF_DAY' || att.attendanceStatus === 'LATE'
        ).length || 0;

        setAttendanceStats({
          totalEmployees,
          presentToday,
          absentToday,
          lateToday
        });

        // Load salary stats (mock data for now)
        setSalaryStats({
          totalSalary: totalEmployees * 50000, // Mock calculation
          averageSalary: 50000,
          pendingApprovals: 5
        });

        // Load expense stats (mock data for now)
        setExpenseStats({
          totalExpenses: 250000,
          pendingExpenses: 12,
          approvedExpenses: 8
        });

      } catch (error) {
        console.error('Error loading HR data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHRData();
  }, [isHR, token]);

  if (!isHR) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <Heading as="h2" size="xl" weight="semibold" className="mb-2">
            Access Denied
          </Heading>
          <Text tone="muted">
            You don&apos;t have permission to access HR features.
          </Text>
        </Card>
      </div>
    );
  }

  const quickActions = [
    {
      title: "Attendance Records",
      description: "Track employee attendance",
      icon: CheckCircle,
      href: "/dashboard/hr/attendance",
      color: "bg-blue-500"
    },
    {
      title: "HR Settings",
      description: "Configure HR policies",
      icon: UserCheck,
      href: "/dashboard/hr/settings",
      color: "bg-purple-500"
    }
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold">
                  {attendanceStats.totalEmployees}
                </Heading>
                <Text size="xs" tone="muted">
                  Active employees
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Present Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold" className="text-green-600">
                  {attendanceStats.presentToday}
                </Heading>
                <Text size="xs" tone="muted">
                  {attendanceStats.totalEmployees > 0 
                    ? `${Math.round((attendanceStats.presentToday / attendanceStats.totalEmployees) * 100)}% attendance`
                    : '0% attendance'
                  }
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Absent Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold" className="text-red-600">
                  {attendanceStats.absentToday}
                </Heading>
                <Text size="xs" tone="muted">
                  Need attention
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold" className="text-orange-600">
                  {salaryStats.pendingApprovals + expenseStats.pendingExpenses}
                </Heading>
                <Text size="xs" tone="muted">
                  Awaiting review
                </Text>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          Quick Actions
        </Heading>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="cursor-pointer transition-all hover:shadow-md hover:scale-105">
                  <CardHeader className="pb-3">
                    <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Text size="sm" tone="muted">
                      {action.description}
                    </Text>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          Recent Activity
        </Heading>
        <Card>
          <CardHeader>
            <CardTitle>HR Activity Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <Text>Employee attendance recorded for today</Text>
                  </div>
                  <Badge variant="secondary">Today</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <Text>Salary updates pending review</Text>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <Text>New expense claims submitted</Text>
                  </div>
                  <Badge variant="outline">2 hours ago</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
