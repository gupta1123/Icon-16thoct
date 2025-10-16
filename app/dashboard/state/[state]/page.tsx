"use client";

import { use, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import EmployeeCard from "@/components/employee-card";
import { API, type DashboardEmployeeSummary } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

type Employee = {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
  totalVisits: number;
};

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

export default function StateDetailPage({ params }: { params: Promise<{ state: string }> }) {
  const router = useRouter();
  const { token } = useAuth();
  const resolvedParams = use(params);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Decode the state name from URL parameter
  const stateName = decodeURIComponent(resolvedParams.state);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get dashboard overview to filter employees by state
        const overview = await API.getDashboardOverview();
        
        // Filter employees for this specific state and only show active ones
        // Use consistent active definition: only assigned or ongoing visits count as "active"
        const stateEmployees = overview.employees
          .filter(emp => emp.state === stateName)
          .filter(emp => emp.assignedVisits > 0 || emp.ongoingVisits > 0)
          .map(emp => ({
            id: emp.employeeId,
            name: emp.employeeName || `Employee ${emp.employeeId}`,
            position: emp.role || 'Employee',
            avatar: getInitials(emp.employeeName || 'E'),
            lastUpdated: emp.liveLocationUpdatedAt || emp.lastVisitAt || new Date().toISOString(),
            status: emp.ongoingVisits > 0 ? 'ongoing' : emp.assignedVisits > 0 ? 'assigned' : 'idle',
            location: [emp.city, emp.state].filter(Boolean).join(', '),
            totalVisits: emp.totalVisits
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setEmployees(stateEmployees);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
        setError(error instanceof Error ? error.message : 'Failed to load employees');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [stateName, token]);

  const handleEmployeeSelect = (employee: { id: number }) => {
    router.push(`/dashboard/employee/${employee.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{stateName} - Employee Details</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">{stateName} - Employee Details</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Error loading employees</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">{stateName} - Employee Details</h1>
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">No active employees found</p>
              <p className="text-sm mt-1">
                There are no employees with visit activity in {stateName} for the current period.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <EmployeeCard 
              key={employee.id} 
              employee={employee} 
              onClick={() => handleEmployeeSelect(employee)}
            />
          ))}
        </div>
      )}
    </div>
  );
}