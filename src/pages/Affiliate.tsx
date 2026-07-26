import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Users, Network, Layers, Gift, TrendingUp, Crown, Percent,
  Wallet, Radio, CalendarClock, Copy, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAffiliateDashboard, RANK_INFO } from "@/hooks/use-affiliate-dashboard";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function StatCard({ icon: Icon, label, value, tone = "primary" }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: "primary" | "success" | "warning" }) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-yellow-500/10 text-yellow-400",
  };
  return (
    <Card className="glass-card">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-full ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-display font-bold truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Affiliate() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading } = useAffiliateDashboard();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || isLoading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  const rankInfo = RANK_INFO[data.current_rank] || RANK_INFO.none;
  const tvProgress = rankInfo.nextTV ? Math.min(100, (data.team_volume / rankInfo.nextTV) * 100) : 100;
  const refProgress = rankInfo.nextReferrals ? Math.min(100, (data.personal_referrals / rankInfo.nextReferrals) * 100) : 100;

  const code = profile?.referral_code || "";
  const link = `${window.location.origin}/auth?mode=signup&ref=${code}`;
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2"><span className="gradient-text">Affiliate Dashboard</span></h1>
          <p className="text-muted-foreground">Your 7-level unilevel network performance</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className={`h-6 w-6 ${rankInfo.color}`} /> Current Rank: <span className={rankInfo.color}>{rankInfo.label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rankInfo.nextRank ? (
              <>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Team Volume toward {rankInfo.nextRank}</span>
                    <span>${data.team_volume.toLocaleString()} / ${rankInfo.nextTV?.toLocaleString()}</span>
                  </div>
                  <Progress value={tvProgress} />
                </div>
                {rankInfo.nextReferrals && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Personal referrals toward {rankInfo.nextRank}</span>
                      <span>{data.personal_referrals} / {rankInfo.nextReferrals}</span>
                    </div>
                    <Progress value={refProgress} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-success">You've reached the top rank — Diamond.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Personal Referrals" value={String(data.personal_referrals)} />
          <StatCard icon={Network} label="Active Team Size" value={String(data.active_team_size)} />
          <StatCard icon={Layers} label="Team Volume" value={`$${data.team_volume.toLocaleString()}`} />
          <StatCard icon={Radio} label="Signals Today" value={`${data.taken_today}/${data.daily_signal_limit}`} tone={data.subscription_status === "expired" ? "warning" : "primary"} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Gift} label="Deposit Commissions" value={`$${data.deposit_commissions_earned.toFixed(2)}`} tone="success" />
          <StatCard icon={TrendingUp} label="Lifetime Profit Share" value={`$${data.profit_share_earned.toFixed(2)}`} tone="success" />
          <StatCard icon={Trophy} label="Leadership Bonuses" value={`$${data.leadership_bonuses_earned.toFixed(2)}`} tone="success" />
          <StatCard icon={Percent} label="Matching Bonuses" value={`$${data.matching_bonuses_earned.toFixed(2)}`} tone="success" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard icon={Wallet} label="Total Affiliate Earnings" value={`$${data.total_affiliate_earnings.toFixed(2)}`} tone="success" />
          <StatCard icon={Wallet} label="Available Commission Balance" value={`$${data.available_balance.toFixed(2)}`} />
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /> Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between flex-wrap gap-2">
            <Badge variant={data.subscription_status === "expired" ? "outline" : "default"} className={data.subscription_status === "expired" ? "text-destructive border-destructive/40" : ""}>
              {data.subscription_status === "expired" ? "Expired" : "Active"}
            </Badge>
            {data.next_billing_date && (
              <span className="text-xs text-muted-foreground">
                Next billing: {format(new Date(data.next_billing_date), "MMM d, yyyy")}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle>Your Referral Link</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={code} className="font-mono" />
              <Button variant="outline" size="icon" onClick={() => copy(code, "Code")}><Copy className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Input readOnly value={link} className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(link, "Link")}><Copy className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
