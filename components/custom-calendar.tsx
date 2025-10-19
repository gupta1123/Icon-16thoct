"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  onSummaryChange: (summary: { fullDays: number; halfDays: number; absentDays: number }) => void;
  onDateClick: (date: string, employeeName: string) => void;
  employeeName: string;
}
const CustomCalendar: React.FC<CustomCalendarProps> = ({
  month,
  year,
  attendanceData,
  onSummaryChange,
  onDateClick,
  employeeName,
}) => {
  const datesRef = useRef<HTMLDivElement>(null);
  const onDateClickRef = useRef(onDateClick);
  const lastSummaryRef = useRef<{ fullDays: number; halfDays: number; absentDays: number } | null>(null);
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
            const matches = checkinDatePart === dateKey;
            if (matches) {
              console.log(`Found attendance record for ${dateKey}:`, data);
            }
            return matches;
          });
          
          const attendanceStatus = attendanceRecord?.attendanceStatus;
          const tooltip = document.createElement('span');
          tooltip.classList.add('calendar-tooltip');
          // Check if it's Sunday first (like reference code)
          if (date.getDay() === 0) {
            dateDiv.classList.add('full-day');
            tooltip.textContent = 'Full Day (Sunday)';
            fullDays++;
          }
          // If there's an attendance record, use it (but don't double-count Sundays)
          else if (attendanceStatus) {
            const normalizedStatus = attendanceStatus.toLowerCase();
            // Replace all spaces and special characters with hyphens for valid CSS class
            const cssClass = normalizedStatus.replace(/[\s()]+/g, '-').replace(/--+/g, '-');
            dateDiv.classList.add(cssClass);
            tooltip.textContent = ` ${attendanceStatus}`;
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
            // 'present' doesn't count in any category
          }
          // If no attendance record and it's not Sunday, count as absent
          else {
            dateDiv.classList.add('absent');
            tooltip.textContent = 'Absent';
            absentDays++;
          }
          dateDiv.appendChild(tooltip);
          // Handle date click using ref to avoid effect dependency on function identity
          dateDiv.addEventListener('click', () => {
            onDateClickRef.current?.(dateKey, employeeName);
          });
          datesRef.current.appendChild(dateDiv);
        }
        // Update the summary in the parent (matches reference approach)
        const newSummary = { fullDays, halfDays, absentDays };
        console.log(`Calendar stats for ${employeeName}:`, { ...newSummary, totalDays: daysInMonth });
        // Only notify parent if values actually changed
        if (
          !lastSummaryRef.current ||
          lastSummaryRef.current.fullDays !== newSummary.fullDays ||
          lastSummaryRef.current.halfDays !== newSummary.halfDays ||
          lastSummaryRef.current.absentDays !== newSummary.absentDays
        ) {
          lastSummaryRef.current = newSummary;
          onSummaryChange(newSummary);
        }
      }
    };
    renderCalendar();
  }, [month, year, attendanceData, employeeName]);
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