import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Users, DollarSign, Wallet, Loader2, Gift, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string; color: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="pt-6 flex items-center gap-3">
        <div className={`p-3 rounded-full ${color}`}><Icon className="h-5 w-5" /></div>
        <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
      </CardContent>
    </Card>
  );
}

export default function Franchise() {
  const { isFranchise, isAdmin, loading } = useAuth();
  // Admin "view as" mode: which franchise the admin is previewing
  const [viewAsId, setViewAsId] = useState<string | null>(null);
  const adminViewing = isAdmin && !!viewAsId;

  // Admins get a list of franchises to pick from
  const { data: franchiseList } = useQuery({
    queryKey: ["admin-franchise-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_franchises");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const { data: stats } = useQuery({
    queryKey: ["franchise-stats", viewAsId],
    queryFn: async () => {
      const { data, error } = adminViewing
        ? await supabase.rpc("admin_franchise_stats", { _franchise_id: viewAsId! })
        : await supabase.rpc("franchise_get_stats");
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: (isFranchise || adminViewing),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["franchise-members", viewAsId],
    queryFn: async () => {
      const { data, error } = adminViewing
        ? await supabase.rpc("admin_franchise_members", { _franchise_id: viewAsId! })
        : await supabase.rpc("franchise_get_members");
      if (error) throw error;
      return data ?? [];
    },
    enabled: (isFranchise || adminViewing),
  });

  const { data: deposits } = useQuery({
    queryKey: ["franchise-deposits", viewAsId],
    queryFn: async () => {
      const { data, error } = adminViewing
        ? await supabase.rpc("admin_franchise_deposits", { _franchise_id: viewAsId! })
        : await supabase.rpc("franchise_get_deposits");
      if (error) throw error;
      return data ?? [];
    },
    enabled: (isFranchise || adminViewing),
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["franchise-withdrawals", viewAsId],
    queryFn: async () => {
      const { data, error } = adminViewing
        ? await supabase.rpc("admin_franchise_withdrawals", { _franchise_id: viewAsId! })
        : await supabase.rpc("franchise_get_withdrawals");
      if (error) throw error;
      return data ?? [];
    },
    enabled: (isFranchise || adminViewing),
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Franchisees and admins allowed; everyone else redirected
  if (!isFranchise && !isAdmin) return <Navigate to="/dashboard" replace />;

  const statusVariant = (s: string) =>
    s === "approved" || s === "completed" ? "default" : s === "rejected" ? "destructive" : "secondary";

  // Admin who hasn't picked a franchise yet: show the picker
  const showPicker = isAdmin && !isFranchise;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">
            {showPicker ? <>Franchise <span className="gradient-text">Overview</span></> : <>My <span className="gradient-text">Franchise</span></>}
          </h1>
          <p className="text-muted-foreground">
            {showPicker
              ? "Select a franchise to preview their scoped panel (read-only)."
              : "Your business network and performance. You have view-only access to your team."}
          </p>
        </div>

        {isAdmin && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" /> Viewing as:
            </div>
            <Select value={viewAsId ?? ""} onValueChange={(v) => setViewAsId(v || null)}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Select a franchise to preview" />
              </SelectTrigger>
              <SelectContent>
                {franchiseList?.map((f: Record<string, unknown>) => (
                  <SelectItem key={f.profile_id as string} value={f.profile_id as string}>
                    {(f.full_name as string) || (f.email as string)}
                  </SelectItem>
                ))}
                {(!franchiseList || franchiseList.length === 0) && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No franchises yet</div>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {showPicker && !viewAsId ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Eye className="h-8 w-8 mx-auto mb-3 opacity-50" />
              Select a franchise above to preview their panel.
            </CardContent>
          </Card>
        ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Team Members" value={String(stats?.total_members ?? 0)} color="bg-primary/10 text-primary" />
          <StatCard icon={DollarSign} label="Total Deposits" value={`$${Number(stats?.total_deposits ?? 0).toFixed(2)}`} color="bg-success/10 text-success" />
          <StatCard icon={Wallet} label="Total Withdrawals" value={`$${Number(stats?.total_withdrawals ?? 0).toFixed(2)}`} color="bg-blue-500/10 text-blue-400" />
          <StatCard icon={Gift} label="Commissions Generated" value={`$${Number(stats?.total_commissions ?? 0).toFixed(2)}`} color="bg-amber-500/10 text-amber-400" />
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <Card className="glass-card">
              <CardHeader><CardTitle>Team Members ({members?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Rank</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Earnings</TableHead>
                        <TableHead className="text-right">Team Volume</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {members?.map((m: Record<string, unknown>) => (
                          <TableRow key={m.id as string}>
                            <TableCell>
                              <span className="font-medium">{(m.full_name as string) || "—"}</span>
                              {m.banned as boolean && <Badge variant="destructive" className="ml-2 text-[10px]">Banned</Badge>}
                            </TableCell>
                            <TableCell className="capitalize">{(m.current_rank as string) || "none"}</TableCell>
                            <TableCell className="text-right">${Number(m.total_balance).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-success">${Number(m.total_earnings).toFixed(2)}</TableCell>
                            <TableCell className="text-right">${Number(m.team_volume).toFixed(2)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.created_at ? format(new Date(m.created_at as string), "MMM d, yyyy") : "—"}</TableCell>
                          </TableRow>
                        ))}
                        {(!members || members.length === 0) && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No team members yet</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deposits">
            <Card className="glass-card">
              <CardHeader><CardTitle>Deposits ({deposits?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {deposits?.map((d: Record<string, unknown>) => (
                        <TableRow key={d.id as string}>
                          <TableCell>{(d.member_name as string) || "—"}</TableCell>
                          <TableCell className="text-right">${Number(d.amount_usd).toFixed(2)}</TableCell>
                          <TableCell className="uppercase text-xs">{(d.method as string) || "usdt"}</TableCell>
                          <TableCell><Badge variant={statusVariant(d.status as string)}>{d.status as string}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{d.created_at ? format(new Date(d.created_at as string), "MMM d, yyyy") : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(!deposits || deposits.length === 0) && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No deposits yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="glass-card">
              <CardHeader><CardTitle>Withdrawals ({withdrawals?.length ?? 0})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {withdrawals?.map((w: Record<string, unknown>) => (
                        <TableRow key={w.id as string}>
                          <TableCell>{(w.member_name as string) || "—"}</TableCell>
                          <TableCell className="text-right">${Number(w.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${Number(w.net_amount).toFixed(2)}</TableCell>
                          <TableCell className="uppercase text-xs">{(w.method as string) || "usdt"}</TableCell>
                          <TableCell><Badge variant={statusVariant(w.status as string)}>{w.status as string}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{w.requested_at ? format(new Date(w.requested_at as string), "MMM d, yyyy") : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(!withdrawals || withdrawals.length === 0) && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No withdrawals yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </>
        )}
      </main>
    </div>
  );
}
