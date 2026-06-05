import { Banknote, ChartNoAxesColumnIncreasing, Receipt, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const financeSections = [
  { description: "Verification queue for deposits, installment payments, rent, and fees.", icon: Banknote, title: "Payments" },
  { description: "Receipt generation and receipt history for approved payments.", icon: Receipt, title: "Receipts" },
  { description: "Operational expense capture, review, and approval trail.", icon: ChartNoAxesColumnIncreasing, title: "Expenses" },
  { description: "Agent and broker commission calculations tied to closed transactions.", icon: ShieldCheck, title: "Commissions" },
];

export default function FinancePage() {
  return (
    <section className="grid min-w-0 gap-5">
      <div className="rounded-md bg-white p-4 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
        <h1 className="text-xl font-semibold md:text-2xl">Finance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Payments, receipts, expenses, commissions, and finance approvals.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {financeSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardContent className="grid gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{section.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader><CardTitle>Finance Control Note</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Payment verification must be completed through privileged Cloud Functions before production use.</CardContent>
      </Card>
    </section>
  );
}
