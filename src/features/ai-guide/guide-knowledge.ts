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
  partnerBranchIds?: unknown;
  role?: unknown;
  roles?: unknown;
}

const guideAreaPermissions = [
  [
    "Dashboard",
    ["dashboard.viewExecutive", "leads.readAssigned", "leads.readAll", "inventory.read", "pos.read"],
  ],
  ["Leads and Lead Locations", ["leads.readAssigned", "leads.readAll"]],
  ["Clients", ["clients.read"]],
  ["Deals", ["deals.read"]],
  ["Products/Services", ["offerings.read"]],
  ["Inventory", ["inventory.read"]],
  ["Point of Sale", ["pos.read"]],
  ["Installation Projects", ["installations.read"]],
  ["Marketing", ["marketing.read"]],
  ["Tasks and Google Calendar", ["tasks.read"]],
  ["Activities", ["activities.read"]],
  ["Finance", ["reports.viewFinancial"]],
  ["User administration", ["users.manage"]],
  ["Role administration", ["roles.manage"]],
  ["Audit logs", ["auditLogs.read"]],
] as const;

export function buildGuideMemberContext(member: GuideMemberContext) {
  const roles = Array.from(
    new Set([
      ...(Array.isArray(member.roles)
        ? member.roles.filter(
            (role): role is string => typeof role === "string",
          )
        : []),
      ...(typeof member.role === "string" ? [member.role] : []),
    ]),
  );
  const permissions = Array.isArray(member.permissions)
    ? member.permissions.filter(
        (permission): permission is string => typeof permission === "string",
      )
    : [];
  const isSuperAdmin = roles.includes("superAdmin");
  const accessibleAreas = isSuperAdmin
    ? guideAreaPermissions.map(([area]) => area)
    : guideAreaPermissions
        .filter(([, requiredPermissions]) =>
          requiredPermissions.some((permission) =>
            permissions.includes(permission),
          ),
        )
        .map(([area]) => area);

  return `
Current signed-in user:
- Name: ${typeof member.displayName === "string" && member.displayName.trim() ? member.displayName : "Not provided"}
- Roles: ${roles.length ? roles.join(", ") : "No role recorded"}
- Branch: ${typeof member.branchId === "string" && member.branchId ? member.branchId : "Not provided"}
- Branch access: ${isSuperAdmin || member.branchAccess === "all" ? "all branches" : "assigned branch only"}
- Brand representative branch scope: All organization branches
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
    keywords: ["installation project", "project materials", "project labour", "project transport", "project procurement", "project margin", "site project", "external material"],
    title: "Run an installation project",
    steps: [
      "Open a qualified solar CRM deal and choose Create installation project, or go to Installation Projects and create one directly. A linked deal copies its customer, scope, agreed or quoted total, inventory-product lines, and external service-cost lines into the project plan.",
      "In the deal quotation, catalog inventory lines marked Check stock or Procure into inventory become project material requirements. Adding a requirement is planning only and does not change inventory.",
      "Review availability across the branches you can access. Reserve available stock for the project, then choose Issue to project only when the material physically leaves the location for site work.",
      "For catalog shortages, create a project-linked purchase order. Paid, part-paid, and credit orders follow the existing approval and receiving workflow; receiving the order adds stock before it is issued to the project.",
      "Deal lines marked direct to site, external material, service, labour, transport, or other become project cost lines. They do not create artificial inventory movements.",
      "Create project tasks, activity updates, and documents from the project header. Use Finance to record customer payments and project expenses against the installation project.",
      "Create milestone invoices for deposits, procurement, progress work, commissioning, or the final balance. Open any invoice to print or save the official fixed-A4 Vlingo document.",
      "Use the project ledger to compare contract value, receipts, planned costs, inventory issued, supplier commitments, other actual costs, and forecast margin. Only verified receipts and approved or paid expenses count as financial actuals.",
      "Project access is permission controlled: installations.create starts projects, installations.read views them, installations.update changes plans and delivery status, inventory permissions control stock and procurement, and finance permissions control receipts and expenses.",
    ],
  },
  {
    keywords: [
      "print on phone",
      "mobile print",
      "save pdf",
      "download pdf",
      "iphone print",
      "android print",
      "a4 pdf",
    ],
    title: "Print or save an A4 document on a phone",
    steps: [
      "Open the invoice, receipt, or filtered inventory report, then choose Print / Save PDF.",
      "The button becomes disabled and a Preparing your document dialog appears briefly while the app switches to print formatting. Wait for the phone's system print options to open.",
      "The app switches to a fixed A4 layout for printing, so a PDF generated on Android or iPhone has the same document dimensions and desktop-style columns as one generated on a computer.",
      "On Android, choose Save as PDF from the printer selector, confirm A4 portrait, then save or share the file.",
      "On iPhone, use the system print preview, open the full preview, then use Share to save the PDF to Files or send it through an approved app.",
      "If an in-app browser does not show the system print dialog, open the CRM page directly in Chrome on Android or Safari on iPhone and try again.",
    ],
  },
  {
    keywords: [
      "point of sale",
      "pos",
      "checkout",
      "record sale",
      "sales receipt",
      "sales invoice",
      "part payment",
      "customer receipt",
      "official receipt",
      "official invoice",
      "invoice template",
      "receipt template",
      "sales quantity",
    ],
    title: "Record a sale and issue documents",
    steps: [
      "Go to Point of Sale and choose New sale. Checkout always uses available stock in the active dashboard branch.",
      "Search by product name, SKU, barcode, or brand, then add products to the cart. Type the full required whole-number quantity directly, or use minus and plus as shortcuts; the quantity cannot exceed available stock. Reserved units cannot be sold.",
      "Add the customer details when known; a blank name is saved as Walk-in customer.",
      "Apply line discounts and tax where required. The server uses the product catalogue selling price and checks stock again before completing the sale.",
      "Enter the amount received and payment method. Full, partial, and unpaid sales are supported.",
      "Complete the sale. The system deducts stock, records sale movements, creates a branch-coded VSL invoice number, and creates a separate numbered receipt whenever money is received—all in one transaction.",
      "Open Sales history to print an A4 invoice or receipt using the Vlingo letterhead template. Documents include customer and location details, itemized prices, amount in words, payment status, and company details; invoices also include Lotus Bank instructions, while receipts include the authorised signature, official stamp, and current Lagos date.",
      "For an outstanding invoice, choose Record payment to receive some or all of the balance. Every later payment updates the balance and gets its own printable receipt.",
      "Users need pos.read to view sales and pos.sell to process checkout or receive later payments. Brand partners do not receive POS access.",
    ],
  },
  {
    keywords: [
      "crm",
      "concept",
      "customer relationship",
      "what is crm",
      "why crm",
      "pipeline",
      "customer journey",
    ],
    title: "Understand the CRM concept",
    steps: [
      "CRM means Customer Relationship Management. It is the system and process a company uses to track prospects, clients, conversations, deals, tasks, and revenue.",
      "A lead is an early opportunity: someone interested in a solar solution, material, installation, consultancy, or service.",
      "A client is a qualified person or organization you now manage as a business relationship.",
      "A deal is the commercial opportunity that can produce revenue, such as a solar installation, material sale, maintenance contract, or consultancy project.",
      "Activities and tasks keep follow-up visible so the team knows what happened and what should happen next.",
      "Finance connects payments, receipts, expenses, and commissions to the real business records instead of tracking money separately.",
      "Good CRM use means every customer interaction is recorded once, assigned to the right person, linked to the right product/service, and moved through the right next step.",
    ],
  },
  {
    keywords: [
      "lead",
      "capture",
      "new lead",
      "import lead",
      "geotag",
      "location",
    ],
    title: "Create or import a lead",
    steps: [
      "Go to Leads, then choose Create Lead.",
      "Use Quick capture for the lead's essential contact, category, source, immediate interest, follow-up, and notes; switch to Full details only when richer qualification information is available.",
      "Choose the branch and default assignee before entering lead details.",
      "Select the interest category first so the form only shows relevant fields.",
      "Choose the relevant business category, link the required product/service, and add budget and delivery details.",
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
      "Link the lead or client so finance and history stay connected.",
      "For a solar deal, build the installation quotation with as many catalog products, externally sourced materials, services, labour, transport, and other lines as required. The create form asks only for the customer-facing basics; use More options on a quotation line only when you need its unit, estimated cost, discount, tax, or fulfillment route.",
      "Choose the owner and expected close date when useful. Deal stage, finance, proposal, fulfillment, commission, and closing controls are managed later from the saved deal instead of complicating initial creation. The quotation calculates subtotal, discounts, tax, customer total, and estimated cost.",
      "Review and finalize the quotation before creating the installation project. Once a project is linked, the quotation lines are locked so the project plan and commercial record cannot silently diverge.",
      "Save the deal, then update the stage as the sale, installation, material order, or service progresses.",
      "Use Finance to record payments, receipts, commissions, and approvals tied to that deal.",
    ],
  },
  {
    keywords: [
      "how inventory works",
      "inventory system",
      "inventory overview",
      "inventory report",
      "stock report",
      "stock balance",
      "available stock",
      "reserved stock",
      "low stock",
      "inventory csv",
    ],
    title: "Review inventory balances and reports",
    steps: [
      "Go to Inventory and open Overview to see on-hand, reserved, and available quantities, stock value, low-stock items, and balances by location.",
      "Available stock is on hand minus reserved stock; use the available figure when promising stock to a customer or project.",
      "Use Report filters to select any permitted branch, brand, and optional movement date range. Dates filter the movement ledger while the stock table always shows the latest balance.",
      "Choose Export CSV for the filtered current-stock data or Print report for an A4 report containing summary totals, current balances, and the filtered movement ledger.",
      "Internal users see records allowed by their branch access. Brand partners see only inventory belonging to their assigned brands across all branches, and their dashboard, CSV, and printed report omit inventory value and cost information.",
      "Open Comments to discuss a brand report without changing inventory quantities.",
    ],
  },
  {
    keywords: [
      "purchase order",
      "purchase stock",
      "procurement",
      "supplier",
      "receive purchase",
      "partial receipt",
      "credit purchase",
      "supplier payment",
      "amount owing",
    ],
    title: "Procure and receive inventory",
    steps: [
      "Go to Inventory, then Purchasing; creating suppliers and purchase orders requires inventory.procure permission.",
      "Create or select an active supplier, add the catalogue items, then choose Paid in full, Credit agreement, or Part payment. Credit and part-paid orders require a balance due date.",
      "Submit the purchase order for approval. Its creator cannot approve it, so another user with inventory.approve permission must approve or reject it from Approvals.",
      "After approval, receive each line into a stock location. Partial receipts are allowed and the order remains Part received until every line is complete.",
      "Stock location options come from active locations created by administrators under Settings > Branches. Closed locations are not offered for new stock activity.",
      "Inventory-created legacy locations cannot receive new stock. If one still has quantity, it appears only as a Legacy cleanup source so the stock can be transferred into an admin-created branch.",
      "For a transfer, the source is the active dashboard branch. Users with access to other branches can choose one of those branches as the destination; both branch ledgers show the transfer.",
      "A new product defaults to the creator's assigned branch. A user with all-branch access can select another active branch on the product form before saving.",
      "Receiving stock and paying the supplier are separate. Authorized inventory or finance users can record later payments against the outstanding order balance.",
      "For batch items, enter the batch number and optional expiry date. Serial numbers are optional for now; if supplied, enter one unique serial number for every unit received.",
      "Receiving updates the purchase order, location balance, trace register, product total, and movement ledger together.",
    ],
  },
  {
    keywords: [
      "stock movement",
      "transfer stock",
      "issue stock",
      "record product sale",
      "inventory sale",
      "inventory receipt",
      "inventory adjustment",
      "return stock",
      "barcode",
      "opening stock",
      "existing stock",
      "initial quantity",
    ],
    title: "Record a stock movement",
    steps: [
      "Go to Inventory, then Add / move stock. The form shows only actions allowed by your role.",
      "For stock already owned when the system is introduced, choose Enter existing / opening stock. For a delivery without a purchase order, choose Receive stock without a purchase order.",
      "Scan the item's barcode or select the product. For a sale, choose Record stock leaving and set its purpose to Sale.",
      "Enter the quantity and required source or destination location. Add the supplier, purchase order, job, or sale reference when applicable.",
      "Batch-controlled items require a batch number. Serial numbers are optional for now; when supplied, enter exactly one per unit.",
      "Submit the movement. The system verifies available stock and updates all affected balances atomically before adding the ledger entry.",
    ],
  },
  {
    keywords: [
      "stock count",
      "cycle count",
      "physical count",
      "inventory variance",
      "post variance",
    ],
    title: "Perform and approve a stock count",
    steps: [
      "Go to Inventory, then Counts; submitting a count requires inventory.count permission.",
      "Name the count and enter the item, location, actual physical quantity, and variance reason for each line.",
      "Submit the count for review. A different user with inventory.approve permission must approve or reject it.",
      "After approval, an approver posts the count. Non-zero differences create adjustment movements and update the balances.",
      "A count cannot reduce stock below its reserved quantity. Batch-controlled products must be reconciled through traceable movements; serial-designated products can be counted by quantity while serial capture remains optional.",
    ],
  },
  {
    keywords: [
      "reserve inventory",
      "reserve stock",
      "stock reservation",
      "fulfill reservation",
      "release reservation",
    ],
    title: "Reserve stock for work or a sale",
    steps: [
      "Go to Inventory, then Reservations; this requires inventory.reserve permission.",
      "Choose the item, location, quantity, and purpose, then link the deal, project, work order, or other record when possible.",
      "For a batch item, choose its batch number. Serial numbers may be left blank for now; if supplied, enter the exact serial numbers to lock.",
      "Submit the reservation. Reserved stock remains on hand but is removed from the available quantity.",
      "Use Release when the stock is no longer needed. Use Fulfill when it leaves inventory; fulfillment reduces on-hand and reserved quantities and records an issue movement.",
    ],
  },
  {
    keywords: [
      "batch tracking",
      "lot tracking",
      "serial tracking",
      "traceability",
      "expiry date",
      "serial number",
    ],
    title: "Use batch and serial traceability",
    steps: [
      "Set the item's Traceability field in Products/Services to None, Batch, or Serial and add its barcode or GTIN when available.",
      "Batch-controlled transactions require a batch number and can record an expiry date; quantities are maintained for each batch and location.",
      "Serial numbers are optional for now. When they are supplied, enter one unique number per unit so the system can maintain each unit's location and status.",
      "Open Inventory, then Traceability to scan or search by item, batch, serial number, or location.",
      "Use traceable receipts, transfers, issues, returns, and reservations so the trace register and balance ledger stay synchronized.",
    ],
  },
  {
    keywords: [
      "brand partner",
      "brand rep",
      "brand representative",
      "partner inventory",
      "guest inventory",
      "partner report",
      "invite partner",
    ],
    title: "Give a brand partner access to inventory reports",
    steps: [
      "Create the inventory brands first under Inventory Setup.",
      "Go to Settings, then Users; create or invite the guest with the Brand Representative role, then select one or more permitted brands.",
      "After signing in, the representative can open Inventory to view quantities, movements, recorded sale issues, trace records, and reports for their assigned brands across every branch. Inventory cost and value are not displayed.",
      "The partner can filter by permitted branch, brand, and movement dates, then export CSV or print the scoped report. Comments remain available for collaboration by brand and report period.",
      "Brand partners cannot access suppliers, purchase orders, stock counts, reservations, approvals, setup, or stock-changing actions.",
    ],
  },
  {
    keywords: [
      "finance",
      "payment",
      "receipt",
      "expense",
      "commission",
      "approval",
    ],
    title: "Record finance activity",
    steps: [
      "Go to Finance.",
      "Use Payments to record solar, materials, installation, consultancy, maintenance, or service revenue.",
      "Link payments to the correct deal, installation project, client, or payer record.",
      "Set verification status and save; verified payments count toward confirmed revenue.",
      "Open the receipt view when a printable receipt is needed.",
      "Use Expenses and Commissions for operational costs and commission tracking, then approve them with the proper finance permissions.",
    ],
  },
  {
    keywords: [
      "email",
      "smtp",
      "bulk email",
      "message",
      "client email",
      "lead email",
    ],
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
    keywords: [
      "notification",
      "unread",
      "read",
      "alert",
      "browser notification",
      "push notification",
    ],
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
    keywords: [
      "calendar",
      "google calendar",
      "sync task",
      "dated task",
      "follow-up date",
    ],
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
    keywords: [
      "report",
      "performance",
      "amount generated",
      "revenue report",
      "conversion rate",
      "my performance",
      "csv",
    ],
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
    keywords: [
      "invite",
      "invitation",
      "invite link",
      "expired invite",
      "resend link",
      "new user",
    ],
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
    keywords: [
      "branch",
      "branches",
      "disable branch",
      "enable branch",
      "delete branch",
      "close office",
      "location settings",
    ],
    title: "Disable or delete a branch",
    steps: [
      "Go to Settings, then Branches; this requires user-management permission.",
      "Choose Disable when a location should stop being available for new users, stock, sales, and operational work. Reassign every user from that branch first, and keep at least one other branch active.",
      "A disabled branch can be enabled again from the same Branches screen.",
      "Delete is available only after the branch is disabled. The server permits deletion only when no users or business records refer to that branch.",
      "If deletion is blocked because records exist, leave the branch disabled so historical reports and audit context remain intact.",
    ],
  },
  {
    keywords: [
      "role",
      "permission",
      "branch",
      "sales executive",
      "manager",
      "super admin",
    ],
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
    keywords: [
      "unit",
      "offering",
      "catalog",
      "product",
      "import products",
      "product spreadsheet",
      "csv",
      "excel",
      "service",
      "solar",
      "materials",
      "services",
    ],
    title: "Manage products and services",
    steps: [
      "Use Products/Services for catalog items such as solar equipment, installation packages, materials, consultancy, maintenance, and services.",
      "For an inventory product, select its brand. An admin or manager with inventory.manageCatalog can use Create brand beside the Brand field when the required brand is not in the dropdown.",
      "Enter the product details and save the record; the SKU/item code is generated automatically and cannot be entered manually. Barcode/GTIN is optional.",
      "To create many products, open Products/Services and choose Import CSV/Excel. Upload a file, map each file column to a system field, review valid and rejected rows, and import the valid rows. A downloadable CSV template is available.",
      "The importer can match an existing brand by name, code, or ID. Users with all-branch access can map a branch column or choose a default branch; branch-limited users always import to their assigned branch.",
      "The product form does not accept a stock quantity. After saving the product, use Inventory > Add / move stock to enter existing opening stock or receive new stock so every quantity has a location and an audit trail.",
      "The product defaults to the creator's assigned branch. A user with all-branch access can select another active admin-created branch before saving.",
      "Link leads and deals to products/services so users do not re-enter the same information.",
      "Keep prices, status, category, stock, and service details current so sales and finance flows stay accurate.",
    ],
  },
  {
    keywords: ["dashboard", "metric", "cards", "welcome", "sales dashboard", "sales record", "recent sales", "sales today", "dashboard sales"],
    title: "Read the dashboard",
    steps: [
      "Go to Dashboard for live operational cards based on the current user, branch, and permissions.",
      "The inventory summary shows on-hand, available, reserved, low-stock and sold quantities, inventory value, stock by brand, and recent stock movements.",
      "Users with pos.read see the Sales record section for the active branch: completed transactions, sales value, payments received, outstanding balances, units sold, today's sales, and the eight latest completed invoices.",
      "Use the Invoice link on a recent sale to open its printable document, or choose View all sales to open the complete Point of Sale history.",
      "Brand representatives do not see inventory value, cost prices, customer names, invoice values, or payment details. Their dashboard instead shows quantity metrics and recent product-sale movements for assigned brands across all branches.",
      "Use branch switching if you are a super admin or have all-branch access.",
      "If a number looks wrong, confirm the active branch, sale status, payment balance, and inventory movement purpose. Voided POS sales are excluded from completed-sales figures.",
    ],
  },
  {
    keywords: [
      "organization",
      "logo",
      "branding",
      "primary color",
      "company name",
    ],
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
Vlingo Systems CRM is an internal business operations CRM for solar, building materials, services, consultancy, installations, projects, inventory, point of sale, finance, documents, notifications, and team administration. Property, unit, rental, and real-estate development modules are currently retired from the active app; do not direct users to those areas.

CRM concept:
- CRM means Customer Relationship Management.
- The CRM exists to help the company capture demand, qualify opportunities, follow up consistently, assign responsibility, convert prospects into clients, manage deals, connect revenue to work performed, and preserve relationship history.
- Lead: a person or organization showing interest before becoming a client.
- Client: a known customer relationship with useful profile and communication history.
- Deal: the revenue-facing opportunity tied to a lead/client and a solar package, material, service, or project.
- Pipeline: the stages a lead or deal moves through from first contact to conversion, win, loss, payment, or fulfillment.
- Activity: a record of what happened.
- Task: a future action someone must complete.
- Good CRM discipline means data should be entered once, linked to the correct records, assigned to the right owner, followed up on time, and visible to managers according to role and branch.

Main routes and modules:
- Dashboard: inventory-first operational overview plus permission-aware POS sales totals and recent sales records, scoped by active branch; brand representatives receive brand-scoped sale movements without customer or payment details.
- Leads: create, import with flexible header mapping, geotag, assign, qualify, email, follow up, convert, delete when authorized, and open deals. Lead forms reveal fields based on interest category.
- Lead Locations: map view for geotagged leads. Sales executives see assigned leads; managers see branch-scoped records; super admins can view all branches.
- Clients: manage client records, communication, pagination, list/card views, creator attribution, and clickable WhatsApp phone links.
- Deals: dynamic finance-facing pipeline for solar, materials, services, consultancy, installation, and custom work. Creation is deliberately focused on customer, ownership, timing, and quote essentials; lifecycle controls become available after saving. Solar deals use a multi-line installation quotation for catalog stock, direct-to-site materials, services, labour, transport, discounts, tax, selling totals, estimated costs, and planned fulfillment, with optional line details behind More options; other deal forms reveal fields based on category and type and inherit useful lead/client data.
- Products/Services: catalog for solar equipment, materials, services, consultancy, maintenance, installation projects, and other sellable items.
- Inventory: branch-aware stock balances, guided opening-stock entry, movement ledger, supplier master, paid/part-paid/credit purchase orders, supplier balances, partial receiving, approval-controlled stock counts, reservations, barcode lookup, batch/serial traceability, filtered CSV/A4 reports, and brand-partner collaboration.
- Point of Sale: branch-aware checkout, directly typed whole-number quantities with plus/minus shortcuts, customer details, discounts, tax, full/partial/unpaid sales, stock deduction, sales history, later payments, and Vlingo-branded printable invoices and receipts.
- Installation Projects: CRM-linked delivery workspaces for bill of materials, branch stock availability, reservations and issues, shortage procurement, direct-to-site materials, labour, transport, tasks, documents, receipts, costs, and forecast margin.
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
- Lead -> linked product/service -> client conversion -> deal -> verified finance payment -> personal performance report.
- Selecting a lead interest category or deal category/type hides irrelevant fields and keeps forms focused.
- Lead, client, and deal cards show who entered the record; ownership fields determine personal workflow visibility and reporting attribution.
- Phone numbers in lead/client areas can open WhatsApp, and single or bulk email uses the organization's configured SMTP mailbox.
- Dated assigned tasks can sync to the user's connected Google Calendar and task notifications can reach enabled browsers/PWA devices.
- Product/service catalogue items marked as inventory feed branch/location balances. Procurement receipts, controlled movements, counts, and reservation fulfillment update stock through server-side transactions.
- A CRM deal can create one linked installation project. Solar quotation lines automatically seed the project: stock/check-stock and procure-to-stock catalog items become material requirements, while direct-to-site materials, services, labour, transport, and other non-stock lines become cost lines. Adding planned materials never changes stock; reserving protects available stock; fulfilling the reservation issues it to the project. Catalog shortages use project-linked purchase orders. Finance receipts and expenses can link to the project for profitability reporting.
- The dashboard is inventory-first and sales-aware: it highlights stock on hand, available and reserved units, low-stock exposure, inventory value, recent movements and units sold. Users with pos.read also see transaction count, sales value, payments received, outstanding balances, today's sales, and the eight latest completed invoices for the active branch.
- Point of Sale sells from the active branch's available balance. A user can type a full whole-number cart quantity or use plus/minus shortcuts. Checkout creates the sale, branch-coded VSL invoice number, optional numbered receipt and finance payment, inventory issues, and stock deductions atomically. It supports walk-in customers, discounts, tax, unpaid invoices, part payments, and a separate receipt for every later payment.
- Printable POS invoices, receipts, finance receipts, and inventory reports use a fixed A4 print layout on desktop, Android, and iPhone. Print actions show a blocking preparation dialog and disable the button before opening the native print sheet. Mobile navigation, drawers, overlays, and loading UI are excluded from the printed document. Mobile printing preserves the desktop-style columns and full document width; the system print dialog can print physically or save/share a PDF.
- Printable POS invoices and receipts use the Vlingo letterhead and A4 document structure: customer/location metadata, itemized lines, totals, amount in words, and payment status. Invoices contain the configured Lotus Bank payment details; receipts contain payment acknowledgement, the approved authorised signature, the official company stamp, and the current Lagos date.
- Products can be created individually or imported from CSV/XLS/XLSX through a column-mapping and validation preview. Inventory products require an existing active brand, use an automatically generated SKU, and may omit barcode/GTIN. Product creation and import never accept stock quantity; opening and procured stock enter through Inventory so location balances and the movement ledger remain authoritative. Users with inventory.manageCatalog can create a missing brand from the product form. Admin-created active branches are the stock locations used for new inventory.
- Inventory availability is on-hand quantity minus reserved quantity. Batch and serial records must stay synchronized with the balance and movement ledgers.

Role behavior:
- Super admin has no restrictions.
- Managers are scoped to branches unless granted all-branch access.
- Sales executives only see their own assigned leads/workflows unless assigned by a manager.
- Inventory managers can procure, count, reserve, receive, issue, transfer, and adjust stock but do not have approval permission. Users with inventory.approve permission approve purchase orders and stock counts, and creators cannot approve their own submissions.
- Brand partners are read-only inventory guests scoped to assigned brands across all branches. They can filter, export, print, and comment on their report, but cannot see cost prices, inventory value, customer/payment data, internal procurement, counts, reservations, approvals, or other brands.
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
  const topic = guideTopics
    .map((item) => ({
      item,
      score: item.keywords
        .filter((keyword) => normalized.includes(keyword))
        .reduce((total, keyword) => total + keyword.length, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item;
  const selected = topic ?? {
    title: "Use the CRM effectively",
    steps: [
      "Start from the sidebar and choose the module that matches the work: Leads, Clients, Deals, Finance, Products/Services, Inventory, Installation Projects, Tasks, Documents, or Settings.",
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
