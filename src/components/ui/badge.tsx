import { cn, type BadgeTone } from "@/lib/utils";

const tones: Record<BadgeTone, string> = {
  default: "border-secondary/20 bg-secondary/10 text-secondary",
  success: "border-success/20 bg-success/10 text-success",
  warning: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-info/20 bg-info/10 text-info",
  muted: "border-border bg-muted text-muted-foreground",
};

export function Badge({ className, tone = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold", tones[tone], className)} {...props} />;
}
