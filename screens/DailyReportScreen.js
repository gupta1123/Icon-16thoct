import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { format, subDays, isAfter, setHours, setMinutes, startOfDay } from 'date-fns';
import CustomDropdown from './CustomDropdown';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const REPORT_WIDTH = SCREEN_WIDTH - 40; // Padding

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
const getOrdinalSuffix = (day) => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Helper function to format time from "HH:mm:ss.SSS" to "h:mm AM/PM"
const formatTime = (timeStr) => {
  if (!timeStr) return 'N/A';
  try {
    // Handle format like "18:53:54.858" or "18:53:54" or "18:53"
    const timeParts = timeStr.split(':');
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12; // Convert to 12-hour format
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    return timeStr;
  } catch {
    return timeStr;
  }
};

// Helper function to format date in "5th Jan '25" format
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Try parsing as "YYYY-MM-DD"
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        date.setFullYear(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      } else {
        return dateStr;
      }
    }
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits
    return `${day}${getOrdinalSuffix(day)} ${month} '${year}`;
  } catch {
    return dateStr;
  }
};

// Helper function to format date-time string in "5th Jan '25 9:30 PM" format
const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return 'N/A';
  try {
    // Try to parse as ISO string or common formats
    let date;
    if (dateTimeStr.includes(' ')) {
      // Format like "2025-12-31 18:56:54"
      const [datePart, timePart] = dateTimeStr.split(' ');
      const [year, month, day] = datePart.split('-');
      date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      const formattedDate = formatDate(datePart);
      const formattedTime = formatTime(timePart);
      return `${formattedDate} ${formattedTime}`;
    } else {
      // Just a date
      date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) {
        return dateTimeStr;
      }
      return formatDate(dateTimeStr);
    }
  } catch {
    return dateTimeStr;
  }
};

