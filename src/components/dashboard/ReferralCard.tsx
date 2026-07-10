import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Users, Gift } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ReferralCard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({ count: 0, total: 0 });

  const code = profile?.referral_code || "";
  const link = `${window.location.origin}/auth?mode=signup&ref=${code}`;

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const { data } = await supabase
        .from("referral_commissions")
        .select("commission_amount, referee_id")
        .eq("referrer_id", profile.id);
      if (data) {
        const total = data.reduce((s, r) => s + Number(r.commission_amount), 0);
        const count = new Set(data.map((r) => r.referee_id)).size;
        setStats({ count, total });
      }
    })();
  }, [profile?.id]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Refer & Earn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Earn a <span className="text-primary font-semibold">10% instant bonus</span> on every approved referral deposit, plus <span className="text-primary font-semibold">0.5% of profits</span> from each signal your referrals take.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Users className="h-3 w-3" /> Referrals</div>
            <div className="text-2xl font-display font-bold">{stats.count}</div>
          </div>
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Gift className="h-3 w-3" /> Earned</div>
            <div className="text-2xl font-display font-bold text-success">${stats.total.toFixed(2)}</div>
          </div>
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
