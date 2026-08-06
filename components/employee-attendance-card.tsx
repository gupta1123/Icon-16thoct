import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Calendar,
  Sun,
  CloudSun,
  XCircle,
  Info
} from "lucide-react";
import { format, parseISO } from "date-fns";
import CustomCalendar from "./custom-calendar";

interface Visit {
  id: number;
  customer: string;
  time: string;
  purpose: string;
}

interface AttendanceRecord {
  date: string;
  status: "present" | "half" | "absent";
  visits: Visit[];
}

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  fullDays: number;
  halfDays: number;
  absent: number;
  attendance: AttendanceRecord[];
}

interface AttendanceData {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: string;
  checkinDate: string;
  checkoutDate: string;
  visitCount?: number;
  assignedVisits?: number;
  hasActivity?: boolean;
  activityCount?: number;
}

interface EmployeeAttendanceCardProps {
  employee: Employee;
  selectedMonth: number;
  selectedYear: number;
  attendanceData: AttendanceData[];
  onDateClick?: (date: string, employeeName: string) => void;
}

export default function EmployeeAttendanceCard({ 
  employee, 
  selectedMonth, 
  selectedYear, 
  attendanceData, 
  onDateClick 
}: EmployeeAttendanceCardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [summary, setSummary] = useState({
    fullDays: employee.fullDays,
    halfDays: employee.halfDays,
    absentDays: employee.absent
  });

  const handleDayClick = useCallback((date: string) => {
    if (onDateClick) {
      onDateClick(date, employee.name);
    } else {
      const record = employee.attendance.find(record => record.date === date);
      if (record) {
        setSelectedDate(date);
        setIsDialogOpen(true);
      }
    }
  }, [onDateClick, employee.name, employee.attendance]);

  const handleSummaryChange = useCallback((newSummary: { fullDays: number; halfDays: number; absentDays: number }) => {
    setSummary((prev) => (
      prev.fullDays !== newSummary.fullDays ||
      prev.halfDays !== newSummary.halfDays ||
      prev.absentDays !== newSummary.absentDays
        ? newSummary
        : prev
    ));
  }, []);

  const filteredAttendanceData = useMemo(
    () => attendanceData.filter((data) => data.employeeId === employee.id),
    [attendanceData, employee.id]
  );

  const fullDaysBreakdown = useMemo(() => {
    const breakdown = {
      visitBasedFullDays: 0,
      activityBasedFullDays: 0,
      paidLeaves: 0,
      total: 0
    };

    filteredAttendanceData.forEach((data) => {
      const status = data.attendanceStatus?.toLowerCase() || '';
      if (status === 'paid leave') {
        breakdown.paidLeaves++;
      } else if (status === 'full day (activity)') {
        breakdown.activityBasedFullDays++;
      } else if (status === 'full day') {
        breakdown.visitBasedFullDays++;
      }
    });

    breakdown.total = breakdown.visitBasedFullDays + breakdown.activityBasedFullDays + breakdown.paidLeaves;
    return breakdown;
  }, [filteredAttendanceData]);

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return '??';
    const parts = name.split(' ').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
    } else if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return '??';
  };

  const selectedDateVisits = selectedDate 
    ? employee.attendance.find(record => record.date === selectedDate)?.visits || []
    : [];

  return (
    <>
      <Card className="w-full border border-border/60 hover:border-primary/30 transition-all shadow-sm rounded-xl overflow-hidden py-0 gap-0">
        <CardContent className="p-3.5 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-purple-600 text-white font-bold text-xs rounded-lg h-8 w-8 flex items-center justify-center shrink-0 shadow-sm">
              {getInitials(employee.name)}
            </div>
            <div className="min-w-0 flex flex-col justify-center m-0 p-0">
              <span className="font-bold text-sm text-foreground truncate block leading-none">
                {employee.name}
              </span>
              <span className="text-[11px] text-muted-foreground truncate block leading-none mt-1">
                {employee.position || 'Field Officer'}
              </span>
            </div>
          </div>

          {/* Compact Summary Cards */}
          <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
            <Popover>
              <PopoverTrigger asChild>
                <div className="bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 p-1.5 rounded-lg cursor-pointer hover:bg-emerald-500/15 transition-colors">
                  <div className="flex items-center justify-center mb-0.5 gap-1">
                    <Sun className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <Info className="h-2.5 w-2.5 text-emerald-500 opacity-60" />
                  </div>
                  <span className="font-bold text-xs text-emerald-700 dark:text-emerald-300 block leading-tight">
                    {summary.fullDays}
                  </span>
                  <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400 font-medium">Full Days</span>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-3 rounded-xl" align="start">
                <div className="space-y-2 text-xs">
                  <h4 className="font-bold text-xs pb-1.5 border-b">Full Days Breakdown</h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        Visit-based
                      </span>
                      <span className="font-semibold">{fullDaysBreakdown.visitBasedFullDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                        Activity-based
                      </span>
                      <span className="font-semibold">{fullDaysBreakdown.activityBasedFullDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        Paid Leaves (Sundays)
                      </span>
                      <span className="font-semibold">{fullDaysBreakdown.paidLeaves}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t font-bold text-foreground">
                      <span>Total Full Days</span>
                      <span>{fullDaysBreakdown.total}</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 p-1.5 rounded-lg">
              <div className="flex items-center justify-center mb-0.5">
                <CloudSun className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-bold text-xs text-amber-700 dark:text-amber-300 block leading-tight">
                {summary.halfDays}
              </span>
              <span className="text-[10px] text-amber-600/80 dark:text-amber-400 font-medium">Half Days</span>
            </div>

            <div className="bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/20 p-1.5 rounded-lg">
              <div className="flex items-center justify-center mb-0.5">
                <XCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="font-bold text-xs text-rose-700 dark:text-rose-300 block leading-tight">
                {summary.absentDays}
              </span>
              <span className="text-[10px] text-rose-600/80 dark:text-rose-400 font-medium">Absent</span>
            </div>
          </div>

          {/* Calendar Section */}
          <div className="pt-0.5">
            <CustomCalendar
              month={selectedMonth}
              year={selectedYear}
              attendanceData={filteredAttendanceData}
              onSummaryChange={handleSummaryChange}
              onDateClick={handleDayClick}
              employeeName={employee.name}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Visits on {selectedDate ? format(parseISO(selectedDate), "MMMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {selectedDateVisits.length > 0 ? (
              selectedDateVisits.map((visit) => (
                <div key={visit.id} className="border rounded-xl p-3 bg-muted/30 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-foreground">
                      {visit.customer}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {visit.time}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {visit.purpose}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No visits recorded for this day
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}