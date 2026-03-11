import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, Users, Clock, Copy, ArrowUpRight, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InvestmentDialog } from "@/components/dashboard/InvestmentDialog";
import { ActiveInvestments } from "@/components/dashboard/ActiveInvestments";
import { WithdrawalDialog } from "@/components/dashboard/WithdrawalDialog";
import { WithdrawalHistory } from "@/components/dashboard/WithdrawalHistory";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeProfile } from "@/hooks/use-realtime-profile";

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [investDialogOpen, setInvestDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  // Enable realtime updates
  useRealtimeProfile();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth?mode=signup&ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  const handleInvestmentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["user-investments"] });
  };

  const handleWithdrawalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2">
            Welcome back, <span className="gradient-text">{profile.full_name || "Investor"}</span>
          </h1>
          <p className="text-muted-foreground">Here's your investment overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">${Number(profile.total_balance).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-success">${Number(profile.total_earnings).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawn</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">${Number(profile.total_withdrawn).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Next Earning</CardTitle>
              <Clock className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">14 days</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Investments */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: "0.5s" }}>
          <ActiveInvestments />
        </div>

        {/* Withdrawal History */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: "0.55s" }}>
          <WithdrawalHistory />
        </div>

        {/* Referral Section */}
        <Card className="glass-card mb-8 animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="bg-secondary/50 border border-border rounded-lg px-4 py-3 font-mono text-xl font-bold text-primary">
                  {profile.referral_code}
                </div>
              </div>
              <Button onClick={copyReferralLink} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Share this code with friends to earn referral bonuses
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.7s" }}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>New Investment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Start a new investment package and earn 10% bi-weekly returns.</p>
              <Button variant="hero" onClick={() => setInvestDialogOpen(true)}>
                Start Investing
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Request Withdrawal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Withdraw your earnings to your crypto wallet.</p>
              <Button variant="outline" onClick={() => setWithdrawDialogOpen(true)}>
                Request Withdrawal
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <InvestmentDialog 
        open={investDialogOpen} 
        onOpenChange={setInvestDialogOpen}
        onSuccess={handleInvestmentSuccess}
      />

      <WithdrawalDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        onSuccess={handleWithdrawalSuccess}
      />
    </div>
  );
}
