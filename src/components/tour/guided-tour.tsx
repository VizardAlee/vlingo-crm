"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GuidedTourStep {
  body: string;
  target: string;
  title: string;
}

interface TargetRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function GuidedTour({
  autoStart = false,
  className,
  storageKey,
  steps,
}: {
  autoStart?: boolean;
  className?: string;
  storageKey: string;
  steps: GuidedTourStep[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const activeStep = steps[activeIndex];
  const completed = useMemo(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(storageKey) === "done";
  }, [storageKey]);

  useEffect(() => {
    if (!autoStart || completed || !steps.length) {
      return;
    }

    const timeout = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timeout);
  }, [autoStart, completed, steps.length]);

  useEffect(() => {
    if (!open || !activeStep) {
      return;
    }

    function updateTarget() {
      const element = document.querySelector<HTMLElement>(`[data-tour="${activeStep.target}"]`);
      if (!element) {
        setTargetRect(null);
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setTargetRect({
          height: rect.height,
          left: rect.left,
          top: rect.top,
          width: rect.width,
        });
      });
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updateTarget();
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeStep, open]);

  function startTour() {
    setActiveIndex(0);
    setOpen(true);
  }

  function closeTour(markDone: boolean) {
    if (markDone) {
      window.localStorage.setItem(storageKey, "done");
    }

    setOpen(false);
  }

  function goNext() {
    if (activeIndex >= steps.length - 1) {
      closeTour(true);
      return;
    }

    setActiveIndex((index) => index + 1);
  }

  const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const tooltipTop = targetRect ? Math.min(viewportHeight - 240, targetRect.top + targetRect.height + 18) : 120;
  const tooltipLeft = targetRect ? Math.min(viewportWidth - 380, Math.max(16, targetRect.left)) : 16;

  return (
    <>
      <Button className={className} onClick={startTour} type="button" variant="outline">
        <HelpCircle className="h-4 w-4" />
        Guide me
      </Button>
      {open && activeStep ? (
        <div className="fixed inset-0 z-[80] pointer-events-none">
          <div className="absolute inset-0 bg-black/45" />
          {targetRect ? (
            <div
              className="absolute rounded-lg border-2 border-primary bg-white/10 shadow-[0_0_0_9999px_rgb(0_0_0_/_0.42),0_0_0_8px_rgb(177_18_38_/_0.16)] transition-all duration-300"
              style={{
                height: targetRect.height + 12,
                left: targetRect.left - 6,
                top: targetRect.top - 6,
                width: targetRect.width + 12,
              }}
            >
              <span className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-primary" />
            </div>
          ) : null}
          <div
            aria-labelledby="guided-tour-title"
            aria-modal="false"
            className="pointer-events-auto absolute w-[calc(100vw-2rem)] max-w-sm rounded-md border bg-white p-4 shadow-2xl transition-all duration-300"
            role="dialog"
            style={{ left: tooltipLeft, top: Math.max(16, tooltipTop) }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Step {activeIndex + 1} of {steps.length}</p>
                <h2 className="mt-1 text-base font-semibold" id="guided-tour-title">{activeStep.title}</h2>
              </div>
              <Button aria-label="Close guide" onClick={() => closeTour(false)} size="icon" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStep.body}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {steps.map((step, index) => (
                  <span className={cn("h-1.5 w-5 rounded-full", index === activeIndex ? "bg-primary" : "bg-muted")} key={step.target} />
                ))}
              </div>
              <div className="flex gap-2">
                <Button disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} size="sm" type="button" variant="outline">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button onClick={goNext} size="sm" type="button">
                  {activeIndex >= steps.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  {activeIndex >= steps.length - 1 ? "Done" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