// Generate HTML for PDF
const generateReportHTML = (reportData, reportDate) => {
  if (!reportData) return '';

  const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 20mm;
          size: A4;
        }
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          color: #1F2937;
          line-height: 1.6;
          width: 100%;
          box-sizing: border-box;
        }
        * {
          box-sizing: border-box;
        }
        .header {
          border-bottom: 3px solid #6C63FF;
          padding-bottom: 16px;
          margin-bottom: 20px;
          text-align: center;
        }
        .header-title {
          font-size: 24px;
          font-weight: bold;
          color: #1F2937;
          margin-bottom: 8px;
        }
        .header-subtitle {
          font-size: 18px;
          font-weight: 600;
          color: #6C63FF;
          margin-bottom: 4px;
        }
        .generated-at {
          font-size: 12px;
          color: #6B7280;
          margin-top: 4px;
        }
        .employee-name {
          font-size: 14px;
          color: #4B5563;
          margin-top: 4px;
          font-weight: 500;
        }
        .section {
          margin-bottom: 24px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #1F2937;
          margin-bottom: 12px;
          border-bottom: 2px solid #E5E7EB;
          padding-bottom: 8px;
        }
        .count-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          margin-top: 8px;
        }
        .count-card {
          width: 48%;
          background-color: #F3F4F6;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          text-align: center;
          border: 1px solid #E5E7EB;
        }
        .count-value {
          font-size: 32px;
          font-weight: bold;
          color: #6C63FF;
          margin-bottom: 4px;
        }
        .count-label {
          font-size: 12px;
          color: #6B7280;
        }
        .visit-card {
          background-color: #F9FAFB;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 12px;
          border: 1px solid #E5E7EB;
          page-break-inside: avoid;
        }
        .visit-title {
          font-size: 16px;
          font-weight: bold;
          color: #1F2937;
          margin-bottom: 8px;
        }
        .visit-row {
          margin-bottom: 6px;
        }
        .visit-label {
          font-size: 13px;
          font-weight: 600;
          color: #4B5563;
          display: inline-block;
          width: 120px;
        }
        .visit-value {
          font-size: 13px;
          color: #6B7280;
        }
        .table-container {
          margin-top: 8px;
        }
        .table-header {
          background-color: #6C63FF;
          color: #FFFFFF;
          font-weight: bold;
          font-size: 10px;
          padding: 8px 6px;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          display: flex;
        }
        .table-header-cell {
          padding: 0 3px;
        }
        .table-row {
          background-color: #F9FAFB;
          padding: 6px;
          border-bottom: 1px solid #E5E7EB;
          display: flex;
          page-break-inside: avoid;
        }
        .table-cell {
          font-size: 9px;
          color: #1F2937;
          padding: 0 3px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          min-width: 0;
        }
        .table-cell-bold {
          font-weight: 600;
        }
        .col-owner { flex: 1.2; }
        .col-mobile { flex: 1; }
        .col-brand { flex: 0.8; }
        .col-stage { flex: 0.8; }
        .col-notes { flex: 1; }
        .col-name { flex: 1.3; }
        .col-email { flex: 1.2; }
        .col-gift { flex: 0.6; }
        .col-sites { flex: 0.6; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-title">Daily Visit Report</div>
        <div class="header-subtitle">${formatDate(reportData.reportDate)}</div>
        ${reportData.generatedAt ? `<div class="generated-at">Generated: ${escapeHtml(formatDateTime(reportData.generatedAt))}</div>` : ''}
        ${reportData.employeeName ? `<div class="employee-name">Employee: ${escapeHtml(reportData.employeeName)}</div>` : ''}
      </div>
  `;

  // Visit Summary
  if (reportData.visitCountByCustomerType) {
    html += `
      <div class="section">
        <div class="section-title">Visit Summary</div>
        <div class="count-grid">
    `;
    Object.entries(reportData.visitCountByCustomerType).forEach(([type, count]) => {
      html += `
        <div class="count-card">
          <div class="count-value">${count}</div>
          <div class="count-label">${escapeHtml(type)}</div>
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  }

  // Dealer Visits
  if (reportData.dealerVisits && reportData.dealerVisits.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">Dealer Visits (${reportData.dealerVisits.length})</div>
    `;
    reportData.dealerVisits.forEach((visit) => {
      html += `
        <div class="visit-card">
          <div class="visit-title">${escapeHtml(visit.dealerName || 'N/A')}</div>
          <div class="visit-row">
            <span class="visit-label">Location:</span>
            <span class="visit-value">${escapeHtml(visit.location || 'N/A')}</span>
          </div>
          <div class="visit-row">
            <span class="visit-label">Time:</span>
            <span class="visit-value">${escapeHtml(formatTime(visit.visitStartTime) || 'N/A')} - ${escapeHtml(formatTime(visit.visitEndTime) || 'N/A')}</span>
          </div>
          ${visit.requirement ? `
          <div class="visit-row">
            <span class="visit-label">Requirement:</span>
            <span class="visit-value">${escapeHtml(visit.requirement)}</span>
          </div>
          ` : ''}
          ${visit.notes ? `
          <div class="visit-row">
            <span class="visit-label">Notes:</span>
            <span class="visit-value">${escapeHtml(visit.notes)}</span>
          </div>
          ` : ''}
        </div>
      `;
    });
    html += `</div>`;
  }

  // Site Visits - Table Format
  if (reportData.siteVisits && reportData.siteVisits.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">Site Visits (${reportData.siteVisits.length})</div>
        <div class="table-container">
          <div class="table-header">
            <div class="table-header-cell col-owner">Owner</div>
            <div class="table-header-cell col-mobile">Mobile</div>
            <div class="table-header-cell col-brand">Brand</div>
            <div class="table-header-cell col-stage">Stage</div>
            <div class="table-header-cell col-notes">Notes</div>
          </div>
    `;
    reportData.siteVisits.forEach((visit) => {
      html += `
        <div class="table-row">
          <div class="table-cell table-cell-bold col-owner">${escapeHtml(visit.ownerName || 'N/A')}</div>
          <div class="table-cell col-mobile">${escapeHtml(visit.ownerMobile || 'N/A')}</div>
          <div class="table-cell col-brand">${escapeHtml(visit.brandCurrentlyUsed || '-')}</div>
          <div class="table-cell col-stage">${escapeHtml(visit.constructionStage || '-')}</div>
          <div class="table-cell col-notes">${escapeHtml(visit.notes || '-')}</div>
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  }

  // Engineer/Architect/Contractor Visits - Table Format
  if (reportData.professionalVisits && reportData.professionalVisits.length > 0) {
    html += `
      <div class="section">
        <div class="section-title">Engineer/Architect/Contractor Visits (${reportData.professionalVisits.length})</div>
        <div class="table-container">
          <div class="table-header">
            <div class="table-header-cell col-name">Name</div>
            <div class="table-header-cell col-mobile">Mobile</div>
            <div class="table-header-cell col-email">Email</div>
            <div class="table-header-cell col-gift">Gift</div>
            <div class="table-header-cell col-sites">Sites</div>
            <div class="table-header-cell col-notes">Notes</div>
          </div>
    `;
    reportData.professionalVisits.forEach((visit) => {
      html += `
        <div class="table-row">
          <div class="table-cell table-cell-bold col-name">${escapeHtml(visit.name || 'N/A')}</div>
          <div class="table-cell col-mobile">${escapeHtml(visit.mobile || 'N/A')}</div>
          <div class="table-cell col-email">${escapeHtml(visit.email || '-')}</div>
          <div class="table-cell col-gift">${escapeHtml(visit.giftGiven || '-')}</div>
          <div class="table-cell col-sites">${escapeHtml(visit.upcomingSiteCount || '-')}</div>
          <div class="table-cell col-notes">${escapeHtml(visit.notes || '-')}</div>
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  }

  html += `
    </body>
    </html>
  `;

  return html;
};

// Report Image Template Component (kept for preview)
const ReportImageTemplate = ({ reportData, reportDate }) => {
  if (!reportData) return null;

  return (
    <View style={reportStyles.container}>
      {/* Header */}
      <View style={reportStyles.header}>
        <Text style={reportStyles.headerTitle}>Daily Visit Report</Text>
        <Text style={reportStyles.headerSubtitle}>
          {reportData.reportDate ? formatDate(reportData.reportDate) : 'N/A'}
        </Text>
        {reportData.generatedAt && (
          <Text style={reportStyles.generatedAt}>
            Generated: {formatDateTime(reportData.generatedAt)}
          </Text>
        )}
        {reportData.employeeName && (
          <Text style={reportStyles.employeeName}>
            Employee: {reportData.employeeName}
          </Text>
        )}
      </View>

      {/* Visit Count Summary */}
      {reportData.visitCountByCustomerType && (
        <View style={reportStyles.section}>
          <Text style={reportStyles.sectionTitle}>Visit Summary</Text>
          <View style={reportStyles.countGrid}>
            {Object.entries(reportData.visitCountByCustomerType).map(([type, count]) => (
              <View key={type} style={reportStyles.countCard}>
                <Text style={reportStyles.countValue}>{count}</Text>
                <Text style={reportStyles.countLabel}>{type}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Dealer Visits */}
      {reportData.dealerVisits && reportData.dealerVisits.length > 0 && (
        <View style={reportStyles.section}>
          <Text style={reportStyles.sectionTitle}>Dealer Visits ({reportData.dealerVisits.length})</Text>
          {reportData.dealerVisits.map((visit, index) => (
            <View key={index} style={reportStyles.visitCard}>
              <Text style={reportStyles.visitTitle}>{visit.dealerName || 'N/A'}</Text>
              <View style={reportStyles.visitRow}>
                <Text style={reportStyles.visitLabel}>Location:</Text>
                <Text style={reportStyles.visitValue}>{visit.location || 'N/A'}</Text>
              </View>
              <View style={reportStyles.visitRow}>
                <Text style={reportStyles.visitLabel}>Time:</Text>
                <Text style={reportStyles.visitValue}>
                  {formatTime(visit.visitStartTime) || 'N/A'} - {formatTime(visit.visitEndTime) || 'N/A'}
                </Text>
              </View>
              {visit.requirement && (
                <View style={reportStyles.visitRow}>
                  <Text style={reportStyles.visitLabel}>Requirement:</Text>
                  <Text style={reportStyles.visitValue}>{visit.requirement}</Text>
                </View>
              )}
              {visit.notes && (
                <View style={reportStyles.visitRow}>
                  <Text style={reportStyles.visitLabel}>Notes:</Text>
                  <Text style={reportStyles.visitValue}>{visit.notes}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Site Visits - Compact Table Format */}
      {reportData.siteVisits && reportData.siteVisits.length > 0 && (
        <View style={reportStyles.section}>
          <Text style={reportStyles.sectionTitle}>Site Visits ({reportData.siteVisits.length})</Text>
          {/* Table Header */}
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1.2 }]}>Owner</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 0.8 }]}>Brand</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 0.8 }]}>Stage</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1 }]}>Notes</Text>
          </View>
          {/* Table Rows */}
          {reportData.siteVisits.map((visit, index) => (
            <View key={index} style={reportStyles.tableRow}>
              <Text style={[reportStyles.tableCell, { flex: 1.2, fontWeight: '600' }]} numberOfLines={1}>
                {visit.ownerName || 'N/A'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 1 }]} numberOfLines={1}>
                {visit.ownerMobile || 'N/A'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 0.8 }]} numberOfLines={1}>
                {visit.brandCurrentlyUsed || '-'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 0.8 }]} numberOfLines={1}>
                {visit.constructionStage || '-'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 1 }]} numberOfLines={1}>
                {visit.notes || '-'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Engineer/Architect/Contractor Visits - Compact Table Format */}
      {reportData.professionalVisits && reportData.professionalVisits.length > 0 && (
        <View style={reportStyles.section}>
          <Text style={reportStyles.sectionTitle}>Engineer/Architect/Contractor Visits ({reportData.professionalVisits.length})</Text>
          {/* Table Header */}
          <View style={reportStyles.tableHeader}>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1.3 }]}>Name</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1 }]}>Mobile</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1.2 }]}>Email</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 0.6 }]}>Gift</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 0.6 }]}>Sites</Text>
            <Text style={[reportStyles.tableCell, reportStyles.tableHeaderCell, { flex: 1 }]}>Notes</Text>
          </View>
          {/* Table Rows */}
          {reportData.professionalVisits.map((visit, index) => (
            <View key={index} style={reportStyles.tableRow}>
              <Text style={[reportStyles.tableCell, { flex: 1.3, fontWeight: '600' }]} numberOfLines={1}>
                {visit.name || 'N/A'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 1 }]} numberOfLines={1}>
                {visit.mobile || 'N/A'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 1.2 }]} numberOfLines={1}>
                {visit.email || '-'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 0.6 }]} numberOfLines={1}>
                {visit.giftGiven || '-'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 0.6 }]} numberOfLines={1}>
                {visit.upcomingSiteCount || '-'}
              </Text>
              <Text style={[reportStyles.tableCell, { flex: 1 }]} numberOfLines={1}>
                {visit.notes || '-'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const DailyReportScreen = ({ navigation, authToken }) => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportDate, setReportDate] = useState(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);

  useEffect(() => {
    checkReportAvailability();
  }, []);

  const checkReportAvailability = () => {
    const now = new Date();
    const today8PM = setMinutes(setHours(startOfDay(now), 20), 0); // 8:00 PM today
    const yesterday = subDays(now, 1);
    const yesterday8PM = setMinutes(setHours(startOfDay(yesterday), 20), 0); // 8:00 PM yesterday

    // Report is available if current time is after 8 PM today
    // It remains available until 8 PM tomorrow (24 hours from 8 PM today)
    if (isAfter(now, today8PM)) {
      // Report for today is available (generated at 8 PM today, available until 8 PM tomorrow)
      setReportDate(format(now, 'yyyy-MM-dd'));
      setIsAvailable(true);
      setAvailabilityMessage(`Report for ${format(now, 'dd MMM yyyy')} is available`);
    } else if (isAfter(now, yesterday8PM)) {
      // Report for yesterday is available (generated at 8 PM yesterday, available until 8 PM today)
      setReportDate(format(yesterday, 'yyyy-MM-dd'));
      setIsAvailable(true);
      setAvailabilityMessage(`Report for ${format(yesterday, 'dd MMM yyyy')} is available`);
    } else {
      // Report not yet available
      setIsAvailable(false);
      const timeUntil8PM = today8PM.getTime() - now.getTime();
      const hoursUntil = Math.floor(timeUntil8PM / (1000 * 60 * 60));
      const minutesUntil = Math.floor((timeUntil8PM % (1000 * 60 * 60)) / (1000 * 60));
      setAvailabilityMessage(
        `Report will be available after 8:00 PM today (in ${hoursUntil}h ${minutesUntil}m)`
      );
    }
  };

  const fetchReportData = async () => {
    if (!reportDate) return null;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        Alert.alert('Error', 'Authentication required');
        setLoading(false);
        return null;
      }

      // Fetch daily report from new API endpoint
      const response = await axios.get(
        `https://unbalkingly-uncharged-elizabet.ngrok-free.dev/report/daily`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'IconMobile',
          },
          params: {
            date: reportDate, // Optional: pass date if API supports it
          },
        }
      );

      // Check if response is HTML
      if (typeof response.data === 'string' &&
          (response.data.includes('<!DOCTYPE html>') || response.data.includes('<html>'))) {
        console.log('⚠️ [DAILY REPORT] Server returned HTML');
        setReportData(null);
        setLoading(false);
        return null;
      }

      // Set the report data with the new structure
      setReportData(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching report data:', error);
      Alert.alert('Error', 'Failed to fetch report data. Please try again.');
      setReportData(null);
      return null;
    } finally {
      setLoading(false);
    }
  };


  const downloadViaSharing = async (fileName, csvContent) => {
    try {
      // Save to documentDirectory first (persistent storage)
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Write CSV to file
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log('✅ [DAILY REPORT] File saved to:', fileUri);

      // Use Sharing API
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Save Daily Report',
          UTI: 'public.comma-separated-values-text',
        });
        
        Alert.alert(
          'Report Ready',
          Platform.OS === 'android' 
            ? `Please select "Save to Downloads" from the sharing options.\n\nFile: ${fileName}`
            : `Please select "Save to Files" from the sharing options.\n\nFile: ${fileName}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Report Saved',
          `Report has been saved to app storage.\n\nFile: ${fileName}\n\nTo access: Use a file manager app.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error in downloadViaSharing:', error);
      Alert.alert('Error', 'Failed to save report. Please try again.');
    }
  };

  // Filter report data based on selections
  const filterReportData = (data, options = {}) => {
    const filtered = { ...data };
    
    // Filter dealer visits
    if (options.dealerNames && options.dealerNames.length > 0) {
      filtered.dealerVisits = (data.dealerVisits || []).filter(visit => 
        options.dealerNames.includes(visit.dealerName)
      );
    } else if (options.includeDealers === false) {
      filtered.dealerVisits = [];
    }
    
    // Filter site visits
    if (options.siteVisitIndices && options.siteVisitIndices.length > 0) {
      filtered.siteVisits = (data.siteVisits || []).filter((visit, index) => 
        options.siteVisitIndices.includes(index)
      );
    } else if (options.includeSiteVisits === false) {
      filtered.siteVisits = [];
    }
    
    // Filter professional visits
    if (options.professionalIndices && options.professionalIndices.length > 0) {
      filtered.professionalVisits = (data.professionalVisits || []).filter((visit, index) => 
        options.professionalIndices.includes(index)
      );
    } else if (options.includeProfessionals === false) {
      filtered.professionalVisits = [];
    }
    
    // Update visit counts
    filtered.visitCountByCustomerType = {
      'Dealer/Shop': filtered.dealerVisits?.length || 0,
      'Site Visit': filtered.siteVisits?.length || 0,
      'Engineer/Architect/Contractor': filtered.professionalVisits?.length || 0,
    };
    
    return filtered;
  };

  // Generate a single PDF with custom filename
  const generateSinglePDF = async (filteredData, fileName) => {
    // Generate HTML from filtered report data
    const html = generateReportHTML(filteredData, reportDate);
    
    // Generate PDF from HTML
    const { uri } = await Print.printToFileAsync({
      html: html,
      base64: false,
      width: 595, // A4 width in points
      height: 842, // A4 height in points
    });

    console.log('✅ [DAILY REPORT] PDF generated:', uri);

    // Save PDF to document directory
    const savedUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({
      from: uri,
      to: savedUri,
    });

    console.log('✅ [DAILY REPORT] PDF saved to:', savedUri);
    return savedUri;
  };

  const handleGeneratePDF = async (filteredData, customFileName = null) => {
    setIsGeneratingImage(true);
    try {
      // Generate filename with date
      const fileName = customFileName || `Daily_Report_${reportDate}_${format(new Date(reportDate), 'dd-MMM-yyyy')}.pdf`;
      
      const savedUri = await generateSinglePDF(filteredData, fileName);

      // Share the PDF (user can save it from sharing options)
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(savedUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save Daily Report PDF',
          UTI: 'com.adobe.pdf',
        });
        
        Alert.alert(
          '✅ PDF Generated',
          Platform.OS === 'android'
            ? `PDF has been generated!\n\nFile: ${fileName}\n\nSelect "Save" or "Files" from sharing options to save to Downloads.`
            : `PDF has been generated!\n\nFile: ${fileName}\n\nSelect "Save to Files" from sharing options to save.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'PDF Saved',
          `PDF has been saved to app storage.\n\nFile: ${fileName}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error generating PDF report:', error);
      Alert.alert('Error', 'Failed to generate report PDF. Please try again.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Master download - filtered by selected dealer
  const generateMasterPDF = async () => {
    if (!isAvailable) {
      Alert.alert('Not Available', availabilityMessage);
      return;
    }

    // Check if dealer is selected
    if (!selectedDealer) {
      Alert.alert('Select Dealer', 'Please select a dealer from the dropdown to generate the report.');
      return;
    }

    // Fetch data if not already loaded
    let dataToUse = reportData;
    if (!dataToUse) {
      dataToUse = await fetchReportData();
      
      if (!dataToUse) {
        Alert.alert('No Data', 'No report data available for this date.');
        return;
      }
    }

    // Filter data to include only selected dealer
    const filteredData = filterReportData(dataToUse, {
      dealerNames: [selectedDealer],
      includeSiteVisits: true, // Keep site visits and professionals
      includeProfessionals: true,
    });

    const dateStr = format(new Date(reportDate), 'dd-MMM-yyyy');
    const sanitizedDealerName = selectedDealer.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Daily_Report_${sanitizedDealerName}_${dateStr}.pdf`;
    
    await handleGeneratePDF(filteredData, fileName);
  };


  useEffect(() => {
    if (isAvailable && reportDate) {
      fetchReportData();
    }
  }, [isAvailable, reportDate]);

  // Reset selected dealer when report data changes
  useEffect(() => {
    if (reportData && reportData.dealerVisits && reportData.dealerVisits.length > 0) {
      // Auto-select first dealer if none selected
      if (!selectedDealer) {
        setSelectedDealer(reportData.dealerVisits[0].dealerName);
      }
    } else {
      setSelectedDealer(null);
    }
  }, [reportData]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#6C63FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Report</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color="#6C63FF" />
          <Text style={styles.infoText}>
            Daily reports are auto-generated and available for download after 8:00 PM.
            Reports remain downloadable for 24 hours (until 8:00 PM the next day).
          </Text>
        </View>

        <View style={[styles.statusCard, isAvailable ? styles.availableCard : styles.unavailableCard]}>
          <Ionicons
            name={isAvailable ? 'checkmark-circle' : 'time-outline'}
            size={32}
            color={isAvailable ? '#10B981' : '#F59E0B'}
          />
          <Text style={[styles.statusText, isAvailable ? styles.availableText : styles.unavailableText]}>
            {availabilityMessage}
          </Text>
        </View>

        {isAvailable && reportDate && (
          <View style={styles.reportInfoCard}>
            <Text style={styles.reportDateLabel}>Report Date:</Text>
            <Text style={styles.reportDateValue}>{formatDate(reportDate)}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={styles.loadingText}>Loading report data...</Text>
          </View>
        ) : (
          <>
            {isAvailable && reportData && (
              <>
                {/* Dealer Selection Dropdown */}
                {reportData.dealerVisits && reportData.dealerVisits.length > 0 && (
                  <View style={styles.dealerSelectorContainer}>
                    <Text style={styles.dealerSelectorLabel}>Select Dealer*</Text>
                    <CustomDropdown
                      options={reportData.dealerVisits.map(visit => ({
                        label: visit.dealerName || 'N/A',
                        value: visit.dealerName || 'N/A',
                      }))}
                      placeholder="Select a dealer"
                      onSelect={(option) => {
                        if (option && option.value) {
                          setSelectedDealer(option.value);
                        } else {
                          setSelectedDealer(null);
                        }
                      }}
                      selectedOption={selectedDealer ? {
                        label: selectedDealer,
                        value: selectedDealer,
                      } : null}
                    />
                  </View>
                )}

                {/* Preview version (visible on screen) */}
                <View style={styles.dataPreview}>
                  <Text style={styles.previewTitle}>Report Summary</Text>
                  
                  {/* Visit Count by Customer Type */}
                  {reportData.visitCountByCustomerType && (
                    <View style={styles.summarySection}>
                      <Text style={styles.sectionTitle}>Visit Count by Customer Type</Text>
                      {Object.entries(reportData.visitCountByCustomerType).map(([type, count]) => (
                        <View key={type} style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>{type}:</Text>
                          <Text style={styles.summaryValue}>{count}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* Dealer Visits Preview */}
                  {reportData.dealerVisits && reportData.dealerVisits.length > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={styles.sectionTitle}>Dealer Visits ({reportData.dealerVisits.length})</Text>
                      {reportData.dealerVisits.map((visit, index) => (
                        <View key={index} style={styles.visitPreviewCard}>
                          <Text style={styles.visitPreviewName}>{visit.dealerName || 'N/A'}</Text>
                          <Text style={styles.visitPreviewDetail}>Location: {visit.location || 'N/A'}</Text>
                          <Text style={styles.visitPreviewDetail}>
                            Time: {formatTime(visit.visitStartTime) || 'N/A'} - {formatTime(visit.visitEndTime) || 'N/A'}
                          </Text>
                          {visit.requirement && (
                            <Text style={styles.visitPreviewDetail}>Requirement: {visit.requirement}</Text>
                          )}
                          {visit.notes && (
                            <Text style={styles.visitPreviewDetail}>Notes: {visit.notes}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* Site Visits Preview */}
                  {reportData.siteVisits && reportData.siteVisits.length > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={styles.sectionTitle}>Site Visits ({reportData.siteVisits.length})</Text>
                      {reportData.siteVisits.map((visit, index) => (
                        <View key={index} style={styles.visitPreviewCard}>
                          <Text style={styles.visitPreviewName}>{visit.ownerName || 'N/A'}</Text>
                          <Text style={styles.visitPreviewDetail}>Mobile: {visit.ownerMobile || 'N/A'}</Text>
                          {visit.brandCurrentlyUsed && (
                            <Text style={styles.visitPreviewDetail}>Brand: {visit.brandCurrentlyUsed}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* Engineer/Architect/Contractor Visits Preview */}
                  {reportData.professionalVisits && reportData.professionalVisits.length > 0 && (
                    <View style={styles.summarySection}>
                      <Text style={styles.sectionTitle}>Engineer/Architect/Contractor Visits ({reportData.professionalVisits.length})</Text>
                      {reportData.professionalVisits.map((visit, index) => (
                        <View key={index} style={styles.visitPreviewCard}>
                          <Text style={styles.visitPreviewName}>{visit.name || 'N/A'}</Text>
                          <Text style={styles.visitPreviewDetail}>Mobile: {visit.mobile || 'N/A'}</Text>
                          {visit.giftGiven && (
                            <Text style={styles.visitPreviewDetail}>Gift: {visit.giftGiven}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

              </>
            )}

            {isAvailable && !reportData && !loading && (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyText}>No report data available for this date</Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.downloadButton, (!isAvailable || isGeneratingImage || !selectedDealer) && styles.downloadButtonDisabled]}
          onPress={generateMasterPDF}
          disabled={!isAvailable || loading || isGeneratingImage || !selectedDealer}
        >
          {isGeneratingImage ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>Generating PDF...</Text>
            </>
          ) : (
            <>
              <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
              <Text style={styles.downloadButtonText}>Download Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  availableCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  unavailableCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statusText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  availableText: {
    color: '#065F46',
  },
  unavailableText: {
    color: '#92400E',
  },
  reportInfoCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportDateLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  reportDateValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  dataPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  previewList: {
    maxHeight: 300,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  previewStoreName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  previewDate: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 12,
    width: 100,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completedBadge: {
    backgroundColor: '#D1FAE5',
  },
  ongoingBadge: {
    backgroundColor: '#DBEAFE',
  },
  assignedBadge: {
    backgroundColor: '#F3F4F6',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  moreItemsText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  downloadButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dealerSelectorContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dealerSelectorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  summarySection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  sectionDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  sectionDownloadText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
    marginLeft: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  visitPreviewCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  visitPreviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  downloadIcon: {
    padding: 4,
    marginLeft: 8,
  },
  visitPreviewDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});

// Styles for the report image template
const reportStyles = StyleSheet.create({
  container: {
    width: REPORT_WIDTH,
    backgroundColor: '#FFFFFF',
    padding: 20,
    minHeight: 400,
  },
  header: {
    borderBottomWidth: 3,
    borderBottomColor: '#6C63FF',
    paddingBottom: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6C63FF',
    marginBottom: 4,
  },
  generatedAt: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  employeeName: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  countCard: {
    width: '48%',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  countValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6C63FF',
    marginBottom: 4,
  },
  countLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  visitCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  visitRow: {
    flexDirection: 'row',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  visitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    width: 100,
  },
  visitValue: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  // Compact table styles for Site Visits and Engineer/Architect/Contractor Visits
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 10,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableCell: {
    fontSize: 9,
    color: '#1F2937',
    paddingHorizontal: 3,
    textAlign: 'left',
  },
});

export default DailyReportScreen;

