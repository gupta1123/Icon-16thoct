'use client';

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  PanelLeft,
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
import { ReactNode, useState } from "react";
import Topbar from "@/components/topbar";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import DailyPricingChecker from "@/components/DailyPricingChecker";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import {
  extractAuthorityRoles,
  hasAnyRole,
  normalizeRoleValue,
} from "@/lib/role-utils";

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

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
      { name: "Enquiries", href: "/dashboard/enquiries", icon: Phone },
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
    ]
  }
];

// Manager allowed pages
const managerAllowedPages = [
  "/dashboard/customers",
  "/dashboard/enquiries", 
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
  "/dashboard/enquiries", 
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
  "/dashboard/enquiries", 
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
  const router = useRouter();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Role hierarchy: Admin > Data Manager > Coordinator > Regional Manager > Field Officer > HR
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
  const isManager = hasAnyRole(normalizedUserRole, authorityRoles, [
    'MANAGER',
    'OFFICE_MANAGER',
    'REGIONAL_MANAGER',
  ]);
  const isFieldOfficer = hasAnyRole(normalizedUserRole, authorityRoles, ['FIELD_OFFICER']);
  const isHR = hasAnyRole(normalizedUserRole, authorityRoles, ['HR']);

  const toggleCategory = (categoryName: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const isActive = (path: string) => {
    return pathname === path;
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

  return (
    <div className="min-h-screen w-full grid md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
      {/* Daily Pricing Checker - Global Modal */}
      <DailyPricingChecker />
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav sidebarCategories={sidebarCategories} isAdmin={isAdmin || false} isManager={isManager || false} isHR={isHR || false} isCoordinator={isCoordinator || false} isDataManager={isDataManager || false} />
      {/* Mobile sidebar trigger - hidden since we use bottom nav */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 hidden md:hidden absolute top-4 left-4 z-50"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col w-64 z-50">
          <nav className="grid gap-2 text-base font-medium pt-4 px-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-lg font-semibold px-3 py-2"
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-5 w-5" />
              <span className="font-bold">Icon Steel</span>
            </Link>
          </nav>
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="grid gap-1 px-2">
              {/* Dashboard link */}
              <Link
                href="/dashboard"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                  pathname === "/dashboard"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4" />
                <span className="text-sm">Dashboard</span>
              </Link>
              
              {/* Settings link - show for Admins and Data Managers only (hierarchy-based access) */}
              {(isAdmin || isDataManager) && (
                <Link
                  href="/dashboard/settings"
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                    pathname.startsWith("/dashboard/settings")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">Settings</span>
                </Link>
              )}
              
              {sidebarCategories.map((category) => {
                const CategoryIcon = category.icon;
                const isOpen = openCategories[category.name];
                
                return (
                  <div key={category.name} className="flex flex-col">
                    <Button
                      variant="ghost"
                      className="justify-between px-3 py-2 h-auto"
                      onClick={() => toggleCategory(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {isOpen && (
                      <div className="pl-4 py-1 space-y-1">
                        {category.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                                isActive(item.href)
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                              <span className="text-sm">{item.name}</span>
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
          <div className="mt-auto pt-2 border-t bg-muted/30">
            <div className="flex items-center gap-2 px-2 py-1">
              {/* Avatar with initials */}
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-semibold text-xs shadow-sm">
                {currentUser?.username ? getInitials(currentUser.username) : 'U'}
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">
                  {currentUser?.username || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {getDisplayRole()}
                </div>
              </div>
              
              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden border-r bg-background md:block sticky top-0 h-screen">
        <div className="flex h-full max-h-screen flex-col">
          <div className="flex h-14 items-center border-b px-4 lg:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Home className="h-5 w-5" />
              <span className="font-bold">Icon Steel</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="grid gap-1 px-2">
              {/* Dashboard link (no category) */}
              <Link
                href="/dashboard"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                  pathname === "/dashboard"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4" />
                <span className="text-sm">Dashboard</span>
              </Link>
              
              {/* Settings link - show for Admins and Data Managers only (hierarchy-based access) */}
              {(isAdmin || isDataManager) && (
                <Link
                  href="/dashboard/settings"
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                    pathname.startsWith("/dashboard/settings")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">Settings</span>
                </Link>
              )}
              
              {/* Categories */}
              {sidebarCategories.map((category) => {
                const CategoryIcon = category.icon;
                const isOpen = openCategories[category.name];
                
                return (
                  <div key={category.name} className="flex flex-col">
                    <Button
                      variant="ghost"
                      className="justify-between px-3 py-2 h-auto"
                      onClick={() => toggleCategory(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {isOpen && (
                      <div className="pl-4 py-1 space-y-1">
                        {category.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.name}
                              href={item.href}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                                isActive(item.href)
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              <ItemIcon className="h-4 w-4" />
                              <span className="text-sm">{item.name}</span>
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
          <div className="p-2 border-t bg-muted/30">
            <div className="flex items-center gap-2">
              {/* Avatar with initials */}
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-semibold text-xs shadow-sm">
                {currentUser?.username ? getInitials(currentUser.username) : 'U'}
              </div>
              
              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">
                  {currentUser?.username || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {getDisplayRole()}
                </div>
              </div>
              
              {/* Logout button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col">
        {/* Topbar */}
        <Topbar heading={heading} subheading={subheading} />
        
        {/* Page content */}
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
