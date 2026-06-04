import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DevelopmentPage() {
  return (
    <section className="grid gap-5">
      <h1 className="text-2xl font-semibold">Development</h1>
      <Card>
        <CardHeader><CardTitle>Projects and Contractors</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Prepared route for development project and contractor management.</CardContent>
      </Card>
    </section>
  );
}
