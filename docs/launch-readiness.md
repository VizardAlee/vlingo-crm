# Launch Readiness Runbook

This runbook is for a controlled real-world/internal business launch of Beacon Operations CRM.

## Required Validation

Run these checks before every launch candidate:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:e2e:emulated
npm run test:rules
npm run build
npm --prefix functions run build
```

Smoke-test these routes on the deployed environment with at least one admin user and one restricted user:

- `/dashboard`
- `/leads`
- `/leads/new`
- `/deals`
- `/properties`
- `/units`
- `/rentals`
- `/documents`
- `/finance`
- `/notifications`
- `/settings/users`

## Firebase Setup

1. Create or select the Firebase project.
2. Enable Authentication, Firestore, Storage, Functions, App Check, and Cloud Messaging.
3. Add the Firebase Web App values to the hosting environment variables.
4. Set `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID` and `NEXT_PUBLIC_DEFAULT_BRANCH_ID`.
5. Configure App Check and set `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.
6. Grant the Functions runtime service account Firestore and Firebase Auth access:

```bash
gcloud projects add-iam-policy-binding beacon-operations-crm \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --condition=None

gcloud projects add-iam-policy-binding beacon-operations-crm \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/firebaseauth.admin" \
  --condition=None
```

7. Configure invite setup links in the Functions runtime environment. The invite workflow provisions the user first, then generates a Firebase password setup link that admins can copy and share manually. `APP_BASE_URL` is optional, but recommended so the setup flow returns to the app:

```bash
APP_BASE_URL="https://your-app.example.com"
```

If `APP_BASE_URL` is set, add its domain to Firebase Authentication authorized domains. For local or Firebase CLI-managed Function deployments, put the variable in a Functions environment file such as `functions/.env.beacon-operations-crm`. For deployed Gen 2 Functions, confirm the same variable is present on the Cloud Run service for `provisionOrganizationMember`.

8. Configure user SMTP settings encryption before enabling client/lead email. `MAIL_SETTINGS_ENCRYPTION_KEY` is required by the Functions runtime and must be at least 32 characters. Treat it as a secret; prefer Secret Manager or a protected Functions environment file:

```bash
MAIL_SETTINGS_ENCRYPTION_KEY="replace-with-a-long-random-secret"
```

9. Optional: configure Gemini-backed AI Guide answers. If `GEMINI_API_KEY` is absent, AI Guide still works with the built-in CRM workflow guide. Keep the key server-side only:

```bash
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-3.5-flash"
AI_GUIDE_DAILY_LIMIT="30"
AI_GUIDE_RESPONSE_CHARACTER_LIMIT="3500"
```

10. Create the first admin:

```bash
FIRST_ADMIN_UID="firebase-auth-uid" FIRST_ADMIN_EMAIL="admin@example.com" npm run create:first-admin
```

11. Sync role permissions after role changes:

```bash
npm run sync:roles
```

## Deployment

Deploy Firebase infrastructure in this order:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy --only functions
```

Deploy the Next.js app through the chosen hosting platform after the validation checks pass.

## Backup And Recovery

- Enable scheduled Firestore exports to a protected Cloud Storage bucket before launch.
- Keep at least daily backups for the internal MVP period.
- Test one restore into a non-production project before broad rollout.
- Export Storage objects or enable bucket retention/versioning if production documents are uploaded.

## Monitoring And Triage

- Monitor Firebase Functions logs, Firestore rule denials, Storage rule denials, and hosting errors after deployment.
- Assign an internal owner for daily review during the first launch week.
- Treat auth failures, cross-organization access, failed finance writes, and receipt mismatches as launch-critical incidents.

## Rollback

- Keep the last known good app deployment available in the hosting platform.
- Keep the previous Firestore and Storage rules files tagged in source control.
- For severe regressions, roll back app hosting first, then rules/functions if the regression is backend-related.
- Do not roll back Firestore data manually without a backup/restore plan.

## Launch Acceptance

The app is launch-ready when:

- All validation commands pass.
- Browser smoke tests and emulator-backed authenticated E2E tests pass.
- The core workflow works end to end: lead capture/import, lead-property link, deal creation, finance receipt, notification, document attachment, and dashboard update.
- Rules tests cover current privileged workflows.
- No dashboard or finance cards rely on placeholder data.
- First-admin, role sync, backup, monitoring, and rollback steps have been rehearsed.
