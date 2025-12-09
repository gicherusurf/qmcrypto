import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const packages = [
  {
    name: "Starter",
    price: 10,
    features: ["10% bi-weekly returns", "Basic dashboard access", "Email support", "Referral earnings"],
    popular: false,
  },
  {
    name: "Basic",
    price: 25,
    features: ["10% bi-weekly returns", "Full dashboard access", "Priority support", "Referral earnings", "Earnings analytics"],
    popular: false,
  },
  {
    name: "Standard",
    price: 50,
    features: ["10% bi-weekly returns", "Full dashboard access", "Priority support", "Referral earnings", "Earnings analytics", "Compound interest option"],
    popular: true,
  },
  {
    name: "Premium",
    price: 100,
    features: ["10% bi-weekly returns", "VIP dashboard access", "24/7 Premium support", "Referral earnings", "Advanced analytics", "Compound interest option", "Exclusive updates"],
    popular: false,
  },
];

export function Packages() {
  return (
    <section id="packages" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Choose Your <span className="gradient-text">Investment Package</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Select the package that fits your investment goals. All packages earn 10% returns every 14 days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {packages.map((pkg, index) => (
            <div
              key={pkg.name}
              className={cn(
                "glass-card p-6 flex flex-col relative overflow-hidden animate-fade-in",
                pkg.popular && "border-primary/50 glow-primary"
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Popular
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-2">{pkg.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">${pkg.price}</span>
                  <span className="text-muted-foreground text-sm">one-time</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link to="/auth?mode=signup">
                <Button
                  variant={pkg.popular ? "hero" : "outline"}
                  className="w-full"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* Custom Package */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="glass-card p-8 text-center gradient-border animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Crown className="h-12 w-12 text-accent mx-auto mb-4" />
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">Unlimited Custom Package</h3>
            <p className="text-muted-foreground mb-6">
              Invest $150 or more with the same great 10% bi-weekly returns. Perfect for serious investors.
            </p>
            <Link to="/auth?mode=signup">
              <Button variant="accent" size="lg">
                Create Custom Investment
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
