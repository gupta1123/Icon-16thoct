'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, Bar, BarChart, ComposedChart } from "recharts";
import { Loader, CalendarIcon } from "lucide-react";
import { API, type TeamDataDto } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import SearchableSelect, { type SearchableOption } from "@/components/searchable-select";

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
    const today = new Date();
    const defaultStart = format(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const defaultEnd = format(today, 'yyyy-MM-dd');

    const [selectedStartDate, setSelectedStartDate] = useState(defaultStart);
    const [selectedEndDate, setSelectedEndDate] = useState(defaultEnd);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [availableBrands, setAvailableBrands] = useState<string[]>([]);
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [gajkesariRate, setGajkesariRate] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showGajkesariRate, setShowGajkesariRate] = useState(false);
    const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
    const [selectedFieldOfficer, setSelectedFieldOfficer] = useState<string>('all');
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamData, setTeamData] = useState<TeamDataDto[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [isStartDatePickerOpen, setIsStartDatePickerOpen] = useState(false);
    const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
    const [dateError, setDateError] = useState<string | null>(null);
    const [cityMenuOpen, setCityMenuOpen] = useState(false);
    const [brandMenuOpen, setBrandMenuOpen] = useState(false);
    const [cityQuery, setCityQuery] = useState("");
    const [brandQuery, setBrandQuery] = useState("");

    const { token, userRole, currentUser, userData } = useAuth();
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [isCoordinator, setIsCoordinator] = useState(false);
    const [userRoleFromAPI, setUserRoleFromAPI] = useState<string | null>(null);
    const [roleResolved, setRoleResolved] = useState(false);

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

                    // Consider all authorities, not only the first
                    const authorities = userData.authorities || [];
                    const roles: string[] = authorities.map((a: { authority: string }) => a.authority);
                    const hasRole = (r: string) => roles.includes(r);
                    const primaryRole = roles[0] ?? null;
                    setUserRoleFromAPI(primaryRole);

                    // Set role flags (treat AVP/Regional/Office Manager as managers)
                    setIsManager(
                        hasRole('ROLE_MANAGER') ||
                        hasRole('ROLE_OFFICE MANAGER') ||
                        hasRole('ROLE_AVP') ||
                        hasRole('ROLE_REGIONAL_MANAGER')
                    );
                    setIsAdmin(hasRole('ROLE_ADMIN'));
                    setIsFieldOfficer(hasRole('ROLE_FIELD OFFICER'));
                    setIsCoordinator(hasRole('ROLE_COORDINATOR'));

                    console.log('Roles:', roles);
                    console.log('isManager:', hasRole('ROLE_MANAGER') || hasRole('ROLE_OFFICE MANAGER') || hasRole('ROLE_AVP') || hasRole('ROLE_REGIONAL_MANAGER'));
                    console.log('isAdmin:', hasRole('ROLE_ADMIN'));
                    console.log('isFieldOfficer:', hasRole('ROLE_FIELD OFFICER'));
                    console.log('isCoordinator:', hasRole('ROLE_COORDINATOR'));
                } else {
                    console.error('Failed to fetch current user data');
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            } finally {
                setRoleResolved(true);
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

    const fetchBrandData = useCallback(async (startDate: Date, endDate: Date) => {
        if (!token) return;

        if ((isManager || isFieldOfficer || isCoordinator) && (teamId === null || teamId === undefined)) {
            return;
        }

        try {
            const formattedStartDate = format(startDate, 'yyyy-MM-dd');
            const formattedEndDate = format(endDate, 'yyyy-MM-dd');

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

            const uniqueCities = Array.from(new Set(
                data
                    .map(brand => brand.city || brand.employeeDto?.city)
                    .filter((city): city is string => Boolean(city && city.trim() !== ''))
            )).sort((a, b) => a.localeCompare(b));
            setAvailableCities(uniqueCities);
            setSelectedCities((prev) => {
                if (prev.length === 0) {
                    return uniqueCities;
                }
                const nextSet = new Set(uniqueCities);
                const filteredPrev = prev.filter((city) => nextSet.has(city));
                const missing = uniqueCities.filter((city) => !filteredPrev.includes(city));
                return [...filteredPrev, ...missing];
            });

            const uniqueBrands = Array.from(new Set(
                data
                    .map(brand => brand.brandName)
                    .filter((brandName): brandName is string => Boolean(brandName && brandName.trim() !== ''))
            )).sort((a, b) => a.localeCompare(b));
            setAvailableBrands(uniqueBrands);
            setSelectedBrands((prev) => {
                if (prev.length === 0) {
                    return uniqueBrands;
                }
                const nextSet = new Set(uniqueBrands);
                const filteredPrev = prev.filter((brand) => nextSet.has(brand));
                const missing = uniqueBrands.filter((brand) => !filteredPrev.includes(brand));
                return [...filteredPrev, ...missing];
            });

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
            setSelectedFieldOfficer((prev) => {
                if (prev === 'all') {
                    return prev;
                }
                const prevId = Number(prev);
                if (Number.isNaN(prevId) || !employeeMap.has(prevId)) {
                    return 'all';
                }
                return prev;
            });

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
    }, [token, isManager, isCoordinator, isFieldOfficer, teamId]);

    useEffect(() => {
        if (!token || !selectedStartDate || !selectedEndDate) {
            return;
        }

        const start = new Date(selectedStartDate);
        const end = new Date(selectedEndDate);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            setDateError('Please pick a valid start and end date.');
            return;
        }

        if (start > end) {
            setDateError('Start date cannot be after end date.');
            return;
        }

        setDateError(null);

        const fetchData = async () => {
            setIsLoading(true);
            await fetchBrandData(start, end);
            setIsLoading(false);
        };

        fetchData();
    }, [fetchBrandData, selectedStartDate, selectedEndDate, token]);

    // Smart filter: When city is selected, only show employees from that city
    const filteredEmployees = useMemo(() => {
        if (selectedCities.length === 0) {
            return allEmployees;
        }
        const citySet = new Set(selectedCities);
        return allEmployees.filter((emp) => emp.city && citySet.has(emp.city));
    }, [allEmployees, selectedCities]);

    const filteredCitiesList = useMemo(() => {
        if (!cityQuery) {
            return availableCities;
        }
        const search = cityQuery.toLowerCase();
        return availableCities.filter((city) => city.toLowerCase().includes(search));
    }, [availableCities, cityQuery]);

    const filteredBrandsList = useMemo(() => {
        if (!brandQuery) {
            return availableBrands;
        }
        const search = brandQuery.toLowerCase();
        return availableBrands.filter((brand) => brand.toLowerCase().includes(search));
    }, [availableBrands, brandQuery]);

    useEffect(() => {
        if (selectedFieldOfficer === 'all') {
            return;
        }
        const exists = filteredEmployees.some((emp) => String(emp.id) === selectedFieldOfficer);
        if (!exists) {
            setSelectedFieldOfficer('all');
        }
    }, [filteredEmployees, selectedFieldOfficer]);

    const employeeOptions = useMemo<SearchableOption<EmployeeOption | null>[]>(() => {
        const base = filteredEmployees.map((employee) => ({
            value: String(employee.id),
            label: employee.name,
            data: employee,
        }));
        return [
            { value: 'all', label: 'All Field Officers' },
            ...base,
        ];
    }, [filteredEmployees]);

    const toggleCitySelection = (city: string) => {
        setSelectedCities((prev) =>
            prev.includes(city)
                ? prev.filter((value) => value !== city)
                : [...prev, city]
        );
    };

    const toggleBrandSelection = (brand: string) => {
        setSelectedBrands((prev) =>
            prev.includes(brand)
                ? prev.filter((value) => value !== brand)
                : [...prev, brand]
        );
    };

    useEffect(() => {
        if (!cityMenuOpen) {
            setCityQuery("");
        }
    }, [cityMenuOpen]);

    useEffect(() => {
        if (!brandMenuOpen) {
            setBrandQuery("");
        }
    }, [brandMenuOpen]);

    const filteredBrands = useMemo(() => {
        if (brandData.length === 0) {
            return [];
        }
        const citySet = new Set(selectedCities);
        return brandData.filter((brand) => {
            const brandEmployeeCity = brand.employeeDto?.city;
            const effectiveCity = brand.brandName.toLowerCase() === 'gajkesari'
                ? (brand.city ?? brandEmployeeCity)
                : brandEmployeeCity;
            const cityMatch = selectedCities.length === 0 || (effectiveCity && citySet.has(effectiveCity));
            const officerMatch = selectedFieldOfficer === 'all'
                || (brand.employeeDto?.id != null && String(brand.employeeDto.id) === selectedFieldOfficer);
            const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(brand.brandName);
            return cityMatch && officerMatch && brandMatch;
        });
    }, [brandData, selectedCities, selectedFieldOfficer, selectedBrands]);

    const scopedBrandNames = useMemo(() => {
        return Array.from(
            new Set(
                filteredBrands
                    .map((brand) => brand.brandName)
                    .filter((name): name is string => Boolean(name && name.trim() !== ''))
            )
        ).sort((a, b) => a.localeCompare(b));
    }, [filteredBrands]);

    const brandStyleMap = useMemo(() => {
        // Distinct colors for each brand (like the temperature chart example)
        const colorPalette = [
            '#8884d8', // Blue
            '#82ca9d', // Green
            '#ffc658', // Orange/Yellow
            '#ff7300', // Orange
            '#0088fe', // Bright Blue
            '#00c49f', // Teal
            '#ffbb28', // Yellow
            '#ff8042', // Red-Orange
            '#a4de6c', // Light Green
            '#d0ed57', // Lime
            '#ffc658', // Orange
            '#8884d8', // Repeating colors
            '#82ca9d',
            '#ff7300',
        ];

        return scopedBrandNames.reduce<Record<string, {
            stroke: string;
            fill: string;
            strokeWidth: number;
            strokeDasharray?: string;
            dot: { r: number; fill: string } | boolean;
            activeDot: { r: number; fill: string; strokeWidth: number; stroke?: string };
        }>>((acc, brandName, index) => {
            const stroke = colorPalette[index % colorPalette.length];
            const fill = 'rgba(0, 0, 0, 0)'; // No fill for lines
            
            acc[brandName] = {
                stroke,
                fill,
                strokeWidth: 2.5,
                strokeDasharray: undefined, // Solid lines
                dot: false, // No dots, just smooth continuous line
                activeDot: { r: 6, fill: stroke, strokeWidth: 2, stroke: '#fff' },
            };
            return acc;
        }, {});
    }, [scopedBrandNames]);

    const lineChartData = useMemo(() => {
        if (!selectedStartDate || !selectedEndDate || filteredBrands.length === 0) {
            return [];
        }

        const start = new Date(selectedStartDate + 'T00:00:00');
        const end = new Date(selectedEndDate + 'T00:00:00');

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return [];
        }

        const dateKeys: string[] = [];
        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
            dateKeys.push(format(cursor, 'yyyy-MM-dd'));
        }

        const perBrandPerDay = new Map<string, Map<string, { value: number; timestamp: number }>>();
        const startTime = start.getTime();
        const endTime = end.getTime();

        filteredBrands.forEach((brand) => {
            const rawTimestamp = brand.updatedAt ?? brand.createdAt;
            if (!rawTimestamp) {
                return;
            }
            const timestamp = new Date(rawTimestamp);
            const timeValue = timestamp.getTime();
            if (Number.isNaN(timeValue) || timeValue < startTime || timeValue > endTime) {
                return;
            }
            const dateKey = format(timestamp, 'yyyy-MM-dd');
            const brandName = brand.brandName;
            if (!brandName) {
                return;
            }

            if (!perBrandPerDay.has(brandName)) {
                perBrandPerDay.set(brandName, new Map());
            }
            const dailyMap = perBrandPerDay.get(brandName)!;
            const existing = dailyMap.get(dateKey);
            if (!existing || timeValue >= existing.timestamp) {
                dailyMap.set(dateKey, { value: brand.price, timestamp: timeValue });
            }
        });

        return dateKeys.map((dateKey) => {
            const row: Record<string, string | number | null> = { date: dateKey };
            scopedBrandNames.forEach((brandName) => {
                const dailyValue = perBrandPerDay.get(brandName)?.get(dateKey);
                row[brandName] = dailyValue ? Number(dailyValue.value.toFixed(2)) : null;
            });
            return row;
        });
    }, [filteredBrands, selectedEndDate, selectedStartDate, scopedBrandNames]);

    const renderTooltip = useCallback(({ active, payload, label }: {
        active?: boolean;
        payload?: Array<{ color?: string; dataKey?: string | number; value?: number | string; name?: string | number }>;
        label?: string | number;
    }) => {
        if (!active || !payload || payload.length === 0 || label == null) {
            return null;
        }

        const labelString = typeof label === 'number' ? String(label) : label;
        const displayDate = format(new Date(labelString + 'T00:00:00'), 'EEE, MMM d yyyy');

        return (
            <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
                <p className="font-medium text-foreground">{displayDate}</p>
                <div className="mt-2 space-y-1">
                    {payload.map((item) => (
                        <div key={String(item.dataKey)} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 text-foreground">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color ?? '#1f2937' }} />
                                <span>{item.name ?? item.dataKey}</span>
                            </div>
                            <span className="font-semibold text-foreground">₹{Number(item.value ?? 0).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }, []);

    const handleExport = useCallback(() => {
        if (filteredBrands.length === 0) {
            return;
        }

        const header = ['Date', 'Brand', 'Price', 'City', 'State', 'Employee', 'Metric'];
        const rows = filteredBrands.map((brand) => {
            const timestamp = brand.createdAt || brand.updatedAt || new Date().toISOString();
            const dateLabel = format(new Date(timestamp), 'yyyy-MM-dd');
            const employeeName = brand.employeeDto ? formatEmployeeName(brand.employeeDto.firstName, brand.employeeDto.lastName) : '—';
            return [
                dateLabel,
                brand.brandName,
                brand.price,
                brand.city ?? brand.employeeDto?.city ?? '—',
                brand.state ?? '—',
                employeeName,
                brand.metric ?? '—',
            ];
        });

        const csv = [header, ...rows]
            .map((values) =>
                values
                    .map((value) => {
                        const stringValue = String(value ?? '');
                        return stringValue.includes(',')
                            ? `"${stringValue.replace(/"/g, '""')}"`
                            : stringValue;
                    })
                    .join(',')
            )
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pricing_${selectedStartDate}_${selectedEndDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [filteredBrands, selectedEndDate, selectedStartDate]);


    if (!roleResolved) {
        return (
            <div className="flex h-80 items-center justify-center">
                <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    // Allow Admin and Manager (includes AVP) to access pricing
    if (!(isAdmin || isManager)) {
        return (
            <div className="flex h-80 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <p>Pricing analytics are restricted to administrators.</p>
                <p>Please contact an admin if you believe this is a mistake.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters Section */}
            <div className="mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Cities</Label>
                            <DropdownMenu open={cityMenuOpen} onOpenChange={setCityMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-w-[220px] justify-between text-sm bg-background border-border"
                                    >
                                        <span>
                                            {selectedCities.length === 0
                                                ? 'All cities'
                                                : `${selectedCities.length} selected`}
                                        </span>
                                        <span className="text-xs text-muted-foreground">Filter</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-60">
                                    <div className="p-2 pb-1">
                                        <Input
                                            value={cityQuery}
                                            onChange={(event) => setCityQuery(event.target.value)}
                                            placeholder="Search cities..."
                                            className="h-8"
                                        />
                                    </div>
                                    <DropdownMenuSeparator />
                                    {filteredCitiesList.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">No cities found</div>
                                    ) : (
                                        filteredCitiesList.map((city) => (
                                            <DropdownMenuCheckboxItem
                                                key={city}
                                                checked={selectedCities.includes(city)}
                                                onCheckedChange={() => toggleCitySelection(city)}
                                            >
                                                {city}
                                            </DropdownMenuCheckboxItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Brands</Label>
                            <DropdownMenu open={brandMenuOpen} onOpenChange={setBrandMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-w-[220px] justify-between text-sm bg-background border-border"
                                    >
                                        <span>
                                            {selectedBrands.length === 0
                                                ? 'All brands'
                                                : `${selectedBrands.length} selected`}
                                        </span>
                                        <span className="text-xs text-muted-foreground">Filter</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-64">
                                    <div className="p-2 pb-1">
                                        <Input
                                            value={brandQuery}
                                            onChange={(event) => setBrandQuery(event.target.value)}
                                            placeholder="Search brands..."
                                            className="h-8"
                                        />
                                    </div>
                                    <DropdownMenuSeparator />
                                    {filteredBrandsList.length === 0 ? (
                                        <div className="px-3 py-2 text-sm text-muted-foreground">No brands found</div>
                                    ) : (
                                        filteredBrandsList.map((brand) => (
                                            <DropdownMenuCheckboxItem
                                                key={brand}
                                                checked={selectedBrands.includes(brand)}
                                                onCheckedChange={() => toggleBrandSelection(brand)}
                                            >
                                                {brand}
                                            </DropdownMenuCheckboxItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Start Date</Label>
                            <Popover open={isStartDatePickerOpen} onOpenChange={setIsStartDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-[160px] justify-start text-left font-normal text-sm bg-background border-border"
                                    >
                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                        {selectedStartDate ? format(new Date(selectedStartDate + 'T00:00:00'), 'MMM d, yyyy') : 'Start date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedStartDate ? new Date(selectedStartDate + 'T00:00:00') : undefined}
                                        onSelect={(date) => {
                                            if (date) {
                                                setSelectedStartDate(format(date, 'yyyy-MM-dd'));
                                                setIsStartDatePickerOpen(false);
                                            }
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">End Date</Label>
                            <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-[160px] justify-start text-left font-normal text-sm bg-background border-border"
                                    >
                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                        {selectedEndDate ? format(new Date(selectedEndDate + 'T00:00:00'), 'MMM d, yyyy') : 'End date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={selectedEndDate ? new Date(selectedEndDate + 'T00:00:00') : undefined}
                                        onSelect={(date) => {
                                            if (date) {
                                                setSelectedEndDate(format(date, 'yyyy-MM-dd'));
                                                setIsEndDatePickerOpen(false);
                                            }
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Field Officer</Label>
                            <SearchableSelect<EmployeeOption | null>
                                options={employeeOptions}
                                value={selectedFieldOfficer}
                                onSelect={(option) => setSelectedFieldOfficer(option?.value ?? 'all')}
                                placeholder="All field officers"
                                triggerClassName="w-[240px] text-sm bg-background border-border"
                                searchPlaceholder="Search field officers..."
                            />
                        </div>
                    </div>
                    
                    {/* Gajkesari Rate Display */}
                    <div className="flex flex-col items-end gap-2">
                        {showGajkesariRate && gajkesariRate > 0 && (
                            <div className="text-right">
                                <h2 className="text-2xl">
                                    Gajkesari Rate: <span className="font-bold">₹{gajkesariRate}/ton</span>
                                </h2>
                            </div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            disabled={isLoading || filteredBrands.length === 0}
                        >
                            Export CSV
                        </Button>
                    </div>
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
                {dateError && (
                    <p className="mt-3 text-sm text-destructive">{dateError}</p>
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
                                            <TableHead>Date</TableHead>
                                            <TableHead>Competitor</TableHead>
                                            <TableHead>Price (₹/ton)</TableHead>
                                            <TableHead>City</TableHead>
                                            <TableHead>Field Officer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((brand) => (
                                                <TableRow key={brand.id}>
                                                    <TableCell>{format(new Date((brand.createdAt || brand.updatedAt || new Date().toISOString())), 'MMM d, yyyy')}</TableCell>
                                                    <TableCell className="font-medium">{brand.brandName}</TableCell>
                                                    <TableCell>₹{brand.price.toFixed(2)}</TableCell>
                                                    <TableCell>{brand.city ?? brand.employeeDto?.city ?? '—'}</TableCell>
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
                        ) : lineChartData.length === 0 ? (
                            <div className="flex h-80 flex-col items-center justify-center text-sm text-muted-foreground">
                                <p>No pricing data found for the selected filters.</p>
                                <p>Try expanding the date range or clearing the filters.</p>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-xl border bg-muted/40 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={lineChartData} margin={{ top: 12, right: 18, left: 10, bottom: 12 }}>
                                                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(value) => format(new Date(value + 'T00:00:00'), 'MMM d')}
                                                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tickFormatter={(value) => `₹${value}`}
                                                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={70}
                                                />
                                                <Tooltip content={renderTooltip} />
                                                <Legend
                                                    iconType="plainline"
                                                    wrapperStyle={{ paddingTop: 8, fontSize: 12, color: 'hsl(var(--foreground))' }}
                                                />
                                                {scopedBrandNames.map((brandName) => {
                                                    const style = brandStyleMap[brandName] ?? {
                                                        stroke: 'hsl(var(--primary))',
                                                        fill: 'rgba(0, 0, 0, 0)',
                                                        strokeWidth: 2.5,
                                                        strokeDasharray: undefined,
                                                        dot: false,
                                                        activeDot: { r: 6, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' },
                                                    };
                                                    
                                                    return (
                                                        <Line
                                                            key={brandName}
                                                            type="monotone"
                                                            dataKey={brandName}
                                                            name={brandName}
                                                            stroke={style.stroke}
                                                            strokeWidth={style.strokeWidth}
                                                            dot={style.dot}
                                                            activeDot={style.activeDot}
                                                            connectNulls
                                                        />
                                                    );
                                                })}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="mt-4 text-sm text-muted-foreground">
                                    <p>
                                        Multi-brand pricing trends across the selected date range. Hover to compare daily rates.
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
