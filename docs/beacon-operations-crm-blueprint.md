# Beacon Operations CRM Blueprint

Beacon Operations CRM is a Firebase-backed Next.js App Router platform for Beacon Corporate Realty Limited. It is organized around `organizations/{organizationId}` so every business record is organization-scoped.

## Stack

- Next.js App Router, TypeScript strict mode, Tailwind CSS 4
- Firebase Authentication, Cloud Firestore, Firebase Storage, Cloud Functions v2
- Firebase App Check placeholders and Firebase Cloud Messaging bootstrap
- React Hook Form, Zod, TanStack Table, Recharts, Lucide icons

## Firestore Structure

Phase 1 uses `organizations/{organizationId}` plus subcollections for branches, members, roles, leads, clients, properties, propertyUnits, tasks, activities, documents, and auditLogs.

Important business records include `organizationId`, `branchId`, creator/updater metadata, `status`, assignment fields, and soft-delete fields where applicable.

## Development Setup

1. Copy `.env.example` to `.env.local`.
2. Create a Firebase project and enable Authentication, Firestore, Storage, Functions, App Check, and Cloud Messaging.
3. Add Firebase Web App values to the `NEXT_PUBLIC_FIREBASE_*` variables.
4. Start emulators with `npx firebase emulators:start`.
5. Seed local data with `npm run seed` while using emulator credentials or a safe development project.
6. Run the app with `npm run dev`.

## Validation Commands

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run test:rules`

## Phase 2 Recommendations

- Complete deals, reservations, allocations, installment plans, payments, receipts, tenancies, leases, maintenance, commissions, and expenses.
- Move all audit writes to `writeProtectedAuditLog`.
- Add Cloud Function transactions for duplicate unit prevention and payment verification.
- Add real document upload workflows with metadata records.
- Add Playwright end-to-end tests for responsive navigation, forms, and permission routing.
