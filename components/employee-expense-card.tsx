import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  CheckCircle, 
  Clock, 
  XCircle,
  Check,
  X,
  Calendar,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

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

interface EmployeeExpenseCardProps {
  employee: Employee;
  showExpenses: boolean;
  onToggleExpenses: () => void;
  onApprove?: (employeeName: string, expenseId: number) => void;
  onReject?: (employeeName: string, expenseId: number) => void;
  onApproveMultiple?: (employeeName: string, expenseIds: number[]) => void;
  onRejectMultiple?: (employeeName: string, expenseIds: number[]) => void;
}

export default function EmployeeExpenseCard({ 
  employee, 
  showExpenses, 
  onToggleExpenses, 
  onApprove, 
  onReject, 
  onApproveMultiple, 
  onRejectMultiple 
}: EmployeeExpenseCardProps) {
  const [expenses, setExpenses] = useState(employee.expenses);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
            <CheckCircle className="h-2.5 w-2.5" /> Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
            <XCircle className="h-2.5 w-2.5" /> Rejected
          </Badge>
        );
      default:
        return <Badge className="text-[10px] py-0 px-1.5">{status}</Badge>;
    }
  };

  const updateExpenseStatus = (id: number | number[], newStatus: "approved" | "rejected") => {
    setExpenses(prevExpenses => 
      prevExpenses.map(expense => 
        Array.isArray(id) 
          ? (id.includes(expense.id) ? { ...expense, status: newStatus } : expense)
          : (expense.id === id ? { ...expense, status: newStatus } : expense)
      )
    );
  };

  const updateAllExpensesStatus = (newStatus: "approved" | "rejected") => {
    setExpenses(prevExpenses => 
      prevExpenses.map(expense => 
        expense.status === "pending" ? { ...expense, status: newStatus } : expense
      )
    );
  };

  const calculateTotals = () => {
    return expenses.reduce((acc, expense) => {
      acc.total += expense.amount;
      if (expense.status === "approved") acc.approved += expense.amount;
      if (expense.status === "pending") acc.pending += expense.amount;
      if (expense.status === "rejected") acc.rejected += expense.amount;
      return acc;
    }, { total: 0, approved: 0, pending: 0, rejected: 0 });
  };

  const totals = calculateTotals();
  const initials = employee.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  return (
    <Card className="w-full border border-border/60 hover:border-primary/30 transition-all shadow-sm rounded-xl overflow-hidden">
      <CardContent className="p-3.5 space-y-3">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-muted text-muted-foreground font-bold text-xs rounded-lg h-9 w-9 flex items-center justify-center shrink-0 border border-border/60">
              {initials}
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <span className="font-bold text-sm text-foreground truncate block leading-tight">
                {employee.name}
              </span>
              <span className="text-[11px] text-muted-foreground truncate block leading-tight mt-0.5">
                {employee.position}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center text-right shrink-0">
            <span className="font-bold text-sm text-foreground block leading-tight">
              ₹{totals.total.toFixed(2)}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-tight block leading-tight mt-0.5">
              Total Expenses
            </span>
          </div>
        </div>

        {/* Compact Status Breakdown Chips */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 p-1.5 rounded-lg">
            <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 block">
              ₹{totals.approved.toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500 font-medium">Approved</span>
          </div>

          <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 p-1.5 rounded-lg">
            <span className="font-bold text-xs text-amber-700 dark:text-amber-400 block">
              ₹{totals.pending.toFixed(2)}
            </span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-500 font-medium">Pending</span>
          </div>

          <div className="bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/20 p-1.5 rounded-lg">
            <span className="font-bold text-xs text-rose-700 dark:text-rose-400 block">
              ₹{totals.rejected.toFixed(2)}
            </span>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-500 font-medium">Rejected</span>
          </div>
        </div>

        {/* Compact Toggle Button */}
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full h-8 text-xs font-medium bg-muted/50 hover:bg-muted justify-between rounded-lg px-3"
          onClick={onToggleExpenses}
        >
          <span>{showExpenses ? "Hide Expenses" : `Show Expenses (${expenses.length})`}</span>
          {showExpenses ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>

        {/* Expanded Expense Items */}
        {showExpenses && (
          <div className="space-y-2 pt-1">
            <Separator className="my-1" />
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-2 hover:bg-muted/40 rounded-lg text-xs border border-border/30">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Checkbox
                      checked={selectedExpenseIds.includes(expense.id)}
                      className="h-3.5 w-3.5 rounded"
                      onCheckedChange={(checked: boolean) => {
                        if (checked) {
                          setSelectedExpenseIds(prev => [...prev, expense.id]);
                        } else {
                          setSelectedExpenseIds(prev => prev.filter(id => id !== expense.id));
                        }
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">
                        {expense.category}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="h-2.5 w-2.5" />
                        <span>{format(new Date(expense.date), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-xs text-foreground">
                      ₹{expense.amount.toFixed(2)}
                    </span>
                    {expense.status === "pending" ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6 rounded-md border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => {
                            updateExpenseStatus(expense.id, "approved");
                            onApprove?.(employee.name, expense.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-6 w-6 rounded-md border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                          onClick={() => {
                            updateExpenseStatus(expense.id, "rejected");
                            onReject?.(employee.name, expense.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      getStatusBadge(expense.status)
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Bulk Action Buttons */}
            {expenses.some(expense => expense.status === "pending") && (
              <div className="flex gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[11px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => {
                    const pendingExpenseIds = expenses
                      .filter(expense => expense.status === "pending")
                      .map(expense => expense.id);
                    updateAllExpensesStatus("approved");
                    onApproveMultiple?.(employee.name, pendingExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Approve All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[11px] border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                  onClick={() => {
                    const pendingExpenseIds = expenses
                      .filter(expense => expense.status === "pending")
                      .map(expense => expense.id);
                    updateAllExpensesStatus("rejected");
                    onRejectMultiple?.(employee.name, pendingExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Reject All
                </Button>
              </div>
            )}

            {selectedExpenseIds.length > 0 && (
              <div className="flex gap-1.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[11px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => {
                    updateExpenseStatus(selectedExpenseIds, "approved");
                    onApproveMultiple?.(employee.name, selectedExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Approve Selected ({selectedExpenseIds.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-[11px] border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10"
                  onClick={() => {
                    updateExpenseStatus(selectedExpenseIds, "rejected");
                    onRejectMultiple?.(employee.name, selectedExpenseIds);
                    setSelectedExpenseIds([]);
                  }}
                >
                  Reject Selected ({selectedExpenseIds.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
