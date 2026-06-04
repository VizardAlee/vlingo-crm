import {
  Activity,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Home,
  Landmark,
  LayoutDashboard,
  ListTodo,
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
    items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permissions: ["leads.readAssigned", "leads.readAll", "dashboard.viewExecutive"] }],
  },
  {
    label: "CRM",
    items: [
      { href: "/leads", icon: Users, label: "Leads", permissions: ["leads.readAssigned", "leads.readAll"] },
      { href: "/clients", icon: ClipboardCheck, label: "Clients", permissions: ["clients.read"] },
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
      { href: "/rentals", icon: Landmark, label: "Rentals", permissions: ["properties.read"] },
      { href: "/development", icon: FolderKanban, label: "Development", permissions: ["properties.read"] },
      { href: "/marketing", icon: Megaphone, label: "Marketing", permissions: ["leads.readAll"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/settings/organization", icon: Settings, label: "Organization", permissions: ["users.manage", "roles.manage"] },
      { href: "/settings/users", icon: Users, label: "Users", permissions: ["users.manage"] },
      { href: "/settings/roles", icon: ShieldCheck, label: "Roles", permissions: ["roles.manage"] },
    ],
  },
];
