import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-96 place-items-center text-center">
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This CRM workspace page does not exist.</p>
        <ButtonLink className="mt-5" href="/dashboard">Return to dashboard</ButtonLink>
      </div>
    </main>
  );
}
