"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog,
  DialogContent as DialogContentPrimitive,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogPortal,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
// Use a simple overflow container to allow horizontal + vertical scroll
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faExclamationTriangle, faEye } from '@fortawesome/free-solid-svg-icons';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
    Pagination,
    PaginationContent,
    PaginationLink,
    PaginationItem,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis
} from '@/components/ui/pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface VisitDetail {
    id: number;
    storeName?: string;
    purpose?: string;
    checkinDate?: string;
    checkinTime?: string;
    checkoutDate?: string;
    checkoutTime?: string;
    outcome?: string;
    updatedAt?: string;
    updatedTime?: string;
    visit_date?: string;
}

interface CustomerVisitDetail {
    completedVisitCount: number;
    customerType: string;
    avgIntentLevel: number;
    avgMonthlySales: number;
    visitCount: number;
    lastVisited: string;
    city: string;
    taluka: string | null;
    state: string;
    storeId: number;
    customerName: string;
}

interface Activity {
    id?: number;
    title?: string;
    name?: string;
    description?: string;
    notes?: string;
    date?: string;
    createdDate?: string;
    time?: string;
    createdTime?: string;
}

interface ExtendedVisitItem extends VisitDetail {
    isCustomerSummary?: boolean;
    customerType?: string;
    visitCount?: number;
    completedVisitCount?: number;
    city?: string;
    state?: string;
}

interface VisitDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    visitData: VisitDetail[];
    selectedDate: string;
    employeeName: string;
    hideViewAction?: boolean;
    customerVisitDetails?: CustomerVisitDetail[];
    activities?: Activity[];
}

const getOutcomeStatus = (visit: { outcome?: string; checkinDate?: string; checkinTime?: string; checkoutDate?: string; checkoutTime?: string }): { emoji: React.ReactNode; status: string; color: string } => {
    if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
        return { emoji: '✅', status: 'Completed', color: 'bg-purple-100 text-purple-800' };
    } else if (visit.checkoutDate && visit.checkoutTime) {
        return { emoji: '⏱️', status: 'Checked Out', color: 'bg-orange-100 text-orange-800' };
    } else if (visit.checkinDate && visit.checkinTime) {
        return { emoji: '🕰️', status: 'On Going', color: 'bg-green-100 text-green-800' };
    }
    return { emoji: '📅', status: 'Assigned', color: 'bg-blue-100 text-blue-800' };
};

