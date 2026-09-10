'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-provider';
import { normalizeRoleValue } from '@/lib/role-utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3, CalendarIcon, Loader2, MapPin } from "lucide-react";
import { API, API_BASE_URL, type TeamDataDto } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";

interface Brand {
    id: number;
    brandName: string;
    price: number;
    metric?: string | null;
    city: string | null;
    state: string | null;
    employeeDto: {
        id: number;
        firstName: string;
        lastName: string;
        city?: string | null;
        role?: string | null;
    };
    createdAt?: string | null;
    updatedAt?: string | null;
}

const isCompanyBrand = (brandName: string) => {
    const normalized = brandName.toLowerCase().replace(/\s+/g, '');
    return normalized === 'icon' || normalized === 'iconsteel' || normalized === 'iconsteels' || normalized === 'gajkesari';
};

const getBrandCity = (brand: Brand) =>
    isCompanyBrand(brand.brandName) ? (brand.city || '—') : (brand.employeeDto?.city || brand.city || '—');

const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(price);

const formatCityLabel = (city?: string | null): string => {
    if (!city || !city.trim() || city === '—') return '—';
    return city
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const isManagerRoleValue = (role?: string | null): boolean => {
    if (!role) return false;
    const normalized = role.toUpperCase();
    return (
        normalized.includes('MANAGER') ||
        normalized.includes('AVP') ||
        normalized.includes('VP') ||
        normalized.includes('HEAD') ||
        normalized.includes('DIRECTOR')
    );
};

const getTeamIds = (teamData: TeamDataDto[]): number[] => {
    const ids: number[] = [];
    teamData.forEach((team) => {
        if (typeof team.id === 'number') ids.push(team.id);
        if (typeof (team as any).teamId === 'number') ids.push((team as any).teamId);
    });
    return Array.from(new Set(ids));
};

const PricingPage = () => {
    const [brandData, setBrandData] = useState<Brand[]>([]);
    const [selectedCity, setSelectedCity] = useState('all');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [cities, setCities] = useState<string[]>([]);
    const [companyRate, setCompanyRate] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [pricingError, setPricingError] = useState<string | null>(null);
    const pricingRequest = useRef(0);
    const [showCompanyRate, setShowCompanyRate] = useState(false);
    const [fieldOfficers, setFieldOfficers] = useState<string[]>([]);
    const [selectedFieldOfficer, setSelectedFieldOfficer] = useState("all");
    const [teamIds, setTeamIds] = useState<number[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);

    const { token, userData } = useAuth();
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [isRoleDetermined, setIsRoleDetermined] = useState(false);

    // Fetch current user data to determine role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            setIsRoleDetermined(false);
            
            try {
                const response = await fetch(`${API_BASE_URL}/user/manage/current-user`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    
                    const authorities = userData.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    const normalizedRole = normalizeRoleValue(role);
                    const managerFlag = isManagerRoleValue(role);
                    const fieldOfficerFlag = normalizedRole === 'ROLE_FIELD OFFICER' || normalizedRole === 'FIELD OFFICER';

                    setIsManager(managerFlag);
                    setIsFieldOfficer(fieldOfficerFlag);
                    setIsRoleDetermined(true);
                } else {
                    setIsRoleDetermined(true);
                }
            } catch (error) {
                console.error('Error verifying user role:', error);
                setIsRoleDetermined(true);
            }
        };

        fetchCurrentUser();
    }, [token]);

    // Fetch team data for managers and field officers
    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isManager && !isFieldOfficer) || !userData?.employeeId) return;
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
                if (teamData.length > 0) {
                    const accessibleTeamIds = getTeamIds(teamData);
                    setTeamIds(accessibleTeamIds);
                } else {
                    setTeamError('No team data found for this user');
                    setTeamIds([]);
                }
            } catch (err) {
                console.error('Failed to load team data:', err);
                setTeamError('Failed to load team data');
                setTeamIds([]);
            } finally {
                setTeamLoading(false);
            }
        };

        loadTeamData();
    }, [isManager, isFieldOfficer, userData?.employeeId]);

    const fetchBrandData = useCallback(async () => {
        const request = ++pricingRequest.current;
        if (!token || !isRoleDetermined || ((isManager || isFieldOfficer) && teamIds.length === 0)) {
            setBrandData([]);
            setCities([]);
            setFieldOfficers([]);
            setShowCompanyRate(false);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setPricingError(null);
        
        try {
            const formattedStartDate = format(new Date(selectedDate), 'yyyy-MM-dd');
            const formattedEndDate = format(new Date(selectedDate), 'yyyy-MM-dd');

            let data: Brand[];

            if (isManager || isFieldOfficer) {
                const responses = await Promise.all(teamIds.map(async (id) => {
                    const url = `${API_BASE_URL}/brand/getByTeamAndDate?id=${id}&start=${formattedStartDate}&end=${formattedEndDate}`;
                    const response = await fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    if (!response.ok) throw new Error('Could not load pricing. Please try again.');
                    const records = await response.json();
                    if (!Array.isArray(records)) throw new Error('Unexpected pricing response. Please try again.');
                    return records as Brand[];
                }));
                data = Array.from(new Map(responses.flat().map((brand) => [brand.id, brand])).values());
            } else {
                const url = `${API_BASE_URL}/brand/getByDateRange?start=${formattedStartDate}&end=${formattedEndDate}`;
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok) throw new Error('Could not load pricing. Please try again.');
                data = await response.json();
                if (!Array.isArray(data)) throw new Error('Unexpected pricing response. Please try again.');
            }

            if (request !== pricingRequest.current) return;
            setBrandData(data);

            const uniqueCities = Array.from(new Set(data.map(brand =>
                isCompanyBrand(brand.brandName) ? brand.city : brand.employeeDto?.city || brand.city
            ).filter((city): city is string => Boolean(city && city.trim() !== ""))));
            setCities(uniqueCities.sort((left, right) => formatCityLabel(left).localeCompare(formatCityLabel(right))));

            const uniqueFieldOfficers = Array.from(new Set(data.map(brand =>
                brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` : ''
            ).filter(officer => Boolean(officer && officer.trim() !== ""))));
            setFieldOfficers(uniqueFieldOfficers.sort((left, right) => left.localeCompare(right)));

            const companyBrand = data.find(brand => isCompanyBrand(brand.brandName));
            if (companyBrand) {
                setCompanyRate(companyBrand.price);
                setShowCompanyRate(true);
            } else {
                setCompanyRate(0);
                setShowCompanyRate(false);
            }
        } catch (error) {
            if (request !== pricingRequest.current) return;
            setPricingError(error instanceof Error ? error.message : 'Could not load pricing. Please try again.');
            setBrandData([]);
            setCompanyRate(0);
            setShowCompanyRate(false);
            setCities([]);
            setFieldOfficers([]);
        } finally {
            if (request === pricingRequest.current) setIsLoading(false);
        }
    }, [selectedDate, token, isRoleDetermined, isManager, isFieldOfficer, teamIds]);

    useEffect(() => {
        void fetchBrandData();
        return () => { pricingRequest.current += 1; };
    }, [fetchBrandData]);

    const fieldOfficerOptions = useMemo<SearchableOption[]>(() =>
        fieldOfficers.map((officer) => ({ value: officer, label: officer })),
    [fieldOfficers]);

    const filteredBrands = brandData.filter(brand => {
        const cityMatch = selectedCity === "all" || getBrandCity(brand) === selectedCity;
        const officerMatch = selectedFieldOfficer === "all" || (brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` === selectedFieldOfficer : false);
        return cityMatch && officerMatch;
    });

    const brandGroups = filteredBrands.reduce((acc, brand) => {
        const brandName = brand.brandName.toLowerCase();
        
        if (isCompanyBrand(brandName)) {
            if (!acc['Icon Steel']) {
                acc['Icon Steel'] = {
                    brand: 'Icon Steel',
                    ourPrice: companyRate > 0 ? companyRate : brand.price,
                    competitorPrice: 0,
                    count: 1
                };
            } else {
                acc['Icon Steel'].count += 1;
                if (companyRate === 0) {
                    acc['Icon Steel'].ourPrice = brand.price;
                }
            }
        } else {
            if (!acc[brand.brandName]) {
                acc[brand.brandName] = {
                    brand: brand.brandName,
                    ourPrice: 0,
                    competitorPrice: brand.price,
                    count: 1
                };
            } else {
                acc[brand.brandName].count += 1;
                acc[brand.brandName].competitorPrice = 
                    (acc[brand.brandName].competitorPrice * (acc[brand.brandName].count - 1) + brand.price) / acc[brand.brandName].count;
            }
        }
        
        return acc;
    }, {} as Record<string, { brand: string; ourPrice: number; competitorPrice: number; count: number }>);

    const chartData = Object.values(brandGroups)
        .map((item) => ({
            brand: item.brand,
            ourPrice: item.ourPrice,
            competitorPrice: item.competitorPrice
        }))
        .sort((a, b) => {
            if (isCompanyBrand(a.brand)) return -1;
            if (isCompanyBrand(b.brand)) return 1;
            return a.brand.localeCompare(b.brand);
        });

    return (
        <div className="space-y-4 py-4">
            <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end">
                <div className="min-w-0 space-y-1.5 lg:w-[180px]">
                    <Label className="text-xs font-medium">City</Label>
                    <Select value={selectedCity} onValueChange={setSelectedCity}>
                        <SelectTrigger className="h-9 w-full text-sm shadow-none">
                            <SelectValue placeholder="All cities" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                            <SelectItem value="all">All cities</SelectItem>
                            {cities.map((city) => (
                                <SelectItem key={city} value={city}>
                                    {formatCityLabel(city)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="min-w-0 space-y-1.5 lg:w-[190px]">
                    <Label className="text-xs font-medium">Date</Label>
                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={`h-9 w-full justify-start text-left text-sm font-normal shadow-none ${!selectedDate && 'text-muted-foreground'}`}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(new Date(selectedDate), 'MMM dd, yyyy') : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <SpacedCalendar
                                initialFocus
                                mode="single"
                                defaultMonth={new Date(selectedDate)}
                                selected={new Date(selectedDate)}
                                onSelect={(date: Date | undefined) => {
                                    if (date) {
                                        setSelectedDate(format(date, 'yyyy-MM-dd'));
                                        setIsDatePickerOpen(false);
                                    }
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                
                <div className="min-w-0 space-y-1.5 lg:w-[240px]">
                    <Label className="text-xs font-medium">Field officer</Label>
                    <SearchableSelect
                        options={fieldOfficerOptions}
                        value={selectedFieldOfficer === 'all' ? undefined : selectedFieldOfficer}
                        onSelect={(option) => setSelectedFieldOfficer(option?.value ?? 'all')}
                        placeholder="All field officers"
                        searchPlaceholder="Search field officers..."
                        emptyMessage="No field officers found"
                        allowClear
                        triggerClassName="h-9 w-full text-sm shadow-none"
                        contentClassName="w-[var(--radix-popover-trigger-width)]"
                    />
                </div>

                {showCompanyRate && companyRate > 0 && (
                    <div className="ml-auto rounded-md border bg-muted/30 px-3 py-2 text-right">
                        <p className="text-[11px] text-muted-foreground">Icon Steel rate</p>
                        <p className="text-sm font-semibold tabular-nums">{formatPrice(companyRate)}<span className="font-normal text-muted-foreground">/ton</span></p>
                    </div>
                )}
            </div>

            {pricingError && <p role="alert" className="text-sm text-destructive">{pricingError}</p>}

            {(isManager || isFieldOfficer) && (teamLoading || teamError) && (
                <p className={`text-xs ${teamError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {teamLoading ? 'Loading team pricing access…' : teamError}
                </p>
            )}

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,36rem),1fr))] items-start gap-4">
                <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none">
                    <CardHeader className="border-b px-4 py-3">
                        <CardTitle className="text-sm font-semibold">Recorded prices</CardTitle>
                        <p className="text-xs text-muted-foreground">Recorded prices for the selected day and market.</p>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex h-64 items-center justify-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="text-sm">Loading pricing…</span>
                            </div>
                        ) : (
                            <div className="max-h-[420px] overflow-auto">
                                <Table className="table-fixed text-xs">
                                    <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                                        <TableRow>
                                            <TableHead className="h-10 w-[30%] whitespace-normal text-xs">Brand</TableHead>
                                            <TableHead className="h-10 w-[21%] whitespace-normal text-right text-xs">Price/ton</TableHead>
                                            <TableHead className="h-10 w-[21%] whitespace-normal text-xs">City</TableHead>
                                            <TableHead className="h-10 w-[28%] whitespace-normal text-xs">Field officer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((brand) => (
                                                <TableRow key={brand.id}>
                                                    <TableCell className="whitespace-normal py-3 align-top font-medium leading-5 [overflow-wrap:anywhere]">{brand.brandName}</TableCell>
                                                    <TableCell className="whitespace-normal py-3 text-right align-top font-medium leading-5 tabular-nums [overflow-wrap:anywhere]">{formatPrice(brand.price)}</TableCell>
                                                    <TableCell className="whitespace-normal py-3 align-top leading-5 [overflow-wrap:anywhere]">
                                                        <span className="inline-flex items-start gap-1">
                                                            <MapPin className="mt-1 hidden h-3 w-3 shrink-0 text-muted-foreground sm:block" />
                                                            {formatCityLabel(getBrandCity(brand))}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal py-3 align-top leading-5 [overflow-wrap:anywhere]">
                                                        {isCompanyBrand(brand.brandName)
                                                            ? '—'
                                                            : brand.employeeDto
                                                                ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}`
                                                                : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-48 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <BarChart3 className="h-7 w-7 stroke-[1.5]" />
                                                        <span className="text-sm font-medium text-foreground">No pricing data found</span>
                                                        <span className="text-xs">Try a different date, city, or field officer.</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none">
                    <CardHeader className="border-b px-4 py-3">
                        <CardTitle className="text-sm font-semibold">Price comparison by brand</CardTitle>
                        <p className="text-xs text-muted-foreground">Icon Steel and competitor rates per ton.</p>
                    </CardHeader>
                    <CardContent className="p-4">
                        {isLoading ? (
                            <div className="flex h-72 items-center justify-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="text-sm">Building comparison…</span>
                            </div>
                        ) : chartData.length === 0 ? (
                            <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
                                <BarChart3 className="h-7 w-7 stroke-[1.5]" />
                                <span className="text-sm font-medium text-foreground">Nothing to compare yet</span>
                                <span className="text-xs">Pricing entries will appear here.</span>
                            </div>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto overflow-x-hidden">
                                <div style={{ height: Math.max(220, chartData.length * 56 + 64) }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={chartData}
                                            margin={{
                                                top: 8,
                                                right: 20,
                                                left: 8,
                                                bottom: 8,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => `₹${value}`} />
                                            <YAxis type="category" dataKey="brand" width={105} interval={0} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                                            <Tooltip 
                                                formatter={(value) => [formatPrice(Number(value)), "Price"]}
                                                labelFormatter={(value) => `Brand: ${value}`}
                                                contentStyle={{ borderRadius: 8, borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', fontSize: 12 }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="ourPrice" name="Our price" stackId="price" maxBarSize={24} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="competitorPrice" name="Competitor price" stackId="price" maxBarSize={24} fill="#16a085" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PricingPage;
