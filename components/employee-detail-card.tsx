"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "@/components/ui/pagination";
import { 
  Calendar, 
  CheckCircle2, 
  MapPin, 
  ChevronUpIcon, 
  ChevronDownIcon,
  Eye,
  BarChart2,
  Building
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ClipLoader } from "react-spinners";
import { useRouter } from "next/navigation";
import { API, type VisitDto, type EmployeeStatsWithVisits } from "@/lib/api";
import type { DateRangeKey } from "@/components/dashboard/types";

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
}

interface VisitRow {
  id: number;
  date: string;
  customer: string;
  purpose: string;
  status: "completed" | "in-progress" | "scheduled";
  duration: string;
  checkinTime?: string;
  checkoutTime?: string;
  employeeState?: string;
}

interface VisitsByPurposeChartProps {
  data: { purpose: string; visits: number }[];
}

const VisitsByPurposeChart = ({ data }: VisitsByPurposeChartProps) => {
  return (
    <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <BarChart2 className="w-4 h-4 text-foreground/80" />
          Visits by Purpose
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-xs font-medium">
            No purpose data available for this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150, 150, 150, 0.15)" />
              <XAxis dataKey="purpose" tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'currentColor' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                }}
              />
              <Bar dataKey="visits" name="Visits" fill="#18181b" radius={[4, 4, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

interface VisitsTableProps {
  visits: VisitRow[];
  onViewDetails: (visitId: number) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const VisitsTable = ({ visits, onViewDetails, currentPage, onPageChange }: VisitsTableProps) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<keyof VisitRow>('date');
  const [lastClickedColumn, setLastClickedColumn] = useState<keyof VisitRow | null>(null);

  const handleSort = (column: keyof VisitRow) => {
    if (column === sortColumn) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
    setLastClickedColumn(column);
  };

  const completedVisits = useMemo(() => {
    return visits.filter(visit => visit.checkinTime && visit.checkoutTime);
  }, [visits]);

  const rowsPerPage = 10;
  const totalPages = Math.ceil(completedVisits.length / rowsPerPage);

  const sortedVisits = [...completedVisits].sort((a, b) => {
    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    if (valueA === null || valueA === undefined) return 1;
    if (valueB === null || valueB === undefined) return -1;

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    }

    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const visitsToDisplay = sortedVisits.slice(startIndex, endIndex);

  return (
    <Card className="border border-border/80 shadow-xs rounded-xl overflow-hidden bg-card">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <CheckCircle2 className="w-4 h-4 text-foreground/80" />
          Completed Visits
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold cursor-pointer hover:bg-muted/60" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">
                    Store
                    {lastClickedColumn === 'customer' && (
                      sortOrder === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold cursor-pointer hover:bg-muted/60" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    Date
                    {lastClickedColumn === 'date' && (
                      sortOrder === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold cursor-pointer hover:bg-muted/60" onClick={() => handleSort('purpose')}>
                  <div className="flex items-center gap-1">
                    Purpose
                    {lastClickedColumn === 'purpose' && (
                      sortOrder === 'asc' ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsToDisplay.map((visit) => (
                <TableRow key={visit.id} className="hover:bg-muted/30 transition-colors border-b border-border/30">
                  <TableCell className="text-xs font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{visit.customer}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                      <span>{format(parseISO(visit.date), "dd MMM ''yy")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="bg-muted text-foreground/90 font-medium px-2 py-0.5 rounded-md text-[11px] inline-block border border-border/40">
                      {visit.purpose}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 font-medium rounded-lg border-border/80 hover:bg-foreground hover:text-background transition-all"
                      onClick={() => onViewDetails(visit.id)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {visitsToDisplay.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-8 text-center text-xs text-muted-foreground" colSpan={4}>
                    No completed visits in this date range
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {totalPages > 1 && visitsToDisplay.length > 0 && (
        <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">
            Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to <span className="font-semibold text-foreground">{Math.min(endIndex, completedVisits.length)}</span> of <span className="font-semibold text-foreground">{completedVisits.length}</span> visits
          </p>
          <Pagination className="w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  size="sm"
                  onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
                  className={currentPage === 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                >
                  Previous
                </PaginationLink>
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    size="sm"
                    isActive={currentPage === page}
                    onClick={() => onPageChange(page)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationLink
                  size="sm"
                  onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                >
                  Next
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
};

interface EmployeeDetailCardProps {
  employee: Employee;
  dateRange: { start: Date; end: Date };
  selectedDateRangeKey?: DateRangeKey;
}

export default function EmployeeDetailCard({ employee, dateRange, selectedDateRangeKey }: EmployeeDetailCardProps) {
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeStatsWithVisits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  // Visits + stats respect dashboard date range
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const start = format(dateRange.start, 'yyyy-MM-dd');
        const end = format(dateRange.end, 'yyyy-MM-dd');
        const data = await API.getEmployeeStatsWithVisits(employee.id, start, end);
        setEmployeeDetails(data);
      } catch (e: unknown) {
        console.error('Error loading employee details:', e);
        if (e instanceof Error && e.message.includes('404')) {
          setEmployeeDetails({
            visitDto: [],
            statsDto: {
              visitCount: 0,
              fullDays: 0,
              halfDays: 0,
              absences: 0
            }
          });
        } else {
          setError(e instanceof Error ? e.message : 'Failed to load employee details');
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [employee.id, dateRange.start, dateRange.end]);

  const visitsByPurposeChartData = useMemo(() => {
    if (!employeeDetails || !employeeDetails.visitDto) return [];

    const completedVisits = employeeDetails.visitDto.filter((visit) =>
      visit.checkinTime && visit.checkoutTime
    );

    const visitsByPurpose = completedVisits.reduce((acc: { [key: string]: number }, visit) => {
      const purpose = visit.purpose ? visit.purpose.trim().toLowerCase() : 'unknown';
      if (!acc[purpose]) {
        acc[purpose] = 0;
      }
      acc[purpose]++;
      return acc;
    }, {});

    return Object.entries(visitsByPurpose).map(([purpose, visits]) => ({
      purpose: purpose.charAt(0).toUpperCase() + purpose.slice(1),
      visits: Number(visits),
    }));
  }, [employeeDetails]);

  const handleViewDetails = (visitId: number) => {
    if (typeof window !== 'undefined') {
      const returnContext = {
        route: `/dashboard?view=employeeDetail&employeeId=${employee.id}${selectedDateRangeKey ? `&dateRange=${selectedDateRangeKey}` : ''}`,
        timestamp: Date.now(),
      };
      try {
        window.localStorage.setItem('visitReturnContext', JSON.stringify(returnContext));
      } catch (storageError) {
        console.error('Failed to store visit return context:', storageError);
      }
    }

    const searchParams = new URLSearchParams({
      from: "dashboardEmployee",
      employeeId: String(employee.id),
    });
    if (selectedDateRangeKey) {
      searchParams.set("dateRange", selectedDateRangeKey);
    }
    router.push(`/dashboard/visits/${visitId}?${searchParams.toString()}`);
  };

  if (error) {
    return <div className="space-y-4"><div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div></div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ClipLoader color="#18181b" size={40} />
      </div>
    );
  }

  const visits: VisitRow[] = (employeeDetails?.visitDto || []).map((v: VisitDto) => ({
    id: v.id,
    date: v.visit_date,
    customer: v.storeName,
    purpose: v.purpose || '—',
    status: 'completed',
    duration: '-',
    checkinTime: v.checkinTime,
    checkoutTime: v.checkoutTime,
    employeeState: v.state,
  }));

  const completedVisits = visits.filter(visit => visit.checkinTime && visit.checkoutTime);
  const totalCompletedVisits = completedVisits.length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-border/80 shadow-xs bg-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground block">Total Completed Visits</span>
              <span className="text-2xl font-bold text-foreground leading-none block">
                {totalCompletedVisits}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </Card>

        <Card className="border border-border/80 shadow-xs bg-card p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground block">Total Visits</span>
              <span className="text-2xl font-bold text-foreground leading-none block">
                {visits.length}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </Card>
      </div>

      <VisitsTable
        visits={visits}
        onViewDetails={handleViewDetails}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
      
      <VisitsByPurposeChart data={visitsByPurposeChartData} />
    </div>
  );
}
