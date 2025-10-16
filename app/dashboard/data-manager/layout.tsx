"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function DataManagerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // This layout will use the main DashboardLayout but can be customized for Data Manager if needed
  return (
    <DashboardLayout 
      heading={pathname === "/dashboard/data-manager" ? "Data Manager Dashboard" : "Data Management"} 
      subheading={pathname === "/dashboard/data-manager" ? "Data management and analytics with full access" : "Comprehensive data management tools"}
    >
      {children}
    </DashboardLayout>
  );
}
