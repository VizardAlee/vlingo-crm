import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RentalsPage() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Rentals</h1>
      <Card>
        <CardHeader><CardTitle>Tenancies and Leases</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Prepared route for tenancies, leases, and maintenance workflows.</CardContent>
      </Card>
    </section>
  );
}
