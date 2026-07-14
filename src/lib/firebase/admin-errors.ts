export interface FirebaseAdminRecovery {
  error: string;
  requiredAction: string;
}

function adminErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message} ${adminErrorText(error.cause)}`;
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.details, record.error_description, record.cause]
      .map(adminErrorText)
      .filter(Boolean)
      .join(" ");
  }
  return typeof error === "string" ? error : "";
}

export function firebaseAdminRecovery(error: unknown, featureName: string): FirebaseAdminRecovery | null {
  const message = adminErrorText(error);

  if (message.includes("invalid_rapt") || message.includes("invalid_grant")) {
    return {
      error: `${featureName} cannot reach Firestore because the local Google backend credentials have expired.`,
      requiredAction: "Run gcloud auth application-default login, complete the browser sign-in, then restart npm run dev.",
    };
  }

  if (
    message.includes("Unable to detect a Project Id") ||
    message.includes("Could not load the default credentials") ||
    message.includes("Cloud Datastore User")
  ) {
    return {
      error: `${featureName} cannot reach Firestore with the current backend credentials.`,
      requiredAction: "For local development, run gcloud auth application-default login. For deployed hosting, configure Firebase Admin credentials or grant the runtime service account Cloud Datastore User.",
    };
  }

  return null;
}
