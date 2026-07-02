import { Bot } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { ComponentProps } from "react";

type AiGuideLinkProps = Omit<ComponentProps<typeof ButtonLink>, "href"> & {
  question: string;
};

export function AiGuideLink({ children = "Ask AI Guide", question, variant = "outline", ...props }: AiGuideLinkProps) {
  return (
    <ButtonLink href={`/ai-guide?question=${encodeURIComponent(question)}`} variant={variant} {...props}>
      <Bot className="h-4 w-4" />
      {children}
    </ButtonLink>
  );
}
