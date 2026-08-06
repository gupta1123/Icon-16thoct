"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchIcon, Loader2, Grid3X3, Table as TableIcon, CalendarIcon, Download, Check, X } from "lucide-react";
import EmployeeExpenseCard from "@/components/employee-expense-card";
import { Text } from "@/components/ui/typography";
import { apiService, ExpenseDto } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: "approved" | "pending" | "rejected";
}

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  totalExpenses: number;
  approved: number;
  pending: number;
  rejected: number;
  expenses: Expense[];
}

// Mock data for employees and their expenses (fallback)
const mockEmployees = [
  {
    id: 1,
    name: "Alice Smith",
    position: "Field Officer",
    avatar: "/placeholder.svg?height=40&width=40",
    totalExpenses: 1250.75,
    approved: 950.50,
    pending: 200.25,
    rejected: 100.00,
    expenses: [
      { id: 1, date: "2023-06-15", category: "Travel", amount: 45.50, description: "Taxi to client meeting", status: "approved" },
      { id: 2, date: "2023-06-10", category: "Meals", amount: 32.75, description: "Lunch with client", status: "pending" },
      { id: 3, date: "2023-06-05", category: "Supplies", amount: 15.99, description: "Office supplies", status: "approved" },
      { id: 4, date: "2023-06-01", category: "Travel", amount: 65.00, description: "Bus fare", status: "rejected" },
      { id: 5, date: "2023-05-28", category: "Meals", amount: 28.50, description: "Team lunch", status: "approved" },
      { id: 6, date: "2023-05-25", category: "Supplies", amount: 42.25, description: "Stationery", status: "pending" },
      { id: 7, date: "2023-05-20", category: "Travel", amount: 55.75, description: "Train ticket", status: "approved" },
    ]
  },
  {
    id: 2,
    name: "Bob Johnson",
    position: "Field Officer",
    avatar: "/placeholder.svg?height=40&width=40",
    totalExpenses: 890.25,
    approved: 720.00,
    pending: 120.25,
    rejected: 50.00,
    expenses: [
      { id: 8, date: "2023-06-12", category: "Travel", amount: 35.00, description: "Metro fare", status: "approved" },
      { id: 9, date: "2023-06-08", category: "Meals", amount: 25.50, description: "Client dinner", status: "pending" },
      { id: 10, date: "2023-06-03", category: "Supplies", amount: 18.99, description: "Printing", status: "approved" },
    ]
  },
  {
    id: 3,
    name: "Charlie Brown",
    position: "Sales Manager",
    avatar: "/placeholder.svg?height=40&width=40",
    totalExpenses: 2100.00,
    approved: 1800.00,
    pending: 200.00,
    rejected: 100.00,
    expenses: [
      { id: 11, date: "2023-06-18", category: "Travel", amount: 120.00, description: "Flight ticket", status: "approved" },
      { id: 12, date: "2023-06-14", category: "Accommodation", amount: 250.00, description: "Hotel stay", status: "pending" },
    ]
  },
  {
    id: 4,
    name: "Diana Prince",
    position: "Field Officer",
    avatar: "/placeholder.svg?height=40&width=40",
    totalExpenses: 650.30,
    approved: 580.30,
    pending: 50.00,
    rejected: 20.00,
    expenses: [
      { id: 13, date: "2023-06-20", category: "Travel", amount: 40.00, description: "Taxi fare", status: "approved" },
      { id: 14, date: "2023-06-16", category: "Meals", amount: 30.00, description: "Business lunch", status: "approved" },
    ]
  },
  {
    id: 5,
    name: "Bruce Wayne",
    position: "Sales Manager",
    avatar: "/placeholder.svg?height=40&width=40",
    totalExpenses: 3200.50,
    approved: 2900.50,
    pending: 200.00,
    rejected: 100.00,
    expenses: [
      { id: 15, date: "2023-06-22", category: "Travel", amount: 450.00, description: "Flight ticket", status: "approved" },
      { id: 16, date: "2023-06-19", category: "Accommodation", amount: 320.00, description: "Hotel booking", status: "pending" },
    ]
  },
];

const today = new Date();
const defaultStartDate = format(startOfMonth(today), 'yyyy-MM-dd');
const defaultEndDate = format(today, 'yyyy-MM-dd');

