import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketingPage() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Marketing</h1>
      <Card>
        <CardHeader><CardTitle>Listings, Campaigns, Agents</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Prepared route for listing campaigns, lead sources, and agent performance.</CardContent>
      </Card>
    </section>
  );
}
