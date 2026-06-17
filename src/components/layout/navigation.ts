import {
  Activity,
  BarChart3,
  Bell,
  Building2,
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
  Receipt,
  Settings,
  ShieldCheck,
  Users,
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

export const navigation: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: ["leads.readAssigned", "leads.readAll", "dashboard.viewExecutive"] },
      { href: "/notifications", icon: Bell, label: "Notifications", permissions: ["tasks.read", "leads.readAssigned", "leads.readAll", "rentals.read", "activities.read"] },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/leads", icon: Users, label: "Leads", permissions: ["leads.readAssigned", "leads.readAll"] },
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
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/tasks", icon: ListTodo, label: "Tasks", permissions: ["tasks.read"] },
      { href: "/documents", icon: FileText, label: "Documents", permissions: ["clients.read", "properties.read"] },
      { href: "/reports", icon: BarChart3, label: "Reports", permissions: ["reports.viewFinancial", "dashboard.viewExecutive"] },
    ],
  },
  {
    label: "Future Modules",
    items: [
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
      { href: "/settings/email", icon: Mail, label: "Email Settings", permissions: ["leads.readAssigned", "leads.readAll", "clients.read", "deals.read", "properties.read", "units.read", "tasks.read", "activities.read", "users.manage"] },
      { href: "/settings/branches", icon: Building2, label: "Branches", permissions: ["users.manage"] },
      { href: "/settings/users", icon: Users, label: "Users", permissions: ["users.manage"] },
      { href: "/settings/roles", icon: ShieldCheck, label: "Roles", permissions: ["roles.manage"] },
      { href: "/settings/audit-logs", icon: FileText, label: "Audit Logs", permissions: ["auditLogs.read"] },
    ],
  },
];
