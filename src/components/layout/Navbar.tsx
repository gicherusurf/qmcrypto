import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { LogOut, User, Shield, Menu, X, Radio, History } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const { user, isAdmin, isModerator, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Radio className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold gradient-text">QMProfits</span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link to="/dashboard"><Button variant="ghost" size="sm"><User className="h-4 w-4 mr-2" />Dashboard</Button></Link>
                <Link to="/signals"><Button variant="ghost" size="sm"><Radio className="h-4 w-4 mr-2" />Signals</Button></Link>
                <Link to="/history"><Button variant="ghost" size="sm"><History className="h-4 w-4 mr-2" />History</Button></Link>
                {(isAdmin || isModerator) && <Link to="/admin"><Button variant="ghost" size="sm"><Shield className="h-4 w-4 mr-2" />{isAdmin ? "Admin" : "Moderator"}</Button></Link>}
                <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
              </>
            ) : (
              <>
                <Link to="/auth"><Button variant="ghost" size="sm">Sign In</Button></Link>
                <Link to="/auth?mode=signup"><Button variant="hero" size="sm">Get Started</Button></Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>

        {open && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start"><User className="h-4 w-4 mr-2" />Dashboard</Button></Link>
                  <Link to="/signals" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start"><Radio className="h-4 w-4 mr-2" />Signals</Button></Link>
                  <Link to="/history" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start"><History className="h-4 w-4 mr-2" />History</Button></Link>
                  {(isAdmin || isModerator) && <Link to="/admin" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start"><Shield className="h-4 w-4 mr-2" />{isAdmin ? "Admin" : "Moderator"}</Button></Link>}
                  <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full">Sign In</Button></Link>
                  <Link to="/auth?mode=signup" onClick={() => setOpen(false)}><Button variant="hero" className="w-full">Get Started</Button></Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
