import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingUp, Radio, ShieldCheck, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Hero() {
  const { user } = useAuth();
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">Live trading signals · 3% per call</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Crypto trading signals,<br />
            <span className="gradient-text">delivered to your chat.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Deposit crypto, receive premium trading signals from our in-house bot, and earn 3% profit on every signal you take.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link to="/dashboard">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto">
                    <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
                  </Button>
                </Link>
                <Link to="/signals">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <Radio className="h-4 w-4 mr-2" /> View Signals
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth?mode=signup">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto">
                    Start Trading <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">Sign In</Button>
                </Link>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6 mt-16 max-w-2xl mx-auto">
            {[
              { icon: TrendingUp, label: "3%", sub: "per signal" },
              { icon: Radio, label: "24/7", sub: "live signals" },
              { icon: ShieldCheck, label: "Secure", sub: "deposits" },
            ].map((s, i) => (
              <div key={i} className="glass-card p-4 text-center">
                <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="font-display text-2xl font-bold">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
