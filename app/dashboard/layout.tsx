"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Define headings for each page
  const pageHeadings: Record<string, { heading: string; subheading: string }> = {
    "/dashboard": {
      heading: "Dashboard",
      subheading: "Welcome to your sales dashboard"
    },
    "/dashboard/visits": {
      heading: "Visits",
      subheading: "Track and manage all visits"
    },
    "/dashboard/expenses": {
      heading: "Expenses",
      subheading: "Track and manage all expenses"
    },
    "/dashboard/attendance": {
      heading: "Attendance",
      subheading: "Track and manage employee attendance"
    },
    "/dashboard/requirements": {
      heading: "Requirements",
      subheading: "Manage project and client requirements"
    },
    "/dashboard/assign-visits": {
      heading: "Assign Visits",
      subheading: "Plan visits for your team"
    },
    "/dashboard/complaints": {
      heading: "Complaints",
      subheading: "Track and manage customer complaints"
    },
    "/dashboard/pricing": {
      heading: "Pricing",
      subheading: "Manage product and service pricing"
    },
    "/dashboard/reports": {
      heading: "Reports",
      subheading: "View and generate reports"
    },
    "/dashboard/reports/monthly-target": {
      heading: "Monthly Target Report",
      subheading: "Track city-wise targets, achievements, and team member performance"
    },
    "/dashboard/customers": {
      heading: "Customers",
      subheading: "Manage your customer relationships"
    },
    "/dashboard/employees": {
      heading: "Employees",
      subheading: "Manage employee information"
    },
    "/dashboard/enquiries": {
      heading: "Enquiries",
      subheading: "Manage customer enquiries"
    },
    "/dashboard/settings": {
      heading: "Settings",
      subheading: "Manage your organization settings and preferences"
    },
    "/dashboard/live-locations": {
      heading: "Live Locations",
      subheading: "Track real-time employee locations"
    },
    "/dashboard/hr": {
      heading: "HR Dashboard",
      subheading: "Human Resources Management"
    },
    "/dashboard/hr/attendance": {
      heading: "HR Attendance",
      subheading: "Track and manage employee attendance records"
    },
    "/dashboard/hr/settings": {
      heading: "HR Settings",
      subheading: "Configure HR policies and settings"
    },
    "/dashboard/coordinator": {
      heading: "Coordinator Dashboard",
      subheading: "Team coordination and management"
    },
    "/dashboard/data-manager": {
      heading: "Data Manager Dashboard",
      subheading: "Data management and analytics with full access"
    },
    "/dashboard/regional-manager": {
      heading: "Regional Manager Dashboard",
      subheading: "Regional team management and oversight"
    }
  };

  // Function to determine page heading based on pathname
  const getPageHeading = () => {
    // Check for detail pages with dynamic routes
    if (pathname.match(/^\/dashboard\/visits\/\d+/)) {
      return {
        heading: "Visit Detail",
        subheading: "View and manage visit information"
      };
    }
    if (pathname.match(/^\/dashboard\/customers\/\d+/)) {
      return {
        heading: "Customer Detail",
        subheading: "View and manage customer information"
      };
    }
    if (pathname.match(/^\/dashboard\/employees\/\d+/)) {
      return {
        heading: "Employee Detail",
        subheading: "View and manage employee information"
      };
    }
    if (pathname.match(/^\/dashboard\/employee\/\d+/)) {
      return {
        heading: "Employee Detail",
        subheading: "View and manage employee information"
      };
    }
    
    // Return exact match or default
    return pageHeadings[pathname] || pageHeadings["/dashboard"];
  };

  const currentPage = getPageHeading();

  return (
    <DashboardLayout 
      heading={currentPage.heading} 
      subheading={currentPage.subheading}
    >
      {children}
    </DashboardLayout>
  );
}
