"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface SummaryData {
    employeeName: string;
    fullDayThreshold: number;
    endDate: string;
    includeSundays: boolean;
    presentDays: number;
    fullDays: number;
    baseSalary: number;
    carDistanceKm: number;
    employeeId: number;
    absentDays: number;
    travelAllowance: number;
    halfDayThreshold: number;
    totalSalary: number;
    halfDays: number;
    bikeDistanceKm: number;
    approvedExpenses: number;
    startDate: string;
    dearnessAllowance: number;
}

const EmployeeSummary: React.FC = () => {
    const [summaryData, setSummaryData] = useState<SummaryData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'));

    // Get auth data from localStorage instead of Redux
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const fetchSummaryData = async () => {
        setError(null);
        try {
            setSummaryLoading(true);
            
            if (!startDate || !endDate) {
                throw new Error('Please select a valid date range');
            }

            if (!token) {
                throw new Error('Authentication token not found. Please log in.');
            }

            const response = await fetch(
                `/api/proxy/salary-calculation/manual-summary-range?startDate=${startDate}&endDate=${endDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch summary data: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data) {
                throw new Error('No summary data received');
            }

            setSummaryData(data);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setSummaryLoading(false);
        }
    };

    // Remove automatic data fetching - only fetch on Apply Filter

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    // Filter summary data based on search query and sort alphabetically by employee name
    const filteredSummaryData = summaryData
        .filter(employee =>
            employee.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => 
            a.employeeName.toLowerCase().localeCompare(b.employeeName.toLowerCase())
        );

    // Get date range display name
    const getDateRangeDisplay = () => {
        if (!startDate || !endDate) {
            return 'Select Date Range';
        }
        return `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`;
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-foreground">Employee Summary</CardTitle>
                    <p className="text-sm text-muted-foreground">View employee salary summaries and attendance data</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-2">
                            <Label htmlFor="searchQuery" className="text-sm font-medium text-foreground">Search Employee</Label>
                            <Input
                                id="searchQuery"
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="text-sm font-medium text-foreground">From Date</Label>
                            <Input
                                type="date"
                                id="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate" className="text-sm font-medium text-foreground">To Date</Label>
                            <Input
                                type="date"
                                id="endDate"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={fetchSummaryData} className="w-full" disabled={summaryLoading}>
                                {summaryLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Apply Filter'
                                )}
                            </Button>
                        </div>
                    </div>

                    {summaryLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading salary data...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchSummaryData}
                                    disabled={summaryLoading}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!summaryLoading && !error && (
                        <>
                            {/* Mobile view */}
                            <div className="md:hidden space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Employee Salary Summary ({getDateRangeDisplay()})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {summaryLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin" />
                                                <span className="ml-2">Loading summary...</span>
                                            </div>
                                        ) : summaryData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No summary data available
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {filteredSummaryData.map((employee) => (
                                                    <motion.div
                                                        key={employee.employeeId}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                    >
                                                        <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                                                            <CardHeader className="pb-2">
                                                                <div className="flex items-center justify-between">
                                                                    <CardTitle className="text-lg">{employee.employeeName}</CardTitle>
                                                                    <Badge variant="outline" className="font-bold">
                                                                        {formatCurrency(employee.totalSalary)}
                                                                    </Badge>
                                                                </div>
                                                            </CardHeader>
                                                            <CardContent>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Present Days:</span>
                                                                            <span className="font-medium">{employee.presentDays}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Full Days:</span>
                                                                            <span className="font-medium">{employee.fullDays}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Half Days:</span>
                                                                            <span className="font-medium">{employee.halfDays}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Absent Days:</span>
                                                                            <span className="font-medium">{employee.absentDays}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Base Salary:</span>
                                                                            <span className="font-medium">{formatCurrency(employee.baseSalary)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">Travel:</span>
                                                                            <span className="font-medium">{formatCurrency(employee.travelAllowance)}</span>
                                                                        </div>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-muted-foreground">DA:</span>
                                                                            <span className="font-medium">{formatCurrency(employee.dearnessAllowance)}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Desktop view */}
                            <div className="hidden md:block">
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Employee Salary Summary ({getDateRangeDisplay()})</h3>
                                        <p className="text-sm text-muted-foreground">Overview of employee attendance and salary calculations</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {summaryLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                    <p className="text-sm text-muted-foreground">Loading summary data...</p>
                                                </div>
                                            </div>
                                        ) : filteredSummaryData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                {summaryData.length === 0 ? 'No summary data available' : 'No employees found matching your search'}
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Employee Name</TableHead>
                                                        <TableHead>Present Days</TableHead>
                                                        <TableHead>Full Days</TableHead>
                                                        <TableHead>Half Days</TableHead>
                                                        <TableHead>Absent Days</TableHead>
                                                        <TableHead>Base Salary</TableHead>
                                                        <TableHead>Travel Allowance</TableHead>
                                                        <TableHead>Dearness Allowance</TableHead>
                                                        <TableHead>Expenses</TableHead>
                                                        <TableHead>Total Salary</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredSummaryData.map((employee) => (
                                                        <TableRow key={employee.employeeId}>
                                                            <TableCell className="font-medium">{employee.employeeName}</TableCell>
                                                            <TableCell>{employee.presentDays}</TableCell>
                                                            <TableCell>{employee.fullDays}</TableCell>
                                                            <TableCell>{employee.halfDays}</TableCell>
                                                            <TableCell>{employee.absentDays}</TableCell>
                                                            <TableCell>{formatCurrency(employee.baseSalary)}</TableCell>
                                                            <TableCell>{formatCurrency(employee.travelAllowance)}</TableCell>
                                                            <TableCell>{formatCurrency(employee.dearnessAllowance)}</TableCell>
                                                            <TableCell>{formatCurrency(employee.approvedExpenses)}</TableCell>
                                                            <TableCell className="font-bold">{formatCurrency(employee.totalSalary)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default EmployeeSummary;
