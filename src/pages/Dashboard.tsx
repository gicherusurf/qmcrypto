import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, ArrowUpRight, Radio, ArrowDownLeft } from "lucide-react";
import { DepositDialog } from "@/components/dashboard/DepositDialog";
import { WithdrawalDialog } from "@/components/dashboard/WithdrawalDialog";
import { WithdrawalHistory } from "@/components/dashboard/WithdrawalHistory";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { ReferralCard } from "@/components/dashboard/ReferralCard";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeProfile } from "@/hooks/use-realtime-profile";

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  useRealtimeProfile();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const onChange = () => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["user-deposits"] });
    queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] });
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
            Welcome back, <span className="gradient-text">{profile.full_name || "Trader"}</span>
          </h1>
          <p className="text-muted-foreground">Your trading overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Trading Balance</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">${Number(profile.total_balance).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Profits</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-success">${Number(profile.total_earnings).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawn</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">${Number(profile.total_withdrawn).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader><CardTitle>Deposit</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">Add crypto to your trading balance.</p>
              <Button variant="hero" onClick={() => setDepositOpen(true)} className="w-full">
                <ArrowDownLeft className="h-4 w-4 mr-2" /> Deposit
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>Live Signals</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">Open the chat to see active signals.</p>
              <Button variant="hero" onClick={() => navigate("/signals")} className="w-full">
                <Radio className="h-4 w-4 mr-2" /> Open Signals
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>Withdraw</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4 text-sm">Move profits to your crypto wallet.</p>
              <Button variant="outline" onClick={() => setWithdrawOpen(true)} className="w-full">
                <ArrowUpRight className="h-4 w-4 mr-2" /> Withdraw
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8"><ReferralCard /></div>
        <div className="mb-8"><RecentTrades /></div>
        <div className="mb-8"><WithdrawalHistory /></div>
      </main>

      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} onSuccess={onChange} />
      <WithdrawalDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} onSuccess={onChange} />
    </div>
  );
}
