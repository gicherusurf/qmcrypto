import { MessageCircle } from "lucide-react";

// WhatsApp support entry point for users. Opens a chat with the support line.
// Number: +1 801-801-3939 -> wa.me expects digits only, no + or dashes.
const SUPPORT_NUMBER = "18018013939";
const SUPPORT_DISPLAY = "+1 801-801-3939";

export function WhatsAppSupport() {
  const prefilled = encodeURIComponent("Hi QMProfits support, I need help with ");
  const href = `https://wa.me/${SUPPORT_NUMBER}?text=${prefilled}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-xl border border-[#25D366]/30 bg-gradient-to-br from-[#25D366]/10 to-transparent p-5 transition hover:border-[#25D366]/60"
    >
      <div className="p-3 rounded-full bg-[#25D366]/15 shrink-0">
        <MessageCircle className="h-6 w-6 text-[#25D366]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold">Need help? Chat with us on WhatsApp</p>
        <p className="text-sm text-muted-foreground">
          Our support team is ready to assist you — tap to message {SUPPORT_DISPLAY}.
        </p>
      </div>
      <div className="shrink-0 text-sm font-medium text-[#25D366] hidden sm:block">
        Open chat →
      </div>
    </a>
  );
}
