"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadIcon, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { format } from "date-fns";

export default function CustomersTable({ customers }: { customers: unknown[] }) {
  const { userRole, currentUser } = useAuth();
  const isAdmin = userRole === 'ADMIN' || currentUser?.authorities?.some(a => a.authority === 'ROLE_ADMIN');
  const isDataManager = userRole === 'DATA_MANAGER' || currentUser?.authorities?.some(a => a.authority === 'ROLE_DATA_MANAGER');
  const handleExport = () => {
    // In a real app, this would export the filtered data to CSV
    alert("Export to CSV functionality would be implemented here");
  };

  const getIntentTextColor = (level: number) => {
    if (level > 7) return "text-green-600";
    if (level > 4) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Customers</CardTitle>
        {(isAdmin || isDataManager) && (
          <Button onClick={handleExport} size="sm" variant="outline">
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </CardHeader>
      <CardContent className="w-full">
        <div className="rounded-md border overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Name</TableHead>
                  <TableHead>Owner Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Monthly Sales</TableHead>
                  
                  <TableHead>Field Officer</TableHead>
                  <TableHead>Client Type</TableHead>
                  <TableHead>Last Visit (Total)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length > 0 ? (
                  customers.map((customer) => {
                    const c = customer as Record<string, unknown>;
                    return (
                    <TableRow key={c.id as number}>
                      <TableCell className="font-medium break-words">
                        <Link href={`/dashboard/customers/${c.id}`} className="text-blue-600 hover:underline">
                          {String(c.shopName || '')}
                        </Link>
                      </TableCell>
                      <TableCell className="break-words">{String(c.ownerName || '')}</TableCell>
                      <TableCell className="break-words">{String(c.city || '')}</TableCell>
                      <TableCell className="break-words">{String(c.state || '')}</TableCell>
                      <TableCell className="break-words">{String(c.phone || '')}</TableCell>
                      <TableCell className="break-words">{String(c.monthlySales || '')}</TableCell>
                      
                      <TableCell className="break-words">{String(c.fieldOfficer || '')}</TableCell>
                      <TableCell className="break-words">{String(c.clientType || '')}</TableCell>
                      <TableCell className="break-words">
                        {c.lastVisitDate ? `${format(new Date(c.lastVisitDate as string), "d MMM")} (${c.totalVisits || 0})` : '—'}
                      </TableCell>
                      <TableCell className="break-words">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/customers/${c.id}`}>View customer</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit customer</DropdownMenuItem>
                            <DropdownMenuItem>Delete customer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center">
                      No customers found matching the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
