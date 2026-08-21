import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Handshake,
  Home,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Mail,
  Megaphone,
  MapPinned,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Warehouse,
} from "lucide-react";
import type { Permission } from "@/types/crm";

export interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permissions: Permission[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const notificationAccessPermissions: Permission[] = [
  "tasks.read",
  "leads.readAssigned",
  "leads.readAll",
  "deals.read",
  "rentals.read",
  "activities.read",
  "reports.viewFinancial",
];

export const documentAccessPermissions: Permission[] = [
  "leads.readAssigned",
  "leads.readAll",
  "clients.read",
  "deals.read",
  "properties.read",
  "units.read",
  "rentals.read",
  "development.read",
  "marketing.read",
  "offerings.read",
  "tasks.read",
  "activities.read",
  "reports.viewFinancial",
  "auditLogs.read",
];

export const emailSettingsAccessPermissions: Permission[] = [
  "leads.readAssigned",
  "leads.readAll",
  "clients.read",
  "deals.read",
  "properties.read",
  "units.read",
  "offerings.read",
  "tasks.read",
  "activities.read",
  "users.manage",
];

export const aiGuideAccessPermissions: Permission[] = [
  "dashboard.viewExecutive",
  "leads.create",
  "leads.readAssigned",
  "leads.readAll",
  "clients.read",
  "deals.read",
  "properties.read",
  "units.read",
  "rentals.read",
  "development.read",
  "marketing.read",
  "offerings.read",
  "tasks.read",
  "activities.read",
  "reports.viewFinancial",
  "users.manage",
  "pos.read",
];

export const reportsAccessPermissions: Permission[] = Array.from(new Set([
  ...aiGuideAccessPermissions,
  "roles.manage" as Permission,
  "auditLogs.read" as Permission,
]));

export interface RouteAccessRule {
  exact?: string;
  pattern?: RegExp;
  permissions: Permission[];
}

export const routeAccessRules: RouteAccessRule[] = [
  { exact: "/dashboard", permissions: ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll", "inventory.read"] },
  { exact: "/ai-guide", permissions: aiGuideAccessPermissions },
  { exact: "/notifications", permissions: notificationAccessPermissions },

  { exact: "/leads/new", permissions: ["leads.create"] },
  { exact: "/leads/map", permissions: ["leads.readAssigned", "leads.readAll"] },
  { pattern: /^\/leads\/[^/]+\/edit$/, permissions: ["leads.updateAssigned", "leads.assign"] },
  { pattern: /^\/leads(\/[^/]+)?$/, permissions: ["leads.readAssigned", "leads.readAll"] },

  { exact: "/clients/new", permissions: ["clients.create"] },
  { pattern: /^\/clients\/[^/]+\/edit$/, permissions: ["clients.update"] },
  { pattern: /^\/clients(\/[^/]+)?$/, permissions: ["clients.read"] },

  { exact: "/deals/new", permissions: ["deals.create"] },
  { pattern: /^\/deals\/[^/]+\/edit$/, permissions: ["deals.update"] },
  { pattern: /^\/deals(\/[^/]+)?$/, permissions: ["deals.read"] },

  { exact: "/properties/new", permissions: ["properties.create"] },
  { pattern: /^\/properties\/[^/]+\/edit$/, permissions: ["properties.update"] },
  { pattern: /^\/properties\/[^/]+\/units$/, permissions: ["units.read"] },
  { pattern: /^\/properties(\/[^/]+)?$/, permissions: ["properties.read"] },

  { exact: "/units/new", permissions: ["units.create"] },
  { pattern: /^\/units\/[^/]+\/edit$/, permissions: ["units.update"] },
  { pattern: /^\/units(\/[^/]+)?$/, permissions: ["units.read"] },

  { exact: "/offerings/new", permissions: ["offerings.create"] },
  { pattern: /^\/offerings\/[^/]+\/edit$/, permissions: ["offerings.update"] },
  { pattern: /^\/offerings(\/[^/]+)?$/, permissions: ["offerings.read"] },
  { pattern: /^\/inventory(\/.*)?$/, permissions: ["inventory.read"] },
  { pattern: /^\/pos(\/.*)?$/, permissions: ["pos.read"] },

  { exact: "/rentals/new", permissions: ["rentals.create"] },
  { pattern: /^\/rentals\/[^/]+\/edit$/, permissions: ["rentals.update"] },
  { pattern: /^\/rentals(\/[^/]+)?$/, permissions: ["rentals.read"] },

  { exact: "/development/new", permissions: ["development.create"] },
  { pattern: /^\/development\/[^/]+\/edit$/, permissions: ["development.update"] },
  { pattern: /^\/development(\/[^/]+)?$/, permissions: ["development.read"] },

  { exact: "/marketing/new", permissions: ["marketing.create"] },
  { pattern: /^\/marketing\/[^/]+\/edit$/, permissions: ["marketing.update"] },
  { pattern: /^\/marketing(\/[^/]+)?$/, permissions: ["marketing.read"] },

  { exact: "/tasks/new", permissions: ["tasks.create"] },
  { pattern: /^\/tasks\/[^/]+\/edit$/, permissions: ["tasks.update"] },
  { pattern: /^\/tasks(\/[^/]+)?$/, permissions: ["tasks.read"] },

  { exact: "/activities/new", permissions: ["activities.create"] },
  { pattern: /^\/activities\/[^/]+\/edit$/, permissions: ["activities.create"] },
  { pattern: /^\/activities(\/[^/]+)?$/, permissions: ["activities.read"] },

  { exact: "/documents", permissions: documentAccessPermissions },
  { exact: "/reports", permissions: reportsAccessPermissions },
  { pattern: /^\/finance(\/.*)?$/, permissions: ["reports.viewFinancial"] },

  { exact: "/settings/organization", permissions: ["users.manage", "roles.manage"] },
  { exact: "/settings/calendar", permissions: ["tasks.read", "tasks.create"] },
  { exact: "/settings/email", permissions: emailSettingsAccessPermissions },
  { exact: "/settings/branches", permissions: ["users.manage"] },
  { exact: "/settings/users", permissions: ["users.manage"] },
  { exact: "/settings/roles", permissions: ["roles.manage"] },
  { exact: "/settings/audit-logs", permissions: ["auditLogs.read"] },
];

export function accessRuleForPath(pathname: string) {
  return routeAccessRules.find((rule) => rule.exact === pathname || rule.pattern?.test(pathname));
}

export const navigation: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: ["leads.readAssigned", "leads.readAll", "dashboard.viewExecutive", "inventory.read"] },
      { href: "/ai-guide", icon: Bot, label: "AI Guide", permissions: aiGuideAccessPermissions },
      { href: "/notifications", icon: Bell, label: "Notifications", permissions: notificationAccessPermissions },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/leads", icon: Users, label: "Leads", permissions: ["leads.readAssigned", "leads.readAll"] },
      { href: "/leads/map", icon: MapPinned, label: "Lead Locations", permissions: ["leads.readAssigned", "leads.readAll"] },
      { href: "/clients", icon: ClipboardCheck, label: "Clients", permissions: ["clients.read"] },
      { href: "/deals", icon: Handshake, label: "Deals", permissions: ["deals.read"] },
      { href: "/activities", icon: Activity, label: "Activities", permissions: ["activities.read"] },
    ],
  },
  {
    label: "Properties",
    items: [
      { href: "/properties", icon: Building2, label: "Properties", permissions: ["properties.read"] },
      { href: "/units", icon: Home, label: "Units", permissions: ["units.read"] },
      { href: "/offerings", icon: Package, label: "Products/Services", permissions: ["offerings.read"] },
      { href: "/inventory", icon: Warehouse, label: "Inventory", permissions: ["inventory.read"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/tasks", icon: ListTodo, label: "Tasks", permissions: ["tasks.read"] },
      { href: "/settings/calendar", icon: CalendarDays, label: "Google Calendar", permissions: ["tasks.read", "tasks.create"] },
      { href: "/documents", icon: FileText, label: "Documents", permissions: documentAccessPermissions },
      { href: "/reports", icon: BarChart3, label: "Reports", permissions: reportsAccessPermissions },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/pos", icon: ShoppingCart, label: "Point of Sale", permissions: ["pos.read"] },
      { href: "/finance", icon: Receipt, label: "Finance", permissions: ["reports.viewFinancial"] },
      { href: "/rentals", icon: Landmark, label: "Rentals", permissions: ["rentals.read"] },
      { href: "/development", icon: FolderKanban, label: "Development", permissions: ["development.read"] },
      { href: "/marketing", icon: Megaphone, label: "Marketing", permissions: ["marketing.read"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/settings/organization", icon: Settings, label: "Organization", permissions: ["users.manage", "roles.manage"] },
      { href: "/settings/email", icon: Mail, label: "Email Settings", permissions: emailSettingsAccessPermissions },
      { href: "/settings/branches", icon: Building2, label: "Branches", permissions: ["users.manage"] },
      { href: "/settings/users", icon: Users, label: "Users", permissions: ["users.manage"] },
      { href: "/settings/roles", icon: ShieldCheck, label: "Roles", permissions: ["roles.manage"] },
      { href: "/settings/audit-logs", icon: FileText, label: "Audit Logs", permissions: ["auditLogs.read"] },
    ],
  },
];
