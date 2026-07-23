import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Users, Gift, Radio } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { nextTierInfo } from "@/hooks/use-signal-quota";

interface ReferralStats {
  total_referrals: number;
  deposited_referrals: number;
  daily_signal_limit: number;
  signup_bonus_earned: number;
  signal_commission_earned: number;
  total_referral_earnings: number;
}

export function ReferralCard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);

  const code = profile?.referral_code || "";
  const link = `${window.location.origin}/auth?mode=signup&ref=${code}`;

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data } = await supabase.rpc("get_my_referral_stats");
      if (data?.[0]) setStats(data[0] as ReferralStats);
    })();
  }, [profile?.id]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const next = stats ? nextTierInfo(stats.deposited_referrals) : null;

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Refer & Earn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Earn a <span className="text-primary font-semibold">10% instant bonus</span> on every approved referral deposit, plus <span className="text-primary font-semibold">0.5% of profits</span> from each signal your referrals take. Referrals who deposit also unlock more signals per day for you.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="h-3 w-3" /> Total Referrals</div>
            <div className="text-2xl font-display font-bold">{stats?.total_referrals ?? 0}</div>
          </div>
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="h-3 w-3" /> Deposited</div>
            <div className="text-2xl font-display font-bold">{stats?.deposited_referrals ?? 0}</div>
          </div>
        </div>

        <div className="glass-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Radio className="h-3 w-3" /> Your Signal Tier</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-bold text-primary">{stats?.daily_signal_limit ?? 2}</span>
            <span className="text-sm text-muted-foreground">signals/day</span>
          </div>
          {next ? (
            <p className="text-xs text-muted-foreground mt-1">
              Refer {next.needed} more {next.needed === 1 ? "person" : "people"} who deposit to unlock {next.unlocksLimit} signals/day.
            </p>
          ) : (
            <p className="text-xs text-success mt-1">You're on the top tier.</p>
          )}
        </div>

        <div className="glass-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Gift className="h-3 w-3" /> Total Earned</div>
          <div className="text-2xl font-display font-bold text-success">${(stats?.total_referral_earnings ?? 0).toFixed(2)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            ${(stats?.signup_bonus_earned ?? 0).toFixed(2)} deposit bonuses + ${(stats?.signal_commission_earned ?? 0).toFixed(2)} signal commissions
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Your code</label>
          <div className="flex gap-2">
            <Input readOnly value={code} className="font-mono" />
            <Button variant="outline" size="icon" onClick={() => copy(code, "Code")}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Your referral link</label>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(link, "Link")}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
