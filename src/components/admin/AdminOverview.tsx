import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, DollarSign, ArrowUpRight, Radio, Gift, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { StatCard } from "@/components/admin/StatCard";

type ProfileLite = { full_name: string | null; email: string | null } | null;


export function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [
        usersRes,
        depositsAllRes,
        depositsApprRes,
        depositsPendRes,
        withdrawalsAllRes,
        withdrawalsPendRes,
        withdrawalsCompRes,
        referralsRes,
        signalsRes,
        takesRes,
        recentDeposits,
        recentWithdrawals,
        recentTakes,
        recentReferrals,
        recentUsers,
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("deposits").select("amount_usd"),
        supabase.from("deposits").select("amount_usd").eq("status", "approved"),
        supabase.from("deposits").select("amount_usd", { count: "exact" }).eq("status", "pending"),
        supabase.from("withdrawals").select("amount"),
        supabase.from("withdrawals").select("amount", { count: "exact" }).eq("status", "pending"),
        supabase.from("withdrawals").select("amount, net_amount").eq("status", "completed"),
        supabase.from("referral_commissions").select("commission_amount"),
        supabase.from("signals").select("id, status", { count: "exact" }),
        supabase.from("signal_takes").select("stake_amount, profit_amount"),
        supabase
          .from("deposits")
          .select("*, profiles(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("withdrawals")
          .select("*, profiles(full_name, email)")
          .order("requested_at", { ascending: false })
          .limit(5),
        supabase
          .from("signal_takes")
          .select("*, profiles(full_name, email), signals(pair, direction, status)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("referral_commissions")
          .select("*, referrer:profiles!referral_commissions_referrer_id_fkey(full_name, email), referee:profiles!referral_commissions_referee_id_fkey(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("profiles")
          .select("id, full_name, email, created_at, total_balance, withdrawable_balance")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const sum = (rows: { amount_usd?: number | string; amount?: number | string; commission_amount?: number | string; stake_amount?: number | string; profit_amount?: number | string; net_amount?: number | string }[] | null | undefined, key: string) =>
        (rows || []).reduce((s, r) => s + Number((r as Record<string, unknown>)[key] ?? 0), 0);

      const openSignals = (signalsRes.data || []).filter((s) => s.status === "open").length;

      return {
        totalUsers: usersRes.count || 0,
        deposits: {
          total: sum(depositsAllRes.data, "amount_usd"),
          approved: sum(depositsApprRes.data, "amount_usd"),
          pendingCount: depositsPendRes.count || 0,
        },
        withdrawals: {
          totalRequested: sum(withdrawalsAllRes.data, "amount"),
          completedNet: sum(withdrawalsCompRes.data, "net_amount"),
          pendingCount: withdrawalsPendRes.count || 0,
        },
        referrals: {
          count: (referralsRes.data || []).length,
          totalPaid: sum(referralsRes.data, "commission_amount"),
        },
        signals: {
          total: signalsRes.count || 0,
          open: openSignals,
          takesCount: (takesRes.data || []).length,
          totalStaked: sum(takesRes.data, "stake_amount"),
          totalProfit: sum(takesRes.data, "profit_amount"),
        },
        recentDeposits: recentDeposits.data || [],
        recentWithdrawals: recentWithdrawals.data || [],
        recentTakes: recentTakes.data || [],
        recentReferrals: recentReferrals.data || [],
        recentUsers: recentUsers.data || [],
      };
    },
    refetchInterval: 20000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Total Users" value={data.totalUsers} tone="primary" />
        <StatCard icon={DollarSign} label="Approved Deposits" value={`$${data.deposits.approved.toFixed(2)}`} tone="success" />
        <StatCard icon={DollarSign} label="Pending Deposits" value={data.deposits.pendingCount} tone="warning" />
        <StatCard icon={ArrowUpRight} label="Pending Withdrawals" value={data.withdrawals.pendingCount} tone="warning" />
        <StatCard icon={Radio} label="Open Signals" value={`${data.signals.open}/${data.signals.total}`} tone="info" />
        <StatCard icon={Gift} label="Referral Payouts" value={`$${data.referrals.totalPaid.toFixed(2)}`} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Total Staked" value={`$${data.signals.totalStaked.toFixed(2)}`} tone="info" />
        <StatCard icon={TrendingUp} label="Total Trader Profit" value={`$${data.signals.totalProfit.toFixed(2)}`} tone="success" />
        <StatCard icon={ArrowUpRight} label="Withdrawals Paid (Net)" value={`$${data.withdrawals.completedNet.toFixed(2)}`} tone="success" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle>Recent Users</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>${Number(u.total_balance).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.created_at ? format(new Date(u.created_at), "MMM d") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {data.recentUsers.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No users yet</TableCell></TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle>Recent Deposits</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentDeposits.map((d) => {
                  const p = d.profiles as ProfileLite;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email}</div>
                      </TableCell>
                      <TableCell>${Number(d.amount_usd).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data.recentDeposits.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No deposits yet</TableCell></TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle>Recent Withdrawal Requests</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentWithdrawals.map((w) => {
                  const p = w.profiles as ProfileLite;
                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email}</div>
                      </TableCell>
                      <TableCell>${Number(w.amount).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="secondary">{w.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {data.recentWithdrawals.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No withdrawals yet</TableCell></TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle>Recent Signals Taken</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead>Stake</TableHead>
                  <TableHead>P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTakes.map((t) => {
                  const p = t.profiles as ProfileLite;
                  const s = t.signals as { pair: string; direction: string; status: string } | null;
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
                      <TableCell className="text-success">${Number(t.profit_amount || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {data.recentTakes.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No signals taken yet</TableCell></TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card xl:col-span-2">
          <CardHeader><CardTitle>Recent Referral Commissions</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Stake</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentReferrals.map((r) => {
                  const rr = r.referrer as ProfileLite;
                  const re = r.referee as ProfileLite;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{rr?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{rr?.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{re?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{re?.email}</div>
                      </TableCell>
                      <TableCell>${Number(r.stake_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-success">${Number(r.commission_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.created_at ? format(new Date(r.created_at), "MMM d") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {data.recentReferrals.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No referral commissions yet</TableCell></TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
