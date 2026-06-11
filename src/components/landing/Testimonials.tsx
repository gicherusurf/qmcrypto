import { Star } from "lucide-react";

const items = [
  { name: "Marcus T.", role: "Day Trader", text: "The signals are clean and the 3% per trade adds up fast. Best decision I made this year." },
  { name: "Sophia L.", role: "Crypto Investor", text: "Love that I just open the chat and a fresh signal is waiting. Withdrawals are quick too." },
  { name: "James K.", role: "Portfolio Manager", text: "Consistent returns and a clean interface. The chatbot model is genius." },
];

export function Testimonials() {
  return (
    <section className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Traders trust <span className="gradient-text">CryptoVest</span>
          </h2>
          <p className="text-muted-foreground">Real feedback from active members.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-primary text-primary" />)}
              </div>
              <p className="text-sm mb-4">"{t.text}"</p>
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
