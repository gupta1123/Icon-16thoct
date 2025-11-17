import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Heading, Text } from "@/components/ui/typography";
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

export default function EmployeeAttendanceCard({ employee, selectedMonth, selectedYear, attendanceData, onDateClick }: EmployeeAttendanceCardProps) {
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

  // Filter attendance for this specific employee
  const filteredAttendanceData = useMemo(
    () => attendanceData.filter((data) => data.employeeId === employee.id),
    [attendanceData, employee.id]
  );

  // Calculate full days breakdown
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

  // Get employee initials
  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') {
      return '??';
    }
    
    // Filter out undefined, null, empty strings, and trim whitespace
    const parts = name
      .split(' ')
      .map(part => part.trim())
      .filter(part => part && part !== 'undefined' && part !== 'null' && part.length > 0);
    
    if (parts.length >= 2) {
      // Get first letter of first name and first letter of last name
      const firstInitial = parts[0][0]?.toUpperCase() || '';
      const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
      return (firstInitial + lastInitial) || '??';
    } else if (parts.length === 1) {
      // If only one name part, take first 2 characters
      return parts[0].substring(0, 2).toUpperCase() || '??';
    }
    
    return '??';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "bg-green-500 dark:bg-green-600";
      case "half": return "bg-yellow-500 dark:bg-yellow-600";
      case "absent": return "bg-red-500 dark:bg-red-600";
      default: return "bg-gray-100 dark:bg-gray-700";
    }
  };


  // Get visits for the selected date
  const selectedDateVisits = selectedDate 
    ? employee.attendance.find(record => record.date === selectedDate)?.visits || []
    : [];

  return (
    <>
      <Card className="w-full hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl w-10 h-10 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                {getInitials(employee.name)}
              </div>
              <div>
                <Heading as="h3" size="lg" weight="semibold" className="text-foreground dark:text-gray-200">
                  {employee.name}
                </Heading>
                <Text size="sm" tone="muted" className="dark:text-gray-400">
                  {employee.position}
                </Text>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Popover>
              <PopoverTrigger asChild>
                <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-lg text-center cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                  <div className="flex items-center justify-center mb-0.5 gap-1">
                    <Sun className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <Info className="h-2.5 w-2.5 text-green-500 dark:text-green-400 opacity-60" />
                  </div>
                  <Heading as="p" size="md" weight="semibold" className="text-green-800 dark:text-green-300">
                    {summary.fullDays}
                  </Heading>
                  <Text size="xs" tone="muted" className="text-green-700 dark:text-green-400">
                    Full Days
                  </Text>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-3 border-b pb-2">Full Days Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        Visit-based
                      </span>
                      <span className="font-semibold">{fullDaysBreakdown.visitBasedFullDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                        Activity-based
                      </span>
                      <span className="font-semibold">{fullDaysBreakdown.activityBasedFullDays}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 rounded"></div>
                        Paid Leaves (Sundays)
                      </span>
                      <span className="font-semibold">{fullDaysBreakdown.paidLeaves}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t font-semibold">
                      <span>Total Full Days</span>
                      <span>{fullDaysBreakdown.total}</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-lg text-center">
              <div className="flex items-center justify-center mb-0.5">
                <CloudSun className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
              </div>
              <Heading as="p" size="md" weight="semibold" className="text-yellow-800 dark:text-yellow-300">
                {summary.halfDays}
              </Heading>
              <Text size="xs" tone="muted" className="text-yellow-700 dark:text-yellow-400">
                Half Days
              </Text>
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 p-2 rounded-lg text-center">
              <div className="flex items-center justify-center mb-0.5">
                <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
              </div>
              <Heading as="p" size="md" weight="semibold" className="text-red-800 dark:text-red-300">
                {summary.absentDays}
              </Heading>
              <Text size="xs" tone="muted" className="text-red-700 dark:text-red-400">
                Absent
              </Text>
            </div>
          </div>
          
          <div className="mt-4">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Visits on {selectedDate ? format(parseISO(selectedDate), "MMMM d, yyyy") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedDateVisits.length > 0 ? (
              selectedDateVisits.map((visit) => (
                <div key={visit.id} className="border rounded-lg p-3 dark:border-gray-700">
                  <div className="flex justify-between">
                    <Heading as="h4" size="md" weight="semibold" className="dark:text-gray-200">
                      {visit.customer}
                    </Heading>
                    <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300">
                      {visit.time}
                    </Badge>
                  </div>
                  <Text size="sm" tone="muted" className="mt-1 dark:text-gray-400">
                    {visit.purpose}
                  </Text>
                </div>
              ))
            ) : (
              <Text size="sm" tone="muted" className="py-4 text-center dark:text-gray-400">
                No visits recorded for this day
              </Text>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}