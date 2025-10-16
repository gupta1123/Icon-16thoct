"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  User, 
  Building, 
  Clock, 
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  CalendarIcon,
  CheckCircle,
  CreditCard,
  Tag,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heading, Text } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  role?: string; // Add role field
  department: string;
  hireDate: string;
  status: string;
  avatar: string;
  employeeId: string;
  manager: string;
  location: string;
}

interface Visit {
  id: number;
  date: string;
  customer: string;
  purpose: string;
  outcome: string;
  duration: string;
}

interface Attendance {
  id: number;
  date: string;
  status: "present" | "absent" | "leave" | "holiday";
  checkIn: string;
  checkOut: string;
  hours: string;
}

interface Expense {
  id: number;
  date: string;
  category: string;
  amount: number;
  description: string;
  status: "pending" | "approved" | "rejected";
}

interface Pricing {
  id: number;
  date: string;
  brand: string;
  product: string;
  price: number;
  competitorPrice: number;
  location: string;
}

// Data will be fetched from API
const visits: Visit[] = [];
const attendance: Attendance[] = [];
const expenses: Expense[] = [];
const pricing: Pricing[] = [];

const brands: string[] = [];
const products: string[] = [];
const locations: string[] = [];

// Helper function to transform role for display
const transformRole = (role: string) => {
  if (!role) return '';
  
  const roleLower = role.toLowerCase().trim();
  
  // Map various role formats to display values
  const roleMap: { [key: string]: string } = {
    'hr': 'HR',
    'regional manager': 'Regional Manager',
    'office manager': 'Office Manager',
    'manager': 'Regional Manager',
    'coordinator': 'Coordinator',
    'data manager': 'Data Manager',
    'data_manager': 'Data Manager',
    'field officer': 'Field Officer',
    'field_officer': 'Field Officer'
  };
  
  return roleMap[roleLower] || role;
};

// Helper function to get role badge color
const getRoleBadgeColor = (role: string) => {
  const roleLower = role.toLowerCase().trim();
  
  // Map roles to unique colors
  const roleColorMap: { [key: string]: string } = {
    'hr': 'bg-pink-100 text-pink-800 border-pink-200',
    'regional manager': 'bg-purple-100 text-purple-800 border-purple-200',
    'office manager': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'manager': 'bg-purple-100 text-purple-800 border-purple-200',
    'coordinator': 'bg-orange-100 text-orange-800 border-orange-200',
    'data manager': 'bg-blue-100 text-blue-800 border-blue-200',
    'data_manager': 'bg-blue-100 text-blue-800 border-blue-200',
    'field officer': 'bg-green-100 text-green-800 border-green-200',
    'field_officer': 'bg-green-100 text-green-800 border-green-200'
  };
  
  return roleColorMap[roleLower] || 'bg-gray-100 text-gray-800 border-gray-200';
};

