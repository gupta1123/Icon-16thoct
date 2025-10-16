'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  CalendarIcon, 
  DownloadIcon, 
  Building,
  MapPin,
  User,
  Target,
  TrendingUp,
  Loader,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Calendar,
  DollarSign
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import dayjs from 'dayjs';

interface AttendanceStats {
    absences: number;
    halfDays: number;
    fullDays: number;
}

interface VisitsByCustomerType {
    [key: string]: number; 
}

interface FieldOfficerStatsResponse {
    totalVisits: number;
    attendanceStats: AttendanceStats;
    completedVisits: number;
    visitsByCustomerType: VisitsByCustomerType;
}

interface EmployeeUserDto {
    username: string;
    password?: string | null;
    roles?: string[] | null;
    employeeId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    plainPassword?: string;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    employeeId: string;
    primaryContact: number;
    secondaryContact?: number;
    departmentName: string;
    email: string;
    role: string; 
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    pincode: number;
    dateOfJoining: string;
    createdAt: string;
    updatedAt: string;
    userDto?: EmployeeUserDto;
    teamId?: string | null;
    isOfficeManager?: boolean;
    assignedCity?: string[];
    travelAllowance?: number | null;
    dearnessAllowance?: number | null;
    createdTime?: string;
    updatedTime?: string;
    companyId?: string | null;
    companyName?: string | null;
    fullMonthSalary?: number | null;
    status?: string | null; 
}

interface VisitDetail {
    avgIntentLevel: number;
    avgMonthlySales: number;
    visitCount: number;
    lastVisited: string; 
    city: string;
    taluka: string;
    state: string;
    customerName: string;
    customerType: string; 
    storeId: number; 
}

const formatSalesNumber = (num: number): string => {
    if (num >= 10000000) { // Crores
        const val = num / 10000000;
        return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'Cr';
    }
    if (num >= 100000) { // Lakhs
        const val = num / 100000;
        return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'L';
    }
    if (num >= 1000) { // Thousands
        const val = num / 1000;
        return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + 'K';
    }
    return num.toString();
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 6, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(await response.text() || response.statusText);
            return response;
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw new Error('Failed after retries');
}

