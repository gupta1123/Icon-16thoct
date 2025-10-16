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
  Calendar,
  Sun,
  CloudSun,
  XCircle
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
  attendanceStatus: 'full day' | 'half day' | 'absent';
  checkinDate: string;
  checkoutDate: string;
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
              <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10 dark:bg-gray-700" />
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
            <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-lg text-center">
              <div className="flex items-center justify-center mb-0.5">
                <Sun className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
              <Heading as="p" size="md" weight="semibold" className="text-green-800 dark:text-green-300">
                {summary.fullDays}
              </Heading>
              <Text size="xs" tone="muted" className="text-green-700 dark:text-green-400">
                Full Days
              </Text>
            </div>
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
