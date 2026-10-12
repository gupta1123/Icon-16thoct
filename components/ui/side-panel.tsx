"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/**
 * Right-hand side panel with the same look as `FormSheet` (detail-ui): tinted header, scrolling body,
 * pinned footer. Drop-in names for the old dialog parts so forms and viewers can move from centred
 * modals to panels without restructuring: SidePanel, SidePanelTrigger, SidePanelContent,
 * SidePanelHeader, SidePanelTitle, SidePanelDescription, SidePanelFooter, SidePanelClose.
 */
const SidePanel = Sheet
const SidePanelTrigger = SheetTrigger
const SidePanelClose = SheetClose
const SidePanelTitle = ({ className, ...props }: React.ComponentProps<typeof SheetTitle>) => (
  <SheetTitle className={cn("text-base font-semibold leading-tight tracking-tight", className)} {...props} />
)
const SidePanelDescription = ({ className, ...props }: React.ComponentProps<typeof SheetDescription>) => (
  <SheetDescription className={cn("mt-1 text-xs leading-snug text-muted-foreground", className)} {...props} />
)
const SidePanelHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <SheetHeader
    data-panel-part="header"
    className={cn("space-y-0 border-b bg-gradient-to-b from-primary/[0.06] to-transparent px-6 py-5 pr-12 text-left", className)}
    {...props}
  />
)
const SidePanelFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
  <SheetFooter
    data-panel-part="footer"
    className={cn("flex-row flex-wrap items-center justify-end gap-2 space-x-0 border-t bg-muted/30 px-6 py-3 sm:justify-end sm:space-x-0", className)}
    {...props}
  />
)

const SIZES = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "4xl": "sm:max-w-4xl",
} as const

interface SidePanelContentProps extends Omit<React.ComponentProps<typeof SheetContent>, "side"> {
  size?: keyof typeof SIZES
}

/** Header and footer children are pinned; everything else scrolls. Content with no SidePanelHeader scrolls edge to edge. */
function SidePanelContent({ size = "lg", className, children, ...props }: SidePanelContentProps) {
  const parts = React.Children.toArray(children)
  const isPart = (node: React.ReactNode, type: unknown) => React.isValidElement(node) && node.type === type
  const header = parts.filter(node => isPart(node, SidePanelHeader))
  const footer = parts.filter(node => isPart(node, SidePanelFooter))
  const body = parts.filter(node => !isPart(node, SidePanelHeader) && !isPart(node, SidePanelFooter))
  return (
    <SheetContent
      side="right"
      className={cn("detail-page flex w-full flex-col gap-0 p-0 text-sm", SIZES[size], className)}
      {...props}
    >
      {header}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", header.length > 0 && "space-y-4 px-6 py-5")}>{body}</div>
      {footer}
    </SheetContent>
  )
}

export {
  SidePanel,
  SidePanelTrigger,
  SidePanelClose,
  SidePanelContent,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelDescription,
  SidePanelFooter,
}
