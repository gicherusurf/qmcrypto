import { UserPlus, Package, TrendingUp, Wallet } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up with Referral",
    description: "Create your account using a sponsor's referral code to join our community.",
  },
  {
    icon: Package,
    title: "Choose a Package",
    description: "Select an investment package that matches your goals, starting from just $10.",
  },
  {
    icon: TrendingUp,
    title: "Earn Returns",
    description: "Watch your investment grow with 10% returns calculated every 14 days automatically.",
  },
  {
    icon: Wallet,
    title: "Withdraw Profits",
    description: "Request withdrawals bi-weekly and receive your earnings to your wallet.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            How <span className="gradient-text-accent">It Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Getting started is simple. Follow these four easy steps to begin your investment journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
              )}
              
              <div className="text-center relative z-10">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 mb-6 mx-auto glow-primary">
                  <step.icon className="h-10 w-10 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center mx-auto" style={{ left: "calc(50% + 2rem)" }}>
                  {index + 1}
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
