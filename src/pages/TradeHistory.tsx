import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeProfile } from "@/hooks/use-realtime-profile";
import { History, TrendingUp, TrendingDown, Loader2, Wallet } from "lucide-react";
import { format } from "date-fns";

type SignalRef = {
  pair: string;
  direction: string;
  entry_price: number | null;
  target_price: number | null;
  profit_percentage: number;
  status: string;
  closes_at: string | null;
  closed_at: string | null;
};

type TakeRow = {
  id: string;
  stake_amount: number;
  profit_amount: number;
  status: string;
  created_at: string;
  closed_at: string | null;
  signals: SignalRef | null;
};

export default function TradeHistory() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  useRealtimeProfile();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["trade-history", profile?.id],
    queryFn: async (): Promise<TakeRow[]> => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("signal_takes")
        .select("id, stake_amount, profit_amount, status, created_at, closed_at, signals(pair, direction, entry_price, target_price, profit_percentage, status, closes_at, closed_at)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TakeRow[];
    },
    enabled: !!profile?.id,
  });

  const stats = useMemo(() => {
    const rows = data || [];
    const closed = rows.filter((r) => r.status === "won");
    const active = rows.filter((r) => r.status === "active");
    const totalProfit = closed.reduce((sum, r) => sum + Number(r.profit_amount || 0), 0);
    const totalStakeClosed = closed.reduce((sum, r) => sum + Number(r.stake_amount || 0), 0);
    const totalStakeActive = active.reduce((sum, r) => sum + Number(r.stake_amount || 0), 0);
    return {
      totalTrades: rows.length,
      closedTrades: closed.length,
      activeTrades: active.length,
      totalProfit,
      totalStakeClosed,
      totalStakeActive,
      avgRoi: totalStakeClosed > 0 ? (totalProfit / totalStakeClosed) * 100 : 0,
    };
  }, [data]);

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
          <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-2">
            <History className="h-8 w-8 text-primary" /> Trade History
          </h1>
          <p className="text-muted-foreground">Full P/L breakdown for every signal you've taken</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold text-success">+${stats.totalProfit.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Avg ROI</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">{stats.avgRoi.toFixed(2)}%</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Closed Trades</CardTitle>
              <TrendingDown className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">{stats.closedTrades}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Active Stake</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-display font-bold">${stats.totalStakeActive.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.activeTrades} open</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>All Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !data?.length ? (
              <p className="text-center text-muted-foreground py-10">
                No trades yet. Take a signal to start building your history.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pair</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Stake</TableHead>
                      <TableHead>Entry Time</TableHead>
                      <TableHead>Close Time</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">P/L</TableHead>
                      <TableHead className="text-right">Credited</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((t) => {
                      const s = t.signals;
                      const pct = s ? Number(s.profit_percentage) : 3;
                      const projected = Number(t.stake_amount) * (pct / 100);
                      const isWon = t.status === "won";
                      const profit = isWon ? Number(t.profit_amount) : projected;
                      const credited = isWon ? Number(t.stake_amount) + Number(t.profit_amount) : 0;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{s?.pair || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={s?.direction === "LONG" ? "default" : "secondary"}>
                              {s?.direction || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">${Number(t.stake_amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(t.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.closed_at
                              ? format(new Date(t.closed_at), "MMM d, HH:mm")
                              : s?.closes_at
                              ? `~${format(new Date(s.closes_at), "MMM d, HH:mm")}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">{pct.toFixed(2)}%</TableCell>
                          <TableCell className={`text-right font-medium ${isWon ? "text-success" : "text-muted-foreground"}`}>
                            {isWon ? "+" : "~"}${profit.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-display">
                            {credited > 0 ? `$${credited.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isWon ? "default" : "outline"}>
                              {isWon ? "Closed · Won" : "Active"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
