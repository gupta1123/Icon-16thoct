"use client";

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
        <ThemeToggle />
      </div>
    </header>
  );
}