const ReportsPage: React.FC = () => {
    const { token, userData } = useAuth();

    const [fieldOfficers, setFieldOfficers] = useState<Employee[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState<boolean>(true);
    const [employeesError, setEmployeesError] = useState<string | null>(null);
    const [isCoordinator, setIsCoordinator] = useState(false);
    const [isManager, setIsManager] = useState(false);
    const [teamId, setTeamId] = useState<number | null>(null);

    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [rangeSelect, setRangeSelect] = useState<string>('');
    
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);

    const [reportLoading, setReportLoading] = useState<boolean>(false);
    const [reportError, setReportError] = useState<string | null>(null);

    const [showReport, setShowReport] = useState<boolean>(false);
    const [summaryHeader, setSummaryHeader] = useState<React.ReactNode>(null);
    const [summaryRow, setSummaryRow] = useState<React.ReactNode>(null);
    const [reportData, setReportData] = useState<FieldOfficerStatsResponse | null>(null);
    const [categorizedVisits, setCategorizedVisits] = useState<{ [key: string]: number }>({});

    const [visitDetails, setVisitDetails] = useState<VisitDetail[] | null>(null);
    const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [selectedCustomerTypeForDetails, setSelectedCustomerTypeForDetails] = useState<string | null>(null);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [dateRangeError, setDateRangeError] = useState<string | null>(null);
    const [expandedSummaryCards, setExpandedSummaryCards] = useState<boolean>(true);
    const [expandedVisitCards, setExpandedVisitCards] = useState<Set<number>>(new Set());

    // Detect user role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            
            try {
                const response = await fetch('/api/proxy/user/manage/current-user', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const user = await response.json();
                    const authorities = user.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    
                    setIsCoordinator(role === 'ROLE_COORDINATOR');
                    setIsManager(role === 'ROLE_MANAGER' || role === 'ROLE_REGIONAL_MANAGER');
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };

        fetchCurrentUser();
    }, [token]);

    // Fetch team data for coordinators and managers
    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isCoordinator && !isManager) || !userData?.employeeId) {
                return;
            }
            
            try {
                const response = await fetch(`/api/proxy/employee/team/getbyEmployee?id=${userData.employeeId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const teamData = await response.json();
                    if (teamData.length > 0) {
                        setTeamId(teamData[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to load team data:', err);
            }
        };

        loadTeamData();
    }, [isCoordinator, isManager, userData?.employeeId, token]);

    useEffect(() => {
        const fetchAllEmployeeData = async () => {
            if (!token) return;
            
            setEmployeesLoading(true);
            setEmployeesError(null);
            try {
                let activeFieldOfficers: Employee[] = [];
                
                if (isCoordinator || isManager) {
                    // For coordinators/managers, fetch team members only
                    if (teamId) {
                        const teamResponse = await fetch(`/api/proxy/employee/team/getbyEmployee?id=${userData?.employeeId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (teamResponse.ok) {
                            const teamData = await teamResponse.json();
                            if (teamData.length > 0 && teamData[0].fieldOfficers) {
                                activeFieldOfficers = teamData[0].fieldOfficers.map((fo: { id: number; firstName: string; lastName: string; role: string; city: string; state: string; primaryContact: string; email: string }) => ({
                                    id: fo.id,
                                    firstName: fo.firstName,
                                    lastName: fo.lastName,
                                    role: fo.role,
                                    city: fo.city,
                                    state: fo.state,
                                    primaryContact: fo.primaryContact,
                                    email: fo.email,
                                }));
                            }
                        }
                    }
                } else {
                    // For admins and others, fetch all field officers
                    const [allEmployeesResponse, inactiveEmployeesResponse] = await Promise.all([
                        fetch('/api/proxy/employee/getAll', {
                            headers: { Authorization: `Bearer ${token}` },
                        }),
                        fetch('/api/proxy/employee/getAllInactive', {
                            headers: { Authorization: `Bearer ${token}` },
                        }),
                    ]);
                    if (!allEmployeesResponse.ok) throw new Error(`Failed to fetch all employees: ${allEmployeesResponse.statusText}`);
                    if (!inactiveEmployeesResponse.ok) throw new Error(`Failed to fetch inactive employees: ${inactiveEmployeesResponse.statusText}`);
                    const allEmployees: Employee[] = await allEmployeesResponse.json();
                    const inactiveEmployees: Employee[] = await inactiveEmployeesResponse.json();
                    const inactiveEmployeeIds = new Set(inactiveEmployees.map(emp => emp.id));
                    activeFieldOfficers = allEmployees
                        .filter(emp => emp.role === 'Field Officer' && !inactiveEmployeeIds.has(emp.id))
                        .sort((a, b) => {
                            const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                            const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                            if (nameA < nameB) return -1;
                            if (nameA > nameB) return 1;
                            return 0;
                        });
                }
                
                setFieldOfficers(activeFieldOfficers);
                if (activeFieldOfficers.length > 0 && !selectedEmployeeId) {
                    setSelectedEmployeeId(activeFieldOfficers[0].id.toString());
                }
            } catch (err: unknown) {
                setEmployeesError(err instanceof Error ? err.message : 'Could not fetch employee data.');
                setFieldOfficers([]);
            } finally {
                setEmployeesLoading(false);
            }
        };
        if (token) fetchAllEmployeeData();
    }, [token, isCoordinator, isManager, teamId, userData?.employeeId]);

    useEffect(() => {
        const now = new Date();
        let startDt: Date | undefined, endDt: Date | undefined;
        switch (rangeSelect) {
            case 'last-7-days': endDt = new Date(now); startDt = new Date(now); startDt.setDate(now.getDate() - 6); break;
            case 'last-15-days': endDt = new Date(now); startDt = new Date(now); startDt.setDate(now.getDate() - 14); break;
            case 'last-30-days': endDt = new Date(now); startDt = new Date(now); startDt.setDate(now.getDate() - 29); break;
            case 'last-week': { const day = now.getDay(); startDt = new Date(now); startDt.setDate(now.getDate() - (day + 6)); endDt = new Date(startDt); endDt.setDate(startDt.getDate() + 6); break; }
            case 'last-month': { const y = now.getFullYear(), m = now.getMonth(); startDt = new Date(y, m - 1, 1); endDt = new Date(y, m, 0); break; }
            default: return;
        }
        setStartDate(dayjs(startDt).format('YYYY-MM-DD'));
        setEndDate(dayjs(endDt).format('YYYY-MM-DD'));
    }, [rangeSelect]);

    const displayCategoryToApiTypeMap: { [displayCategory: string]: string } = {
        "Shop": "shop",
        "Site Visit": "site visit",
        "Architect": "architect",
        "Engineer": "engineer",
        "Builder": "builder",
        "Others": "others"
    };

    const fetchCustomerTypeDetails = async (displayCategory: string) => {
        if (!selectedEmployeeId || !startDate || !endDate) {
            setDetailsError("Please generate the main report first.");
            return;
        }
        setDetailsLoading(true);
        setDetailsError(null);
        setVisitDetails(null); 
        setSelectedCustomerTypeForDetails(displayCategory);

        const apiCustomerType = displayCategoryToApiTypeMap[displayCategory] || displayCategory.toLowerCase();

        try {
            const url = `/api/proxy/visit/customer-visit-details?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}&customerType=${apiCustomerType}`;
            const response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 6, 1000);
            const data: VisitDetail[] = await response.json();
            setVisitDetails(data);
        } catch (err: unknown) {
            setDetailsError(err instanceof Error ? err.message : `Failed to fetch details for ${displayCategory}.`);
            setVisitDetails(null);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleGenerateReport = async () => {
        if (!rangeSelect) {
            setDateRangeError('Please select a Date Range.');
            return;
        }
        if (!selectedEmployeeId || !startDate || !endDate) {
            setDateRangeError(null);
            alert('Select an officer and both dates.');
        return;
    }
        setDateRangeError(null);
        setReportLoading(true); setReportError(null); setShowReport(false);
        try {
            const url = `/api/proxy/visit/field-officer-stats?employeeId=${selectedEmployeeId}&startDate=${startDate}&endDate=${endDate}`;
            const response = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } }, 6, 1000);
            const data: FieldOfficerStatsResponse = await response.json();

            const displayCategories = ["Shop", "Site Visit", "Architect", "Engineer", "Builder", "Others"];
            const apiTypeToDisplayCategoryMap: { [apiTypeLowercase: string]: string } = {
                "shop": "Shop",
                "site visit": "Site Visit",
                "architect": "Architect", 
                "engineer": "Engineer",
                "builder": "Builder"
            };

            const categorizedVisits: { [key: string]: number } = {};
            displayCategories.forEach(cat => categorizedVisits[cat] = 0); 

            for (const apiType in data.visitsByCustomerType) {
                const count = data.visitsByCustomerType[apiType];
                const targetDisplayCategory = apiTypeToDisplayCategoryMap[apiType.toLowerCase()];

                if (targetDisplayCategory) {
                    categorizedVisits[targetDisplayCategory] += count;
                } else {
                    categorizedVisits["Others"] += count;
                }
            }

            setSummaryHeader(
                <>
                    <tr>
                        <th rowSpan={2} className="text-center">Total Visits</th><th rowSpan={2} className="text-center">Completed Visits</th>
                        <th colSpan={3} className="text-center">Attendance</th><th colSpan={displayCategories.length} className="text-center">Visits by Customer Type</th>
                    </tr>
                    <tr>
                        <th className="text-center">Full Days</th><th className="text-center">Half Days</th><th className="text-center">Absences</th>
                        {displayCategories.map(displayCat => (
                            <th key={displayCat} className="text-center">
                                <button
                                    onClick={() => fetchCustomerTypeDetails(displayCat)}
                                    className="text-blue-600 underline hover:text-blue-800 bg-transparent border-none p-0 m-0 cursor-pointer disabled:text-gray-400"
                                    disabled={reportLoading || detailsLoading}
                                    type="button"
                                >
                                    {displayCat}
                                </button>
                            </th>
                        ))}
                    </tr>
                </>
            );
            setSummaryRow(
                <>
                    <td className="text-center">{data.totalVisits}</td><td className="text-center">{data.completedVisits}</td>
                    <td className="text-center">{data.attendanceStats.fullDays}</td><td className="text-center">{data.attendanceStats.halfDays}</td><td className="text-center">{data.attendanceStats.absences}</td>
                    {displayCategories.map(type => (<td key={type} className="text-center">{categorizedVisits[type]}</td>))}
                </>
            );
            setReportData(data);
            setCategorizedVisits(categorizedVisits);
            setShowReport(true);
            setVisitDetails(null);
            setDetailsError(null);
            setSelectedCustomerTypeForDetails(null);
        } catch (err: unknown) {
            setReportError(err instanceof Error ? err.message : 'Failed to fetch report data.');
            setShowReport(false);
        } finally {
            setReportLoading(false);
        }
    };

    const handleStartDateSelect = (date: Date | undefined) => {
        if (date) {
            setStartDate(dayjs(date).format('YYYY-MM-DD'));
            if (endDate && dayjs(date).isAfter(dayjs(endDate))) {
                setEndDate('');
            }
        }
        setIsStartDatePopoverOpen(false);
    };

    const handleEndDateSelect = (date: Date | undefined) => {
        if (date) {
            setEndDate(dayjs(date).format('YYYY-MM-DD'));
        }
        setIsEndDatePopoverOpen(false);
    };
    
    const selectedEmployeeName = fieldOfficers.find(emp => emp.id.toString() === selectedEmployeeId)?.firstName + ' ' + fieldOfficers.find(emp => emp.id.toString() === selectedEmployeeId)?.lastName || "Select Field Officer";

    const filteredFieldOfficers = fieldOfficers.filter(officer => 
        `${officer.firstName} ${officer.lastName}`.toLowerCase().includes(employeeSearchTerm.toLowerCase())
    );

  const formatDateRange = () => {
        if (!startDate) return "Select date range";
        if (!endDate) return dayjs(startDate).format('MMM D, YYYY');
        return `${dayjs(startDate).format('MMM D, YYYY')} - ${dayjs(endDate).format('MMM D, YYYY')}`;
  };

  const toggleVisitCardExpansion = (index: number) => {
    setExpandedVisitCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-6">
            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-2">
                            <Label htmlFor="employeeSelectTrigger" className="text-sm text-muted-foreground">Field Officer</Label>
                            {employeesLoading ? (
                                <div className="flex items-center justify-center h-10 w-full">
                                    <Loader className="w-4 h-4 animate-spin text-muted-foreground"/>
                                </div>
                            ) : employeesError ? (
                                <div className="text-destructive text-sm">Error loading officers</div>
                            ) : (
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" id="employeeSelectTrigger" className="w-full justify-between">
                                            {selectedEmployeeId && fieldOfficers.find(emp => emp.id.toString() === selectedEmployeeId) 
                                                ? `${fieldOfficers.find(emp => emp.id.toString() === selectedEmployeeId)?.firstName} ${fieldOfficers.find(emp => emp.id.toString() === selectedEmployeeId)?.lastName}` 
                                                : "Select Field Officer"}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-full">
                                        <div className="p-2">
                                            <Input 
                                                ref={searchInputRef}
                                                placeholder="Search officer..."
                                                value={employeeSearchTerm}
                                                onChange={(e) => {
                                                    const newValue = e.target.value;
                                                    setEmployeeSearchTerm(newValue);
                                                    setTimeout(() => {
                                                        if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
                                                             searchInputRef.current.focus();
                                                        }
                                                    }, 0);
                                                }}
                                                className="w-full mb-2 h-8"
                                            />
      </div>
                                        <DropdownMenuRadioGroup value={selectedEmployeeId} onValueChange={(value) => {
                                            setSelectedEmployeeId(value);
                                            setEmployeeSearchTerm("");
                                        }}>
                                            {filteredFieldOfficers.length === 0 ? (
                                                <DropdownMenuRadioItem value="" disabled>
                                                    No matching officers
                                                </DropdownMenuRadioItem>
                                            ) : filteredFieldOfficers.map(officer => (
                                                <DropdownMenuRadioItem key={officer.id} value={officer.id.toString()}>
                                                    {`${officer.firstName} ${officer.lastName}`}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
            </div>
            
            <div className="space-y-2">
                            <Label htmlFor="rangeSelectTrigger" className="text-sm text-muted-foreground">Date Range</Label>
                            <Select value={rangeSelect} onValueChange={(value) => { 
                                setRangeSelect(value); 
                                setDateRangeError(null);
                                if (value === 'custom') {
                                    setStartDate('');
                                    setEndDate('');
                                }
                            }}>
                                <SelectTrigger id="rangeSelectTrigger" className="w-full">
                                    <SelectValue placeholder="Select Range" />
                </SelectTrigger>
                <SelectContent>
                                    <SelectItem value="custom">Custom</SelectItem>
                                    <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                                    <SelectItem value="last-15-days">Last 15 Days</SelectItem>
                                    <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                                    <SelectItem value="last-week">Last Week</SelectItem>
                                    <SelectItem value="last-month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
                            <Label htmlFor="startDateTrigger" className="text-sm text-muted-foreground">From Date</Label>
                            <Popover open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                                        id="startDateTrigger"
                    variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                                        disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? dayjs(startDate).format('MMM D, YYYY') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePicker
                                        mode="single"
                                        selected={startDate ? dayjs(startDate).toDate() : undefined}
                                        onSelect={handleStartDateSelect}
                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
            
                        <div className="space-y-2">
                            <Label htmlFor="endDateTrigger" className="text-sm text-muted-foreground">To Date</Label>
                            <Popover open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="endDateTrigger"
                                        variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground", rangeSelect !== 'custom' && rangeSelect !== '' && "opacity-50 cursor-not-allowed")}
                                        disabled={rangeSelect !== 'custom' && rangeSelect !== ''}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? dayjs(endDate).format('MMM D, YYYY') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <DatePicker
                                        mode="single"
                                        selected={endDate ? dayjs(endDate).toDate() : undefined}
                                        onSelect={handleEndDateSelect}
                                        disabled={startDate ? { before: dayjs(startDate).toDate() } : undefined}
                                        initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-end">
                            <Button
                                onClick={handleGenerateReport}
                                className="w-full"
                                disabled={reportLoading || fieldOfficers.length === 0 || !selectedEmployeeId || !startDate || !endDate}
                            >
                                {reportLoading ? (
                                    <>
                                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Generate Report
                                    </>
                                )}
              </Button>
            </div>
            </div>

            {dateRangeError && (
                        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            {dateRangeError}
                        </div>
                    )}

            {reportLoading && (
                <div className="flex justify-center items-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <Loader className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Generating report...</p>
                    </div>
                </div>
            )}
            
            {reportError && (
                <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                    <div className="flex items-center justify-between">
                        <p><strong>Error:</strong> {reportError}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateReport}
                            disabled={reportLoading}
                        >
                            Try Again
                        </Button>
                    </div>
                </div>
            )}
            {showReport && !reportLoading && !reportError && (
                        <div className="space-y-6">
                            <div className="rounded-lg border bg-card">
                                <div className="p-4 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-medium text-foreground">Report Summary</h3>
                                            <p className="text-sm text-muted-foreground">Overview of visits, attendance, and customer types</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedSummaryCards(!expandedSummaryCards)}
                                            className="md:hidden"
                                        >
                                            {expandedSummaryCards ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <Table>
                                        <TableHeader>{summaryHeader}</TableHeader>
                                        <TableBody><TableRow>{summaryRow}</TableRow></TableBody>
                                    </Table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden">
                                    {expandedSummaryCards && reportData && (
                                        <div className="p-4 space-y-4">
                                            {/* Total Visits & Completed Visits */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <Card className="p-4">
                                                    <div className="flex items-center space-x-2">
                                                        <Target className="h-5 w-5 text-blue-500" />
                                                        <div>
                                                            <p className="text-sm font-medium text-muted-foreground">Total Visits</p>
                                                            <p className="text-2xl font-bold">{reportData.totalVisits}</p>
                                                        </div>
                                                    </div>
                                                </Card>
                                                <Card className="p-4">
                                                    <div className="flex items-center space-x-2">
                                                        <TrendingUp className="h-5 w-5 text-green-500" />
                                                        <div>
                                                            <p className="text-sm font-medium text-muted-foreground">Completed</p>
                                                            <p className="text-2xl font-bold">{reportData.completedVisits}</p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </div>

                                            {/* Attendance Stats */}
                                            <div>
                                                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
                                                    <User className="h-4 w-4 mr-2" />
                                                    Attendance
                                                </h4>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <Card className="p-3">
                                                        <div className="text-center">
                                                            <p className="text-xs text-muted-foreground">Full Days</p>
                                                            <p className="text-lg font-semibold text-green-600">{reportData.attendanceStats.fullDays}</p>
                                                        </div>
                                                    </Card>
                                                    <Card className="p-3">
                                                        <div className="text-center">
                                                            <p className="text-xs text-muted-foreground">Half Days</p>
                                                            <p className="text-lg font-semibold text-yellow-600">{reportData.attendanceStats.halfDays}</p>
                                                        </div>
                                                    </Card>
                                                    <Card className="p-3">
                                                        <div className="text-center">
                                                            <p className="text-xs text-muted-foreground">Absences</p>
                                                            <p className="text-lg font-semibold text-red-600">{reportData.attendanceStats.absences}</p>
                                                        </div>
                                                    </Card>
                                                </div>
                                            </div>

                                            {/* Customer Types */}
                                            <div>
                                                <h4 className="text-sm font-medium text-foreground mb-3 flex items-center">
                                                    <Building className="h-4 w-4 mr-2" />
                                                    Visits by Customer Type
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {Object.entries(categorizedVisits).map(([customerType, count]) => (
                                                        <Card key={customerType} className="p-3">
                                                            <button
                                                                onClick={() => fetchCustomerTypeDetails(customerType)}
                                                                className="w-full text-left hover:bg-gray-50 rounded-md p-2 -m-2 transition-colors"
                                                                disabled={reportLoading || detailsLoading}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <p className="text-sm font-medium">{customerType}</p>
                                                                        <p className="text-lg font-semibold text-blue-600">{count}</p>
                                                                    </div>
                                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                </div>
                                                            </button>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

            {selectedCustomerTypeForDetails && (
                        <div className="rounded-lg border bg-card">
                            <div className="p-4 border-b">
                                <h3 className="text-base font-medium text-foreground">
                                    Visit Details for {selectedCustomerTypeForDetails}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedEmployeeName !== "Select Field Officer" && `Officer: ${selectedEmployeeName} • ${dayjs(startDate).format('MMM D, YYYY')} - ${dayjs(endDate).format('MMM D, YYYY')}`}
                                </p>
                            </div>
                            
                            {detailsLoading && (
                                <div className="flex justify-center items-center py-12">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader className="w-8 h-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">Loading visit details...</p>
                                    </div>
                                </div>
                            )}
                            
                            {detailsError && (
                                <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md m-4">
                                    <p><strong>Error:</strong> {detailsError}</p>
                                </div>
                            )}
                            
                            {!detailsLoading && !detailsError && visitDetails && (
                                visitDetails.length > 0 ? (
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="hidden md:block overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Customer Name</TableHead>
                                                        <TableHead>City</TableHead>
                                                        <TableHead>Taluka</TableHead>
                                                        <TableHead>State</TableHead>
                                                        <TableHead>Last Visited</TableHead>
                                                        <TableHead>Visit Count</TableHead>
                                                        <TableHead>Avg Monthly Sales</TableHead>
                                                        <TableHead>Customer Type</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {visitDetails
                                                        .slice()
                                                        .sort((a, b) => {
                                                            const dateA = new Date(a.lastVisited).getTime();
                                                            const dateB = new Date(b.lastVisited).getTime();
                                                            return dateB - dateA;
                                                        })
                                                        .map((detail, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-medium">
                                                                    <Link 
                                                                      href={`/dashboard/customers/${detail.storeId}`}
                                                                      className="text-primary hover:text-primary/80 hover:underline"
                                                                    >
                                                                      {detail.customerName}
                                                                    </Link>
                                                                </TableCell>
                                                                <TableCell>{detail.city}</TableCell>
                                                                <TableCell>{detail.taluka}</TableCell>
                                                                <TableCell>{detail.state}</TableCell>
                                                                <TableCell>{dayjs(detail.lastVisited).format('MMM D, YYYY')}</TableCell>
                                                                <TableCell>{detail.visitCount}</TableCell>
                                                                <TableCell>
                                                                    {(() => {
                                                                        const val = detail.avgMonthlySales;
                                                                        if (val % 1 === 0) return formatSalesNumber(val);
                                                                        const rounded = Math.round(val * 10) / 10;
                                                                        return formatSalesNumber(rounded);
                                                                    })()}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline">
                                                                        {detail.customerType}
                                                                    </Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {/* Mobile Card View */}
                                        <div className="md:hidden space-y-4 p-4">
                                            {visitDetails
                                                .slice()
                                                .sort((a, b) => {
                                                    const dateA = new Date(a.lastVisited).getTime();
                                                    const dateB = new Date(b.lastVisited).getTime();
                                                    return dateB - dateA;
                                                })
                                                .map((detail, index) => (
                                                    <Card key={index} className="overflow-hidden">
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex-1">
                                                                    <Link 
                                                                        href={`/dashboard/customers/${detail.storeId}`}
                                                                        className="text-primary hover:text-primary/80 hover:underline"
                                                                    >
                                                                        <CardTitle className="text-base font-medium">
                                                                            {detail.customerName}
                                                                        </CardTitle>
                                                                    </Link>
                                                                    <div className="flex items-center space-x-2 mt-1">
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {detail.customerType}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => toggleVisitCardExpansion(index)}
                                                                >
                                                                    {expandedVisitCards.has(index) ? (
                                                                        <ChevronUp className="h-5 w-5" />
                                                                    ) : (
                                                                        <ChevronDown className="h-5 w-5" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pt-0">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="flex items-center space-x-2">
                                                                    <MapPin className="h-4 w-4 text-blue-500" />
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Location</p>
                                                                        <p className="text-sm font-medium">{detail.city}, {detail.state}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <Calendar className="h-4 w-4 text-green-500" />
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground">Last Visit</p>
                                                                        <p className="text-sm font-medium">{dayjs(detail.lastVisited).format('MMM D, YYYY')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {expandedVisitCards.has(index) && (
                                                                <div className="mt-4 space-y-3 pt-4 border-t">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="flex items-center space-x-2">
                                                                            <Target className="h-4 w-4 text-purple-500" />
                                                                            <div>
                                                                                <p className="text-xs text-muted-foreground">Visit Count</p>
                                                                                <p className="text-sm font-medium">{detail.visitCount}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2">
                                                                            <DollarSign className="h-4 w-4 text-yellow-500" />
                                                                            <div>
                                                                                <p className="text-xs text-muted-foreground">Monthly Sales</p>
                                                                                <p className="text-sm font-medium">
                                                                                    {(() => {
                                                                                        const val = detail.avgMonthlySales;
                                                                                        if (val % 1 === 0) return formatSalesNumber(val);
                                                                                        const rounded = Math.round(val * 10) / 10;
                                                                                        return formatSalesNumber(rounded);
                                                                                    })()}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {detail.taluka && (
                                                                        <div className="flex items-center space-x-2">
                                                                            <Building className="h-4 w-4 text-gray-500" />
                                                                            <div>
                                                                                <p className="text-xs text-muted-foreground">Taluka</p>
                                                                                <p className="text-sm font-medium">{detail.taluka}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-8 text-center">
                                        <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-muted-foreground">No visit details found for {selectedCustomerTypeForDetails}</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}
    </div>
  );
};

export default ReportsPage;
