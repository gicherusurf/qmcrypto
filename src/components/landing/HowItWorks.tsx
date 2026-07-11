import { Wallet, Radio, MousePointerClick, TrendingUp } from "lucide-react";

const steps = [
  { icon: Wallet, title: "1. Deposit Crypto", description: "Fund your account with BTC or USDT. Your balance becomes your trading capital." },
  { icon: Radio, title: "2. Receive Signals", description: "Our in-house chatbot pushes live trading signals around the clock." },
  { icon: MousePointerClick, title: "3. Take the Signal", description: "Stake any amount from your balance on a signal you like." },
  { icon: TrendingUp, title: "4. Earn 3% Profit", description: "When the signal closes, 3% profit is credited automatically to your balance." },
];

export function HowItWorks() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            How <span className="gradient-text">QMProfits</span> works
          </h2>
          <p className="text-muted-foreground">
            Four simple steps from deposit to profit.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="glass-card p-6 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                <s.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
