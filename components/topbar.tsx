"use client";

import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopbarProps {
  heading?: string;
  subheading?: string;
  showSidebarTrigger?: boolean;
  onOpenSidebar?: () => void;
}

export default function Topbar({
  heading,
  subheading,
  showSidebarTrigger = false,
  onOpenSidebar,
}: TopbarProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-1.5 sm:border-0 sm:bg-transparent sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
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

        <div className="flex min-w-0 flex-col justify-center overflow-hidden m-0 p-0">
          {heading && (
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate m-0 p-0 leading-none">
              {heading}
            </h1>
          )}
          {subheading && (
            <p className="text-xs text-muted-foreground truncate m-0 p-0 leading-none mt-0.5">
              {subheading}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle />
      </div>
    </header>
  );
}
