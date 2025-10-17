'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-provider';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Loader, CalendarIcon } from "lucide-react";
import { API, type TeamDataDto } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface Brand {
    id: number;
    brandName: string;
    price: number;
    city: string;
    state: string;
    employeeDto: {
        id: number;
        firstName: string;
        lastName: string;
        city: string;
    };
    metric: string;
    createdAt: string;
    updatedAt: string;
}

interface EmployeeOption {
    id: number;
    name: string;
    city: string;
}

const formatEmployeeName = (firstName?: string | null, lastName?: string | null) =>
    [firstName ?? "", lastName ?? ""].join(" ").replace(/\s+/g, " ").trim();

const PricingPage = () => {
    const [brandData, setBrandData] = useState<Brand[]>([]);
    const [previousDayData, setPreviousDayData] = useState<Brand[]>([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [cities, setCities] = useState<string[]>([]);
    const [gajkesariRate, setGajkesariRate] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showGajkesariRate, setShowGajkesariRate] = useState(false);
    const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
    const [selectedFieldOfficer, setSelectedFieldOfficer] = useState("all");
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamData, setTeamData] = useState<TeamDataDto[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const { token, userRole, currentUser, userData } = useAuth();
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [isCoordinator, setIsCoordinator] = useState(false);
    const [userRoleFromAPI, setUserRoleFromAPI] = useState<string | null>(null);

    // Fetch current user data to determine role
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
                    const userData = await response.json();
                    console.log('Current user data:', userData);
                    
                    // Extract role from authorities
                    const authorities = userData.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    setUserRoleFromAPI(role);
                    
                    // Set role flags
                    setIsManager(role === 'ROLE_MANAGER');
                    setIsAdmin(role === 'ROLE_ADMIN');
                    setIsFieldOfficer(role === 'ROLE_FIELD OFFICER');
                    setIsCoordinator(role === 'ROLE_COORDINATOR');
                    
                    console.log('Role from API:', role);
                    console.log('isManager:', role === 'ROLE_MANAGER');
                    console.log('isAdmin:', role === 'ROLE_ADMIN');
                    console.log('isFieldOfficer:', role === 'ROLE_FIELD OFFICER');
                    console.log('isCoordinator:', role === 'ROLE_COORDINATOR');
                } else {
                    console.error('Failed to fetch current user data');
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };

        fetchCurrentUser();
    }, [token]);

    // Fetch team data for managers, coordinators and field officers
    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isManager && !isFieldOfficer && !isCoordinator) || !userData?.employeeId) return;
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                setTeamData(teamData);
                
                // Get the first team ID (assuming manager/field officer has one primary team)
                if (teamData.length > 0) {
                    setTeamId(teamData[0].id);
                } else {
                    setTeamError('No team data found for this user');
                    // Fallback to hardcoded team ID
                    setTeamId(51);
                }
            } catch (err: unknown) {
                console.error('Failed to load team data:', err);
                setTeamError('Failed to load team data');
                // Fallback to hardcoded team ID if API fails
                setTeamId(51);
            } finally {
                setTeamLoading(false);
            }
        };

        loadTeamData();
    }, [isManager, isFieldOfficer, isCoordinator, userData?.employeeId]);

    useEffect(() => {
        // Only fetch data when we have a valid date and token
        if (selectedDate && token) {
            const fetchData = async () => {
                setIsLoading(true);
                await Promise.all([fetchBrandData(), fetchPreviousDayData()]);
                setIsLoading(false);
            };
            fetchData();
        }
    }, [selectedCity, selectedDate, teamId, token]);

    const fetchBrandData = useCallback(async () => {
        if (!token || !selectedDate) return;
        
        // For managers, coordinators and field officers, wait until teamId is available
        if ((isManager || isFieldOfficer || isCoordinator) && (teamId === null || teamId === undefined)) return;
        
        try {
            const dateObj = new Date(selectedDate);
            if (isNaN(dateObj.getTime())) {
                console.error('Invalid selectedDate:', selectedDate);
                return;
            }
            
            const formattedStartDate = format(dateObj, 'yyyy-MM-dd');
            const formattedEndDate = format(dateObj, 'yyyy-MM-dd');

            console.log('fetchBrandData - isManager:', isManager, 'isCoordinator:', isCoordinator, 'teamId:', teamId);

            let url: string;
            
            if (isManager && teamId !== null) {
                // For managers, use team-based API call
                url = `/api/proxy/brand/getByTeamAndDate?id=${teamId}&start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Manager API call:', url);
            } else if (isCoordinator && teamId !== null) {
                // For coordinators, use team-based API call
                url = `/api/proxy/brand/getByTeamAndDate?id=${teamId}&start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Coordinator API call:', url);
            } else if (isAdmin) {
                // For admins, use the original API call
                url = `/api/proxy/brand/getByDateRange?start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Admin API call:', url);
            } else if (isFieldOfficer) {
                // For field officers, use team-based API call (same as manager for now)
                url = `/api/proxy/brand/getByTeamAndDate?id=${teamId}&start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Field Officer API call:', url);
            } else {
                // Default to admin API call
                url = `/api/proxy/brand/getByDateRange?start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Default (Admin) API call:', url);
            }

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data: Brand[] = await response.json();
            setBrandData(data);

            const uniqueCities = Array.from(new Set(data.map(brand => {
                const employeeCity = brand.employeeDto?.city;
                const brandCity = brand.city ?? employeeCity;
                return brandCity;
            }).filter(city => city && city.trim() !== "")));
            setCities(uniqueCities);

            if (!selectedCity && uniqueCities.length > 0) {
                setSelectedCity(uniqueCities[0]);
            }

            // Extract unique employees with their city information
            const employeeMap = new Map<number, EmployeeOption>();
            data.forEach(brand => {
                if (brand.employeeDto) {
                    const name = formatEmployeeName(brand.employeeDto.firstName, brand.employeeDto.lastName);
                    employeeMap.set(brand.employeeDto.id, {
                        id: brand.employeeDto.id,
                        name,
                        city: brand.employeeDto.city
                    });
                }
            });
            setAllEmployees(Array.from(employeeMap.values()));

            const gajkesariBrand = data.find(brand => brand.brandName.toLowerCase() === 'gajkesari');
            if (gajkesariBrand) {
                setGajkesariRate(gajkesariBrand.price);
                setShowGajkesariRate(gajkesariBrand.employeeDto?.firstName === 'Test' && gajkesariBrand.employeeDto?.lastName === '1');
            } else {
                setGajkesariRate(0);
                setShowGajkesariRate(false);
            }
        } catch (error) {
            console.error('Error fetching brand data:', error);
            setBrandData([]);
            setGajkesariRate(0);
            setShowGajkesariRate(false);
        }
    }, [selectedDate, token, selectedCity, isManager, isCoordinator, teamId]);

    const fetchPreviousDayData = useCallback(async () => {
        if (!token || !selectedDate) return;
        
        // For managers, coordinators and field officers, wait until teamId is available
        if ((isManager || isFieldOfficer || isCoordinator) && (teamId === null || teamId === undefined)) return;
        
        const dateObj = new Date(selectedDate);
        if (isNaN(dateObj.getTime())) {
            console.error('Invalid selectedDate:', selectedDate);
            return;
        }
        
        const previousDay = format(new Date(dateObj.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        try {
            let url: string;
            
            if (isManager && teamId !== null) {
                // For managers, use team-based API call
                url = `/api/proxy/brand/getByTeamAndDate?id=${teamId}&start=${previousDay}&end=${previousDay}`;
                console.log('Manager Previous Day API call:', url);
            } else if (isCoordinator && teamId !== null) {
                // For coordinators, use team-based API call
                url = `/api/proxy/brand/getByTeamAndDate?id=${teamId}&start=${previousDay}&end=${previousDay}`;
                console.log('Coordinator Previous Day API call:', url);
            } else if (isAdmin) {
                // For admins, use the original API call
                url = `/api/proxy/brand/getByDateRange?start=${previousDay}&end=${previousDay}`;
                console.log('Admin Previous Day API call:', url);
            } else if (isFieldOfficer) {
                // For field officers, use team-based API call (same as manager for now)
                url = `/api/proxy/brand/getByTeamAndDate?id=${teamId}&start=${previousDay}&end=${previousDay}`;
                console.log('Field Officer Previous Day API call:', url);
            } else {
                // Default to admin API call
                url = `/api/proxy/brand/getByDateRange?start=${previousDay}&end=${previousDay}`;
                console.log('Default (Admin) Previous Day API call:', url);
            }

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data: Brand[] = await response.json();
            setPreviousDayData(data);
        } catch (error) {
            console.error('Error fetching previous day data:', error);
            setPreviousDayData([]);
        }
    }, [selectedDate, token, isManager, isCoordinator, teamId]);

    // Smart filter: When city is selected, only show employees from that city
    const filteredEmployees = selectedCity === "all" 
        ? allEmployees 
        : allEmployees.filter(emp => emp.city === selectedCity);

    // Handler for city change
    const handleCityChange = (city: string) => {
        setSelectedCity(city);
        
        // If a specific city is selected and current employee is not from that city, reset to "all"
        if (city !== "all" && selectedFieldOfficer !== "all") {
            const selectedEmp = allEmployees.find(emp => emp.name === selectedFieldOfficer);
            if (selectedEmp && selectedEmp.city !== city) {
                setSelectedFieldOfficer("all");
            }
        }
    };

    // Handler for employee change
    const handleEmployeeChange = (employeeName: string) => {
        setSelectedFieldOfficer(employeeName);
        
        // Auto-set city based on selected employee
        if (employeeName !== "all") {
            const selectedEmp = allEmployees.find(emp => emp.name === employeeName);
            if (selectedEmp) {
                setSelectedCity(selectedEmp.city);
            }
        }
    };

    const filteredBrands = brandData.filter(brand => {
        const brandEmployeeCity = brand.employeeDto?.city;
        const effectiveCity = brand.brandName.toLowerCase() === 'gajkesari'
            ? (brand.city ?? brandEmployeeCity)
            : brandEmployeeCity;
        const cityMatch = selectedCity === "all" || effectiveCity === selectedCity;
        const officerName = brand.employeeDto ? formatEmployeeName(brand.employeeDto.firstName, brand.employeeDto.lastName) : null;
        const officerMatch = selectedFieldOfficer === "all" || (officerName ? officerName === selectedFieldOfficer : false);
        return cityMatch && officerMatch;
    });

    // Find our brand (Icon or Icon Steel) - case insensitive
    const ourBrand = filteredBrands.find(brand => 
        brand.brandName.toLowerCase().includes('icon')
    );
    
    // Define colors for each brand
    const brandColors = [
        '#3b82f6', // Blue
        '#10b981', // Green  
        '#f59e0b', // Orange
        '#ef4444', // Red
        '#8b5cf6', // Purple
        '#06b6d4', // Cyan
        '#84cc16', // Lime
        '#f97316', // Orange
    ];
    
    // Separate our brand from competitors
    const competitorBrands = filteredBrands.filter(brand => 
        !ourBrand || brand.brandName !== ourBrand.brandName
    );
    
    // Create chart data with different colors for each competitor brand
    const chartData = competitorBrands.map((brand, index) => {
        const color = brandColors[index % brandColors.length];
        
        return {
            brand: brand.brandName,
            competitorPrice: brand.price,
            ourPrice: 0, // No our price for competitor brands
            fill: color // Add color to each data point
        };
    });
    
    // Add our brand data if it exists
    if (ourBrand) {
        chartData.push({
            brand: ourBrand.brandName,
            competitorPrice: 0, // No competitor price for our brand
            ourPrice: ourBrand.price,
            fill: '#1f2937' // Dark gray for our brand
        });
    }


    return (
        <div className="space-y-6">
            {/* Filters Section */}
            <div className="mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">City</Label>
                            <Select value={selectedCity} onValueChange={handleCityChange}>
                                <SelectTrigger className="w-[160px] text-sm bg-background border-border">
                                    <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cities</SelectItem>
                                    {cities.map((city) => (
                                        <SelectItem key={city} value={city}>
                                            {city}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Date</Label>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-[160px] justify-start text-left font-normal text-sm bg-background border-border"
                                    >
                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                        {selectedDate ? format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy') : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined}
                                        onSelect={(date) => {
                                            if (date) {
                                                const year = date.getFullYear();
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                setSelectedDate(`${year}-${month}-${day}`);
                                                setIsDatePickerOpen(false); // Auto-close after selection
                                            } else {
                                                setSelectedDate('');
                                            }
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">
                                Field Officer
                                {selectedCity !== "all" && filteredEmployees.length < allEmployees.length && (
                                    <span className="ml-1 text-xs text-blue-600">({filteredEmployees.length} in {selectedCity})</span>
                                )}
                            </Label>
                            <Select value={selectedFieldOfficer} onValueChange={handleEmployeeChange}>
                                <SelectTrigger className="w-[160px] text-sm bg-background border-border">
                                    <SelectValue placeholder="Select field officer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Field Officers</SelectItem>
                                    {filteredEmployees.map((employee) => (
                                        <SelectItem key={employee.id} value={employee.name}>
                                            {employee.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    {/* Gajkesari Rate Display */}
                    {showGajkesariRate && gajkesariRate > 0 && (
                        <div className="text-right">
                            <h2 className="text-2xl">
                                Gajkesari Rate: <span className="font-bold">₹{gajkesariRate}/ton</span>
                            </h2>
                        </div>
                    )}
                </div>
                
                {/* Team Info for Managers/Field Officers */}
                {(isManager || isFieldOfficer) && (
                    <div className="mt-4 text-sm text-muted-foreground">
                        <p>
                            {teamLoading ? 'Loading team data...' : 
                             teamError ? `Error: ${teamError} (Using fallback Team ID: ${teamId})` :
                             teamId ? `Team-based view (Team ID: ${teamId})` : 
                             'No team data available'}
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Competitor Pricing</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Competitor</TableHead>
                                            <TableHead>Price (₹/ton)</TableHead>
                                            <TableHead>Field Officer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((brand) => (
                                                <TableRow key={brand.id}>
                                                    <TableCell className="font-medium">{brand.brandName}</TableCell>
                                                    <TableCell>₹{brand.price.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        {brand.employeeDto
                                                            ? formatEmployeeName(brand.employeeDto.firstName, brand.employeeDto.lastName)
                                                            : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-24 text-center">
                                                    No pricing data found matching the selected filters
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Price Comparison by Brand</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-80">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartData}
                                            margin={{
                                                top: 20,
                                                right: 30,
                                                left: 20,
                                                bottom: 60,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="brand" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <Tooltip 
                                                formatter={(value) => [`₹${value}`, "Price"]}
                                                labelFormatter={(value) => `Brand: ${value}`}
                                            />
                                            <Legend />
                                            {ourBrand && ourBrand.price > 0 && (
                                                <Bar dataKey="ourPrice" name={`Our Price (${ourBrand.brandName})`} fill="#1f2937" />
                                            )}
                                            <Bar dataKey="competitorPrice" name="Competitor Prices">
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 text-sm text-muted-foreground">
                                    <p>
                                        {ourBrand && ourBrand.price > 0 
                                            ? `Comparison of ${ourBrand.brandName} vs competitor prices`
                                            : 'Competitor pricing comparison by brand'
                                        }
                                    </p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PricingPage;
