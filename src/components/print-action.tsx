"use client";

import { Loader2, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function PrintAction({
  label = "Print / Save PDF",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
}) {
  const [preparing, setPreparing] = useState(false);
  const preparationTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    const finish = () => setPreparing(false);
    window.addEventListener("afterprint", finish);
    return () => {
      window.removeEventListener("afterprint", finish);
      if (preparationTimer.current) window.clearTimeout(preparationTimer.current);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function startPrint() {
    if (preparing) return;
    setPreparing(true);
    preparationTimer.current = window.setTimeout(() => {
      window.print();
      resetTimer.current = window.setTimeout(() => setPreparing(false), 1_000);
    }, 350);
  }

  return (
    <>
      <Button aria-busy={preparing} disabled={preparing} onClick={startPrint} type="button" variant={variant}>
        {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {preparing ? "Preparing document…" : label}
      </Button>
      {preparing ? (
        <div aria-labelledby="print-preparation-title" aria-modal="true" className="no-print fixed inset-0 z-[200] grid place-items-center bg-black/45 p-5 backdrop-blur-sm" role="dialog">
          <div className="w-full max-w-sm rounded-md border bg-white p-6 text-center shadow-2xl">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-primary" />
            <h2 className="mt-4 text-lg font-semibold" id="print-preparation-title">Preparing your document</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Formatting the complete desktop-style document for print or PDF. Your device’s print options will open automatically.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
