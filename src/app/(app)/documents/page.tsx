import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocumentsPage() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <Card>
        <CardHeader><CardTitle>Document Vault</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Firebase Storage paths and rules are ready for organization-scoped uploads. Upload workflows should be added with signed metadata in Phase 2.</CardContent>
      </Card>
    </section>
  );
}
