"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Grid3X3, Table as TableIcon, Download, Eye, MoreHorizontal, CheckCircle, XCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EmployeeExpenseCard from "@/components/employee-expense-card";
import ExpenseDetailsDialog, { type ExpensePhotoAttachment, type ExpenseViewModel } from "@/components/expense-details-dialog";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";
import { Text } from "@/components/ui/typography";
import { API, apiService, type EmployeeUserDto, type ExpenseDto } from "@/lib/api";
import { getEmployeeRoleCategory, getEmployeeRoleLabel } from "@/lib/employee-role";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { matchesSelectedEmployee } from "@/lib/employee-filter";

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: "approved" | "pending" | "rejected";
  attachments: ExpensePhotoAttachment[];
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

const months = [
  { value: "all", label: "All Months" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 2030 - currentYear + 6 }, (_, i) => currentYear - 5 + i);

const today = new Date();
const defaultMonth = (today.getMonth() + 1).toString().padStart(2, "0");
const defaultYear = today.getFullYear().toString();

const normalizeExpenseAttachments = (value: unknown): ExpensePhotoAttachment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((attachment): attachment is Record<string, unknown> => typeof attachment === "object" && attachment !== null)
    .map((attachment) => ({
      fileName: String(attachment.fileName ?? ""),
      fileDownloadUri: typeof attachment.fileDownloadUri === "string" ? attachment.fileDownloadUri : undefined,
      fileType: String(attachment.fileType ?? ""),
    }))
    .filter((attachment) => attachment.fileName !== "");
};

