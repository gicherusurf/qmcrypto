import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useRealtimeProfile } from "@/hooks/use-realtime-profile";
import { Radio, TrendingUp, TrendingDown, Bot, Clock, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Countdown } from "@/components/signals/Countdown";
import { ProgressBar } from "@/components/signals/ProgressBar";
import { NewBadge } from "@/components/signals/NewBadge";
import { LiveBadge } from "@/components/signals/LiveBadge";
import { BigCountdown } from "@/components/signals/BigCountdown";
import { useCryptoPrices } from "@/hooks/use-crypto-prices";

interface SignalRow {
  id: string;
  pair: string;
  direction: "LONG" | "SHORT";
  entry_price: number;
  target_price: number;
  profit_percentage: number;
  message: string | null;
  status: "open" | "closed" | "cancelled";
  closes_at: string;
  created_at: string;
}

interface TakeRow {
  id: string;
  signal_id: string;
  stake_amount: number;
  profit_amount: number;
  status: "active" | "won";
}

export default function Signals() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  useRealtimeProfile();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: signals, refetch: refetchSignals } = useQuery({
    queryKey: ["signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Newest signals first — do not reverse.
      return (data ?? []) as SignalRow[];
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: takes, refetch: refetchTakes } = useQuery({
    queryKey: ["user-takes", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("signal_takes")
        .select("*")
        .eq("user_id", profile.id);
      if (error) throw error;
      return (data ?? []) as TakeRow[];
    },
    enabled: !!profile?.id,
  });

  const { data: prices } = useCryptoPrices();

  const takesById = useMemo(() => {
    const m = new Map<string, TakeRow>();
    (takes || []).forEach((t) => m.set(t.signal_id, t));
    return m;
  }, [takes]);

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
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-3xl">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" /> Signal Bot
            </h1>
            <p className="text-sm text-muted-foreground">Live trading signals · 3% profit per call</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Available</div>
            <div className="font-display font-bold text-lg text-primary">${Number(profile.total_balance).toFixed(2)}</div>
          </div>
        </div>

        <div className="mb-6">
          <BigCountdown signals={signals} />
        </div>

        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {!signals?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Radio className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>The bot is preparing signals. Check back shortly.</p>
              </div>
            ) : (
              signals.map((s) => (
                <SignalBubble
                  key={s.id}
                  signal={s}
                  take={takesById.get(s.id)}
                  balance={Number(profile.total_balance)}
                  livePrice={prices?.[s.pair]}
                  onTaken={() => {
                    refetchTakes();
                    refetchSignals();
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SignalBubble({
  signal,
  take,
  balance,
  livePrice,
  onTaken,
}: {
  signal: SignalRow;
  take: TakeRow | undefined;
  balance: number;
  livePrice: number | undefined;
  onTaken: () => void;
}) {
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);

  // Tick every second so `isOpen` (and the LiveBadge it drives) flips to
  // CLOSED exactly when the signal expires, not just on the 15s refetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isOpen = signal.status === "open" && new Date(signal.closes_at) > new Date();
  const longShort = signal.direction === "LONG";

  const handleTake = async () => {
    const amt = parseFloat(stake);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Enter a valid stake", variant: "destructive" });
      return;
    }
    if (amt > balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("take_signal", { _signal_id: signal.id, _stake: amt });
    setBusy(false);
    if (error) {
      toast({ title: "Could not take signal", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Trade opened", description: `Staked $${amt.toFixed(2)} on ${signal.pair}` });
    setStake("");
    onTaken();
  };

  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground mb-1">
          Signal Bot · {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-secondary/40 border border-border p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-lg">{signal.pair}</span>
              <Badge variant={longShort ? "default" : "secondary"} className="gap-1">
                {longShort ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {signal.direction}
              </Badge>
              <Badge variant="outline" className="text-primary border-primary/40">
                +{Number(signal.profit_percentage).toFixed(1)}%
              </Badge>
              <NewBadge createdAt={signal.created_at} />
            </div>
            <LiveBadge isLive={isOpen} />
          </div>

          <ProgressBar createdAt={signal.created_at} closesAt={signal.closes_at} />

          {signal.message && <p className="text-sm">{signal.message}</p>}

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-background/50">
              <div className="text-muted-foreground">Entry</div>
              <div className="font-mono">{Number(signal.entry_price).toLocaleString()}</div>
              {livePrice !== undefined && (
                <div className="text-[10px] text-muted-foreground font-mono">Live {livePrice.toLocaleString()}</div>
              )}
            </div>
            <div className="p-2 rounded bg-background/50">
              <div className="text-muted-foreground">Target</div>
              <div className="font-mono text-success">{Number(signal.target_price).toLocaleString()}</div>
            </div>
            <div className="p-2 rounded bg-background/50">
              <div className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Closes</div>
              <Countdown closesAt={signal.closes_at} className="text-xs" />
            </div>
          </div>

          {take ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <div>
                  <div className="text-sm font-medium">
                    {take.status === "won" ? "Closed for profit" : "Trade active"}
                  </div>
                  <div className="text-xs text-muted-foreground">Stake ${Number(take.stake_amount).toFixed(2)}</div>
                </div>
              </div>
              <div className="text-right">
                {take.status === "won" ? (
                  <div className="text-success font-display font-bold">+${Number(take.profit_amount).toFixed(2)}</div>
                ) : (
                  <div className="text-xs text-muted-foreground">Awaiting close</div>
                )}
              </div>
            </div>
          ) : isOpen ? (
            <div className="flex flex-wrap gap-2">
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="Stake $"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                disabled={busy}
                className="flex-1 min-w-[7rem]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setStake(balance.toFixed(2))}
                disabled={busy || balance <= 0}
                className="shrink-0"
              >
                Max
              </Button>
              <Button onClick={handleTake} disabled={busy} variant="hero" className="shrink-0 w-full sm:w-auto">
                {busy ? "Opening..." : "Take Signal"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Signal closed. Wait for the next one.</p>
          )}
        </div>
      </div>
    </div>
  );
}