export default function EmployeeDetailPage({ employee }: { employee: Employee }) {
  const [activeTab, setActiveTab] = useState("visits");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [price, setPrice] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [location, setLocation] = useState("");
  const [pricingDate, setPricingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // State for data loading
  const [isLoading, setIsLoading] = useState(false);
  const [visitsData, setVisitsData] = useState<Visit[]>(visits);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>(attendance);
  const [expensesData, setExpensesData] = useState<Expense[]>(expenses);
  const [pricingData, setPricingData] = useState<Pricing[]>(pricing);
  const [brandsData, setBrandsData] = useState<string[]>(brands);
  const [productsData, setProductsData] = useState<string[]>(products);
  const [locationsData, setLocationsData] = useState<string[]>(locations);


  const handleAddPricing = () => {
    // In a real app, this would submit the form data
    alert(`Pricing added for ${brand} - ${product} on ${pricingDate}`);
    // Reset form
    setBrand("");
    setProduct("");
    setPrice("");
    setCompetitorPrice("");
    setLocation("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Employee Info and Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base font-medium text-foreground">
                    Employee Details
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Information and actions
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg border border-dashed bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base font-medium text-foreground truncate">
                        {employee.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs px-2 py-0.5 border ${getRoleBadgeColor(employee.role || employee.position)}`}>
                          {transformRole(employee.role || employee.position)}
                        </Badge>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        employee.status === "Active"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-red-100 text-red-800 hover:bg-red-100"
                      )}
                    >
                      {employee.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Joined {format(new Date(employee.hireDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{employee.employeeId}</p>
                    <p className="text-xs text-muted-foreground">Employee ID</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{employee.email}</p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{employee.phone}</p>
                    <p className="text-xs text-muted-foreground">Phone</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{employee.location}</p>
                    <p className="text-xs text-muted-foreground">Location</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(employee.hireDate), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">Hire Date</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{employee.manager}</p>
                    <p className="text-xs text-muted-foreground">Manager</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-muted p-2 rounded-lg">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <Badge className={`text-xs px-2 py-0.5 border ${getRoleBadgeColor(employee.role || employee.position)}`}>
                      {transformRole(employee.role || employee.position)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Role</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button className="flex-1 text-sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" className="flex-1 text-sm">
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm">
                <Plus className="mr-2 h-4 w-4" />
                Schedule Visit
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                <CreditCard className="mr-2 h-4 w-4" />
                Submit Expense
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Log Attendance
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm">
                <Tag className="mr-2 h-4 w-4" />
                Add Pricing
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Content - Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex justify-between items-center">
              <TabsList className="text-sm">
                <TabsTrigger value="visits" className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  Visits
                </TabsTrigger>
                <TabsTrigger value="attendance" className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Attendance
                </TabsTrigger>
                <TabsTrigger value="expenses" className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4" />
                  Expenses
                </TabsTrigger>
                <TabsTrigger value="pricing" className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4" />
                  Daily Pricing
                </TabsTrigger>
              </TabsList>
              
              <Button size="sm" className="text-sm">
                <Plus className="mr-2 h-4 w-4" />
                Add New
              </Button>
            </div>

            <TabsContent value="visits" className="space-y-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <User className="h-4 w-4" />
                    Visit History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {visitsData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No visits found</p>
                      </div>
                    ) : (
                      visitsData.map((visit) => (
                      <div key={visit.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="bg-muted p-2 rounded-lg">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium">{visit.customer}</h4>
                            <Badge variant="secondary" className="text-xs">{visit.duration}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {visit.purpose} on {format(new Date(visit.date), "MMM d, yyyy")}
                          </p>
                          <p className="text-xs mt-2">{visit.outcome}</p>
                        </div>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Attendance Records
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm">Date</TableHead>
                          <TableHead className="text-sm">Status</TableHead>
                          <TableHead className="text-sm">Check In</TableHead>
                          <TableHead className="text-sm">Check Out</TableHead>
                          <TableHead className="text-sm">Hours</TableHead>
                          <TableHead className="text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No attendance records found</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          attendanceData.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(record.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={cn(
                                  record.status === "present" 
                                    ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                    : record.status === "absent"
                                    ? "bg-red-100 text-red-800 hover:bg-red-100"
                                    : record.status === "leave"
                                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                    : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                )}
                              >
                                {record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{record.checkIn}</TableCell>
                            <TableCell className="text-sm">{record.checkOut}</TableCell>
                            <TableCell className="text-sm">{record.hours}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="space-y-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <CreditCard className="h-4 w-4" />
                    Expense Reports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm">Date</TableHead>
                          <TableHead className="text-sm">Category</TableHead>
                          <TableHead className="text-sm">Description</TableHead>
                          <TableHead className="text-sm">Amount</TableHead>
                          <TableHead className="text-sm">Status</TableHead>
                          <TableHead className="text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expensesData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No expense records found</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          expensesData.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm">{expense.category}</TableCell>
                            <TableCell className="text-sm">{expense.description}</TableCell>
                            <TableCell className="text-sm">${expense.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge 
                                className={cn(
                                  expense.status === "approved" 
                                    ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                    : expense.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                                    : "bg-red-100 text-red-800 hover:bg-red-100"
                                )}
                              >
                                {expense.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-3">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Tag className="h-4 w-4" />
                    Daily Pricing Input
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-sm">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={pricingDate}
                        onChange={(e) => setPricingDate(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand" className="text-sm">Brand</Label>
                      <Select value={brand} onValueChange={setBrand}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandsData.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="product" className="text-sm">Product</Label>
                      <Select value={product} onValueChange={setProduct}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {productsData.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm">Location</Label>
                      <Select value={location} onValueChange={setLocation}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locationsData.map((loc) => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price" className="text-sm">Our Price ($)</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="competitorPrice" className="text-sm">Competitor Price ($)</Label>
                      <Input
                        id="competitorPrice"
                        type="number"
                        placeholder="0.00"
                        value={competitorPrice}
                        onChange={(e) => setCompetitorPrice(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleAddPricing} className="text-sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Pricing
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Tag className="h-4 w-4" />
                    Recent Pricing Entries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-sm">Date</TableHead>
                          <TableHead className="text-sm">Brand</TableHead>
                          <TableHead className="text-sm">Product</TableHead>
                          <TableHead className="text-sm">Our Price</TableHead>
                          <TableHead className="text-sm">Competitor</TableHead>
                          <TableHead className="text-sm">Location</TableHead>
                          <TableHead className="text-sm">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricingData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No pricing entries found</p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          pricingData.map((pricing) => (
                          <TableRow key={pricing.id}>
                            <TableCell className="font-medium text-sm">
                              {format(new Date(pricing.date), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-sm">{pricing.brand}</TableCell>
                            <TableCell className="text-sm">{pricing.product}</TableCell>
                            <TableCell className="text-sm">${pricing.price.toFixed(2)}</TableCell>
                            <TableCell className="text-sm">${pricing.competitorPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-sm">{pricing.location}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
