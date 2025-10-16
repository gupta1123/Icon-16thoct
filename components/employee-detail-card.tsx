"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis } from "@/components/ui/pagination";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  MapPin,
  User,
  ChevronUpIcon,
  ChevronDownIcon
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ClipLoader } from 'react-spinners';
import { useRouter } from 'next/navigation';
import { API, type VisitDto, type EmployeeStatsWithVisits } from "@/lib/api";

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
    <Card>
      <CardHeader>
        <CardTitle>Visits by Purpose</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="purpose" />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: 'none' }} />
            <Legend />
            <Bar dataKey="visits" fill="#1a202c" />
          </BarChart>
        </ResponsiveContainer>
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

  const getOutcomeStatus = (visit: VisitRow): { emoji: React.ReactNode; status: string; color: string } => {
    if (visit.checkinTime && visit.checkoutTime) {
      return { emoji: '✅', status: 'Completed', color: 'bg-purple-100 text-purple-800' };
    } else if (visit.checkoutTime) {
      return { emoji: '⏱️', status: 'Checked Out', color: 'bg-orange-100 text-orange-800' };
    } else if (visit.checkinTime) {
      return { emoji: '🕰️', status: 'On Going', color: 'bg-green-100 text-green-800' };
    }
    return { emoji: '📅', status: 'Assigned', color: 'bg-blue-100 text-blue-800' };
  };

  const handleSort = (column: keyof VisitRow) => {
    if (column === sortColumn) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
    setLastClickedColumn(column);
  };

  const rowsPerPage = 10;
  const totalPages = Math.ceil(visits.length / rowsPerPage);

  const sortedVisits = [...visits].sort((a, b) => {
    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    if (valueA === null || valueA === undefined) {
      return 1;
    }
    if (valueB === null || valueB === undefined) {
      return -1;
    }

    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
    }

    if (valueA < valueB) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (valueA > valueB) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const visitsToDisplay = sortedVisits.slice(startIndex, endIndex);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Completed Visits</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('customer')}>
                <div className="flex items-center gap-1">
                  Store
                  {lastClickedColumn === 'customer' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('date')}>
                <div className="flex items-center gap-1">
                  Date
                  {lastClickedColumn === 'date' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50" onClick={() => handleSort('purpose')}>
                <div className="flex items-center gap-1">
                  Purpose
                  {lastClickedColumn === 'purpose' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visitsToDisplay.map((visit) => {
              const { emoji, status, color } = getOutcomeStatus(visit);
              if (status !== 'Completed') return null; // Filter out non-completed visits
              return (
                <tr key={visit.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">{visit.customer}</td>
                  <td className="px-4 py-3 text-sm">{format(parseISO(visit.date), "dd MMM ''yy")}</td>
                  <td className="px-4 py-3 text-sm">{visit.purpose}</td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary hover:text-primary/80"
                      onClick={() => onViewDetails(visit.id)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              );
            })}
            {visitsToDisplay.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground" colSpan={4}>
                  No completed visits in this date range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
      {totalPages > 1 && visitsToDisplay.length > 0 && (
        <div className="px-6 pb-4 border-t pt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  size="default"
                  onClick={() => onPageChange(currentPage - 1)}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                >
                  Previous
                </PaginationLink>
              </PaginationItem>
              {(() => {
                const items = [];
                for (let i = 1; i <= totalPages; i++) {
                  // Show first, last, current, and pages around current
                  if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    items.push(
                      <PaginationItem key={i}>
                        <PaginationLink
                          size="default"
                          isActive={currentPage === i}
                          onClick={() => onPageChange(i)}
                          className="cursor-pointer"
                        >
                          {i}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (
                    (i === currentPage - 2 && i > 1) ||
                    (i === currentPage + 2 && i < totalPages)
                  ) {
                    items.push(
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                }
                return items;
              })()}
              <PaginationItem>
                <PaginationLink
                  size="default"
                  onClick={() => onPageChange(currentPage + 1)}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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
}

export default function EmployeeDetailCard({ employee, dateRange }: EmployeeDetailCardProps) {
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeStatsWithVisits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();


  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

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
        setError(e instanceof Error ? e.message : 'Failed to load employee details');
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
    // Navigate to Visit detail page for that visit
    router.push(`/dashboard/visits/${visitId}`);
  };

  if (error) {
    return <div className="space-y-4"><div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div></div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <ClipLoader color="#4A90E2" size={50} />
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

  // Calculate actual metrics from the visits data
  const completedVisits = visits.filter(visit => visit.checkinTime && visit.checkoutTime);
  const totalCompletedVisits = completedVisits.length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Completed Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {totalCompletedVisits}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {visits.length}
            </Heading>
          </CardContent>
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
