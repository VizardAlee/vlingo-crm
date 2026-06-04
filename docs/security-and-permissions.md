# Security and Permissions

Security is enforced in both UI helpers and Firebase Security Rules. UI checks improve usability only; Firestore and Storage rules are the authority.

## Access Model

Users must be authenticated and have an active member record at:

`organizations/{organizationId}/members/{userId}`

Member records contain organization, branch, role, permissions, and status fields.

## Implemented Protections

- Deny by default for Firestore and Storage.
- Require active organization membership.
- Enforce organization isolation.
- Prevent `organizationId` changes on existing business records.
- Block ordinary hard deletes.
- Protect audit logs from ordinary writes.
- Restrict role and user management to users with `users.manage` or `roles.manage`.
- Restrict Storage access to `organizations/{organizationId}/...` paths.

## Privileged Operations

Cloud Functions v2 scaffolds `provisionOrganizationMember`, `convertLeadToClient`, and `writeProtectedAuditLog`.

Production deployments should route sensitive operations through these functions or equivalent trusted server code. Do not trust client-provided `organizationId`, role, permissions, creator, verifier, or audit fields for privileged workflows.

## Rule Tests

Rules tests cover unauthenticated reads, cross-organization reads, assigned lead reads, role escalation denial, sales-manager lead assignment, audit-log write denial, `organizationId` mutation denial, and cross-organization Storage upload denial.

Run with `npm run test:rules`.

## App Check

`src/lib/firebase/client.ts` contains App Check initialization using reCAPTCHA Enterprise. Set `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` after configuring App Check in Firebase.
