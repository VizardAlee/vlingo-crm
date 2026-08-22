# Installation projects, CRM, inventory, procurement, and finance

Installation Projects is the delivery workspace for customer installations. It connects the commercial CRM record to site execution without treating labour, transport, or direct-to-site purchases as inventory.

## Recommended workflow

1. Qualify the lead, create the client and deal, agree the scope and value, then choose **Create installation project** on the deal.
2. Add catalog products to **Inventory materials**. These lines are the bill of materials and do not change stock.
3. Review available quantities across accessible branches. Reserve stock at the correct branch/location, then issue it only when it physically leaves for the project.
4. Create project-linked purchase orders for catalog shortages. Orders support paid, part-paid, and credit arrangements and still require normal approval and receiving.
5. Record direct-to-site materials, labour, transportation, subcontractors, permits, equipment hire, and other non-stock work as project costs.
6. Link tasks, activities, documents, customer receipts, and approved expenses to the project.
7. Create deposit, procurement, progress, commissioning, or final-balance milestone invoices from the project workspace. Each invoice uses the official Vlingo A4 letterhead, payment details, signature, stamp, and mobile-safe print workflow.
8. Move the project through planning, approval, procurement, scheduling, installation, commissioning, and completion.

## Financial interpretation

- **Contract value** is the agreed customer value.
- **Amount received** comes from verified Finance receipts linked to the project, plus any migrated opening receipt summary.
- **Planned cost** combines planned inventory material cost and planned non-stock/service cost.
- **Inventory issued** values fulfilled project reservations using the product catalog cost.
- **Supplier commitments** include active project-linked purchase orders so credit purchases are visible before cash is paid.
- **Other actual costs** include actual project cost lines and approved or paid Finance expenses.
- **Forecast margin** is contract value less committed and actual project cost.

Project lines never create an unaudited stock quantity. Inventory changes only through reservation fulfilment, purchase-order receiving, or another authorized inventory movement.

## Permissions

- `installations.create`: start a project, including from a CRM deal.
- `installations.read`: view project delivery and cost summaries.
- `installations.update`: change project plans, costs, progress, and status.
- Inventory permissions separately control reservation, issue, procurement, receiving, and approval.
- Finance permissions separately control receipts, expenses, verification, and approval.
