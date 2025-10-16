"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, User, DollarSign, MapPin, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface DailyBreakdownData {
    date: string;
    employeeName: string;
    daEarned: number;
    carDistanceKm: number;
    employeeId: number;
    dailyDearnessAllowance: number;
    travelAllowance: number;
    totalDailySalary: number;
    dayType: string;
    completedVisits: number;
    dayOfWeek: string;
    hasAttendance: boolean;
    isSunday: boolean;
    bikeDistanceKm: number;
    dailyBaseSalary: number;
    baseEarned: number;
    approvedExpenses: number;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
}

const DailyBreakdown: React.FC = () => {
    const [dailyBreakdownData, setDailyBreakdownData] = useState<DailyBreakdownData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dailyLoading, setDailyLoading] = useState(false);
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd'));
    const [selectedEmployee, setSelectedEmployee] = useState("all");
    const [employees, setEmployees] = useState<Employee[]>([]);

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const fetchDailyBreakdown = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setDailyLoading(true);
        setError(null);
        try {
            if (!startDate || !endDate) {
                throw new Error('Please select a valid date range');
            }
            if (selectedEmployee === 'all') {
                throw new Error('Please select an employee to view daily breakdown');
            }
            const employeeId = selectedEmployee;

            const response = await fetch(
                `/api/proxy/salary-calculation/daily-breakdown?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch daily breakdown: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data) {
                throw new Error('No daily breakdown data received');
            }

            setDailyBreakdownData(data);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to fetch daily breakdown data');
        } finally {
            setDailyLoading(false);
        }
    }, [token, startDate, endDate, selectedEmployee]);

    const fetchEmployees = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch('/api/proxy/employee/getAll', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch employees');
            }

            const data = await response.json();
            if (data) {
                // Filter only field officers and sort by name
                const fieldOfficers = data
                    .filter((emp: Employee) => emp.role === 'Field Officer')
                    .sort((a: Employee, b: Employee) => {
                        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                setEmployees(fieldOfficers);
                // Auto-select first employee if none selected
                if (fieldOfficers.length > 0 && selectedEmployee === 'all') {
                    setSelectedEmployee(fieldOfficers[0].id.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    }, [token]);

    const fetchAllData = useCallback(async () => {
        if (!token || !startDate || !endDate) return;
        
        setError(null);
        await Promise.all([fetchDailyBreakdown(), fetchEmployees()]);
    }, [token, startDate, endDate, fetchDailyBreakdown, fetchEmployees]);

    // Load employees on mount only
    useEffect(() => {
        if (token) {
            fetchEmployees();
        }
    }, [token, fetchEmployees]);

    const getDayTypeColor = (dayType: string, isSunday: boolean = false) => {
        if (isSunday) return 'bg-purple-100 text-purple-800 border-purple-200';
        switch (dayType.toLowerCase()) {
            case 'full day': return 'bg-green-100 text-green-800 border-green-200';
            case 'full day (activity)': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'half day': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'present': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Format day name from "MONDAY" to "Monday" format
    const formatDayName = (dayOfWeek: string) => {
        return dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1).toLowerCase();
    };

    // Get day type display - show "paid leave" for Sunday, otherwise use dayType
    const getDayTypeDisplay = (dayType: string, isSunday: boolean = false) => {
        if (isSunday) return 'paid leave';
        if (dayType.toLowerCase() === 'full day (activity)') return 'full day (activity)';
        return dayType;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    // Get employee options for dropdown
    const employeeOptions = employees.map(emp => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`
    }));

    // Get date range display name
    const getDateRangeDisplay = () => {
        if (!startDate || !endDate) {
            return 'Select Date Range';
        }
        return `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`;
    };

    // Get selected employee display name
    const getSelectedEmployeeDisplay = () => {
        if (selectedEmployee === 'all') return 'All Employees';
        const selected = employeeOptions.find(e => e.id.toString() === selectedEmployee);
        return selected ? selected.name : 'Selected Employee';
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-foreground">Daily Breakdown</CardTitle>
                    <p className="text-sm text-muted-foreground">View detailed daily salary breakdowns for employees</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-2">
                            <Label htmlFor="employee" className="text-sm font-medium text-foreground">Employee</Label>
                            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select Employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Employees</SelectItem>
                                    {employeeOptions.map((employee) => (
                                        <SelectItem key={employee.id} value={employee.id.toString()}>
                                            {employee.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                        <div className="space-y-2 flex items-end">
                            <Button onClick={fetchAllData} className="w-full" disabled={dailyLoading || selectedEmployee === 'all'}>
                                {dailyLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    selectedEmployee === 'all' ? 'Select Employee' : 'Apply Filter'
                                )}
                            </Button>
                        </div>
                        <div className="space-y-2 flex items-end">
                            <div className="text-sm text-muted-foreground">
                                <div className="font-medium">{getSelectedEmployeeDisplay()}</div>
                                <div>{getDateRangeDisplay()}</div>
                            </div>
                        </div>
                    </div>

                    {dailyLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading daily breakdown data...</p>
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
                                    onClick={() => {
                                        setError(null);
                                        fetchAllData();
                                    }}
                                    disabled={dailyLoading}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!dailyLoading && !error && (
                        <>
                            {/* Mobile view */}
                            <div className="md:hidden space-y-4">
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Daily Breakdown - {getSelectedEmployeeDisplay()}</h3>
                                        <p className="text-sm text-muted-foreground">{getDateRangeDisplay()}</p>
                                    </div>
                                    <div className="p-4">
                                        {dailyLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin" />
                                                <span className="ml-2">Loading daily data...</span>
                                            </div>
                                        ) : dailyBreakdownData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No daily breakdown data available
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {dailyBreakdownData.map((day, index) => (
                                                    <Card key={index} className="overflow-hidden shadow-sm">
                                                        <CardContent className="pt-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center space-x-2">
                                                                    <User className="h-5 w-5 text-primary" />
                                                                    <div>
                                                                        <div className="font-medium text-lg text-foreground">{day.employeeName}</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            {new Date(day.date).toLocaleDateString('en-IN', {
                                                                                weekday: 'long',
                                                                                year: 'numeric',
                                                                                month: 'short',
                                                                                day: 'numeric'
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge className={`${getDayTypeColor(day.dayType, day.isSunday)} mb-1`}>
                                                                        {getDayTypeDisplay(day.dayType, day.isSunday)}
                                                                    </Badge>
                                                                    <div className="font-bold text-lg text-foreground">{formatCurrency(day.totalDailySalary)}</div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Visits:</span>
                                                                        <span className="font-medium text-foreground">{day.completedVisits}</span>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Base:</span>
                                                                        <span className="font-medium text-foreground">{formatCurrency(day.baseEarned)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Travel:</span>
                                                                        <span className="font-medium text-foreground">{formatCurrency(day.travelAllowance)}</span>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">DA:</span>
                                                                        <span className="font-medium text-foreground">{formatCurrency(day.daEarned)}</span>
                                                                    </div>
                                                                    {/* <div className="flex items-center space-x-2">
                                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Car Dist:</span>
                                                                        <span className="font-medium text-foreground">{day.carDistanceKm.toFixed(2)} Km</span>
                                                                    </div> */}
                                                                    <div className="flex items-center space-x-2">
                                                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="text-muted-foreground">Bike Dist:</span>
                                                                        <span className="font-medium text-foreground">{day.bikeDistanceKm.toFixed(2)} Km</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Desktop view */}
                            <div className="hidden md:block">
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Daily Breakdown - {getSelectedEmployeeDisplay()}</h3>
                                        <p className="text-sm text-muted-foreground">{getDateRangeDisplay()}</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        {dailyLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-8 w-8 animate-spin" />
                                                <span className="ml-2">Loading daily breakdown...</span>
                                            </div>
                                        ) : dailyBreakdownData.length === 0 ? (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No daily breakdown data available
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Employee Name</TableHead>
                                                        <TableHead>Date</TableHead>
                                                        <TableHead>Day</TableHead>
                                                        <TableHead>Day Type</TableHead>
                                                        <TableHead>Completed Visits</TableHead>
                                                        <TableHead>Base Earned</TableHead>
                                                        <TableHead>Travel Allowance</TableHead>
                                                        <TableHead>DA Earned</TableHead>
                                                        {/* <TableHead>Car Distance (Km)</TableHead> */}
                                                        <TableHead>Bike Distance (Km)</TableHead>
                                                        <TableHead>Total Daily</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {dailyBreakdownData.map((day, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-medium">{day.employeeName}</TableCell>
                                                            <TableCell>{new Date(day.date).toLocaleDateString('en-IN')}</TableCell>
                                                            <TableCell>{formatDayName(day.dayOfWeek)}</TableCell>
                                                            <TableCell>
                                                                <Badge className={getDayTypeColor(day.dayType, day.isSunday)}>
                                                                    {getDayTypeDisplay(day.dayType, day.isSunday)}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>{day.completedVisits}</TableCell>
                                                            <TableCell>{formatCurrency(day.baseEarned)}</TableCell>
                                                            <TableCell>{formatCurrency(day.travelAllowance)}</TableCell>
                                                            <TableCell>{formatCurrency(day.daEarned)}</TableCell>
                                                            {/* <TableCell>{day.carDistanceKm.toFixed(2)}</TableCell> */}
                                                            <TableCell>{day.bikeDistanceKm.toFixed(2)}</TableCell>
                                                            <TableCell className="font-bold">{formatCurrency(day.totalDailySalary)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Summary Card */}
                            {dailyBreakdownData.length > 0 && (
                                <Card className="bg-muted/30">
                                    <CardContent className="pt-6">
                                        <div className="flex items-start space-x-3">
                                            <Calendar className="h-5 w-5 text-primary mt-0.5" />
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-foreground">Daily Breakdown Summary</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Showing {dailyBreakdownData.length} daily records for {getSelectedEmployeeDisplay()} 
                                                    from {getDateRangeDisplay()}. Each record shows the detailed breakdown of salary components 
                                                    including base salary, travel allowance, and dearness allowance.
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DailyBreakdown;
