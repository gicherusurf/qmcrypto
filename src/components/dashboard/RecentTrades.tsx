import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export function RecentTrades() {
  const { profile } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["recent-trades", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("signal_takes")
        .select("*, signals(pair, direction, profit_percentage, status)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Recent Trades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !data?.length ? (
          <p className="text-center text-muted-foreground py-4">No trades yet. Head to Signals to take your first one.</p>
        ) : (
          <div className="space-y-3">
            {data.map((t) => {
              const signal = t.signals as { pair: string; direction: string; profit_percentage: number; status: string } | null;
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{signal?.pair || "—"}</span>
                      <Badge variant={signal?.direction === "LONG" ? "default" : "secondary"}>{signal?.direction}</Badge>
                      <Badge variant={t.status === "won" ? "default" : "outline"}>
                        {t.status === "won" ? "Profit" : "Active"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Stake ${Number(t.stake_amount).toFixed(2)} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-right">
                    {t.status === "won" ? (
                      <div className="text-success font-display font-bold">+${Number(t.profit_amount).toFixed(2)}</div>
                    ) : (
                      <div className="text-muted-foreground text-sm">Pending</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
