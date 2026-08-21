# Inventory management and brand partner access

## Operating model

Inventory is transaction-led. Products remain in the Products/Services catalog, while Inventory owns brands, stock locations, location balances, movements, reports, and report comments.

- A catalog item must be linked to a brand before stock can move.
- Stock enters through receipts, returns, or positive adjustments.
- Stock leaves through issues, returns, or negative adjustments.
- Transfers reduce the active source branch and increase an accessible destination branch in one server transaction. The destination balance and trace records belong to the destination branch, and the movement is visible in both branch ledgers.
- Direct client writes to balances and movements are denied by Firestore rules.
- Negative location balances are rejected by the server.
- Reservations reduce available stock without changing physical on-hand stock.
- Purchase orders and stock-count variances require a second user with approval permission.
- Batch-tracked items maintain required trace records. Serial-tracked items maintain per-unit trace records when optional serial numbers are supplied.

## Enterprise workflows

### Suppliers and purchase orders

Create suppliers under Inventory > Purchasing. Purchase orders support multiple catalog lines, tax, expected delivery dates, and partial receipts. Every order records whether it was paid in full, partly paid, or obtained under a credit agreement. Part-paid and credit purchases require a balance due date; authorized inventory or finance users can record later supplier payments until the balance reaches zero.

Payment and receiving are intentionally separate. A credit purchase can be received before it is paid, and paying an order does not add stock. New orders enter `pendingApproval`; their creator cannot approve them. After approval, each line can be received into a stock location. Receiving updates the purchase line, balance, product total, trace register, and movement ledger atomically.

### Existing and directly received stock

Use Inventory > Add / move stock > **Enter existing / opening stock** to establish quantities the business already owned before using the system. This creates an audited positive adjustment at the selected location. Use **Receive stock without a purchase order** only for a direct delivery that is not tied to an approved order. Approved purchase-order deliveries must be received from Purchasing so the order and stock ledger remain synchronized.

### Batch and serial traceability

Set each catalog item's Traceability field to `none`, `batch`, or `serial`, and optionally record a barcode/GTIN. Batch movements require a batch number and may include an expiry date. Serial numbers are currently optional; when supplied, enter exactly one unique number per unit to activate per-unit tracing. Camera scanning uses the browser Barcode Detector API when available; USB/Bluetooth scanners and manual entry work in all supported browsers.

### Stock counts

Counts snapshot the current system quantity when submitted. An approver reviews the captured variance; after approval, posting the count updates the location balances and creates immutable adjustment movements for non-zero variances. Counts cannot reduce physical stock below already-reserved quantities. Batch-controlled items are reconciled with traceable inventory movements; ordinary and serial-designated items can be counted by quantity while serial capture remains optional.

### Reservations

Reservations hold stock for a deal, project, work order, or other purpose. Available stock is `on hand - reserved`. Releasing a reservation restores availability without a stock movement. Fulfilling it reduces both on-hand and reserved quantities and creates an issue movement. Batch and serial reservations also lock their trace records.

### Approval separation

The creator of a purchase order or stock count cannot approve it. `inventoryManager` can procure, count, reserve, and operate stock but cannot approve. Operations managers, finance managers, managing directors, and super admins can approve according to their assigned permissions.

### In-app guidance

The Inventory page includes a permission-aware **Guide me** tour that runs only when the user chooses it; refreshing the page never opens it automatically. Internal users are shown only the workflow tabs their role can access, while brand partners receive guidance for their scoped report, movement history, comments, and CSV export. The AI Guide covers opening stock, paid and credit procurement, partial receiving, movements, stock counts, reservations, traceability, approvals, and partner invitations. Its recommendations use the signed-in member's permissions and branch scope.

## Initial setup

1. Deploy Firestore rules and indexes, then deploy Functions.
2. Run `npm run sync:roles` so existing members and role documents receive the new inventory permissions.
3. Sign in as a super admin, operations manager, or inventory manager.
4. Open Inventory > Setup and create brands such as Sorotec and Revo.
5. An administrator creates or activates locations under Settings > Branches. Active locations automatically appear in the applicable inventory stock dropdowns.
6. Create or edit each stock-tracked Product/Service and assign its brand, unit, cost price, and reorder level. New products default to the creator's assigned branch; users with all-branch access can choose another active branch before saving. The SKU is generated automatically when the product is saved.
7. Open Add / move stock and choose **Enter existing / opening stock** at each location to establish audited opening balances. Do not copy the legacy catalog `stockQuantity`; opening stock should enter through the ledger.

## Brand partner onboarding

1. Open Settings > Users and start an invitation.
2. Select the `Brand partner` role. It is intentionally exclusive and cannot be combined with an internal role.
3. Select one or more brands. The invitation is rejected if no active brand is selected.
4. Generate and share the setup link. Existing users can also be converted to a brand representative by editing their role and brand access under Settings > Users.

The partner sees only the Inventory area. Reports, item balances, movements, recorded product-sale issues, exported CSV data, and comments are restricted to the member's `partnerBrandIds` across every organization branch. This brand-only restriction is enforced in both application queries and Firestore rules. A sale appears on the representative dashboard when an inventory issue is recorded with purpose `sale`, or when a deal-linked reservation is fulfilled.

## Collections

- `inventoryBrands`: brand and partner contact records.
- `branches`: active administrator-managed locations used as the canonical stock-location options.
- `inventoryLocations`: legacy/custom locations retained only for historical compatibility. A legacy location with stock appears as a clearly marked cleanup source so its quantity can be transferred into an admin branch, but it can never receive new stock.
- `inventoryBalances`: calculated item/location quantities; server-written only.
- `inventoryMovements`: immutable audit ledger; server-written only.
- `inventoryComments`: brand-scoped report discussion.
- `inventorySuppliers`: supplier master data.
- `inventoryPurchaseOrders`: multi-line procurement, approvals, receipt progress, and paid/credit balances. Payment entries are retained in each order's `payments` subcollection.
- `inventoryLots`: batch quantities and expiry dates by location.
- `inventorySerials`: unique serial status and location register.
- `inventoryStockCounts`: count snapshots, variances, approvals, and posting state.
- `inventoryReservations`: committed stock and fulfillment state.
- `offerings`: product catalog, extended with `brandId` and `brandName`.

## Deployment

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
npm run sync:roles
```
