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
    clientFirstName?: string;
    clientLastName?: string;
    ownerName?: string;
    customerName?: string;
    clientName?: string;
    professionalName?: string;
    engineerName?: string;
    contractorName?: string;
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
    avgStock?: number;
    avgMonthlySales?: number;
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

const getOwnerCustomerName = (visit?: VisitDetail | null) => {
    if (!visit) return '';
    const firstLastName = [visit.clientFirstName, visit.clientLastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');

    return (
        firstLastName ||
        visit.ownerName?.trim() ||
        visit.customerName?.trim() ||
        visit.clientName?.trim() ||
        visit.professionalName?.trim() ||
        visit.engineerName?.trim() ||
        visit.contractorName?.trim() ||
        ''
    );
};

const shouldShowOwnerCustomer = (visit: VisitDetail) => {
    const ownerCustomerName = getOwnerCustomerName(visit);
    return Boolean(
        ownerCustomerName &&
        ownerCustomerName.toLowerCase() !== (visit.storeName ?? '').trim().toLowerCase()
    );
};

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({ isOpen, onClose, visitData, selectedDate, employeeName, hideViewAction = false, customerVisitDetails = [], activities = [] }) => {
    const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const visitsPerPage = 10;
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
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="bg-background fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col gap-0 border-l shadow-xl sm:w-[85vw] lg:w-[70vw] max-w-[1100px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-300 data-[state=open]:duration-500"
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>
                            Visits for {employeeName} on {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </DialogTitle>
                    </DialogHeader>
                  
                    <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3.5">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {(employeeName || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-base font-semibold leading-tight text-foreground">{employeeName}</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {new Date(selectedDate).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <Button
                            onClick={onClose}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="sr-only">Close</span>
                        </Button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'visits' | 'activities')} className="flex h-full flex-col">
                            <TabsList className="h-auto w-full flex-shrink-0 justify-start gap-5 rounded-none border-b bg-transparent px-5 py-0">
                                <TabsTrigger value="visits" className="rounded-none border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-[13px] font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
                                    Visits <span className="ml-1.5 text-xs text-muted-foreground">{allVisitItems.length}</span>
                                </TabsTrigger>
                                <TabsTrigger value="activities" className="rounded-none border-b-2 border-transparent bg-transparent px-0.5 py-2.5 text-[13px] font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
                                    Activities <span className="ml-1.5 text-xs text-muted-foreground">{activities.length}</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="visits" className="mt-0 flex-1 overflow-auto">
                                {currentVisits.length > 0 ? (
                                    <Table className="w-full table-fixed text-[13px]">
                                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="h-9 w-[30%] px-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Store / Project</TableHead>
                                                <TableHead className="h-9 w-[15%] px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                                                <TableHead className="h-9 w-[22%] px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purpose</TableHead>
                                                <TableHead className="h-9 w-[11%] px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start</TableHead>
                                                <TableHead className="h-9 w-[11%] px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">End</TableHead>
                                                {!hideViewAction && <TableHead className="h-9 w-[11%] px-5" />}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentVisits.map((v: ExtendedVisitItem, rowIdx: number) => {
                                                const isSummary = !!v.isCustomerSummary;
                                                const { status, color } = getOutcomeStatus(v);
                                                const timeOnly = (d?: string, t?: string) => (formatDateTime(d || '', t || '') || '').replace(/^.*?'\d{2}\s*/, '');
                                                const startText = timeOnly(v.checkinDate, v.checkinTime);
                                                const endText = timeOnly(v.checkoutDate, v.checkoutTime);
                                                return (
                                                    <TableRow key={`${isSummary ? 'customer' : 'visit'}-${v.id}-${rowIdx}`} className="hover:bg-muted/40">
                                                        <TableCell className="px-5 py-2.5">
                                                            <div className="truncate font-medium text-foreground" title={v.storeName ?? ''}>{v.storeName ?? ''}</div>
                                                            {shouldShowOwnerCustomer(v) && (
                                                                <div className="truncate text-xs text-muted-foreground">{getOwnerCustomerName(v)}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="px-2 py-2.5">
                                                            {isSummary ? (
                                                                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Summary</span>
                                                            ) : (
                                                                <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="px-2 py-2.5 text-muted-foreground">
                                                            <div className="truncate" title={v.purpose ?? ''}>{v.purpose ?? ''}</div>
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap px-2 py-2.5 tabular-nums text-foreground">{startText || <span className="text-muted-foreground">–</span>}</TableCell>
                                                        <TableCell className="whitespace-nowrap px-2 py-2.5 tabular-nums text-foreground">{endText || <span className="text-muted-foreground">–</span>}</TableCell>
                                                        {!hideViewAction && (
                                                            <TableCell className="px-5 py-2.5 text-right">
                                                                {!isSummary && (
                                                                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => handleViewDetails(v.id)}>
                                                                        View
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="py-16 text-center">
                                        <p className="text-sm font-medium text-foreground">No visits on this day</p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="activities" className="mt-0 flex-1 overflow-auto">
                                {activities.length > 0 ? (
                                    <Table className="w-full table-fixed text-[13px]">
                                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="h-9 w-[28%] px-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Title</TableHead>
                                                <TableHead className="h-9 w-[42%] px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</TableHead>
                                                <TableHead className="h-9 w-[15%] px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</TableHead>
                                                <TableHead className="h-9 w-[15%] px-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activities.map((activity, idx) => (
                                                <TableRow key={activity.id || idx} className="hover:bg-muted/40">
                                                    <TableCell className="px-5 py-2.5 font-medium text-foreground"><div className="truncate">{activity.title || activity.name || 'Activity'}</div></TableCell>
                                                    <TableCell className="px-2 py-2.5 text-muted-foreground"><div className="truncate">{activity.description || activity.notes || '-'}</div></TableCell>
                                                    <TableCell className="whitespace-nowrap px-2 py-2.5 text-foreground">
                                                        {activity.date || activity.createdDate || selectedDate ? new Date(activity.date || activity.createdDate || selectedDate).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        }) : '-'}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap px-5 py-2.5 tabular-nums text-foreground">{activity.time || activity.createdTime || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="py-16 text-center">
                                        <p className="text-sm font-medium text-foreground">No activities on this day</p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                    <DialogFooter className="flex-shrink-0 border-t bg-background px-5 py-3">
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
                        <DialogPrimitive.Content aria-describedby={undefined} className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200">
                            <DialogHeader>
                                <DialogTitle>Visit Details for {selectedVisit.storeName ?? ''}</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-semibold">Store/Project:</p>
                                    <p>{selectedVisit.storeName ?? ''}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Owner/Customer:</p>
                                    <p>{shouldShowOwnerCustomer(selectedVisit) ? getOwnerCustomerName(selectedVisit) : '-'}</p>
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
