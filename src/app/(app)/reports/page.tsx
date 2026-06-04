import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Card>
        <CardHeader><CardTitle>Management Reports</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Financial, pipeline, source, property availability, and staff activity reports are prepared for Phase 2 once deals/payments are fully implemented.</CardContent>
      </Card>
    </section>
  );
}
