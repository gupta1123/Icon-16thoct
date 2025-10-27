"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Calendar,
  Users,
  BarChart3,
  Home,
} from "lucide-react";

// Import all the setting components
import EmployeeSummary from "@/components/EmployeeSummary";
import Allowance from "@/components/Allowance";
import WorkingDays from "@/components/WorkingDays";
import Teams from "@/components/Teams";
import DailyBreakdown from "@/components/DailyBreakdown";
import HomeLocationRequests from "@/components/HomeLocationRequests";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("employeeSummary");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full gap-2">
          <TabsTrigger
            value="employeeSummary"
            className="flex items-center justify-center gap-2 whitespace-nowrap text-xs sm:text-sm"
            aria-label="Employee Summary"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Employee Summary</span>
          </TabsTrigger>
          <TabsTrigger
            value="allowance"
            className="flex items-center justify-center gap-2 whitespace-nowrap text-xs sm:text-sm"
            aria-label="Allowance"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Allowance</span>
          </TabsTrigger>
          <TabsTrigger
            value="working-days"
            className="flex items-center justify-center gap-2 whitespace-nowrap text-xs sm:text-sm"
            aria-label="Working Days"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Working Days</span>
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="flex items-center justify-center gap-2 whitespace-nowrap text-xs sm:text-sm"
            aria-label="Team"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
          <TabsTrigger
            value="home-location"
            className="flex items-center justify-center gap-2 whitespace-nowrap text-xs sm:text-sm"
            aria-label="Home Location Updates"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home Location Updates</span>
          </TabsTrigger>
          <TabsTrigger
            value="dailyBreakdown"
            className="flex items-center justify-center gap-2 whitespace-nowrap text-xs sm:text-sm"
            aria-label="Daily Breakdown"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Daily Breakdown</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="employeeSummary">
          <EmployeeSummary />
        </TabsContent>
        
        <TabsContent value="allowance">
          <Allowance />
        </TabsContent>
        
        <TabsContent value="working-days">
          <WorkingDays />
        </TabsContent>
        
        <TabsContent value="team">
          <Teams />
        </TabsContent>

        <TabsContent value="home-location">
          <HomeLocationRequests />
        </TabsContent>
        
        <TabsContent value="dailyBreakdown">
          <DailyBreakdown />
        </TabsContent>
      </Tabs>
    </div>
  );
}
