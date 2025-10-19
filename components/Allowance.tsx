"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DollarSign, Truck, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    travelAllowance?: number;
    dearnessAllowance?: number;
    fullMonthSalary?: number;
}

interface TravelRate {
    id: number;
    employeeId: number;
    carRatePerKm: number;
    bikeRatePerKm: number;
}

const Allowance: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [editMode, setEditMode] = useState<{ [key: number]: boolean }>({});
    const [editedData, setEditedData] = useState<{ [key: number]: Record<string, unknown> }>({});
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [travelRates, setTravelRates] = useState<TravelRate[]>([]);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [expandedCards, setExpandedCards] = useState<{ [key: number]: boolean }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const formatNumberField = (value?: number | null) =>
        value === null || value === undefined ? "" : String(value);

    const parseNumericField = (value: unknown): number => {
        if (value === "" || value === null || value === undefined) {
            return 0;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    };

    const getEditedValue = (employeeId: number, field: string, fallback?: number | null) => {
        const record = editedData[employeeId] as Record<string, unknown> | undefined;
        const value = record?.[field];
        if (value === undefined || value === null) {
            if (fallback === null || fallback === undefined) {
                return "";
            }
            return String(fallback);
        }
        return String(value);
    };

    useEffect(() => {
        const checkIfMobile = () => setIsMobile(window.innerWidth < 768);
        checkIfMobile();
        window.addEventListener('resize', checkIfMobile);
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    const fetchEmployees = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/proxy/employee/getAll', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch employees: ${response.statusText}`);
            }

            const data = await response.json();
            const sortedData = data.sort((a: Employee, b: Employee) => a.firstName.localeCompare(b.firstName));
            setEmployees(sortedData);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const fetchTravelRates = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch('/api/proxy/travel-rates/getAll', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch travel rates');
            }
            const data = await response.json();
            setTravelRates(data);
        } catch (error) {
            console.error('Error fetching travel rates:', error);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchEmployees();
            fetchTravelRates();
        }
    }, [fetchEmployees, fetchTravelRates]);

    useEffect(() => {
        const total = Math.max(1, Math.ceil((employees.length || 0) / rowsPerPage) || 1);
        setCurrentPage(prev => (prev > total ? total : prev));
    }, [employees.length, rowsPerPage]);

    const handleInputChange = (employeeId: number, field: string, value: string) => {
        setEditedData(prevData => ({
            ...prevData,
            [employeeId]: {
                ...prevData[employeeId],
                [field]: value
            }
        }));
    };

    const updateSalary = async (employeeId: number) => {
        const editedEmployee = editedData[employeeId] as Record<string, unknown> | undefined;
        if (!editedEmployee) return;

        setIsSaving(true);
        try {
            const salaryPayload = {
                travelAllowance: parseNumericField(editedEmployee.travelAllowance),
                dearnessAllowance: parseNumericField(editedEmployee.dearnessAllowance),
                fullMonthSalary: parseNumericField(editedEmployee.fullMonthSalary),
                employeeId,
            };

            const salaryResponse = await fetch(`/api/proxy/employee/setSalary`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(salaryPayload),
            });

            if (!salaryResponse.ok) {
                throw new Error('Failed to update salary');
            }

            const existingTravelRate = travelRates.find(rate => rate.employeeId === employeeId);
            const travelRateData = {
                employeeId,
                carRatePerKm: parseNumericField(editedEmployee.carRatePerKm),
                bikeRatePerKm: parseNumericField(editedEmployee.bikeRatePerKm)
            };

            let travelRateResponse;
            if (existingTravelRate) {
                travelRateResponse = await fetch(`/api/proxy/travel-rates/edit?id=${existingTravelRate.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(travelRateData),
                });
            } else {
                travelRateResponse = await fetch(`/api/proxy/travel-rates/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(travelRateData),
                });
            }

            if (!travelRateResponse.ok) {
                throw new Error('Failed to update travel rates');
            }

            fetchEmployees();
            fetchTravelRates();
            setEditMode(prevMode => ({
                ...prevMode,
                [employeeId]: false
            }));
        } catch (error) {
            console.error('Error saving changes:', error);
            setError(error instanceof Error ? error.message : 'Error saving changes');
        } finally {
            setIsSaving(false);
        }
    };

    const startEdit = (employeeId: number) => {
        const employee = employees.find(e => e.id === employeeId);
        const travelRate = travelRates.find(rate => rate.employeeId === employeeId);
        setEditMode(prevMode => ({
            ...prevMode,
            [employeeId]: true
        }));
        setEditedData(prevData => ({
            ...prevData,
            [employeeId]: {
                travelAllowance: formatNumberField(employee?.travelAllowance),
                dearnessAllowance: formatNumberField(employee?.dearnessAllowance),
                fullMonthSalary: formatNumberField(employee?.fullMonthSalary),
                carRatePerKm: formatNumberField(travelRate?.carRatePerKm),
                bikeRatePerKm: formatNumberField(travelRate?.bikeRatePerKm)
            }
        }));
    };

    const cancelEdit = (employeeId: number) => {
        setEditMode(prevMode => ({
            ...prevMode,
            [employeeId]: false
        }));
        setEditedData(prevData => {
            const newData = { ...prevData };
            delete newData[employeeId];
            return newData;
        });
    };

    const indexOfFirstRow = (currentPage - 1) * rowsPerPage;
    const currentRows = employees.slice(indexOfFirstRow, indexOfFirstRow + rowsPerPage);
    const totalPages = Math.max(1, Math.ceil((employees.length || 0) / rowsPerPage) || 1);

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    const toggleCardExpansion = (employeeId: number) => {
        setExpandedCards(prev => ({
            ...prev,
            [employeeId]: !prev[employeeId]
        }));
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-foreground">Allowance Details</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage employee allowances, salaries, and travel rates</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading employee data...</p>
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
                                        fetchEmployees();
                                        fetchTravelRates();
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && (
                        <>
                            {isMobile ? (
                                <div className="space-y-4">
                                    {currentRows.map((employee) => (
                                        <Card key={employee.id} className="overflow-hidden">
                                            <CardHeader className="pb-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-4">
                                                        <Avatar className="h-12 w-12 bg-primary">
                                                            <AvatarFallback className="text-primary-foreground">
                                                                {getInitials(employee.firstName, employee.lastName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <CardTitle className="text-lg">{`${employee.firstName} ${employee.lastName}`}</CardTitle>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleCardExpansion(employee.id)}
                                                    >
                                                        {expandedCards[employee.id] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            {expandedCards[employee.id] && (
                                                <CardContent>
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <DollarSign className="h-5 w-5 text-green-500" />
                                                                <span className="font-medium">DA:</span>
                                                            </div>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={getEditedValue(employee.id, 'dearnessAllowance', employee.dearnessAllowance)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'dearnessAllowance', e.target.value)}
                                                                    className="w-24 text-right"
                                                                />
                                                            ) : (
                                                                <span className="font-semibold">{formatCurrency(employee.dearnessAllowance || 0)}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <DollarSign className="h-5 w-5 text-blue-500" />
                                                                <span className="font-medium">Salary:</span>
                                                            </div>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={getEditedValue(employee.id, 'fullMonthSalary', employee.fullMonthSalary)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'fullMonthSalary', e.target.value)}
                                                                    className="w-24 text-right"
                                                                />
                                                            ) : (
                                                                <span className="font-semibold">{formatCurrency(employee.fullMonthSalary || 0)}</span>
                                                            )}
                                                        </div>
                                                        {/* <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <Truck className="h-5 w-5 text-yellow-500" />
                                                                <span className="font-medium">Car Rate:</span>
                                                            </div>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    value={Number(editedData[employee.id]?.carRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'carRatePerKm', e.target.value)}
                                                                    className="w-24 text-right"
                                                                />
                                                            ) : (
                                                                <span className="font-semibold">{travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0}/km</span>
                                                            )}
                                                        </div> */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <Truck className="h-5 w-5 text-purple-500" />
                                                                <span className="font-medium">Bike Rate:</span>
                                                            </div>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={getEditedValue(
                                                                        employee.id,
                                                                        'bikeRatePerKm',
                                                                        travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? null
                                                                    )}
                                                                    onChange={(e) => handleInputChange(employee.id, 'bikeRatePerKm', e.target.value)}
                                                                    className="w-24 text-right"
                                                                />
                                                            ) : (
                                                                <span className="font-semibold">{travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0}/km</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-4">
                                                        {editMode[employee.id] ? (
                                                            <div className="flex space-x-2">
                                                                <Button 
                                                                    onClick={() => updateSalary(employee.id)} 
                                                                    className="flex-1" 
                                                                    disabled={isSaving}
                                                                >
                                                                    {isSaving ? (
                                                                        <>
                                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                            Saving...
                                                                        </>
                                                                    ) : (
                                                                        'Save'
                                                                    )}
                                                                </Button>
                                                                <Button onClick={() => cancelEdit(employee.id)} variant="outline" className="flex-1">Cancel</Button>
                                                            </div>
                                                        ) : (
                                                            <Button onClick={() => startEdit(employee.id)} className="w-full">Edit</Button>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border bg-card">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-foreground">Employee Allowances</h3>
                                        <p className="text-sm text-muted-foreground">Manage DA, Salary, and vehicle rates per employee</p>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Employee</TableHead>
                                                    <TableHead>DA</TableHead>
                                                    <TableHead>Salary</TableHead>
                                                    {/* <TableHead>Car Rate (per km)</TableHead> */}
                                                    <TableHead>Bike Rate (per km)</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {currentRows.map((employee) => (
                                                    <TableRow key={employee.id}>
                                                        <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={getEditedValue(employee.id, 'dearnessAllowance', employee.dearnessAllowance)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'dearnessAllowance', e.target.value)}
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                formatCurrency(employee.dearnessAllowance || 0)
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={getEditedValue(employee.id, 'fullMonthSalary', employee.fullMonthSalary)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'fullMonthSalary', e.target.value)}
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                formatCurrency(employee.fullMonthSalary || 0)
                                                            )}
                                                        </TableCell>
                                                        {/* <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    value={Number(editedData[employee.id]?.carRatePerKm ?? travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0)}
                                                                    onChange={(e) => handleInputChange(employee.id, 'carRatePerKm', e.target.value)}
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                `${travelRates.find(rate => rate.employeeId === employee.id)?.carRatePerKm ?? 0}/km`
                                                            )}
                                                        </TableCell> */}
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <Input
                                                                    type="number"
                                                                    inputMode="decimal"
                                                                    value={getEditedValue(
                                                                        employee.id,
                                                                        'bikeRatePerKm',
                                                                        travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? null
                                                                    )}
                                                                    onChange={(e) => handleInputChange(employee.id, 'bikeRatePerKm', e.target.value)}
                                                                    className="w-full"
                                                                />
                                                            ) : (
                                                                `${travelRates.find(rate => rate.employeeId === employee.id)?.bikeRatePerKm ?? 0}/km`
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {editMode[employee.id] ? (
                                                                <div className="flex space-x-2">
                                                                    <Button 
                                                                        onClick={() => updateSalary(employee.id)} 
                                                                        className="flex-1" 
                                                                        disabled={isSaving}
                                                                    >
                                                                        {isSaving ? (
                                                                            <>
                                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                                Saving...
                                                                            </>
                                                                        ) : (
                                                                            'Save'
                                                                        )}
                                                                    </Button>
                                                                    <Button onClick={() => cancelEdit(employee.id)} variant="outline" className="flex-1">Cancel</Button>
                                                                </div>
                                                            ) : (
                                                                <Button onClick={() => startEdit(employee.id)} className="w-full">Edit</Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {employees.length > 0 && (
                                <div className="flex flex-col gap-3 mt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="pageSize">Rows per page:</Label>
                                        <Select
                                            value={rowsPerPage.toString()}
                                            onValueChange={(value) => {
                                                const parsed = parseInt(value, 10);
                                                if (!Number.isNaN(parsed)) {
                                                    setRowsPerPage(parsed);
                                                    setCurrentPage(1);
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {totalPages > 1 && (
                                        <div className="flex items-center space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Previous
                                            </Button>

                                            <span className="text-sm text-muted-foreground">
                                                Page {currentPage} of {totalPages}
                                            </span>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage >= totalPages}
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Allowance;
