"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import EmployeeDetailPage from "@/components/employee-detail-page";
import { API, type EmployeeUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Loader } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  hireDate: string;
  status: string;
  avatar: string;
  employeeId: string;
  manager: string;
  location: string;
}

export default function EmployeeDetail() {
  const params = useParams();
  const { token } = useAuth();
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!token || !params.id) return;

      try {
        setIsLoading(true);
        const employeeId = Number(params.id);
        
        // Fetch employee data using the API
        const data: EmployeeUserDto = await API.getEmployeeById(employeeId);
        
        // Transform the API data to match the component's expected format
        const transformedData = {
          id: data.id,
          name: `${data.firstName} ${data.lastName}`,
          email: data.email || "N/A",
          phone: data.primaryContact ? `+${data.primaryContact}` : "N/A",
          position: data.role || "Sales Executive",
          department: data.departmentName || "Sales",
          hireDate: data.dateOfJoining || "N/A",
          status: "Active", // Default status since it's not in the API response
          avatar: "/placeholder.svg?height=100&width=100",
          employeeId: data.userDto?.employeeId ? `EMP-${data.userDto.employeeId}` : `EMP-${data.id}`,
          manager: "N/A", // This would need to be fetched separately if needed
          location: `${data.city || ""}, ${data.state || ""}`.replace(/^,\s*|,\s*$/g, '') || "N/A",
        };

        setEmployeeData(transformedData);
      } catch (err: unknown) {
        console.error('Error fetching employee data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load employee data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployeeData();
  }, [token, params.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading employee details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading employee data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!employeeData) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Employee not found</p>
      </div>
    );
  }

  return <EmployeeDetailPage employee={employeeData} />;
}
