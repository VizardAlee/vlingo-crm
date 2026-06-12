import { MessageCircle } from "lucide-react";
import { cn, formatPhone, whatsappHref } from "@/lib/utils";

export function WhatsAppPhoneLink({
  className,
  displayNumber,
  phoneNumber,
}: {
  className?: string;
  displayNumber?: string | null;
  phoneNumber?: string | null;
}) {
  const href = whatsappHref(phoneNumber ?? displayNumber);
  const label = formatPhone(displayNumber ?? phoneNumber);

  if (!href) {
    return <span>{label}</span>;
  }

  return (
    <a
      aria-label={`Open WhatsApp chat with ${label}`}
      className={cn("inline-flex items-center justify-end gap-1.5 font-medium text-primary hover:underline", className)}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <MessageCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </a>
  );
}
