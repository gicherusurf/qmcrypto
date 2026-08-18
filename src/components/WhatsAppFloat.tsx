import { MessageCircle } from "lucide-react";

// Global floating WhatsApp support button. Fixed to the bottom-right on every page.
// Number: +1 801-801-3939 -> wa.me expects digits only.
const SUPPORT_NUMBER = "18018013939";

export function WhatsAppFloat() {
  const prefilled = encodeURIComponent("Hi QMProfits support, I need help with ");
  const href = `https://wa.me/${SUPPORT_NUMBER}?text=${prefilled}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with support on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-[#25D366] shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#20bd5a] active:scale-95"
    >
      <MessageCircle className="h-7 w-7 text-white" fill="white" />
      <span className="absolute inset-0 rounded-full animate-ping bg-[#25D366]/40 -z-10" />
    </a>
  );
}
