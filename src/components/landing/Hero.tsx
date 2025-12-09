import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Shield, Clock } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: "1s" }} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="text-sm text-muted-foreground">Platform Active • 10% Bi-Weekly Returns</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <span className="text-foreground">Grow Your</span>{" "}
            <span className="gradient-text">Crypto</span>
            <br />
            <span className="text-foreground">With Confidence</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Join thousands of investors earning consistent 10% bi-weekly returns through our 
            secure investment platform. Start with as little as $10.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Link to="/auth?mode=signup">
              <Button variant="hero" size="xl">
                Start Investing
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="#packages">
              <Button variant="hero-outline" size="xl">
                View Packages
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <div className="glass-card p-6 text-center">
              <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
              <div className="font-display text-2xl font-bold text-foreground">10%</div>
              <div className="text-sm text-muted-foreground">Bi-Weekly Returns</div>
            </div>
            <div className="glass-card p-6 text-center">
              <Shield className="h-8 w-8 text-success mx-auto mb-3" />
              <div className="font-display text-2xl font-bold text-foreground">100%</div>
              <div className="text-sm text-muted-foreground">Secure Platform</div>
            </div>
            <div className="glass-card p-6 text-center">
              <Clock className="h-8 w-8 text-accent mx-auto mb-3" />
              <div className="font-display text-2xl font-bold text-foreground">14 Days</div>
              <div className="text-sm text-muted-foreground">Earning Cycle</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
