"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { API, type StoreDto, type EmployeeUserDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

interface VisitFormData {
  storeId: number | null;
  employeeId: number | null;
  visit_date: string;
  purpose: string;
  isSelfGenerated: boolean;
  assignedById?: number;
}

export default function AddVisitPage() {
  const router = useRouter();
  const { currentUser, userRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState<VisitFormData>({
    storeId: null,
    employeeId: null,
    visit_date: format(new Date(), 'yyyy-MM-dd'),
    purpose: '',
    isSelfGenerated: true,
  });
  
  // Options data
  const [stores, setStores] = useState<StoreDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // UI state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Determine if user is a regional manager
  const isRegionalManager = userRole === 'MANAGER' || 
    currentUser?.authorities?.some(auth => auth.authority === 'ROLE_MANAGER');

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingData(true);
      try {
        // Load stores and employees in parallel
        const [storesData, employeesData] = await Promise.all([
          API.getStoresFiltered({ page: 0, size: 1000 }),
          API.getAllEmployees()
        ]);
        
        setStores(storesData);
        setEmployees(employeesData);
        
        // Set default employee if current user is an employee
        if (currentUser && employeesData.length > 0) {
          const currentEmployee = employeesData.find(emp => 
            emp.userDto?.username === currentUser.username
          );
          if (currentEmployee) {
            setFormData(prev => ({
              ...prev,
              employeeId: currentEmployee.id,
              isSelfGenerated: true
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('Failed to load stores and employees data');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadInitialData();
  }, [currentUser]);

  // Update visit_date when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        visit_date: format(selectedDate, 'yyyy-MM-dd')
      }));
    }
  }, [selectedDate]);

  const handleInputChange = (field: keyof VisitFormData, value: VisitFormData[keyof VisitFormData]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.storeId || !formData.employeeId || !formData.visit_date || !formData.purpose.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: {
        storeId: number;
        employeeId: number;
        visit_date: string;
        purpose: string;
        isSelfGenerated: boolean;
        assignedById?: number;
      } = {
        storeId: formData.storeId as number,
        employeeId: formData.employeeId as number,
        visit_date: formData.visit_date,
        purpose: formData.purpose.trim(),
        isSelfGenerated: formData.isSelfGenerated
      };

      // Add assignedById for employee-generated visits
      if (!formData.isSelfGenerated && currentUser) {
        // Find current user's employee ID
        const currentEmployee = employees.find(emp => 
          emp.userDto?.username === currentUser.username
        );
        if (currentEmployee) {
          payload.assignedById = currentEmployee.id;
        }
      }

      // Make API call using the API service
      const visitId = await API.createVisit(payload);
      console.log('Visit created successfully with ID:', visitId);
      
      setSuccess(true);
      
      // Redirect to visits list after a short delay
      setTimeout(() => {
        router.push('/dashboard/visits');
      }, 2000);

    } catch (err) {
      console.error('Error creating visit:', err);
      setError(err instanceof Error ? err.message : 'Failed to create visit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    router.push('/dashboard/visits');
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg">Loading data...</span>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800">Visit Created Successfully!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Redirecting to visits list...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Visits
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Visit</h1>
          <p className="text-sm text-muted-foreground">
            Create a new visit for tracking and management
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Visit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Store Selection */}
            <div className="space-y-2">
              <Label htmlFor="store">Store *</Label>
              <Select
                value={formData.storeId?.toString() || ""}
                onValueChange={(value) => handleInputChange('storeId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.storeId} value={store.storeId.toString()}>
                      {store.storeName} - {store.clientFirstName} {store.clientLastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Selection */}
            <div className="space-y-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select
                value={formData.employeeId?.toString() || ""}
                onValueChange={(value) => handleInputChange('employeeId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      {employee.firstName} {employee.lastName}{employee.employeeId ? ` (${employee.employeeId})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visit Date */}
            <div className="space-y-2">
              <Label>Visit Date *</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setIsDatePickerOpen(false);
                    }}
                    disabled={(date) => date < new Date("1900-01-01")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Purpose */}
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose *</Label>
              <Textarea
                id="purpose"
                placeholder="Enter the purpose of this visit..."
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                rows={3}
              />
            </div>

            {/* Visit Type (only for Regional Managers) */}
            {isRegionalManager && (
              <div className="space-y-2">
                <Label>Visit Type</Label>
                <Select
                  value={formData.isSelfGenerated ? "self" : "assigned"}
                  onValueChange={(value) => handleInputChange('isSelfGenerated', value === "self")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select visit type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Self Generated</SelectItem>
                    <SelectItem value="assigned">Employee Generated</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.isSelfGenerated 
                    ? "Visit is generated by the employee themselves"
                    : "Visit is assigned by a manager to an employee"
                  }
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Visit...
                  </>
                ) : (
                  "Create Visit"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