const formatDateTime = (dateString: string, timeString: string) => {
    if (!dateString || !timeString) return '';
    const date = new Date(`${dateString}T${timeString}`);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    const time = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    // Format like "Aug 1 '25 04:01 PM"
    return `${month} ${day} '${year} ${time}`;
};

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({ isOpen, onClose, visitData, selectedDate, employeeName, hideViewAction = false, customerVisitDetails = [], activities = [] }) => {
    const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const visitsPerPage = 7;
    const router = useRouter();
    
    // Determine initial tab based on available data
    const getInitialTab = (): 'visits' | 'activities' => {
        if (visitData.length > 0 || customerVisitDetails.length > 0) return 'visits';
        if (activities.length > 0) return 'activities';
        return 'visits';
    };
    
    const [activeTab, setActiveTab] = useState<'visits' | 'activities'>(getInitialTab());
    
    // Reset tab when modal opens with new data
    React.useEffect(() => {
        if (isOpen) {
            setActiveTab(getInitialTab());
            setCurrentPage(1);
        }
    }, [isOpen, visitData.length, customerVisitDetails.length, activities.length]);
    
    // Filter visits to only show Completed, Assigned, and On Going (exclude "Checked Out")
    const filteredVisitData = visitData.filter(visit => {
        // Exclude visits that have checkoutDate/checkoutTime but no checkinDate/checkinTime (Checked Out status)
        const hasCheckout = visit.checkoutDate && visit.checkoutTime;
        const hasCheckin = visit.checkinDate && visit.checkinTime;
        
        // Keep: Completed (has both), On Going (has checkin only), Assigned (has neither)
        // Exclude: Checked Out (has checkout only, no checkin)
        if (hasCheckout && !hasCheckin) {
            return false; // Exclude "Checked Out" visits
        }
        return true; // Keep all other visits
    });
    
    // Combine filtered visits and customer visit details for display
    const allVisitItems: ExtendedVisitItem[] = [
        ...filteredVisitData,
        ...customerVisitDetails.map(customer => ({
            id: customer.storeId,
            storeName: customer.customerName,
            purpose: `${customer.customerType} - ${customer.visitCount} visit${customer.visitCount !== 1 ? 's' : ''} (${customer.completedVisitCount} completed)`,
            checkinDate: customer.lastVisited,
            checkinTime: '',
            checkoutDate: '',
            checkoutTime: '',
            outcome: '',
            visit_date: customer.lastVisited,
            isCustomerSummary: true,
            customerType: customer.customerType,
            visitCount: customer.visitCount,
            completedVisitCount: customer.completedVisitCount,
            city: customer.city,
            state: customer.state
        }))
    ];
    
    const indexOfLastVisit = currentPage * visitsPerPage;
    const indexOfFirstVisit = indexOfLastVisit - visitsPerPage;
    const currentVisits = allVisitItems.slice(indexOfFirstVisit, indexOfLastVisit);

    const handleViewDetails = (visitId: number) => {
        // Navigate to the actual Visit Detail app route
        router.push(`/dashboard/visits/${visitId}`);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogPortal>
                {/* Backdrop with blur effect */}
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 w-[90vw] sm:w-[85vw] lg:w-[75vw] max-w-[1200px] h-[80vh] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border shadow-lg duration-200 flex flex-col"
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>
                            Visits for {employeeName} on {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </DialogTitle>
                    </DialogHeader>
                  
                    <div className="flex-shrink-0 px-6 pt-6">
                        <div className="rounded-md bg-black text-white px-4 py-3">
                            <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-blue-900/60 rounded-lg flex items-center justify-center">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="text-blue-300" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-semibold text-white truncate">
                                    Visits for {employeeName}
                                </h2>
                                <p className="text-sm text-gray-300">
                                    {new Date(selectedDate).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="flex-shrink-0 flex items-center space-x-3">
                                <div className="flex items-center space-x-4">
                                <p className="text-sm font-medium text-blue-400">
                                        {allVisitItems.length} {allVisitItems.length === 1 ? 'visit' : 'visits'}
                                    </p>
                                    {activities.length > 0 && (
                                        <p className="text-sm font-medium text-cyan-400">
                                            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
                                        </p>
                                    )}
                                </div>
                                <Button 
                                    onClick={onClose} 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0 text-white/80 hover:bg-white/10"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    <span className="sr-only">Close</span>
                                </Button>
                            </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-hidden px-4 py-4">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'visits' | 'activities')} className="h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="visits">Visits ({allVisitItems.length})</TabsTrigger>
                                <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="visits" className="flex-1 overflow-hidden mt-0">
                                <div className="h-[65vh] w-full overflow-x-auto overflow-y-auto border rounded-lg bg-background">
                                    <div className="min-w-full">
                                        {currentVisits.length > 0 ? (
                                            <>
                                                <Table className="w-full min-w-[1200px] table-fixed">
                                                    <TableHeader>
                                                        <TableRow className="bg-muted hover:bg-muted/80">
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[20%]">Customer Name</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[15%]">Executive</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[10%]">Date</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[12%]">Status</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[12%]">Purpose</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[15%]">Visit Start</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[15%]">Visit End</TableHead>
                                                            {!hideViewAction && (
                                                              <TableHead className="font-semibold text-center px-3 py-4 text-sm w-[10%]">Actions</TableHead>
                                                            )}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {currentVisits.map((v: ExtendedVisitItem) => {
                                                            // Check if this is a customer summary item
                                                            if (v.isCustomerSummary) {
                                                                return (
                                                                    <TableRow key={`customer-${v.id}`} className="hover:bg-muted/40">
                                                                        <TableCell className="text-center font-medium px-3 py-3 w-[20%] truncate">
                                                                            {v.storeName ?? ''}
                                                                        </TableCell>
                                                                        <TableCell className="text-center px-3 py-3 w-[15%] truncate">
                                                                            {employeeName || ''}
                                                                        </TableCell>
                                                                        <TableCell className="text-center px-3 py-3 w-[10%]">
                                                                            {new Date(selectedDate).toLocaleDateString('en-US', {
                                                                                month: 'short',
                                                                                day: 'numeric',
                                                                                year: 'numeric'
                                                                            })}
                                                                        </TableCell>
                                                                        <TableCell className="text-center px-3 py-3 w-[12%]">
                                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                                <span className="mr-1">📋</span>
                                                                                Visit Summary
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="text-center px-3 py-3 w-[12%] truncate">
                                                                            {v.purpose ?? ''}
                                                                        </TableCell>
                                                                        <TableCell 
                                                                            className="text-center px-3 py-3 w-[15%] truncate" 
                                                                            title={formatDateTime(v.checkinDate || '', v.checkinTime || '') || ''}
                                                                        >
                                                                            {formatDateTime(v.checkinDate || '', v.checkinTime || '') || '-'}
                                                                        </TableCell>
                                                                        <TableCell 
                                                                            className="text-center px-3 py-3 w-[15%] truncate" 
                                                                            title={formatDateTime(v.checkoutDate || '', v.checkoutTime || '') || ''}
                                                                        >
                                                                            {formatDateTime(v.checkoutDate || '', v.checkoutTime || '') || '-'}
                                                                        </TableCell>
                                                                        {!hideViewAction && (
                                                                          <TableCell className="text-center px-3 py-3 w-[10%]">
                                                                          </TableCell>
                                                                        )}
                                                                    </TableRow>
                                                                );
                                                            }
                                                            
                                                            // Regular visit item
                                                            const { emoji, status, color } = getOutcomeStatus(v);
                                                            return (
                                                                <TableRow key={v.id} className="hover:bg-muted/40">
                                                                    <TableCell className="text-center font-medium px-3 py-3 w-[20%] truncate">
                                                                        {v.storeName ?? ''}
                                                                    </TableCell>
                                                                    <TableCell className="text-center px-3 py-3 w-[15%] truncate">
                                                                        {employeeName || ''}
                                                                    </TableCell>
                                                                    <TableCell className="text-center px-3 py-3 w-[10%]">
                                                                        {new Date(selectedDate).toLocaleDateString('en-US', {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </TableCell>
                                                                    <TableCell className="text-center px-3 py-3 w-[12%]">
                                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
                                                                            <span className="mr-1">{emoji}</span>
                                                                            {status}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-center px-3 py-3 w-[12%] truncate">
                                                                        {v.purpose ?? ''}
                                                                    </TableCell>
                                                                    <TableCell 
                                                                        className="text-center px-3 py-3 w-[15%] truncate" 
                                                                        title={formatDateTime(v.checkinDate || '', v.checkinTime || '') || ''}
                                                                    >
                                                                        {formatDateTime(v.checkinDate || '', v.checkinTime || '') || ''}
                                                                    </TableCell>
                                                                    <TableCell 
                                                                        className="text-center px-3 py-3 w-[15%] truncate" 
                                                                        title={formatDateTime(v.checkoutDate || '', v.checkoutTime || '') || ''}
                                                                    >
                                                                        {formatDateTime(v.checkoutDate || '', v.checkoutTime || '') || ''}
                                                                    </TableCell>
                                                                    {!hideViewAction && (
                                                                      <TableCell className="text-center px-3 py-3 w-[10%]">
                                                                          <Button size="sm" variant="outline" onClick={() => handleViewDetails(v.id)}>
                                                                              <FontAwesomeIcon icon={faEye} className="mr-1 h-3 w-3" />
                                                                              View
                                                                          </Button>
                                                                      </TableCell>
                                                                    )}
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </>
                                        ) : (
                                            <div className="text-center py-8">
                                                <p className="text-lg font-semibold text-red-400 flex items-center justify-center space-x-2">
                                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400" />
                                                    <span>No visits on this day</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="activities" className="flex-1 overflow-hidden mt-0">
                                <div className="h-[65vh] w-full overflow-x-auto overflow-y-auto border rounded-lg bg-background">
                                    <div className="min-w-full">
                                        {activities.length > 0 ? (
                                            <>
                                                <Table className="w-full min-w-[800px] table-fixed">
                                                    <TableHeader>
                                                        <TableRow className="bg-muted hover:bg-muted/80">
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm">Title</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm">Description</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm">Date</TableHead>
                                                            <TableHead className="font-semibold text-center px-3 py-4 text-sm">Time</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activities.map((activity, idx) => (
                                                            <TableRow key={activity.id || idx} className="hover:bg-muted/40">
                                                                <TableCell className="text-center font-medium px-3 py-3 truncate">
                                                                    {activity.title || activity.name || 'Activity'}
                                                                </TableCell>
                                                                <TableCell className="text-center px-3 py-3 truncate">
                                                                    {activity.description || activity.notes || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center px-3 py-3">
                                                                    {activity.date || activity.createdDate || selectedDate ? new Date(activity.date || activity.createdDate || selectedDate).toLocaleDateString('en-US', {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        year: 'numeric'
                                                                    }) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center px-3 py-3">
                                                                    {activity.time || activity.createdTime || '-'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </>
                                        ) : (
                                            <div className="text-center py-8">
                                                <p className="text-lg font-semibold text-red-400 flex items-center justify-center space-x-2">
                                                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400" />
                                                    <span>No activities on this day</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                </div>
                    <DialogFooter className="pt-4 border-t">
                        <div className="w-full flex items-center justify-end gap-3">
                            {activeTab === 'visits' && currentVisits.length > 0 && allVisitItems.length > visitsPerPage && (
                                <Pagination>
                                    <PaginationContent>
                                        {currentPage > 1 && (
                                            <PaginationPrevious size="sm" onClick={() => handlePageChange(currentPage - 1)} />
                                        )}
                                        {(() => {
                                            const totalPages = Math.ceil(visitData.length / visitsPerPage);
                                            const pages = [] as React.ReactNode[];
                                            if (totalPages <= 7) {
                                                for (let i = 1; i <= totalPages; i++) {
                                                    pages.push(
                                                        <PaginationItem key={i}>
                                                            <PaginationLink size="sm" isActive={i === currentPage} onClick={() => handlePageChange(i)}>
                                                                {i}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                }
                                            } else if (currentPage <= 4) {
                                                for (let i = 1; i <= 5; i++) {
                                                    pages.push(
                                                        <PaginationItem key={i}>
                                                            <PaginationLink size="sm" isActive={i === currentPage} onClick={() => handlePageChange(i)}>
                                                                {i}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                }
                                                pages.push(<PaginationEllipsis key="e1" />);
                                                pages.push(
                                                    <PaginationItem key={totalPages}>
                                                        <PaginationLink size="sm" onClick={() => handlePageChange(totalPages)}>
                                                            {totalPages}
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                            } else if (currentPage >= Math.ceil(allVisitItems.length / visitsPerPage) - 3) {
                                                pages.push(
                                                    <PaginationItem key={1}>
                                                        <PaginationLink size="sm" onClick={() => handlePageChange(1)}>
                                                            1
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                                pages.push(<PaginationEllipsis key="e2" />);
                                                for (let i = totalPages - 4; i <= totalPages; i++) {
                                                    pages.push(
                                                        <PaginationItem key={i}>
                                                            <PaginationLink size="sm" isActive={i === currentPage} onClick={() => handlePageChange(i)}>
                                                                {i}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                }
                                            } else {
                                                pages.push(
                                                    <PaginationItem key={1}>
                                                        <PaginationLink size="sm" onClick={() => handlePageChange(1)}>
                                                            1
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                                pages.push(<PaginationEllipsis key="e3" />);
                                                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                                    pages.push(
                                                        <PaginationItem key={i}>
                                                            <PaginationLink size="sm" isActive={i === currentPage} onClick={() => handlePageChange(i)}>
                                                                {i}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    );
                                                }
                                                pages.push(<PaginationEllipsis key="e4" />);
                                                pages.push(
                                                    <PaginationItem key={totalPages}>
                                                        <PaginationLink size="sm" onClick={() => handlePageChange(totalPages)}>
                                                            {totalPages}
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                            }
                                            return pages;
                                        })()}
                                        {currentPage < Math.ceil(allVisitItems.length / visitsPerPage) && (
                                            <PaginationNext size="sm" onClick={() => handlePageChange(currentPage + 1)} />
                                        )}
                                    </PaginationContent>
                                </Pagination>
                            )}
                            <Button onClick={onClose}>Close</Button>
                        </div>
                    </DialogFooter>
                </DialogPrimitive.Content>
            </DialogPortal>

            {selectedVisit && (
                <Dialog open={!!selectedVisit} onOpenChange={() => setSelectedVisit(null)}>
                    <DialogPortal>
                        {/* Backdrop with blur effect */}
                        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                        <DialogPrimitive.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200">
                            <DialogHeader>
                                <DialogTitle>Visit Details for {selectedVisit.storeName ?? ''}</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-semibold">Customer Name:</p>
                                    <p>{selectedVisit.storeName ?? ''}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Executive:</p>
                                    <p>{employeeName || ''}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Date:</p>
                                    <p>{formatDateTime(selectedVisit.visit_date ?? '', '') || ''}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Status:</p>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${getOutcomeStatus(selectedVisit).color}`}>
                                        {getOutcomeStatus(selectedVisit).emoji} {getOutcomeStatus(selectedVisit).status}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold">Purpose:</p>
                                    <p>{selectedVisit.purpose ?? ''}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Visit Start:</p>
                                    <p>{formatDateTime(selectedVisit.checkinDate ?? '', selectedVisit.checkinTime ?? '') || ''}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Visit End:</p>
                                    <p>{formatDateTime(selectedVisit.checkoutDate ?? '', selectedVisit.checkoutTime ?? '') || ''}</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={() => setSelectedVisit(null)}>Close</Button>
                            </DialogFooter>
                        </DialogPrimitive.Content>
                    </DialogPortal>
                </Dialog>
            )}
        </Dialog>
    );
};

export default VisitDetailsModal;
