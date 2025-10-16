"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XIcon, SlidersHorizontal } from "lucide-react";
import { API, type EmployeeUserDto } from "@/lib/api";

// Mock data for filters (passed as props)
const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Miami"];
const states = ["NY", "CA", "IL", "TX", "FL"];
const clientTypes = ["Retailer", "Wholesaler", "Distributor"];

interface CustomerFiltersProps {
  filters: Record<string, unknown>;
  setFilters: (filters: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void;
  resetFilters: () => void;
}

export default function CustomerFilters({
  filters,
  setFilters,
  resetFilters,
}: CustomerFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fieldOfficers, setFieldOfficers] = useState<EmployeeUserDto[]>([]);

  useEffect(() => {
    const fetchFieldOfficers = async () => {
      try {
        // Fetch all employees and filter for field officers only
        const allEmployees = await API.getAllEmployees();
        
        // Filter for field officers only (handle case variations)
        const fieldOfficerList = allEmployees.filter(employee => 
          employee.role?.toLowerCase() === 'field officer'
        );
        
        setFieldOfficers(fieldOfficerList);
        console.log('Field Officers loaded for filters:', fieldOfficerList);
      } catch (error) {
        console.error('Error fetching field officers for filters:', error);
        setFieldOfficers([]);
      }
    };

    fetchFieldOfficers();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev: Record<string, unknown>) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFilters((prev: Record<string, unknown>) => ({ ...prev, [name]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="shopName">Shop Name</Label>
              <Input
                id="shopName"
                name="shopName"
                placeholder="Search by shop name..."
                value={String(filters.shopName || '')}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="ownerName">Owner Name</Label>
              <Input
                id="ownerName"
                name="ownerName"
                placeholder="Search by owner name..."
                value={String(filters.ownerName || '')}
                onChange={handleInputChange}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => setIsExpanded(!isExpanded)}
                variant="outline"
                className="w-full md:w-auto"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {isExpanded ? "Hide" : "More"} Filters
              </Button>
              <Button
                onClick={resetFilters}
                variant="secondary"
                className="w-full md:w-auto"
              >
                <XIcon className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>City</Label>
                <Select
                  value={String(filters.selectedCity || '')}
                  onValueChange={(value) => handleSelectChange("selectedCity", value)}
                >
                  <SelectTrigger>
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
                <Label>State</Label>
                <Select
                  value={String(filters.selectedState || '')}
                  onValueChange={(value) => handleSelectChange("selectedState", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Intent Level filter removed */}
              <div className="space-y-2">
                <Label>Client Type</Label>
                <Select
                  value={String(filters.selectedClientType || '')}
                  onValueChange={(value) =>
                    handleSelectChange("selectedClientType", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {clientTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Field Officer</Label>
                <Select
                  value={String(filters.selectedFieldOfficer || '')}
                  onValueChange={(value) =>
                    handleSelectChange("selectedFieldOfficer", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select officer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Officers</SelectItem>
                    {fieldOfficers.map((officer) => (
                      <SelectItem key={officer.id} value={`${officer.firstName} ${officer.lastName}`}>
                        {officer.firstName} {officer.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
