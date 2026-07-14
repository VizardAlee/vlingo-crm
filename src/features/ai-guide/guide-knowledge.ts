export interface GuideTopic {
  keywords: string[];
  steps: string[];
  title: string;
}

interface GuideMemberContext {
  branchAccess?: unknown;
  branchId?: unknown;
  displayName?: unknown;
  permissions?: unknown;
  role?: unknown;
  roles?: unknown;
}

const guideAreaPermissions = [
  ["Dashboard", ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll"]],
  ["Leads and Lead Locations", ["leads.readAssigned", "leads.readAll"]],
  ["Clients", ["clients.read"]],
  ["Deals", ["deals.read"]],
  ["Properties", ["properties.read"]],
  ["Units", ["units.read"]],
  ["Products/Services", ["offerings.read"]],
  ["Rentals", ["rentals.read"]],
  ["Development", ["development.read"]],
  ["Marketing", ["marketing.read"]],
  ["Tasks and Google Calendar", ["tasks.read"]],
  ["Activities", ["activities.read"]],
  ["Finance", ["reports.viewFinancial"]],
  ["User administration", ["users.manage"]],
  ["Role administration", ["roles.manage"]],
  ["Audit logs", ["auditLogs.read"]],
] as const;

export function buildGuideMemberContext(member: GuideMemberContext) {
  const roles = Array.from(new Set([
    ...(Array.isArray(member.roles) ? member.roles.filter((role): role is string => typeof role === "string") : []),
    ...(typeof member.role === "string" ? [member.role] : []),
  ]));
  const permissions = Array.isArray(member.permissions)
    ? member.permissions.filter((permission): permission is string => typeof permission === "string")
    : [];
  const isSuperAdmin = roles.includes("superAdmin");
  const accessibleAreas = isSuperAdmin
    ? guideAreaPermissions.map(([area]) => area)
    : guideAreaPermissions
      .filter(([, requiredPermissions]) => requiredPermissions.some((permission) => permissions.includes(permission)))
      .map(([area]) => area);

  return `
Current signed-in user:
- Name: ${typeof member.displayName === "string" && member.displayName.trim() ? member.displayName : "Not provided"}
- Roles: ${roles.length ? roles.join(", ") : "No role recorded"}
- Branch: ${typeof member.branchId === "string" && member.branchId ? member.branchId : "Not provided"}
- Branch access: ${isSuperAdmin || member.branchAccess === "all" ? "all branches" : "assigned branch only"}
- Accessible areas inferred from current permissions: ${accessibleAreas.length ? accessibleAreas.join(", ") : "AI Guide only"}
- Explicit permissions: ${isSuperAdmin ? "Unrestricted super admin access" : permissions.length ? permissions.join(", ") : "None recorded"}

Permission guidance rules:
- Tailor instructions to this user's roles, permissions, ownership, and branch scope.
- Do not tell the user to use a hidden or forbidden section as though they can access it.
- When a required action is unavailable, name the permission or manager/admin assistance needed.
- Do not reveal or infer records, financial values, customer details, or activity belonging to other users or branches.
`;
}

export const guideTopics: GuideTopic[] = [
  {
    keywords: ["crm", "concept", "customer relationship", "what is crm", "why crm", "pipeline", "customer journey"],
    title: "Understand the CRM concept",
    steps: [
      "CRM means Customer Relationship Management. It is the system and process a company uses to track prospects, clients, conversations, deals, tasks, and revenue.",
      "A lead is an early opportunity: someone interested in a property, solar solution, material, installation, consultancy, or service.",
      "A client is a qualified person or organization you now manage as a business relationship.",
      "A deal is the commercial opportunity that can produce revenue, such as a property sale, rental, solar installation, material sale, or consultancy project.",
      "Activities and tasks keep follow-up visible so the team knows what happened and what should happen next.",
      "Finance connects payments, receipts, expenses, and commissions to the real business records instead of tracking money separately.",
      "Good CRM use means every customer interaction is recorded once, assigned to the right person, linked to the right product/service, and moved through the right next step.",
    ],
  },
  {
    keywords: ["lead", "capture", "new lead", "import lead", "geotag", "location"],
    title: "Create or import a lead",
    steps: [
      "Go to Leads, then choose Create Lead.",
      "Choose the branch and default assignee before entering lead details.",
      "Select the interest category first so the form only shows relevant fields.",
      "For real-estate leads, add property preferences, linked property or unit, budget, and inspection details.",
      "For solar, materials, or services, link the relevant product/service where possible.",
      "Use Map location to capture the lead's site or preferred location when field follow-up is needed.",
      "Save the lead, then use the lead detail page for follow-up, email, tasks, conversion, or opening a deal.",
    ],
  },
  {
    keywords: ["deal", "pipeline", "open deal", "sale", "quote", "proposal"],
    title: "Open and manage a deal",
    steps: [
      "Go to Deals, then choose New Deal, or open a lead and use Open Deal.",
      "Choose the deal category and deal type; the form will show only fields that fit that deal.",
      "Link the lead, client, property, unit, or product/service so finance and history stay connected.",
      "Set the owner, stage, expected close date, amount, probability, proposal status, and fulfillment status.",
      "Save the deal, then update the stage as the sale, rental, installation, material order, or service progresses.",
      "Use Finance to record payments, receipts, commissions, and approvals tied to that deal.",
    ],
  },
  {
    keywords: ["finance", "payment", "receipt", "expense", "commission", "approval"],
    title: "Record finance activity",
    steps: [
      "Go to Finance.",
      "Use Payments to record property sale, unit sale, rental, lease, reservation, deposit, solar, materials, or service revenue.",
      "Link payments to the right deal, rental, property, unit, client, or payer record.",
      "Set verification status and save; verified payments count toward confirmed revenue.",
      "Open the receipt view when a printable receipt is needed.",
      "Use Expenses and Commissions for operational costs and commission tracking, then approve them with the proper finance permissions.",
    ],
  },
  {
    keywords: ["email", "smtp", "bulk email", "message", "client email", "lead email"],
    title: "Send emails from the CRM",
    steps: [
      "Go to Settings, then Email Settings.",
      "Enter the sender name, official email address, SMTP host, port, security mode, username, and app password or SMTP password.",
      "Send a test email to confirm the mailbox works.",
      "Open a lead or client/deal workflow and use the email panel for a single message.",
      "Use the bulk email action from list pages when you need to message multiple leads or clients.",
      "If authentication fails, confirm the provider allows SMTP and whether an app password is required.",
    ],
  },
  {
    keywords: ["notification", "unread", "read", "alert", "browser notification", "push notification"],
    title: "Use notifications",
    steps: [
      "Open Notifications from the Workspace section.",
      "Unread notifications are highlighted and the app shows an unread indicator.",
      "Open a notification to review the linked task, lead, deal, finance, or workflow event.",
      "Mark notifications as read when handled.",
      "Use Enable browser notifications to allow alerts on the current phone or computer; browser permission must also be allowed for the site.",
      "Ordinary users receive their own related notifications, while authorized managers can receive branch oversight alerts.",
    ],
  },
  {
    keywords: ["calendar", "google calendar", "sync task", "dated task", "follow-up date"],
    title: "Connect tasks to Google Calendar",
    steps: [
      "Go to Settings, then Google Calendar, and choose Connect Google Calendar.",
      "Sign in to the Google account that should receive CRM tasks and approve Calendar access.",
      "The CRM creates a dedicated Vlingo CRM Tasks calendar and initially syncs assigned tasks that have due dates.",
      "New or updated assigned tasks with dates sync automatically while the connection is active.",
      "From a task or follow-up prompt, use Sync calendar when a dated task needs to be connected.",
      "Disconnect from Google Calendar settings when the CRM should stop managing that calendar.",
    ],
  },
  {
    keywords: ["report", "performance", "amount generated", "revenue report", "conversion rate", "my performance", "csv"],
    title: "Review personal performance",
    steps: [
      "Go to Reports and open My performance.",
      "Choose a quick period or enter a custom start and end date, then select Generate report.",
      "Review assigned leads, qualified and converted leads, conversion rate, managed clients, won deals, open pipeline, tasks, and verified amount generated.",
      "Use Lead interactions and the timeline to review calls, WhatsApp messages, emails, meetings, stage changes, and follow-up work recorded during the period.",
      "Review the AI performance summary, then use A4 PDF to download a phone- and tablet-friendly report or CSV for spreadsheet analysis.",
      "Verified amount generated counts attributed payments only after finance verification; pending payments are shown separately.",
      "Use Export CSV to download the personal summary and breakdowns.",
      "Organization overview is available only to admins and authorized executive, finance, audit, operations, or sales-management roles.",
    ],
  },
  {
    keywords: ["pwa", "install app", "offline", "home screen", "mobile app"],
    title: "Install and use the CRM as an app",
    steps: [
      "Use the browser's Install or Add to Home Screen action when the Vlingo CRM install prompt is available.",
      "Allow the service worker to finish installing before relying on cached pages.",
      "Previously cached app pages and supported record changes can work offline; the app shows when changes are queued or need attention.",
      "Reconnect to the internet and keep the app open until queued changes finish syncing.",
      "Live server features such as AI answers, email, finance verification, and fresh data require an internet connection.",
    ],
  },
  {
    keywords: ["invite", "invitation", "invite link", "expired invite", "resend link", "new user"],
    title: "Invite or re-invite a user",
    steps: [
      "Go to Settings, then Users; this requires user-management permission.",
      "Enter the user's details, branch access, and one or more roles, then generate the setup link.",
      "Copy and share the link through an approved communication channel.",
      "If the link expires before acceptance, find the invited user and choose Resend link to generate a fresh link.",
      "After account setup succeeds, the invited user is redirected to sign in.",
    ],
  },
  {
    keywords: ["role", "permission", "branch", "sales executive", "manager", "super admin"],
    title: "Understand roles and branch access",
    steps: [
      "Super admins have unrestricted app access and can switch branches.",
      "Managers generally see records in their branch or branches they are allowed to access.",
      "Sales executives see their own assigned leads and workflows unless a manager assigns more to them.",
      "Sidebar links are hidden when the user's role does not include access to that area.",
      "If a user sees a permission error, check their member document permissions, branchId, branchAccess, and assigned record ownership.",
    ],
  },
  {
    keywords: ["property", "unit", "offering", "catalog", "product", "service", "solar", "materials", "services"],
    title: "Manage properties, units, and products/services",
    steps: [
      "Use Properties and Units for real-estate inventory.",
      "Use Products/Services for catalog items such as solar equipment, installation packages, materials, consultancy, maintenance, and services.",
      "Link leads and deals to properties, units, or products/services so users do not re-enter the same information.",
      "Keep prices, status, category, stock, and service details current so sales and finance flows stay accurate.",
    ],
  },
  {
    keywords: ["dashboard", "metric", "cards", "welcome"],
    title: "Read the dashboard",
    steps: [
      "Go to Dashboard for live operational cards based on the current user, branch, and permissions.",
      "Use branch switching if you are a super admin or have all-branch access.",
      "If a number looks wrong, check the date/status filters and whether records are assigned to the correct branch.",
    ],
  },
  {
    keywords: ["organization", "logo", "branding", "primary color", "company name"],
    title: "Update organization branding",
    steps: [
      "Go to Settings, then Organization; this requires organization administration permission.",
      "Update the organization name and business details.",
      "Upload a logo from the computer instead of entering a remote logo URL.",
      "Review the detected primary color and save the organization settings.",
      "Refresh the app if an older cached logo or color is still visible.",
    ],
  },
];

export const appGuideContext = `
Vlingo Systems CRM is an internal business operations CRM for real estate, solar, building materials, services, consultancy, installations, projects, rentals, finance, documents, notifications, and team administration.

CRM concept:
- CRM means Customer Relationship Management.
- The CRM exists to help the company capture demand, qualify opportunities, follow up consistently, assign responsibility, convert prospects into clients, manage deals, connect revenue to work performed, and preserve relationship history.
- Lead: a person or organization showing interest before becoming a client.
- Client: a known customer relationship with useful profile and communication history.
- Deal: the revenue-facing opportunity tied to a lead/client and often a property, unit, rental, solar package, material, service, or project.
- Pipeline: the stages a lead or deal moves through from first contact to conversion, win, loss, payment, or fulfillment.
- Activity: a record of what happened.
- Task: a future action someone must complete.
- Good CRM discipline means data should be entered once, linked to the correct records, assigned to the right owner, followed up on time, and visible to managers according to role and branch.

Main routes and modules:
- Dashboard: overview of real data scoped by user permissions and branch.
- Leads: create, import with flexible header mapping, geotag, assign, qualify, email, follow up, convert, delete when authorized, and open deals. Lead forms reveal fields based on interest category.
- Lead Locations: map view for geotagged leads. Sales executives see assigned leads; managers see branch-scoped records; super admins can view all branches.
- Clients: manage client records, communication, pagination, list/card views, creator attribution, and clickable WhatsApp phone links.
- Deals: dynamic finance-facing pipeline for property sales, rentals, solar, materials, services, consultancy, installation, and custom work. Deal forms reveal fields based on category and type, inherit useful lead/client/product data, and record owner/creator attribution.
- Properties and Units: real-estate inventory and unit management.
- Products/Services: catalog for solar equipment, materials, services, consultancy, maintenance, installation projects, and other sellable items.
- Rentals: tenancy, rent payment, lease dates, renewal tasks, and tenant follow-up.
- Development: property development projects, project managers, delivery details, and related operational work.
- Marketing: campaign records connected to lead sources and sales follow-up.
- Finance: payments, receipt numbers, verification, expenses, commissions, approvals, and printable receipts.
- Documents: attach and manage business documents.
- Tasks and Activities: complete dated follow-up information, creator/updater identity, audit-friendly notes, and Google Calendar sync for assigned tasks.
- Notifications: persistent read/unread records plus optional browser push alerts, scoped to the user unless they have oversight access.
- Reports: every active user can review their own lead/client/deal/task performance and attributed verified revenue for selectable periods and export CSV. Executive/financial permissions additionally unlock Organization overview.
- AI Guide: persistent daily conversation, follow-up questions, Markdown answers, daily quota, and a response character limit.
- PWA and offline: installable app shell, browser notifications, cached pages, and queued supported writes; live backend actions still require connectivity.
- Settings: organization name/logo/theme, branches, users and renewable invite links, multiple roles, Google Calendar, email SMTP, and audit logs.

Cross-module workflows:
- Lead -> linked property/unit or product/service -> client conversion -> deal -> verified finance payment -> personal performance report.
- Selecting a lead interest category or deal category/type hides irrelevant fields and keeps forms focused.
- Lead, client, and deal cards show who entered the record; ownership fields determine personal workflow visibility and reporting attribution.
- Phone numbers in lead/client areas can open WhatsApp, and single or bulk email uses the organization's configured SMTP mailbox.
- Dated assigned tasks can sync to the user's connected Google Calendar and task notifications can reach enabled browsers/PWA devices.

Role behavior:
- Super admin has no restrictions.
- Managers are scoped to branches unless granted all-branch access.
- Sales executives only see their own assigned leads/workflows unless assigned by a manager.
- Links should be hidden when a role lacks access.

Answer style:
- Give concise, practical, step-by-step instructions.
- Mention the exact app section or route name when useful.
- If a task requires a permission, state it.
- Use the supplied current-user context to avoid recommending inaccessible sections or cross-branch data.
- Distinguish personal Reports from restricted Organization overview and Finance access.
- Never claim to have inspected live CRM records; explain navigation and workflow unless record data was explicitly supplied in the conversation.
- If the user asks for something outside the CRM, explain what the CRM can do and where to go next.
`;

export function fallbackGuideAnswer(question: string) {
  const normalized = question.toLowerCase();
  const topic = guideTopics.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  const selected = topic ?? {
    title: "Use the CRM effectively",
    steps: [
      "Start from the sidebar and choose the module that matches the work: Leads, Clients, Deals, Finance, Properties, Products/Services, Tasks, Documents, or Settings.",
      "Use Create/New actions for new records and open existing records for detail, edit, email, activity, or finance actions.",
      "Check your role and branch if a section or record is not visible.",
      "Use Guide me buttons on forms when you need field-by-field help.",
      "Ask a more specific question such as 'How do I create a solar deal?' or 'How do I record a payment?' for a tighter guide.",
    ],
  };

  return [
    `### ${selected.title}`,
    ...selected.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Tip: If you do not see a button or section, your role may not include that permission or the record may belong to another branch/user.",
  ].join("\n");
}