export default function ExpensesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStartDate, setSelectedStartDate] = useState(defaultStartDate);
  const [selectedEndDate, setSelectedEndDate] = useState(defaultEndDate);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const { token, userRole, currentUser } = useAuth();
  const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const hasAuthority = useCallback((role: string) => {
    const normalizedRole = role.replace('ROLE_', '').toUpperCase();
    const userRoleUpper = userRole?.toUpperCase();
    if (userRoleUpper === role.toUpperCase() || userRoleUpper === normalizedRole) {
      return true;
    }
    return currentUser?.authorities?.some((auth) => auth.authority === role) ?? false;
  }, [currentUser, userRole]);

  const canExport = hasAuthority('ROLE_ADMIN') || hasAuthority('ROLE_DATA_MANAGER');

  // Transform API data to match component interface
  const transformExpenseData = (expenses: ExpenseDto[]): Employee[] => {
    const employeeMap = new Map<string, Employee>();

    expenses.forEach(expense => {
      const employeeName = expense.employeeName;
      
      if (!employeeMap.has(employeeName)) {
        employeeMap.set(employeeName, {
          id: expense.employeeId,
          name: employeeName,
          position: "Field Officer", 
          avatar: "/placeholder.svg?height=40&width=40",
          totalExpenses: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          expenses: []
        });
      }

      const employee = employeeMap.get(employeeName)!;
      const status = expense.approvalStatus.toLowerCase();
      const validStatus = (status === "approved" || status === "pending" || status === "rejected") 
        ? status as "approved" | "pending" | "rejected"
        : "pending" as "approved" | "pending" | "rejected";

      // Format category: show subType only for travel type, otherwise just show type
      const category = expense.type.toLowerCase() === 'travel' && expense.subType
        ? `${expense.type} - ${expense.subType}`
        : expense.type;

      const transformedExpense: Expense = {
        id: expense.id,
        date: expense.expenseDate,
        category: category,
        amount: expense.amount,
        description: expense.description,
        status: validStatus
      };

      employee.expenses.push(transformedExpense);
      employee.totalExpenses += expense.amount;
      
      if (expense.approvalStatus.toLowerCase() === "approved") {
        employee.approved += expense.amount;
      } else if (expense.approvalStatus.toLowerCase() === "pending") {
        employee.pending += expense.amount;
      } else if (expense.approvalStatus.toLowerCase() === "rejected") {
        employee.rejected += expense.amount;
      }
    });

    return Array.from(employeeMap.values());
  };

  // Handle approve expense
  const handleApprove = async (employeeName: string, expenseId: number) => {
    try {
      const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/updateApproval?id=${expenseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approvalStatus: 'Approved',
          approvalDate: new Date().toISOString().split('T')[0],
          reimbursedDate: '2023-03-23',
          reimbursementAmount: 200,
          paymentMethod: 'cash',
        }),
      });

      if (response.ok) {
        // Update local state
        setEmployees(prevEmployees => 
          prevEmployees.map(employee => 
            employee.name === employeeName 
              ? {
                  ...employee,
                  expenses: employee.expenses.map(expense => 
                    expense.id === expenseId 
                      ? { ...expense, status: 'approved' as const }
                      : expense
                  )
                }
              : employee
          )
        );
        console.log('Expense approved successfully');
      } else {
        console.error('Error approving expense');
      }
    } catch (error) {
      console.error('Error approving expense:', error);
    }
  };

  // Handle approve multiple expenses
  const handleApproveMultiple = async (employeeName: string, expenseIds: number[]) => {
    try {
      const approveExpenses = expenseIds.map((expenseId) => ({
        id: expenseId,
        approvalStatus: "Approved",
        approvalDate: new Date().toISOString().split('T')[0],
        reimbursedDate: '2023-03-23',
        reimbursementAmount: 200,
        paymentMethod: 'cash',
      }));

      const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/approveMultiple', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(approveExpenses),
      });

      if (response.ok) {
        // Update local state
        setEmployees(prevEmployees => 
          prevEmployees.map(employee => 
            employee.name === employeeName 
              ? {
                  ...employee,
                  expenses: employee.expenses.map(expense => 
                    expenseIds.includes(expense.id)
                      ? { ...expense, status: 'approved' as const }
                      : expense
                  )
                }
              : employee
          )
        );
        console.log('Multiple expenses approved successfully');
      } else {
        console.error('Error approving multiple expenses');
      }
    } catch (error) {
      console.error('Error approving multiple expenses:', error);
    }
  };

  // Handle reject expense
  const handleReject = async (employeeName: string, expenseId: number) => {
    try {
      const response = await fetch(`https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/reject?id=${expenseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approvalStatus: 'Rejected',
          approvalDate: new Date().toISOString().split('T')[0],
          rejectionReason: 'Reason',
        }),
      });

      if (response.ok) {
        // Update local state
        setEmployees(prevEmployees => 
          prevEmployees.map(employee => 
            employee.name === employeeName 
              ? {
                  ...employee,
                  expenses: employee.expenses.map(expense => 
                    expense.id === expenseId 
                      ? { ...expense, status: 'rejected' as const }
                      : expense
                  )
                }
              : employee
          )
        );
        console.log('Expense rejected successfully');
      } else {
        console.error('Error rejecting expense');
      }
    } catch (error) {
      console.error('Error rejecting expense:', error);
    }
  };

  // Handle reject multiple expenses
  const handleRejectMultiple = async (employeeName: string, expenseIds: number[]) => {
    try {
      const rejectExpenses = expenseIds.map((expenseId) => ({
        id: expenseId,
        approvalStatus: 'Rejected',
        approvalDate: new Date().toISOString().split('T')[0],
        rejectionReason: 'Reason',
      }));

      const response = await fetch('https://app-iconsteel-eadwdthkg5ffh7gq.centralindia-01.azurewebsites.net/expense/rejectMultiple', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(rejectExpenses),
      });

      if (response.ok) {
        // Update local state
        setEmployees(prevEmployees => 
          prevEmployees.map(employee => 
            employee.name === employeeName 
              ? {
                  ...employee,
                  expenses: employee.expenses.map(expense => 
                    expenseIds.includes(expense.id)
                      ? { ...expense, status: 'rejected' as const }
                      : expense
                  )
                }
              : employee
          )
        );
        console.log('Multiple expenses rejected successfully');
      } else {
        console.error('Error rejecting multiple expenses');
      }
    } catch (error) {
      console.error('Error rejecting multiple expenses:', error);
    }
  };

  // Load expenses data
  const loadExpenses = useCallback(async () => {
    if (!selectedStartDate || !selectedEndDate) {
      setDateError('Please select both start and end dates.');
      return;
    }

    const start = new Date(selectedStartDate);
    const end = new Date(selectedEndDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setDateError('Please select valid dates.');
      return;
    }

    if (start > end) {
      setDateError('Start date cannot be after end date.');
      return;
    }

    setDateError(null);
    setIsLoading(true);
    setError(null);
    
    try {
      const expenses = await apiService.getExpensesByDateRange(
        format(start, 'yyyy-MM-dd'),
        format(end, 'yyyy-MM-dd')
      );
      const transformedEmployees = transformExpenseData(expenses);
      setEmployees(transformedEmployees);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError('Failed to load expenses. Please try again.');
      setEmployees(mockEmployees as Employee[]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStartDate, selectedEndDate, token]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = searchTerm === "" || 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const toggleCardExpansion = (id: number) => {
    setExpandedCardId(expandedCardId === id ? null : id);
  };

  // Get status badge for table view
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">Rejected</Badge>;
      default:
        return <Badge className="text-xs">{status}</Badge>;
    }
  };

  // Flatten expenses for table view
  const allExpenses = employees.flatMap(employee => 
    employee.expenses.map(expense => ({
      ...expense,
      employeeName: employee.name,
      employeePosition: employee.position
    }))
  );

  const handleExport = useCallback(() => {
    if (!canExport || allExpenses.length === 0) {
      return;
    }

    const header = ['Employee', 'Position', 'Date', 'Category', 'Description', 'Amount', 'Status'];
    const rows = allExpenses.map((expense) => [
      expense.employeeName,
      expense.employeePosition,
      format(new Date(expense.date), 'yyyy-MM-dd'),
      expense.category,
      expense.description,
      expense.amount.toFixed(2),
      expense.status.toUpperCase(),
    ]);

    const csv = [header, ...rows]
      .map((values) =>
        values
          .map((value) => {
            const stringValue = String(value ?? '');
            return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${selectedStartDate}_${selectedEndDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [allExpenses, canExport, selectedEndDate, selectedStartDate]);

  // Helper to render the card grid (reused for mobile and desktop)
  const renderCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredEmployees.length === 0 ? (
        <div className="col-span-full text-center py-12">
          <Text tone="muted">No expenses found for the selected period.</Text>
        </div>
      ) : (
        filteredEmployees.map((employee) => (
          <EmployeeExpenseCard
            key={employee.id}
            employee={employee}
            showExpenses={expandedCardId === employee.id}
            onToggleExpenses={() => toggleCardExpansion(employee.id)}
            onApprove={handleApprove}
            onReject={handleReject}
            onApproveMultiple={handleApproveMultiple}
            onRejectMultiple={handleRejectMultiple}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="gap-3 border border-border/60 bg-card p-4 shadow-sm rounded-xl">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-1">
          <div>
            <h3 className="text-base font-bold text-foreground">Filters</h3>
            <p className="!mt-1 text-xs leading-5 text-muted-foreground">
              Track and manage employee expense reports
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isLoading || allExpenses.length === 0}
                className="h-8 rounded-lg text-xs font-medium"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border/50">
              <span className="text-[11px] text-muted-foreground font-medium px-1.5">View:</span>
              <button
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  viewMode === "card" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  viewMode === "table" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          {/* Search Input */}
          <div className="space-y-1 lg:col-span-4">
            <Label className="text-xs font-semibold text-foreground">Search Employee</Label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or position..."
                className="pl-9 h-9 text-xs rounded-lg border-border/80"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-1 lg:col-span-3">
            <Label className="text-xs font-semibold text-foreground">Start Date</Label>
            <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-9 justify-start text-left font-normal text-xs bg-background border-border/80 rounded-lg"
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  {selectedStartDate ? format(new Date(selectedStartDate + 'T00:00:00'), 'MMM d, yyyy') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                <Calendar
                  mode="single"
                  selected={selectedStartDate ? new Date(selectedStartDate + 'T00:00:00') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedStartDate(format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  initialFocus
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="space-y-1 lg:col-span-3">
            <Label className="text-xs font-semibold text-foreground">End Date</Label>
            <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-9 justify-start text-left font-normal text-xs bg-background border-border/80 rounded-lg"
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  {selectedEndDate ? format(new Date(selectedEndDate + 'T00:00:00'), 'MMM d, yyyy') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                <Calendar
                  mode="single"
                  selected={selectedEndDate ? new Date(selectedEndDate + 'T00:00:00') : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedEndDate(format(date, 'yyyy-MM-dd'));
                    }
                  }}
                  initialFocus
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1 lg:col-span-2">
            <div className="flex gap-2">
              {canExport && (
                <Button
                  variant="outline"
                  className="md:hidden flex-1 h-9 text-xs rounded-lg"
                  onClick={handleExport}
                  disabled={isLoading || allExpenses.length === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </Button>
              )}
              <Button
                className="w-full h-9 text-xs font-semibold rounded-lg"
                onClick={loadExpenses}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  "Refresh Data"
                )}
              </Button>
            </div>
          </div>
        </div>
        {dateError && (
          <p className="mt-2 text-xs text-destructive">{dateError}</p>
        )}
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <Text size="sm">{error}</Text>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <Text>Loading expenses...</Text>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Always show cards on mobile */}
          <div className="md:hidden">
            {renderCards()}
          </div>

          {/* Desktop only: respect view toggle */}
          <div className="hidden md:block">
            {viewMode === "card" ? (
              renderCards()
            ) : (
              <Card className="gap-3 border border-border/60 bg-card p-4 shadow-sm rounded-xl">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Expenses Table</h3>
                    <p className="!mt-1 text-xs leading-5 text-muted-foreground">
                      Detailed view of all expenses for the selected period
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold rounded-lg px-2.5 py-1">
                    {allExpenses.length} Expenses Logged
                  </Badge>
                </div>
                <div className="rounded-lg border border-border/60 overflow-hidden w-full">
                  <div className="overflow-x-auto w-full">
                    <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Employee</TableHead>
                      <TableHead className="whitespace-nowrap">Position</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Category</TableHead>
                      <TableHead className="whitespace-nowrap">Description</TableHead>
                      <TableHead className="whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                          No expenses found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      allExpenses
                        .filter(expense => 
                          searchTerm === "" || 
                          expense.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          expense.employeePosition.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {expense.employeeName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {expense.employeePosition}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {expense.category}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {expense.description}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium">
                              ₹{expense.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {getStatusBadge(expense.status)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {expense.status === "pending" ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                    onClick={() => handleApprove(expense.employeeName, expense.id)}
                                    aria-label={`Approve ${expense.category} expense for ${expense.employeeName}`}
                                    title="Approve expense"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-8 w-8 border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                                    onClick={() => handleReject(expense.employeeName, expense.id)}
                                    aria-label={`Reject ${expense.category} expense for ${expense.employeeName}`}
                                    title="Reject expense"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  )}
</div>
  );
}
