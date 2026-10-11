'use client';

import * as React from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Shared building blocks for detail pages (hero, panels, tones, dense lists).
// Visual language ported from the German Steel retail detail page.

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';

export function Pill({ tone = 'neutral', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4', TONE_CLASSES[tone], className)}>{children}</span>;
}

/** Bordered panel. With a title it renders a compact header; without one, `description` + `action` form a slim toolbar. */
export function Section({ icon: Icon, title, description, action, bodyClassName, className, children }: { icon?: LucideIcon; title?: string; description?: React.ReactNode; action?: React.ReactNode; bodyClassName?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card', className)}>
      {(title || description || action) && (
        <header className={cn('flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4', title ? 'border-border/60 py-2' : 'bg-muted/30 py-2')}>
          <div className="flex min-w-0 items-center gap-2">
            {Icon && title && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              {title && <h3 className="truncate text-sm font-semibold leading-tight">{title}</h3>}
              {description && <p className={cn('truncate text-xs text-muted-foreground', title && 'mt-0.5')}>{description}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('flex-1', bodyClassName ?? 'p-4')}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, compact }: { icon?: LucideIcon; title: string; text?: string; action?: React.ReactNode; compact?: boolean }) {
  if (compact) return <p className="px-4 py-4 text-center text-xs text-muted-foreground">{title}</p>;
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon className="h-5 w-5" /></span>
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="max-w-xs text-xs text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return <div className={cn('min-w-0', className)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-5">{value || '—'}</dd></div>;
}

export function KpiCell({ icon: Icon, label, value, hint, action, tone }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; action?: React.ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div className="min-w-0 bg-card px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span>{action && <span className="ml-auto shrink-0">{action}</span>}</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className={cn('max-w-full truncate whitespace-nowrap text-base font-semibold tabular-nums leading-6', tone === 'danger' && 'text-red-600 dark:text-red-400', tone === 'warning' && 'text-amber-700 dark:text-amber-400')}>{value}</span>
        {hint && <span className="min-w-0 max-w-full truncate text-[11px] text-muted-foreground" title={typeof hint === 'string' ? hint : undefined}>{hint}</span>}
      </div>
    </div>
  );
}

export interface ActivityItem { key: string; date: string; dateLabel: string; icon: LucideIcon; title: string; meta: string; onClick?: () => void }

/** Group label row + dense icon rows, used for "Recent activity" style timelines. */
export function ActivityTimeline({ groups }: { groups: Array<{ label: string; items: ActivityItem[]; empty?: string }> }) {
  const groupLabel = 'flex items-center justify-between gap-2 bg-muted/30 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';
  return (
    <div>
      {groups.map((group) => (
        <div key={group.label}>
          <div className={groupLabel}><span>{group.label}</span></div>
          {group.items.length === 0 ? <EmptyState compact title={group.empty ?? 'Nothing here yet.'} /> : (
            <ul className="divide-y">
              {group.items.map((item) => {
                const Icon = item.icon;
                const body = (
                  <>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground" title={item.meta}>{item.meta}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{item.dateLabel}</span>
                  </>
                );
                return (
                  <li key={item.key}>
                    {item.onClick
                      ? <button type="button" onClick={item.onClick} className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">{body}</button>
                      : <div className="flex items-center gap-3 px-4 py-2">{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export interface HeroMeta { icon: LucideIcon; label: React.ReactNode; title?: string; href?: string }
export interface HeroNextStep { text: React.ReactNode; done: boolean; action?: React.ReactNode }

/** Detail-page header card: identity, meta line, actions, KPI strip and a next-step bar. */
export function DetailHero({ name, onBack, backLabel, badges, meta, actions, kpis, nextStep, avatarExtra }: { name: string; onBack: () => void; backLabel: string; badges?: React.ReactNode; meta?: HeroMeta[]; actions?: React.ReactNode; kpis?: React.ReactNode; nextStep?: HeroNextStep | null; avatarExtra?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Button size="icon" variant="ghost" className="-ml-2 h-8 w-8 shrink-0 text-muted-foreground" onClick={onBack} aria-label={backLabel}><ArrowLeft className="h-4 w-4" /></Button>
          <span className="relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground sm:flex" aria-hidden>{initials(name)}{avatarExtra}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-xl font-semibold leading-tight tracking-tight">{name}</h1>
              {badges}
            </div>
            {meta && meta.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meta.map((item, index) => {
                  const Icon = item.icon;
                  const inner = <><Icon className="h-3.5 w-3.5 shrink-0" />{item.label}</>;
                  return item.href
                    ? <a key={index} href={item.href} className="inline-flex items-center gap-1.5 hover:text-foreground" title={item.title}>{inner}</a>
                    : <span key={index} className="inline-flex items-center gap-1.5" title={item.title}>{inner}</span>;
                })}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pl-9 sm:pl-0">{actions}</div>}
      </div>
      {kpis && <div className="grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4">{kpis}</div>}
      {nextStep && (
        <div className={cn('flex flex-col gap-2 border-t px-4 py-2 sm:flex-row sm:items-center sm:justify-between', nextStep.done ? 'bg-emerald-50/60 dark:bg-emerald-500/5' : 'bg-amber-50/60 dark:bg-amber-500/5')}>
          <div className="flex min-w-0 items-center gap-2.5">
            {nextStep.done
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
            <div className="min-w-0 text-[13px]"><span className="font-semibold">{nextStep.done ? 'All good' : 'Next step'}</span><span className="text-muted-foreground"> · </span>{nextStep.text}</div>
          </div>
          {nextStep.action && <div className="shrink-0 pl-6 sm:pl-0 [&_button]:h-7">{nextStep.action}</div>}
        </div>
      )}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[190px] w-full rounded-2xl" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
    </div>
  );
}

export interface DetailTab { value: string; label: string; icon: LucideIcon; count?: number; content: React.ReactNode }

/** Underlined tab bar with icons and count pills. Controlled so the page can lazy-load per tab. */
export function DetailShell({ tabs, value, onValueChange }: { tabs: DetailTab[]; value: string; onValueChange: (value: string) => void }) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="space-y-3">
      <div className="relative border-b border-border">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group relative -mb-px shrink-0 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 opacity-70 group-data-[state=active]:opacity-100" aria-hidden />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="min-w-[1.25rem] rounded-full bg-muted px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums leading-none text-muted-foreground transition-colors group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0">{tab.content}</TabsContent>
      ))}
    </Tabs>
  );
}

/* ---------- Side-panel forms ---------- */

/** Right-hand side panel for create/edit forms: tinted icon header, scrolling grouped body, pinned footer. */
export function FormSheet({ open, onOpenChange, title, description, icon: Icon, wide, children, errors, footerNote, onSubmit, submitLabel, submitting, submitDisabled }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: React.ReactNode; description?: React.ReactNode; icon?: LucideIcon; wide?: boolean;
  children: React.ReactNode; errors?: string[]; footerNote?: React.ReactNode;
  onSubmit: () => void; submitLabel: React.ReactNode; submitting?: boolean; submitDisabled?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('detail-page flex w-full flex-col gap-0 p-0', wide ? 'sm:max-w-xl' : 'sm:max-w-lg')}>
        <SheetHeader className="space-y-0 border-b bg-gradient-to-b from-primary/[0.06] to-transparent px-6 py-5 text-left">
          <div className="flex items-start gap-3.5 pr-8">
            {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Icon className="h-[18px] w-[18px]" /></span>}
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold leading-tight tracking-tight">{title}</SheetTitle>
              {description ? <SheetDescription className="mt-1 text-xs leading-snug text-muted-foreground">{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
            </div>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {errors && errors.length > 0 && (
            <div role="alert" className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs text-destructive">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <div className="space-y-0.5">{errors.map((error) => <p key={error} className="font-medium">{error}</p>)}</div>
            </div>
          )}
          {children}
        </div>
        <SheetFooter className="flex-row items-center justify-between gap-3 space-x-0 border-t bg-muted/30 px-6 py-3 sm:justify-between sm:space-x-0">
          <p className="min-w-0 text-[11px] leading-snug text-muted-foreground">{footerNote}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" className="h-9" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" className="h-9 px-4" onClick={onSubmit} disabled={submitting || submitDisabled}>{submitting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}{submitLabel}</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Titled group of fields inside a FormSheet. */
export function FormGroup({ title, description, columns = 1, children }: { title?: string; description?: React.ReactNode; columns?: 1 | 2; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      {title && (
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn('grid gap-x-4 gap-y-4', columns === 2 && 'sm:grid-cols-2')}>{children}</div>
    </section>
  );
}

export function FormField({ label, required, hint, className, children }: { label: string; required?: boolean; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label className="text-xs font-medium">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Segmented single-choice control (e.g. priority). */
export function SegmentedChoice<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string; dot?: string }> }) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn('inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all', active ? 'bg-background text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}
          >
            {option.dot && <span className={cn('h-2 w-2 rounded-full', option.dot)} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
