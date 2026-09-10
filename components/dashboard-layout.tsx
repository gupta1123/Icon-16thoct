'use client';

import { Button } from "@/components/ui/button";
import { 
  Home, 
  Users, 
  Settings,
  LogOut,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle,
  Tag,
  ThumbsUp,
  ClipboardList,
  BarChart,
  User,
  Phone,
  PanelLeftClose,
  PanelLeftOpen,
  CircleUser,
  ChevronDown,
  ChevronRight,
  Building,
  ShoppingCart,
  UserCheck,
  FileSearch,
  TrendingUp,
  Target,
  MapPin
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Topbar from "@/components/topbar";
import { DashboardHeaderOverrideProvider, type DashboardHeaderConfig } from "@/components/dashboard-header-context";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import {
  extractAuthorityRoles,
  hasAnyRole,
  normalizeRoleValue,
} from "@/lib/role-utils";

interface DashboardLayoutProps {
  children: ReactNode;
  heading?: string;
  subheading?: string;
}

// Define sidebar categories and items
const allSidebarCategories = [
  {
    name: "Customers",
    icon: Users,
    items: [
      { name: "Customers", href: "/dashboard/customers", icon: Users },
      { name: "Dealer Survey", href: "/dashboard/dealer-survey", icon: FileSearch },
      { name: "Complaints", href: "/dashboard/complaints", icon: ThumbsUp },
    ]
  },
  {
    name: "Sales",
    icon: Building,
    items: [
      { name: "Visits", href: "/dashboard/visits", icon: Calendar },
      { name: "Assign Visits", href: "/dashboard/assign-visits", icon: MapPin },
      { name: "Requirements", href: "/dashboard/requirements", icon: ClipboardList },
      { name: "Pricing", href: "/dashboard/pricing", icon: Tag },
    ]
  },
  {
    name: "Employees",
    icon: UserCheck,
    items: [
      { name: "Employees", href: "/dashboard/employees", icon: User },
      { name: "Attendance", href: "/dashboard/attendance", icon: CheckCircle },
      { name: "Expenses", href: "/dashboard/expenses", icon: DollarSign },
    ]
  },
  {
    name: "Reports",
    icon: TrendingUp,
    items: [
      { name: "Approvals", href: "/dashboard/approvals", icon: FileText },
      { name: "Reports", href: "/dashboard/reports", icon: BarChart },
      { name: "Documents", href: "/dashboard/documents", icon: FileText },
    ]
  }
];

// Manager allowed pages
const managerAllowedPages = [
  "/dashboard/customers",
  "/dashboard/dealer-survey",
  "/dashboard/complaints",
  "/dashboard/visits",
  "/dashboard/assign-visits",
  "/dashboard/requirements",
  "/dashboard/pricing",
  "/dashboard/expenses",
  "/dashboard/approvals"
];

// HR allowed pages - ONLY HR-specific pages
const hrAllowedPages = [
  "/dashboard/hr/attendance",
  "/dashboard/hr/settings"
];

// Coordinator allowed pages - All except HR functions and Attendance, restricted to team
const coordinatorAllowedPages = [
  "/dashboard/customers",
  "/dashboard/dealer-survey",
  "/dashboard/complaints",
  "/dashboard/visits",
  "/dashboard/assign-visits",
  "/dashboard/requirements",
  "/dashboard/pricing",
  "/dashboard/employees",
  "/dashboard/expenses",
  "/dashboard/approvals",
  "/dashboard/reports",
  "/dashboard/live-locations"
];

// Data Manager allowed pages - Full access except HR functions
const dataManagerAllowedPages = [
  "/dashboard/customers",
  "/dashboard/dealer-survey",
  "/dashboard/complaints",
  "/dashboard/visits",
  "/dashboard/assign-visits",
  "/dashboard/requirements",
  "/dashboard/pricing",
  "/dashboard/employees",
  "/dashboard/attendance",
  "/dashboard/expenses",
  "/dashboard/approvals",
  "/dashboard/reports",
  "/dashboard/live-locations",
  "/dashboard/settings"
];

// Function to filter sidebar categories based on user role
const getFilteredSidebarCategories = (
  userRole: string | null,
  currentUser: { authorities?: { authority: string }[] } | null
) => {
  const normalizedRole = normalizeRoleValue(userRole);
  const authorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);

  const isManager = hasAnyRole(normalizedRole, authorityRoles, [
    "MANAGER",
    "OFFICE_MANAGER",
    "REGIONAL_MANAGER",
    "AVP",
  ]);
  const isHR = hasAnyRole(normalizedRole, authorityRoles, ["HR"]);
  const isCoordinator = hasAnyRole(normalizedRole, authorityRoles, [
    "COORDINATOR",
  ]);
  const isDataManager = hasAnyRole(normalizedRole, authorityRoles, [
    "DATA_MANAGER",
  ]);
  
  if (isHR) {
    // For HR, show ONLY HR-specific pages
    return [
      {
        name: "HR Management",
        icon: UserCheck,
        items: [
          { name: "HR Attendance", href: "/dashboard/hr/attendance", icon: CheckCircle },
          { name: "HR Settings", href: "/dashboard/hr/settings", icon: Settings },
        ]
      }
    ];
  }
  
  if (isDataManager) {
    // For Data Managers, show all categories except HR functions
    return allSidebarCategories.map(category => ({
      ...category,
      items: category.items.filter(item => dataManagerAllowedPages.includes(item.href))
    })).filter(category => category.items.length > 0); // Remove empty categories
  }
  
  if (isCoordinator) {
    // For Coordinators, show all categories except HR functions, restricted to team
    return allSidebarCategories.map(category => ({
      ...category,
      items: category.items.filter(item => coordinatorAllowedPages.includes(item.href))
    })).filter(category => category.items.length > 0); // Remove empty categories
  }
  
  if (isManager) {
    // For managers, filter categories to only show allowed pages
    return allSidebarCategories.map(category => ({
      ...category,
      items: category.items.filter(item => managerAllowedPages.includes(item.href))
    })).filter(category => category.items.length > 0); // Remove empty categories
  }
  
  // For admin and other roles, show all categories
  return allSidebarCategories;
};

