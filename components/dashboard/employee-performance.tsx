"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./performance-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin,
  CheckCircle2,
  BarChart3,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";

import { format, parseISO } from "date-fns";





export interface VisitRow {
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

interface KPICardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

export const KPICard = ({ title, value, icon }: KPICardProps) => {
  return (
    <Card className="rounded-lg shadow-none">
      <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-3 sm:min-h-[82px] sm:p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
        </div>
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface VisitsByPurposeChartProps {
  data: { purpose: string; visits: number }[];
}

export const VisitsByPurposeChart = ({ data }: VisitsByPurposeChartProps) => {
  const hasData = data.some((item) => item.visits > 0);
  const total = data.reduce((sum, item) => sum + item.visits, 0);

  return (
    <Card className="min-w-0 gap-0 rounded-lg py-0 shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Visits by purpose</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{total} visits · selected period</p>
      </CardHeader>
      <CardContent className="p-4">
        {hasData ? (
          <ResponsiveContainer width="100%" height={Math.max(160, data.length * 42 + 24)}>
            <BarChart accessibilityLayer layout="vertical" data={data} margin={{ top: 4, right: 28, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 'dataMax']}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                type="category"
                dataKey="purpose"
                width={105}
                interval={0}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))" }}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: "12px",
                  boxShadow: "0 8px 24px hsl(var(--foreground) / 0.08)",
                }}
              />
              <Bar dataKey="visits" name="Visits" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={18}>
                {data.map(item => <Cell key={item.purpose} fill={item.purpose === 'Others' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'} />)}
                <LabelList dataKey="visits" position="right" style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontVariantNumeric: 'tabular-nums' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[210px] items-center justify-center text-xs text-muted-foreground">
            No visit-purpose data for this range
          </div>
        )}
        {data.some(item => item.purpose === 'Others') && <p className="mt-3 text-xs text-muted-foreground">Others includes custom and unspecified purposes.</p>}
      </CardContent>
    </Card>
  );
};

interface VisitsTableProps {
  visits: VisitRow[];
  onViewDetails: (visitId: number) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
  totalElements: number;
}

export const VisitsTable = ({ visits, onViewDetails, currentPage, onPageChange, totalPages, totalElements }: VisitsTableProps) => {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortColumn, setSortColumn] = useState<keyof VisitRow>('date');
  const [lastClickedColumn, setLastClickedColumn] = useState<keyof VisitRow | null>(null);

  const getOutcomeStatus = (visit: VisitRow): { emoji: React.ReactNode; status: string } => {
    if (visit.checkinTime && visit.checkoutTime) {
      return { emoji: '✅', status: 'Completed' };
    } else if (visit.checkoutTime) {
      return { emoji: '⏱️', status: 'Checked Out' };
    } else if (visit.checkinTime) {
      return { emoji: '🕰️', status: 'On Going' };
    }
    return { emoji: '📅', status: 'Assigned' };
  };

  const handleSort = (column: keyof VisitRow) => {
    if (column === sortColumn) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
    setLastClickedColumn(column);
    onPageChange(1);
  };

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

  // Filter to only completed visits for pagination calculation
  const completedVisits = sortedVisits.filter(visit => getOutcomeStatus(visit).status === 'Completed');
  
  const safeTotalPages = totalPages === 0 ? 1 : totalPages;
  const visitsToDisplay = completedVisits.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">Recent completed visits</CardTitle>
          <span className="text-xs text-muted-foreground">{totalElements} total visits in range</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile Card View */}
        <div className="space-y-2 p-3 md:hidden">
          {visitsToDisplay.map((visit) => {
            const { status } = getOutcomeStatus(visit);
            return (
              <Card key={visit.id} className="rounded-md border-l-2 border-l-primary shadow-none">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="font-semibold text-sm truncate">{visit.customer}</h4>
                        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> {status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(visit.date), "MMM dd, yyyy")} • {visit.purpose}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`View visit at ${visit.customer}`} className="h-8 w-8" onClick={() => onViewDetails(visit.id)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="capitalize truncate max-w-[150px]">{visit.employeeState || 'N/A'}</span>
                    </div>
                    <Button variant="link" className="px-0 h-auto text-xs" onClick={() => onViewDetails(visit.id)}>
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {visitsToDisplay.length === 0 && (
            <div className="text-xs text-muted-foreground">No completed visits available</div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[600px]">
            <thead className="bg-muted/45">
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" tabIndex={0} role="columnheader" aria-sort={sortColumn === 'customer' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSort('customer'); } }} onClick={() => handleSort('customer')}>
                  Store
                  {lastClickedColumn === 'customer' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" tabIndex={0} role="columnheader" aria-sort={sortColumn === 'date' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSort('date'); } }} onClick={() => handleSort('date')}>
                  Date
                  {lastClickedColumn === 'date' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" tabIndex={0} role="columnheader" aria-sort={sortColumn === 'purpose' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSort('purpose'); } }} onClick={() => handleSort('purpose')}>
                  Purpose
                  {lastClickedColumn === 'purpose' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground cursor-pointer" tabIndex={0} role="columnheader" aria-sort={sortColumn === 'employeeState' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSort('employeeState'); } }} onClick={() => handleSort('employeeState')}>
                  State
                  {lastClickedColumn === 'employeeState' && (
                    sortOrder === 'asc' ? (
                      <ChevronUpIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    ) : (
                      <ChevronDownIcon className="w-3 h-3 md:w-4 md:h-4 inline-block ml-1" />
                    )
                  )}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {visitsToDisplay.map((visit) => {
                const { status } = getOutcomeStatus(visit);
                return (
                  <tr key={visit.id} className="border-b last:border-b-0 hover:bg-muted/25">
                    <td className="max-w-[190px] truncate px-3 py-2.5 text-xs font-medium">{visit.customer}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{format(parseISO(visit.date), "MMM dd, yyyy")}</td>
                    <td className="max-w-[130px] truncate px-3 py-2.5 text-xs">{visit.purpose}</td>
                    <td className="max-w-[120px] truncate px-3 py-2.5 text-xs capitalize text-muted-foreground">{visit.employeeState || 'N/A'}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <Badge variant="outline" className="gap-1 whitespace-nowrap border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> {status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => onViewDetails(visit.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visitsToDisplay.length === 0 && (
                <tr>
                  <td className="px-2 md:px-4 py-2 text-xs md:text-sm text-center" colSpan={6}>No visits available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
      {totalElements > 0 && (
        <div className="flex flex-col gap-2 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">Completed visits shown from {totalElements} total visits</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Previous</span>
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {Math.min(currentPage, safeTotalPages)} of {safeTotalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
              disabled={currentPage >= safeTotalPages}
            >
              <span className="sr-only sm:not-sr-only">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

