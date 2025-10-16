"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import UserNav from "@/components/user-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Heading, Text } from "@/components/ui/typography";

interface TopbarProps {
  heading?: string;
  subheading?: string;
}

export default function Topbar({ heading, subheading }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <div className="flex-1 min-w-0">
        {heading && (
          <Heading as="h1" size="xl" className="truncate" weight="semibold">
            {heading}
          </Heading>
        )}
        {subheading && (
          <Text as="p" size="sm" tone="muted" className="truncate">
            {subheading}
          </Text>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <form className="hidden md:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
            />
          </div>
        </form>
        
        <ThemeToggle />
      </div>
    </header>
  );
}
