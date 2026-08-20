# Inventory management and brand partner access

## Operating model

Inventory is transaction-led. Products remain in the Products/Services catalog, while Inventory owns brands, stock locations, location balances, movements, reports, and report comments.

- A catalog item must be linked to a brand before stock can move.
- Stock enters through receipts, returns, or positive adjustments.
- Stock leaves through issues, returns, or negative adjustments.
- Transfers reduce one location and increase another in one server transaction.
- Direct client writes to balances and movements are denied by Firestore rules.
- Negative location balances are rejected by the server.

## Initial setup

1. Deploy Firestore rules and indexes, then deploy Functions.
2. Run `npm run sync:roles` so existing members and role documents receive the new inventory permissions.
3. Sign in as a super admin, operations manager, or inventory manager.
4. Open Inventory > Setup and create brands such as Sorotec and Revo.
5. Create the warehouses, stores, sites, or vehicles that hold stock.
6. Edit each stock-tracked Product/Service and assign its brand, SKU, unit, cost price, and reorder level.
7. Record an `Adjustment in` movement at each location to establish audited opening balances. Do not copy the legacy catalog `stockQuantity`; opening stock should enter through the ledger.

## Brand partner onboarding

1. Open Settings > Users and start an invitation.
2. Select the `Brand partner` role. It is intentionally exclusive and cannot be combined with an internal role.
3. Select one or more brands. The invitation is rejected if no active brand is selected.
4. Generate and share the setup link.

The partner sees only the Inventory area. Reports, item balances, movements, exported CSV data, and comments are restricted to the member's `partnerBrandIds`. This restriction is enforced in both application queries and Firestore rules.

## Collections

- `inventoryBrands`: brand and partner contact records.
- `inventoryLocations`: branch-scoped stock locations.
- `inventoryBalances`: calculated item/location quantities; server-written only.
- `inventoryMovements`: immutable audit ledger; server-written only.
- `inventoryComments`: brand-scoped report discussion.
- `offerings`: product catalog, extended with `brandId` and `brandName`.

## Deployment

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
npm run sync:roles
```
