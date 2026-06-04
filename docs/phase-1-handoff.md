# Phase 1 Handoff

## Completed

- Next.js App Router project with strict TypeScript and Tailwind CSS.
- Beacon logo placement at `public/branding/beacon-logo.jpeg`.
- Beacon design tokens in `src/app/globals.css`.
- Firebase client/admin configuration and environment validation.
- Authentication pages for login and password reset.
- Protected application shell with sidebar, top navigation, search, quick create, notifications, sign-out, breadcrumbs, and branch selector.
- Permission-aware navigation and settings role matrix.
- Firestore-backed repositories for organization-scoped create, read, update, soft delete, and audit scaffolding.
- Dashboard with count metrics, charts, widgets, loading states, and Naira formatting.
- Phase 1 modules for leads, clients, properties, property units, tasks, and activities.
- Firestore rules, Storage rules, indexes, Functions v2 scaffolding, seed script, and emulator tests.

## Known Limitations

- Firebase environment values are required before live auth and data loading work.
- Audit writes are scaffolded client-side for development; production should use `writeProtectedAuditLog`.
- Lead-to-client conversion function exists but is not yet connected to a detail-page action.
- Duplicate phone and duplicate unit detection need transaction-backed Cloud Function enforcement before production.
- Financial, rental, development, marketing, and document upload workflows are prepared routes, not complete modules.
- Dashboard charts include sample distribution data until richer aggregation queries or reporting collections are added.

## Deployment Notes

Run validation before deployment: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run test:rules`.

Deploy Functions after installing dependencies in `functions/`: `cd functions && npm install && npm run build`.
