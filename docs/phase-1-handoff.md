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
- Modules for leads, clients, deals, properties, property units, rentals, tasks, activities, documents, finance, notifications, development, marketing, and reports.
- Firestore rules, Storage rules, indexes, Functions v2 scaffolding, seed script, and emulator tests.

## Known Limitations

- Firebase environment values are required before live auth and data loading work.
- Audit writes are scaffolded client-side for development; production should use `writeProtectedAuditLog`.
- Duplicate phone and duplicate unit detection need transaction-backed Cloud Function enforcement before production.
- Production monitoring, backup, restore, and rollback steps must be configured and rehearsed before broad rollout.
- Playwright-style browser workflow tests are still recommended for responsive navigation, forms, permissions, and finance flows.

## Deployment Notes

Run validation before deployment: `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test`, and `npm run test:rules`.

Deploy Functions after installing dependencies in `functions/`: `cd functions && npm install && npm run build`.

Use `docs/launch-readiness.md` for the complete launch checklist.
