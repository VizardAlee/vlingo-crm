# Vlingo Systems CRM

Production-oriented business operations CRM for Vlingo Systems Nig. Ltd.

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add Firebase Web App configuration to `.env.local` before signing in.

## Commands

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run test:e2e:emulated
npm run test:rules
npm run seed
```

`npm run test:e2e` runs unauthenticated browser smoke checks. `npm run test:e2e:emulated` starts Firebase emulators, seeds an E2E admin user, and runs authenticated workflow checks.

This workspace is configured to use the installed Chrome browser for Playwright. On a new machine without Chrome, install a Playwright browser and change `playwright.config.ts` back to the bundled Chromium project:

```bash
npx playwright install chromium
```

## Firebase Emulators

```bash
npx firebase emulators:start
```

## Documentation

- `docs/beacon-operations-crm-blueprint.md`
- `docs/security-and-permissions.md`
- `docs/phase-1-handoff.md`
- `docs/launch-readiness.md`