export default function ExpensesPage() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeUserDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedExpense, setSelectedExpense] = useState<ExpenseViewModel | null>(null);
  const { token, userRole, currentUser } = useAuth();

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
        status: validStatus,
        attachments: normalizeExpenseAttachments(expense.attachmentResponse)
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

  // Load expenses data for the selected month/year
  const loadExpenses = useCallback(async () => {
    let startDate: string;
    let endDate: string;

    if (selectedMonth === "all") {
      startDate = `${selectedYear}-01-01`;
      endDate = `${selectedYear}-12-31`;
    } else {
      const month = selectedMonth.padStart(2, '0');
      startDate = `${selectedYear}-${month}-01`;
      const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
      endDate = `${selectedYear}-${month}-${lastDay.toString().padStart(2, '0')}`;
    }

    setIsLoading(true);
    setError(null);

    try {
      const expenses = await apiService.getExpensesByDateRange(startDate, endDate);
      const transformedEmployees = transformExpenseData(expenses);
      setEmployees(transformedEmployees);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError('Failed to load expenses. Please try again.');
      setEmployees(mockEmployees as Employee[]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, token]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const loadEmployeeDirectory = async () => {
      try {
        const directory = await API.getAllEmployees();
        setEmployeeDirectory(directory.filter((employee) => {
          const category = getEmployeeRoleCategory(employee.role);
          return category === "field-officer" || category === "regional-manager";
        }));
      } catch (directoryError) {
        console.error("Error loading employee directory:", directoryError);
      }
    };

    loadEmployeeDirectory();
  }, []);

  const employeeOptions = useMemo<SearchableOption[]>(() => employeeDirectory
    .map((employee) => ({
      value: String(employee.id),
      label: `${employee.firstName} ${employee.lastName}`.trim(),
      description: getEmployeeRoleLabel(employee.role),
    }))
    .sort((a, b) => a.label.localeCompare(b.label)), [employeeDirectory]);

  const filteredEmployees = employees.filter((employee) =>
    matchesSelectedEmployee(employee.id, selectedEmployeeId, employeeDirectory)
  );

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
      employeeId: employee.id,
      employeeName: employee.name,
      employeePosition: employee.position
    }))
  );
  const filteredTableExpenses = allExpenses.filter((expense) =>
    matchesSelectedEmployee(expense.employeeId, selectedEmployeeId, employeeDirectory)
  );

  const toViewModel = (expense: { id: number; date: string; category: string; amount: number; description: string; status: "approved" | "pending" | "rejected"; employeeName: string; employeePosition: string; attachments?: ExpensePhotoAttachment[] }): ExpenseViewModel => ({
    id: expense.id,
    date: expense.date,
    category: expense.category,
    amount: expense.amount,
    description: expense.description,
    status: expense.status,
    employeeName: expense.employeeName,
    employeePosition: expense.employeePosition,
    attachments: expense.attachments ?? [],
  });

  const handleExport = useCallback(() => {
    if (!canExport || filteredTableExpenses.length === 0) {
      return;
    }

    const header = ['Employee', 'Position', 'Date', 'Category', 'Description', 'Amount', 'Status'];
    const rows = filteredTableExpenses.map((expense) => [
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
    link.download = `expenses_${selectedYear}_${selectedMonth === "all" ? "all" : selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredTableExpenses, canExport, selectedMonth, selectedYear]);

  // Helper to render the card grid (reused for mobile and desktop)
  const renderCards = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            onViewDetails={(expense) => setSelectedExpense(toViewModel(expense))}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-none py-4 px-4 sm:px-6">
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-[240px_140px_104px]">
          <div className="min-w-0">
            <Label className="sr-only">Employee</Label>
            <SearchableSelect
              options={employeeOptions}
              value={selectedEmployeeId}
              onSelect={(option) => setSelectedEmployeeId(option?.value ?? "")}
              placeholder="All employees"
              searchPlaceholder="Search employees..."
              emptyMessage="No employees available"
              noResultsMessage="No matching employees"
              allowClear
              triggerClassName="h-9 w-full bg-background text-xs shadow-none"
              contentClassName="w-[var(--radix-popover-trigger-width)]"
            />
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-full bg-background text-xs shadow-none" aria-label="Filter by month">
              <SelectValue placeholder="Month">
                {months.find(month => month.value === selectedMonth)?.label || "Month"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 w-full bg-background text-xs shadow-none" aria-label="Filter by year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <div className="flex overflow-hidden rounded-md border border-border">
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="rounded-r-none h-9 text-xs"
            >
              <Grid3X3 className="mr-2 h-4 w-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-l-none h-9 text-xs"
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Table
            </Button>
          </div>
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredTableExpenses.length === 0 || isLoading}
              className="flex items-center gap-2 h-9 text-xs"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <div className="w-full space-y-4">
                <div className="flex items-center justify-end pb-1">
                  <Badge variant="secondary" className="text-xs font-semibold rounded-lg px-2.5 py-1">
                    {filteredTableExpenses.length} Expenses Logged
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
                    {filteredTableExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                          No expenses found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTableExpenses
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
                            <TableCell className="text-xs py-3 max-w-[140px]">
                              {expense.description ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="block truncate max-w-[140px] cursor-pointer">
                                        {expense.description}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs whitespace-normal p-2">
                                      {expense.description}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium">
                              ₹{expense.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {getStatusBadge(expense.status)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Open expense actions menu">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  <DropdownMenuItem onClick={() => setSelectedExpense(toViewModel(expense))} className="text-xs">
                                    <Eye className="mr-2 h-3.5 w-3.5" />
                                    View details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={expense.status !== "pending"}
                                    onClick={() => handleApprove(expense.employeeName, expense.id)}
                                    className="text-xs text-emerald-600 dark:text-emerald-400"
                                  >
                                    <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={expense.status !== "pending"}
                                    onClick={() => handleReject(expense.employeeName, expense.id)}
                                    className="text-xs text-rose-600 dark:text-rose-400"
                                  >
                                    <XCircle className="mr-2 h-3.5 w-3.5" />
                                    Reject
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          )}
      </div>
    </>
  )}

      <ExpenseDetailsDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExpense(null);
        }}
      />
</div>
  );
}
