import { AlertCircle, Inbox, Loader2, ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function LoadingState({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function EmptyState({ actionHref, actionLabel, title }: { actionHref?: string; actionLabel?: string; title: string }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-md border border-dashed bg-muted/40 p-8 text-center">
      <div>
        <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-semibold">{title}</p>
        {actionHref && actionLabel ? <ButtonLink className="mt-4" href={actionHref} size="sm">{actionLabel}</ButtonLink> : null}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="h-5 w-5" />
      {message}
    </div>
  );
}

export function PermissionDenied() {
  return (
    <div className="grid min-h-96 place-items-center p-8 text-center">
      <div>
        <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-xl font-semibold">Permission denied</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">Your current role does not include access to this workspace area.</p>
      </div>
    </div>
  );
}
