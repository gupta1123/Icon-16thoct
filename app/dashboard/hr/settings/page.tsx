"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Calendar,
  BarChart3,
  Home,
  Users,
} from "lucide-react";

// Import all the setting components
import EmployeeSummary from "@/components/EmployeeSummary";
import Allowance from "@/components/Allowance";
import WorkingDays from "@/components/WorkingDays";
import DailyBreakdown from "@/components/DailyBreakdown";
import HomeLocationRequests from "@/components/HomeLocationRequests";
import TestTeamsPage from "@/app/dashboard/test-teams/page";

function HRSettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  
  // Valid tab values
  const validTabs = ['employeeSummary', 'allowance', 'working-days', 'home-location', 'dailyBreakdown', 'test-teams'];
  const initialTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'employeeSummary';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const tabScrollerRef = useRef<HTMLDivElement>(null);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;

    const frame = window.requestAnimationFrame(() => {
      const activeTrigger = scroller.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      if (!activeTrigger) return;

      const targetLeft = activeTrigger.offsetLeft
        - (scroller.clientWidth - activeTrigger.offsetWidth) / 2;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      scroller.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", value);
    router.push(`/dashboard/hr/settings?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4 py-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <div ref={tabScrollerRef} className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max justify-start gap-1 rounded-lg border border-border/70 bg-card p-1 shadow-sm">
            <TabsTrigger value="employeeSummary" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Employee Summary
            </TabsTrigger>
            <TabsTrigger value="allowance" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <CreditCard className="h-3.5 w-3.5" />
              Allowance
            </TabsTrigger>
            <TabsTrigger value="working-days" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Working Days
            </TabsTrigger>
            <TabsTrigger value="home-location" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Home className="h-3.5 w-3.5" />
              Home Location Updates
            </TabsTrigger>
            <TabsTrigger value="dailyBreakdown" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Daily Breakdown
            </TabsTrigger>
            <TabsTrigger value="test-teams" className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="h-3.5 w-3.5" />
              Teams
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="employeeSummary">
          <EmployeeSummary />
        </TabsContent>
        
        <TabsContent value="allowance">
          <Allowance />
        </TabsContent>
        
        <TabsContent value="working-days">
          <WorkingDays />
        </TabsContent>

        <TabsContent value="home-location">
          <HomeLocationRequests />
        </TabsContent>
        
        <TabsContent value="dailyBreakdown">
          <DailyBreakdown />
        </TabsContent>
        
        <TabsContent value="test-teams">
          <TestTeamsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function HRSettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HRSettingsContent />
    </Suspense>
  );
}
