import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancePage() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Finance</h1>
      <Card>
        <CardHeader><CardTitle>Payments, Receipts, Expenses, Commissions</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Payment verification must be completed through privileged Cloud Functions before production use.</CardContent>
      </Card>
    </section>
  );
}
