import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Zap, Play, Radio, Users, Wallet, TrendingUp, CalendarDays, CalendarRange } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StatCard } from "@/components/admin/StatCard";
import { Countdown } from "@/components/signals/Countdown";
import { startOfEatDay, startOfEatWeek } from "@/lib/signal-schedule";

type ProfileLite = { full_name: string | null; email: string | null } | null;
type SignalLite = { pair: string; direction: string; status?: string } | null;

export function AdminSignals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [genBusy, setGenBusy] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["admin-signal-dashboard"],
    queryFn: async () => {
      const now = new Date();
      const dayStart = startOfEatDay(now).toISOString();
      const weekStart = startOfEatWeek(now).toISOString();

      const [
        currentSignalRes,
        signalsTodayRes,
        signalsWeekRes,
        allTakesRes,
        recentSettlementsRes,
        latestParticipantsRes,
      ] = await Promise.all([
        supabase
          .from("signals")
          .select("*")
          .eq("status", "open")
          .gt("closes_at", now.toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("signals").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
        supabase.from("signals").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
        supabase.from("signal_takes").select("stake_amount, profit_amount, status"),
        supabase
          .from("signal_takes")
          .select("*, profiles(full_name, email), signals(pair, direction)")
          .eq("status", "won")
          .order("closed_at", { ascending: false })
          .limit(8),
        supabase
          .from("signal_takes")
          .select("*, profiles(full_name, email), signals(pair, direction, status)")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      let currentParticipants = 0;
      let currentStake = 0;
      if (currentSignalRes.data) {
        const { data: currentTakes } = await supabase
          .from("signal_takes")
          .select("stake_amount")
          .eq("signal_id", currentSignalRes.data.id);
        currentParticipants = currentTakes?.length ?? 0;
        currentStake = (currentTakes ?? []).reduce((s, t) => s + Number(t.stake_amount), 0);
      }

      const allTakes = allTakesRes.data ?? [];
      const totalStakedAllTime = allTakes.reduce((s, t) => s + Number(t.stake_amount), 0);
      const totalSimulatedProfit = allTakes
        .filter((t) => t.status === "won")
        .reduce((s, t) => s + Number(t.profit_amount || 0), 0);

      return {
        currentSignal: currentSignalRes.data,
        currentParticipants,
        currentStake,
        signalsToday: signalsTodayRes.count || 0,
        signalsThisWeek: signalsWeekRes.count || 0,
        totalParticipations: allTakes.length,
        totalStakedAllTime,
        totalSimulatedProfit,
        recentSettlements: recentSettlementsRes.data || [],
        latestParticipants: latestParticipantsRes.data || [],
      };
    },
    refetchInterval: 10000,
  });

  const triggerGenerate = async () => {
    setGenBusy(true);
    try {
      const { error } = await supabase.functions.invoke("generate-signal", { body: { force: true } });
      if (error) throw error;
      toast({ title: "Signal generated" });
      qc.invalidateQueries({ queryKey: ["admin-signals"] });
      qc.invalidateQueries({ queryKey: ["admin-signal-dashboard"] });
      qc.invalidateQueries({ queryKey: ["signals"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setGenBusy(false);
    }
  };

  const triggerClose = async () => {
    setCloseBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("close-signals");
      if (error) throw error;
      const closed = (data as { closed?: number } | null)?.closed ?? 0;
      toast({ title: `Closed ${closed} signal(s)` });
      qc.invalidateQueries({ queryKey: ["admin-signals"] });
      qc.invalidateQueries({ queryKey: ["admin-signal-dashboard"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCloseBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader><CardTitle>Signal Controls</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={triggerGenerate} disabled={genBusy} variant="hero">
            {genBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            Generate Signal Now
          </Button>
          <Button onClick={triggerClose} disabled={closeBusy} variant="outline">
            {closeBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Process Due Closures
          </Button>
        </CardContent>
      </Card>

      {dashboardLoading || !dashboard ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <Card className="glass-card">
            <CardHeader><CardTitle>Current Signal</CardTitle></CardHeader>
            <CardContent>
              {dashboard.currentSignal ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-lg">{dashboard.currentSignal.pair}</span>
                    <Badge variant={dashboard.currentSignal.direction === "LONG" ? "default" : "secondary"}>
                      {dashboard.currentSignal.direction}
                    </Badge>
                    <Badge variant="default" className="gap-1 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> LIVE NOW
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Time Remaining</div>
                    <Countdown closesAt={dashboard.currentSignal.closes_at} className="text-xl" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Participants</div>
                    <div className="font-display font-bold">{dashboard.currentParticipants}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total Stake</div>
                    <div className="font-display font-bold">${dashboard.currentStake.toFixed(2)}</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No signal is active right now. The next one arrives automatically on schedule.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={CalendarDays} label="Signals Today" value={dashboard.signalsToday} tone="info" />
            <StatCard icon={CalendarRange} label="Signals This Week" value={dashboard.signalsThisWeek} tone="info" />
            <StatCard icon={Users} label="Total Participations" value={dashboard.totalParticipations} tone="primary" />
            <StatCard icon={Wallet} label="Total Staked (All Time)" value={`$${dashboard.totalStakedAllTime.toFixed(2)}`} tone="primary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard icon={TrendingUp} label="Total Simulated Profit Paid" value={`$${dashboard.totalSimulatedProfit.toFixed(2)}`} tone="success" />
            <StatCard icon={Radio} label="Open Positions Right Now" value={dashboard.currentParticipants} tone="warning" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader><CardTitle>Recent Settlements</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.recentSettlements.map((t) => {
                        const p = t.profiles as ProfileLite;
                        const s = t.signals as SignalLite;
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                              <div className="text-xs text-muted-foreground">{p?.email}</div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{s?.pair || "—"}</div>
                              <div className="text-muted-foreground">{s?.direction}</div>
                            </TableCell>
                            <TableCell>${Number(t.stake_amount).toFixed(2)}</TableCell>
                            <TableCell className="text-success">+${Number(t.profit_amount || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {dashboard.recentSettlements.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No settlements yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>Latest Participants</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>Stake</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.latestParticipants.map((t) => {
                        const p = t.profiles as ProfileLite;
                        const s = t.signals as SignalLite;
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                              <div className="text-xs text-muted-foreground">{p?.email}</div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{s?.pair || "—"}</div>
                              <div className="text-muted-foreground">{s?.direction}</div>
                            </TableCell>
                            <TableCell>${Number(t.stake_amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={t.status === "won" ? "default" : "outline"}>{t.status}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {dashboard.latestParticipants.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No participants yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card className="glass-card">
        <CardHeader><CardTitle>Recent Signals</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pair</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Profit %</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Closes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.pair}</TableCell>
                      <TableCell><Badge variant={s.direction === "LONG" ? "default" : "secondary"}>{s.direction}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{Number(s.entry_price).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{Number(s.target_price).toLocaleString()}</TableCell>
                      <TableCell>{Number(s.profit_percentage).toFixed(2)}%</TableCell>
                      <TableCell><Badge variant={s.status === "open" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), "MMM d HH:mm")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.closes_at), "MMM d HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
