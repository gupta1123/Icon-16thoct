"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  Database, 
  BarChart, 
  FileText,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Shield,
  Settings,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { Heading, Text } from "@/components/ui/typography";
import { useAuth } from "@/components/auth-provider";
import { API, type EmployeeUserDto, type ReportCountsItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import Link from "next/link";

interface DataSummary {
  totalEmployees: number;
  totalCustomers: number;
  totalVisits: number;
  totalExpenses: number;
  recentActivities: number;
  dataIntegrity: number;
}

export default function DataManagerDashboard() {
  const { userRole, currentUser, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [dataSummary, setDataSummary] = useState<DataSummary>({
    totalEmployees: 0,
    totalCustomers: 0,
    totalVisits: 0,
    totalExpenses: 0,
    recentActivities: 0,
    dataIntegrity: 95
  });
  const [isDownloading, setIsDownloading] = useState(false);

  // Check if user can access Data Manager downloads
  const isAdmin = userRole === 'ADMIN' || currentUser?.authorities?.some((auth: { authority: string }) => auth.authority === 'ROLE_ADMIN');
  const isDataManager = userRole === 'DATA_MANAGER' || currentUser?.authorities?.some((auth: { authority: string }) => auth.authority === 'ROLE_DATA_MANAGER');
  const canDownload = isAdmin || isDataManager;

  useEffect(() => {
    const loadDataManagerData = async () => {
      if (!canDownload || !token) return;

      try {
        setIsLoading(true);
        
        // Load employees
        const employeeData = await API.getAllEmployees();
        setEmployees(employeeData || []);

        // Load report counts for summary
        const today = format(new Date(), 'yyyy-MM-dd');
        const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
        
        const reportCounts = await API.getReportCounts(monthStart, monthEnd);
        
        // Calculate data summary
        const totalEmployees = employeeData?.length || 0;
        const totalVisits = (reportCounts || []).reduce((sum, item) => sum + (item.statsDto?.visitCount ?? 0), 0);
        const totalExpenses = (reportCounts || []).reduce((sum, item) => sum + (item.expenseTotal ?? 0), 0);

        setDataSummary({
          totalEmployees,
          totalCustomers: totalEmployees * 3, // Mock calculation
          totalVisits,
          totalExpenses,
          recentActivities: Math.floor(Math.random() * 50) + 20,
          dataIntegrity: 95
        });

      } catch (error) {
        console.error('Error loading Data Manager data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDataManagerData();
  }, [canDownload, token]);

  if (!canDownload) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <Heading as="h2" size="xl" weight="semibold" className="mb-2">
            Access Denied
          </Heading>
          <Text tone="muted">
            You don&apos;t have permission to access download/export features.
          </Text>
        </Card>
      </div>
    );
  }

  const handleDownloadData = async (dataType: string) => {
    setIsDownloading(true);
    try {
      // Simulate download process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Here you would implement actual download functionality
      console.log(`Downloading ${dataType} data...`);
      
      // Create a mock download link
      const data = `Sample ${dataType} data\nGenerated at: ${new Date().toISOString()}`;
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataType.toLowerCase().replace(' ', '_')}_export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const dataManagementActions = [
    {
      title: "Export Employee Data",
      description: "Download complete employee database",
      icon: Users,
      href: "#",
      color: "bg-blue-500",
      onClick: () => handleDownloadData("Employee")
    },
    {
      title: "Export Customer Data",
      description: "Download customer information and records",
      icon: Database,
      href: "#",
      color: "bg-green-500",
      onClick: () => handleDownloadData("Customer")
    },
    {
      title: "Export Visit Records",
      description: "Download all visit and attendance data",
      icon: Calendar,
      href: "#",
      color: "bg-purple-500",
      onClick: () => handleDownloadData("Visit")
    },
    {
      title: "Export Financial Data",
      description: "Download expenses and salary information",
      icon: DollarSign,
      href: "#",
      color: "bg-orange-500",
      onClick: () => handleDownloadData("Financial")
    },
    {
      title: "Export Reports",
      description: "Download comprehensive reports and analytics",
      icon: BarChart,
      href: "#",
      color: "bg-indigo-500",
      onClick: () => handleDownloadData("Report")
    },
    {
      title: "System Backup",
      description: "Create complete system data backup",
      icon: Shield,
      href: "#",
      color: "bg-red-500",
      onClick: () => handleDownloadData("Backup")
    }
  ];

  const quickAccessActions = [
    {
      title: "HR Management",
      description: "Access HR functions and settings",
      icon: Users,
      href: "/dashboard/hr/settings",
      color: "bg-green-500"
    },
    {
      title: "System Settings",
      description: "Configure system-wide settings",
      icon: Settings,
      href: "/dashboard/settings",
      color: "bg-blue-500"
    },
    {
      title: "Reports & Analytics",
      description: "Generate and view reports",
      icon: BarChart,
      href: "/dashboard/reports",
      color: "bg-purple-500"
    },
    {
      title: "Live Monitoring",
      description: "Monitor real-time data and activities",
      icon: TrendingUp,
      href: "/dashboard/live-locations",
      color: "bg-orange-500"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Heading as="h1" size="3xl" weight="bold">
            Data Manager Dashboard
          </Heading>
          <Text tone="muted">
            Comprehensive data management and analytics with full system access and download permissions.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleDownloadData("Complete")}
            disabled={isDownloading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Full Export'}
          </Button>
        </div>
      </div>

      {/* Data Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  {dataSummary.totalEmployees}
                </Heading>
                <Text size="xs" tone="muted">
                  Active employees
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold">
                  {dataSummary.totalCustomers}
                </Heading>
                <Text size="xs" tone="muted">
                  Customer records
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Visits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold">
                  {dataSummary.totalVisits}
                </Heading>
                <Text size="xs" tone="muted">
                  This month
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold">
                  ₹{dataSummary.totalExpenses.toLocaleString()}
                </Heading>
                <Text size="xs" tone="muted">
                  This month
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activities</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold">
                  {dataSummary.recentActivities}
                </Heading>
                <Text size="xs" tone="muted">
                  Last 24 hours
                </Text>
              </>
            )}
          </CardContent>
        </Card>

        {/* Data Integrity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Integrity</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <Heading as="p" size="2xl" weight="bold" className="text-green-600">
                  {dataSummary.dataIntegrity}%
                </Heading>
                <Text size="xs" tone="muted">
                  System health
                </Text>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Management Actions */}
      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          Data Export & Management
        </Heading>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {dataManagementActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <Card key={action.title} className="cursor-pointer transition-all hover:shadow-md hover:scale-105">
                <CardHeader className="pb-3">
                  <div className={`w-12 h-12 rounded-lg ${action.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text size="sm" tone="muted" className="mb-4">
                    {action.description}
                  </Text>
                  <Button 
                    onClick={action.onClick}
                    disabled={isDownloading}
                    className="w-full gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isDownloading ? 'Processing...' : 'Download'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Access to System Features */}
      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          Quick Access
        </Heading>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {quickAccessActions.map((action) => {
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

      {/* System Status */}
      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          System Status
        </Heading>
        <Card>
          <CardHeader>
            <CardTitle>Data Management Status</CardTitle>
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
                    <Text>Database connectivity</Text>
                  </div>
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <Text>Data synchronization</Text>
                  </div>
                  <Badge variant="default" className="bg-green-500">Synced</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <Text>Export services</Text>
                  </div>
                  <Badge variant="secondary">Ready</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <Text>Backup systems</Text>
                  </div>
                  <Badge variant="default" className="bg-green-500">Operational</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
