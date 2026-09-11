"use client";

import type { ReactNode } from "react";
import { ArrowLeft, PanelLeft, ShieldCheck, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopbarProps {
  heading?: string;
  subheading?: string;
  showSidebarTrigger?: boolean;
  onOpenSidebar?: () => void;
  onBack?: () => void;
  viewRole?: "admin" | "manager";
  actions?: ReactNode;
}

export default function Topbar({
  heading,
  subheading,
  showSidebarTrigger = false,
  onOpenSidebar,
  onBack,
  viewRole,
  actions,
}: TopbarProps) {
  return (
    <header className="icon-dashboard-header sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {onBack && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Back"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></Button>}
        {showSidebarTrigger && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenSidebar}
            className="hidden h-8 w-8 shrink-0 md:inline-flex"
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          {heading && (
            <h1 className="m-0 truncate text-base font-semibold leading-tight tracking-tight text-foreground" title={heading}>
              {heading}
            </h1>
          )}
          {subheading && (
            <p className="m-0 truncate text-xs font-normal leading-tight text-muted-foreground" title={subheading}>
              {subheading}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {viewRole && <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium leading-5 text-foreground" aria-label={`Current view: ${viewRole === "admin" ? "Admin" : "Regional manager"}`}>
          {viewRole === "admin" ? <ShieldCheck className="h-3 w-3" aria-hidden="true" /> : <UsersRound className="h-3 w-3" aria-hidden="true" />}
          {viewRole === "admin" ? "Admin view" : "Regional manager view"}
        </span>}
        <ThemeToggle />
      </div>
    </header>
  );
}
