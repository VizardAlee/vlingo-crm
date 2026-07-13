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

7. Configure invite setup links in the Functions runtime environment. The invite workflow provisions the user first, then generates a CRM password setup link that admins can copy and share manually. `APP_BASE_URL` is optional because the callable can fall back to the current app origin, but it is recommended for production so copied links always point to the deployed app:

```bash
APP_BASE_URL="https://vlingo-crm.svoltnigeria.com"
```

If `APP_BASE_URL` is set, add its domain to Firebase Authentication authorized domains. For local or Firebase CLI-managed Function deployments, put the variable in a Functions environment file such as `functions/.env.beacon-operations-crm`. For deployed Gen 2 Functions, confirm the same variable is present on the Cloud Run service for `provisionOrganizationMember`. After changing the invite helper, redeploy `provisionOrganizationMember` before testing copied links in production.

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

AI Guide quota is stored in Firestore under internal usage records, so logout, browser refresh, app restart, or redeploy should not reset a user's daily allowance before the UTC day changes.

9. Configure browser push delivery:

- In Firebase Console, open Project settings > Cloud Messaging > Web Push certificates and generate or import a Web Push certificate.
- Add its public key to the hosting environment as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. This key is public and must be available during the Next.js build.
- Enable the Firebase Cloud Messaging API for the project.
- Deploy Firestore rules and Functions so users can store their own device registration and `deliverNotificationPush` can send newly created CRM notifications.
- On each supported device, sign in, open Notifications, and select **Enable alerts**. Notification permission and device registration are independent; the CRM reports a registration error if permission is granted but FCM setup is incomplete.

10. Configure direct Google Calendar synchronization:

- Enable the Google Calendar API in the same Google Cloud project used for OAuth.
- Configure the OAuth consent screen and create an OAuth 2.0 **Web application** client.
- Add these authorized redirect URIs exactly:
  - `http://localhost:3000/api/integrations/google-calendar/callback`
  - `https://vlingo-crm.svoltnigeria.com/api/integrations/google-calendar/callback`
- Configure the Next.js/App Hosting runtime variables:

```bash
GOOGLE_CALENDAR_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CALENDAR_CLIENT_SECRET="..."
GOOGLE_CALENDAR_REDIRECT_URI="https://vlingo-crm.svoltnigeria.com/api/integrations/google-calendar/callback"
GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY="replace-with-a-random-secret-at-least-32-characters"
```

- Configure the matching Firebase Functions secrets. The encryption key must be identical in App Hosting and Functions so the task trigger can decrypt credentials created by the OAuth callback:

```bash
firebase functions:secrets:set GOOGLE_CALENDAR_CLIENT_ID
firebase functions:secrets:set GOOGLE_CALENDAR_CLIENT_SECRET
firebase functions:secrets:set GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY
```

- Deploy `syncTaskGoogleCalendar` after the secrets are available. Users can then open **Google Calendar** in the CRM sidebar, select **Connect Google**, approve access, and receive a dedicated `Vlingo CRM Tasks` calendar. Existing assigned dated tasks are imported at connection time; later task changes sync through the Firestore trigger.

For local development, Admin Firestore access uses Google Application Default Credentials when `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` are not configured. If AI Guide reports `invalid_rapt` or `invalid_grant`, refresh local credentials and restart the dev server:

```bash
gcloud auth application-default login
npm run dev
```

For deployed hosting, prefer service-account credentials through `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY`, or ensure the app runtime service account has Cloud Datastore User access.

11. Create the first admin:

```bash
FIRST_ADMIN_UID="firebase-auth-uid" FIRST_ADMIN_EMAIL="admin@example.com" npm run create:first-admin
```

12. Sync role permissions after role changes:

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
