import { Suspense } from "react";
import { LoadingState } from "@/components/ui/state";
import { GoogleCalendarSettings } from "@/features/settings/google-calendar-settings";

export default function GoogleCalendarSettingsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading Google Calendar settings" />}>
      <GoogleCalendarSettings />
    </Suspense>
  );
}
