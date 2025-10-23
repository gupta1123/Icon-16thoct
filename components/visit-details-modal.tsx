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

interface VisitDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    visitData: VisitDetail[];
    selectedDate: string;
    employeeName: string;
    hideViewAction?: boolean;
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

const VisitDetailsModal: React.FC<VisitDetailsModalProps> = ({ isOpen, onClose, visitData, selectedDate, employeeName, hideViewAction = false }) => {
    const [selectedVisit, setSelectedVisit] = useState<VisitDetail | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const visitsPerPage = 7;
    const router = useRouter();

    const handleViewDetails = (visitId: number) => {
        // Navigate to the actual Visit Detail app route
        router.push(`/dashboard/visits/${visitId}`);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const indexOfLastVisit = currentPage * visitsPerPage;
    const indexOfFirstVisit = indexOfLastVisit - visitsPerPage;
    const currentVisits = visitData.slice(indexOfFirstVisit, indexOfLastVisit);

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
                                <p className="text-sm font-medium text-blue-400">
                                    {visitData.length} {visitData.length === 1 ? 'visit' : 'visits'}
                                </p>
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
                                            {currentVisits.map((v) => {
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
                    

                    {/* Pagination moved to footer for visibility */}
                </div>
                    <DialogFooter className="pt-4 border-t">
                        <div className="w-full flex items-center justify-end gap-3">
                            {currentVisits.length > 0 && visitData.length > visitsPerPage && (
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
                                            } else if (currentPage >= Math.ceil(visitData.length / visitsPerPage) - 3) {
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
                                        {currentPage < Math.ceil(visitData.length / visitsPerPage) && (
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