export default function DashboardLayout({ 
  children, 
  heading,
  subheading
}: DashboardLayoutProps) {
  const { userRole, currentUser } = useAuth();
  const pathname = usePathname();
  const compactSettingsLayout = pathname === "/dashboard/settings";
  const employeeCreateLayout = pathname === "/dashboard/employees/add";
  const employeeEditLayout = /^\/dashboard\/employees\/\d+\/edit$/.test(pathname);
  const employeeDetailLayout = /^\/dashboard\/employee\/\d+$/.test(pathname);
  const surveyDetailLayout = /^\/dashboard\/dealer-survey\/[^/]+$/.test(pathname);
  const usesHeaderOverride = pathname === "/dashboard" || employeeCreateLayout || employeeEditLayout || employeeDetailLayout || surveyDetailLayout;
  const compactPageLayout = pathname === "/dashboard" || pathname === "/dashboard/reports" || /^\/dashboard\/visits\/[^/]+$/.test(pathname) || compactSettingsLayout || employeeCreateLayout || employeeEditLayout || employeeDetailLayout || surveyDetailLayout;
  const router = useRouter();
  const { logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardHeader, setDashboardHeader] = useState<DashboardHeaderConfig | null>(null);

  const normalizedUserRole = normalizeRoleValue(userRole);
  const authorityRoles = extractAuthorityRoles(currentUser?.authorities ?? null);
  
  // Get filtered sidebar categories based on user role
  const sidebarCategories = getFilteredSidebarCategories(userRole, currentUser);
  
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    sidebarCategories.forEach(category => {
      initialState[category.name] = true;
    });
    return initialState;
  });
  
  // Check if user is a Field Officer and redirect them
  const isFieldOfficerUser = hasAnyRole(normalizedUserRole, authorityRoles, ['FIELD_OFFICER']);
  
  if (isFieldOfficerUser) {
    // Field Officers are not allowed to access this system
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
              <UserCheck className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Restricted
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Field Officers cannot access this management system. Please contact your administrator for assistance.
            </p>
            <Button 
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="w-full"
            >
              Return to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Role hierarchy: Admin > Data Manager > Coordinator > AVP > Regional Manager > Field Officer > HR
  // HR is separate from the main hierarchy as it's a specialized role
  const getDisplayRole = () => {
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['ADMIN'])) {
      return 'Admin';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['DATA_MANAGER'])) {
      return 'Data Manager';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['COORDINATOR'])) {
      return 'Coordinator';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['AVP'])) {
      return 'AVP';
    }
    if (
      hasAnyRole(normalizedUserRole, authorityRoles, [
        'MANAGER',
        'OFFICE_MANAGER',
        'REGIONAL_MANAGER',
      ])
    ) {
      return 'Regional Manager';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['FIELD_OFFICER'])) {
      return 'Field Officer';
    }
    if (hasAnyRole(normalizedUserRole, authorityRoles, ['HR'])) {
      return 'HR';
    }
    return 'User';
  };

  // Check user roles based on hierarchy: Admin > Data Manager > Coordinator > Regional Manager > Field Officer > HR
  const isAdmin = hasAnyRole(normalizedUserRole, authorityRoles, ['ADMIN']);
  const isDataManager = hasAnyRole(normalizedUserRole, authorityRoles, ['DATA_MANAGER']);
  const isCoordinator = hasAnyRole(normalizedUserRole, authorityRoles, ['COORDINATOR']);
  const isAvp = hasAnyRole(normalizedUserRole, authorityRoles, ['AVP']);
  const isManager =
    isAvp ||
    hasAnyRole(normalizedUserRole, authorityRoles, [
      'MANAGER',
      'OFFICE_MANAGER',
      'REGIONAL_MANAGER',
    ]);
  const isFieldOfficer = hasAnyRole(normalizedUserRole, authorityRoles, ['FIELD_OFFICER']);
  const isHR = hasAnyRole(normalizedUserRole, authorityRoles, ['HR']);

  useEffect(() => {
    const savedState = window.localStorage.getItem("icon-sidebar-collapsed");
    if (savedState) {
      setSidebarCollapsed(savedState === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("icon-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const toggleCategory = (categoryName: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === path;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if logout API fails
      router.push("/login");
    }
  };

  const canSeeSettings = isAdmin || isDataManager;

  return (
    <div
      className={`min-h-screen w-full grid ${sidebarCollapsed ? "md:grid-cols-[64px_1fr]" : "md:grid-cols-[184px_1fr] lg:grid-cols-[200px_1fr]"}`}
    >
      {/* Daily Pricing Checker removed; pricing modal handled in Dashboard only for Admin/Data Manager */}
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav sidebarCategories={sidebarCategories} isAdmin={isAdmin || false} isManager={isManager || false} isHR={isHR || false} isCoordinator={isCoordinator || false} isDataManager={isDataManager || false} />

      {/* Desktop sidebar - Gajkesari-style compact collapsible */}
      <div className="hidden border-r bg-background md:block sticky top-0 h-screen">
        <div className="flex h-full max-h-screen flex-col">
          <div className={`flex h-14 items-center border-b ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-2.5"}`}>
            {!sidebarCollapsed && (
              <Link href="/dashboard" className="flex min-w-0 items-center gap-2 font-semibold">
                <Home className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-bold">Icon Steel</span>
              </Link>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => {
                setUserMenuOpen(false);
                setSidebarCollapsed((collapsed) => !collapsed);
              }}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="grid gap-1 px-1.5">
              {/* Dashboard link (no category) */}
              <Link
                href="/dashboard"
                title="Dashboard"
                className={`flex items-center rounded-md py-1.5 transition-all text-xs font-medium ${
                  sidebarCollapsed ? "justify-center px-2" : "gap-2 px-2.5"
                } ${
                  pathname === "/dashboard"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <Home className="h-3.5 w-3.5 shrink-0" />
                {!sidebarCollapsed && <span className="text-xs">Dashboard</span>}
              </Link>
              
              {/* Settings link - show for Admins and Data Managers only (hierarchy-based access) */}
              {canSeeSettings && (
                <Link
                  href="/dashboard/settings"
                  title="Settings"
                  className={`flex items-center rounded-md py-1.5 transition-all text-xs font-medium ${
                    sidebarCollapsed ? "justify-center px-2" : "gap-2 px-2.5"
                  } ${
                    pathname.startsWith("/dashboard/settings")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" />
                  {!sidebarCollapsed && <span className="text-xs">Settings</span>}
                </Link>
              )}
              
              {/* Categories */}
              {sidebarCategories.map((category) => {
                const CategoryIcon = category.icon;
                const isOpen = openCategories[category.name];

                if (sidebarCollapsed) {
                  return (
                    <div key={category.name} className="mt-1 border-t pt-1">
                      {category.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            title={item.name}
                            aria-label={item.name}
                            className={`flex items-center justify-center rounded-md px-2 py-1.5 text-xs transition-all ${
                              isActive(item.href)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            }`}
                          >
                            <ItemIcon className="h-3.5 w-3.5" />
                          </Link>
                        );
                      })}
                    </div>
                  );
                }
                
                return (
                  <div key={category.name} className="flex flex-col">
                    <Button
                      variant="ghost"
                      className="justify-between px-2.5 py-1.5 h-auto text-xs font-medium hover:bg-muted/60"
                      onClick={() => toggleCategory(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{category.name}</span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    
                    {isOpen && (
                      <div className="space-y-0.5 py-1 pl-2">
                        {category.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-all ${
                                isActive(item.href)
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              }`}
                            >
                              <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs">{item.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
          <div className="relative border-t p-1.5">
            <Button
              variant="ghost"
              className={`h-8 w-full gap-1.5 ${sidebarCollapsed ? "justify-center px-0" : "justify-start px-1.5"}`}
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title={currentUser?.username || "User"}
            >
              <CircleUser className="h-3.5 w-3.5 shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">{currentUser?.username || "User"}</span>
                  <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    {getDisplayRole()}
                  </span>
                </div>
              )}
            </Button>

            {userMenuOpen && (
              <div
                role="menu"
                className={`absolute bottom-[calc(100%-0.5rem)] z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${
                  sidebarCollapsed ? "left-2 w-48" : "left-4 right-4"
                }`}
              >
                {canSeeSettings && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push("/dashboard/settings");
                    }}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                )}
                {canSeeSettings && <div className="-mx-1 my-1 h-px bg-border" />}
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-col">
        {/* Topbar */}
        <Topbar
          heading={usesHeaderOverride ? dashboardHeader?.heading ?? heading : heading}
          subheading={usesHeaderOverride ? dashboardHeader?.subheading ?? subheading : subheading}
          onBack={usesHeaderOverride ? dashboardHeader?.onBack : undefined}
          viewRole={isAdmin ? "admin" : isManager ? "manager" : undefined}
        />
        
        {/* Page content */}
        <main className={`flex flex-1 flex-col gap-4 ${compactPageLayout ? "p-3 sm:p-4" : "p-4"} pb-24 md:pb-6 ${compactPageLayout ? "" : "lg:gap-6 lg:p-6"}`}>
          <DashboardHeaderOverrideProvider setHeader={setDashboardHeader}>{children}</DashboardHeaderOverrideProvider>
        </main>
      </div>
    </div>
  );
}
