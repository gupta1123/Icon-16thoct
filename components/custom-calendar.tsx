"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
interface AttendanceData {
  employeeId: number;
  attendanceStatus: string; // Can be: 'full day', 'half day', 'present', 'absent', 'paid leave', 'full day (activity)'
  checkinDate: string;
  checkoutDate: string | null;
  visitCount?: number;
  assignedVisits?: number;
  hasActivity?: boolean;
  activityCount?: number;
}
interface CustomCalendarProps {
  month: number;
  year: number;
  attendanceData: AttendanceData[];
  onSummaryChange: (summary: { fullDays: number; halfDays: number; absentDays: number; presentDays: number }) => void;
  onDateClick: (date: string, employeeName: string, employeeId?: number) => void;
  employeeName: string;
  employeeId?: number;
}
const CustomCalendar: React.FC<CustomCalendarProps> = ({
  month,
  year,
  attendanceData,
  onSummaryChange,
  onDateClick,
  employeeName,
  employeeId,
}) => {
  const datesRef = useRef<HTMLDivElement>(null);
  const onDateClickRef = useRef(onDateClick);
  const lastSummaryRef = useRef<{ fullDays: number; halfDays: number; absentDays: number; presentDays: number } | null>(null);
  // Keep the latest onDateClick without triggering re-renders
  useEffect(() => {
    onDateClickRef.current = onDateClick;
  }, [onDateClick]);
  useEffect(() => {
    const renderCalendar = () => {
      if (datesRef.current) {
        datesRef.current.innerHTML = '';
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let fullDays = 0;
        let halfDays = 0;
        let absentDays = 0;
        let presentDays = 0;
        // Helper function to normalize date format (matches reference logic)
        const normalizeDate = (dateStr: string) => {
          return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        };
        // Render empty slots for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
          const emptyDiv = document.createElement('div');
          emptyDiv.classList.add('empty');
          datesRef.current.appendChild(emptyDiv);
        }
        // Render each day of the month
        for (let i = 1; i <= daysInMonth; i++) {
          const dateDiv = document.createElement('div');
          dateDiv.textContent = i.toString();
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
          const date = new Date(year, month, i);
          // Find an attendance record (if any) for this date
          const attendanceRecord = attendanceData.find((data) => {
            const checkinDatePart = normalizeDate(data.checkinDate);
            return checkinDatePart === dateKey;
          });
          
          const attendanceStatus = attendanceRecord?.attendanceStatus;
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const isFuture = date.getTime() > todayStart.getTime();
          const isToday = date.getTime() === todayStart.getTime();
          const tooltip = document.createElement('span');
          tooltip.classList.add('calendar-tooltip');
          // Sundays are paid leave days, regardless of whether the API returns
          // a separate attendance record for that date.
          // Sundays that haven't happened yet stay unmarked and uncounted.
          if (date.getDay() === 0 && !isFuture) {
            dateDiv.classList.add('paid-leave');
            tooltip.textContent = 'Paid Leave (Sunday)';
            fullDays++;
          }
          // If there's an attendance record, use it (but don't double-count Sundays)
          else if (attendanceStatus && isToday && ['half day', 'absent', 'present'].includes(attendanceStatus.toLowerCase())) {
            // Today is still in progress: these can still change, so show them as pending and don't count them yet.
            dateDiv.classList.add('today-pending');
            tooltip.textContent = `Today so far: ${attendanceStatus.toLowerCase() === 'present' ? 'absent' : attendanceStatus.toLowerCase()} (in progress)`;
          }
          else if (attendanceStatus) {
            const normalizedStatus = attendanceStatus.toLowerCase();
            // Replace all spaces and special characters with hyphens for valid CSS class
            const isActivityFullDay = normalizedStatus === 'full day (activity)';
            // "present" (only 1 completed visit) is shown and counted as absent
            const isPresent = normalizedStatus === 'present';
            const cssClass = isActivityFullDay
              ? 'full-day'
              : isPresent
              ? 'absent'
              : normalizedStatus.replace(/[\s()]+/g, '-').replace(/--+/g, '-').replace(/^-+|-+$/g, '');
            dateDiv.classList.add(cssClass);
            tooltip.textContent = isActivityFullDay ? 'Full day' : isPresent ? 'Absent' : ` ${attendanceStatus}`;
            // Count for summary stats
            if (normalizedStatus === 'full day' || normalizedStatus === 'full day (activity)') {
              fullDays++;
            } else if (normalizedStatus === 'half day') {
              halfDays++;
            } else if (normalizedStatus === 'absent') {
              absentDays++;
            } else if (normalizedStatus === 'paid leave') {
              fullDays++; // Paid leave counts as full day
            }
            else if (isPresent) {
              absentDays++;
            }
          }
          // If no attendance record and it's not Sunday
          else {
            // Check if the date is in the future
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to compare dates only
            const currentDate = new Date(year, month, i);
            currentDate.setHours(0, 0, 0, 0);
            
            // Only mark as absent once the day is over (today may still get a check-in)
            if (currentDate < today) {
              dateDiv.classList.add('absent');
              tooltip.textContent = 'Absent';
              absentDays++;
            }
            // Future dates are left unmarked (no class added, no tooltip, not counted)
          }
          dateDiv.appendChild(tooltip);
          // Handle date click using ref to avoid effect dependency on function identity
          dateDiv.addEventListener('click', () => {
            // Check if this is a future date without attendance record
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const clickedDate = new Date(year, month, i);
            clickedDate.setHours(0, 0, 0, 0);
            
            // If it's a future date and has no attendance record, show toast
            if (clickedDate > today && !attendanceStatus) {
              toast.info("Future Date", {
                description: "Attendance cannot be marked for future dates. Please check back on or after this date.",
                duration: 4000,
              });
              return;
            }
            
            // Otherwise, proceed with normal click handler
            onDateClickRef.current?.(dateKey, employeeName, employeeId);
          });
          datesRef.current.appendChild(dateDiv);
        }
        // Update the summary in the parent (matches reference approach)
        const newSummary = { fullDays, halfDays, absentDays, presentDays };
        // Only notify parent if values actually changed
        if (
          !lastSummaryRef.current ||
          lastSummaryRef.current.fullDays !== newSummary.fullDays ||
          lastSummaryRef.current.halfDays !== newSummary.halfDays ||
          lastSummaryRef.current.absentDays !== newSummary.absentDays ||
          lastSummaryRef.current.presentDays !== newSummary.presentDays
        ) {
          lastSummaryRef.current = newSummary;
          onSummaryChange(newSummary);
        }
      }
    };
    renderCalendar();
  }, [month, year, attendanceData, employeeName, employeeId]);
  return (
    <div className="custom-calendar">
      <div className="calendar-days">
        <div>S</div>
        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
      </div>
      <div className="calendar-dates" ref={datesRef}></div>
    </div>
  );
};
export default CustomCalendar;
