"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, ChevronRight, Clock, ShieldAlert, UserCheck, UserX, Users, CalendarCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { API, type AttendanceLogItem } from "@/lib/api";
import { EmptyState, KpiCell, Pill, Section, initials, type Tone } from "@/components/detail-ui";
import { Skeleton } from "@/components/ui/skeleton";

const PRESENT_STATUSES = ["PRESENT", "FULL_DAY"];
const PARTIAL_STATUSES = ["HALF_DAY", "LATE"];

const statusMeta = (status: string): { label: string; tone: Tone } => {
  const key = (status || "").toUpperCase();
  if (PRESENT_STATUSES.includes(key)) return { label: "Present", tone: "success" };
  if (key === "HALF_DAY") return { label: "Half day", tone: "warning" };
  if (key === "LATE") return { label: "Late", tone: "warning" };
  if (key === "ABSENT") return { label: "Absent", tone: "danger" };
  return { label: status ? status.replace(/_/g, " ").toLowerCase() : "Unknown", tone: "neutral" };
};

const SHORTCUTS: Array<{ title: string; description: string; href: string; icon: LucideIcon }> = [
  { title: "Attendance records", description: "Monthly attendance for every employee", href: "/dashboard/hr/attendance", icon: CalendarCheck },
  { title: "HR settings", description: "Employee summary, allowance, working days, home location updates", href: "/dashboard/hr/settings", icon: SlidersHorizontal },
];

export default function HRDashboard() {
  const { userRole, currentUser, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceLogItem[]>([]);

  const isHR = userRole === "HR" || currentUser?.authorities?.some((auth: { authority: string }) => auth.authority === "ROLE_HR");

  useEffect(() => {
    const loadHRData = async () => {
      if (!isHR || !token) return;
      try {
        setIsLoading(true);
        setError(null);
        const today = format(new Date(), "yyyy-MM-dd");
        const [employees, attendanceToday] = await Promise.all([API.getAllEmployees(), API.getAttendanceByDate(today)]);
        setEmployeeCount(employees?.length || 0);
        setAttendance(attendanceToday || []);
      } catch (loadError) {
        console.error("Error loading HR data:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Could not load today's attendance.");
      } finally {
        setIsLoading(false);
      }
    };
    loadHRData();
  }, [isHR, token]);

  const counts = useMemo(() => {
    const present = attendance.filter((row) => PRESENT_STATUSES.includes((row.attendanceStatus || "").toUpperCase())).length;
    const partial = attendance.filter((row) => PARTIAL_STATUSES.includes((row.attendanceStatus || "").toUpperCase())).length;
    const absent = attendance.filter((row) => (row.attendanceStatus || "").toUpperCase() === "ABSENT").length;
    return { present, partial, absent };
  }, [attendance]);

  const recentRows = useMemo(
    () => [...attendance].sort((a, b) => `${b.checkinDate} ${b.checkinTime}`.localeCompare(`${a.checkinDate} ${a.checkinTime}`)).slice(0, 8),
    [attendance]
  );

  if (!isHR) {
    return (
      <Section>
        <EmptyState icon={ShieldAlert} title="Access denied" text="You don't have permission to access HR features." />
      </Section>
    );
  }

  const presentShare = employeeCount > 0 ? `${Math.round((counts.present / employeeCount) * 100)}% of employees` : undefined;

  return (
    <div className="icon-dashboard space-y-3">
      {/* KPI strip */}
      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-card px-4 py-2.5"><Skeleton className="h-3 w-20" /><Skeleton className="mt-2 h-5 w-12" /></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            <KpiCell icon={Users} label="Employees" value={employeeCount} hint="on the roster" />
            <KpiCell icon={UserCheck} label="Present today" value={counts.present} hint={presentShare} />
            <KpiCell icon={Clock} label="Half day / late" value={counts.partial} tone={counts.partial > 0 ? "warning" : undefined} />
            <KpiCell icon={UserX} label="Absent today" value={counts.absent} tone={counts.absent > 0 ? "danger" : undefined} />
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Today's attendance */}
        <Section
          icon={CheckCircle2}
          title="Today's attendance"
          description={format(new Date(), "EEEE, d MMM yyyy")}
          bodyClassName="p-0"
          action={<Link href="/dashboard/hr/attendance" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-8 w-full" />)}
            </div>
          ) : error ? (
            <EmptyState icon={AlertCircle} title="Could not load attendance" text={error} />
          ) : recentRows.length === 0 ? (
            <EmptyState icon={Clock} title="No attendance marked yet today" text="Check-ins appear here as employees mark attendance." />
          ) : (
            <ul className="m-0 list-none divide-y divide-border/60 [&>li]:mt-0">
              {recentRows.map((row) => {
                const meta = statusMeta(row.attendanceStatus);
                return (
                  <li key={row.id ?? `${row.employeeId}-${row.checkinTime}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{initials(row.employeeName || "")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5">{row.employeeName || `Employee ${row.employeeId}`}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.checkinTime ? `In ${row.checkinTime}` : "No check-in time"}
                        {row.checkoutTime ? ` · Out ${row.checkoutTime}` : ""}
                      </p>
                    </div>
                    <Pill tone={meta.tone}>{meta.label}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* Shortcuts */}
        <Section title="HR shortcuts" bodyClassName="p-0">
          <ul className="m-0 list-none divide-y divide-border/60 [&>li]:mt-0">
            {SHORTCUTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-5">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </div>
  );
}
