import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="font-display font-bold text-primary-foreground">C</span>
            </div>
            <span className="font-display text-xl font-bold gradient-text">QMProfits</span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/auth?mode=signup" className="hover:text-foreground transition-colors">Get Started</Link>
          </nav>

          <p className="text-sm text-muted-foreground">
            © 2024 QMProfits. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
