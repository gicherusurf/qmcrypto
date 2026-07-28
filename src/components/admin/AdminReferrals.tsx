import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Gift, TrendingUp, ChevronRight, ChevronDown, User as UserIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
};

// Normalized shape combining all three commission sources:
// - legacy `referral_commissions` (pre-7-level system, direct/level-1 only)
// - `affiliate_commissions` (7-level deposit cascade)
// - `profit_share_commissions` (7-level signal profit-share cascade)
type Commission = {
  id: string;
  referrer_id: string;
  referee_id: string;
  basis_amount: number;
  commission_amount: number;
  level: number;
  type: "deposit" | "profit_share" | "legacy_deposit" | "legacy_profit_share";
  created_at: string;
};

const TYPE_LABELS: Record<Commission["type"], string> = {
  deposit: "Deposit",
  profit_share: "Profit share",
  legacy_deposit: "Deposit (legacy)",
  legacy_profit_share: "Profit share (legacy)",
};

type TreeNode = Profile & {
  children: TreeNode[];
  totalDownline: number;
  commissionsEarned: number;
};

function buildTree(profiles: Profile[], commissions: Commission[]): { roots: TreeNode[]; byId: Map<string, TreeNode> } {
  const commissionSum = new Map<string, number>();
  commissions.forEach((c) => {
    commissionSum.set(c.referrer_id, (commissionSum.get(c.referrer_id) || 0) + Number(c.commission_amount || 0));
  });

  const byId = new Map<string, TreeNode>();
  profiles.forEach((p) => {
    byId.set(p.id, { ...p, children: [], totalDownline: 0, commissionsEarned: commissionSum.get(p.id) || 0 });
  });

  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.referred_by && byId.has(node.referred_by)) {
      byId.get(node.referred_by)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const countDownline = (n: TreeNode): number => {
    let sum = n.children.length;
    n.children.forEach((c) => { sum += countDownline(c); });
    n.totalDownline = sum;
    return sum;
  };
  roots.forEach(countDownline);

  return { roots, byId };
}

function TreeRow({ node, depth = 0, onSelect }: { node: TreeNode; depth?: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <>
      <div
        className="flex items-center gap-2 py-2 px-2 hover:bg-secondary/40 rounded text-sm border-b border-border/40"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className={`p-0.5 rounded ${hasChildren ? "hover:bg-secondary" : "invisible"}`}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => onSelect(node.id)}
          className="flex-1 min-w-0 text-left hover:text-primary transition-colors"
        >
          <div className="font-medium truncate flex items-center gap-1">
            {node.full_name || "—"}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </div>
          <div className="text-xs text-muted-foreground truncate">{node.email}</div>
        </button>
        <div className="hidden sm:block text-xs font-mono text-muted-foreground">{node.referral_code}</div>
        <div className="text-xs text-center w-20">
          <div className="font-medium">{node.children.length}</div>
          <div className="text-muted-foreground">direct</div>
        </div>
        <div className="text-xs text-center w-20">
          <div className="font-medium">{node.totalDownline}</div>
          <div className="text-muted-foreground">total</div>
        </div>
        <div className="text-xs text-right w-24 text-success font-medium">
          ${node.commissionsEarned.toFixed(2)}
        </div>
      </div>
      {open && node.children.map((c) => <TreeRow key={c.id} node={c} depth={depth + 1} onSelect={onSelect} />)}
    </>
  );
}

function UserDetailPanel({
  node,
  byId,
  commissions,
  onSelect,
  onClose,
}: {
  node: TreeNode;
  byId: Map<string, TreeNode>;
  commissions: Commission[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const referrer = node.referred_by ? byId.get(node.referred_by) : null;
  const earned = commissions.filter((c) => c.referrer_id === node.id);
  const paidToReferrer = commissions.filter((c) => c.referee_id === node.id);
  const totalEarned = earned.reduce((s, c) => s + Number(c.commission_amount || 0), 0);
  const totalStakeBasis = earned.reduce((s, c) => s + Number(c.basis_amount || 0), 0);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            {node.full_name || "—"}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>{node.email}</span>
            <span className="font-mono">Code: {node.referral_code}</span>
            <span>Joined {format(new Date(node.created_at), "MMM d, yyyy")}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Direct referrals</div>
            <div className="text-lg font-bold">{node.children.length}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Total downline</div>
            <div className="text-lg font-bold">{node.totalDownline}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Commissions earned</div>
            <div className="text-lg font-bold text-success">${totalEarned.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Payout events</div>
            <div className="text-lg font-bold">{earned.length}</div>
          </div>
        </div>

        {referrer && (
          <div className="rounded-lg border border-border p-3 text-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Referred by</div>
              <div className="font-medium">{referrer.full_name || "—"}</div>
              <div className="text-xs text-muted-foreground">{referrer.email}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onSelect(referrer.id)}>
              View <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold mb-2">Direct referrals ({node.children.length})</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Direct</TableHead>
                  <TableHead className="text-right">Downline</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {node.children.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{c.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </TableCell>
                    <TableCell className="text-right">{c.children.length}</TableCell>
                    <TableCell className="text-right">{c.totalDownline}</TableCell>
                    <TableCell className="text-right text-success">${c.commissionsEarned.toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => onSelect(c.id)}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {node.children.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-sm">No direct referrals</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">
            Commission history ({earned.length}) · Basis ${totalStakeBasis.toFixed(2)}
          </h4>
          <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From referee</TableHead>
                  <TableHead>Type / Level</TableHead>
                  <TableHead className="text-right">Basis</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earned.map((c) => {
                  const re = byId.get(c.referee_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="text-sm">{re?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{re?.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[c.type]} · L{c.level}</Badge>
                      </TableCell>
                      <TableCell className="text-right">${Number(c.basis_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-success font-medium">${Number(c.commission_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, HH:mm")}</TableCell>
                    </TableRow>
                  );
                })}
                {earned.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4 text-sm">No commissions yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>

        {paidToReferrer.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Generated for upline ({paidToReferrer.length})</h4>
            <div className="rounded-lg border border-border overflow-hidden max-h-48 overflow-y-auto">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>To referrer</TableHead>
                    <TableHead>Type / Level</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidToReferrer.map((c) => {
                    const rr = byId.get(c.referrer_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="text-sm">{rr?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{rr?.email}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABELS[c.type]} · L{c.level}</Badge></TableCell>
                        <TableCell className="text-right text-success">${Number(c.commission_amount).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, HH:mm")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminReferrals() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: async () => {
      const [profilesRes, legacyRes, depositRes, profitShareRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, referral_code, referred_by, created_at"),
        supabase.from("referral_commissions").select("id, referrer_id, referee_id, stake_amount, commission_amount, created_at, signal_take_id"),
        supabase.from("affiliate_commissions").select("id, referrer_id, referee_id, deposit_amount, commission_amount, level, created_at"),
        supabase.from("profit_share_commissions").select("id, referrer_id, referee_id, profit_amount, commission_amount, level, created_at"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (legacyRes.error) throw legacyRes.error;
      if (depositRes.error) throw depositRes.error;
      if (profitShareRes.error) throw profitShareRes.error;

      const legacy: Commission[] = (legacyRes.data || []).map((c) => ({
        id: c.id,
        referrer_id: c.referrer_id,
        referee_id: c.referee_id,
        basis_amount: Number(c.stake_amount || 0),
        commission_amount: Number(c.commission_amount || 0),
        level: 1,
        type: c.signal_take_id ? "legacy_profit_share" : "legacy_deposit",
        created_at: c.created_at,
      }));

      const deposit: Commission[] = (depositRes.data || []).map((c) => ({
        id: c.id,
        referrer_id: c.referrer_id,
        referee_id: c.referee_id,
        basis_amount: Number(c.deposit_amount || 0),
        commission_amount: Number(c.commission_amount || 0),
        level: c.level,
        type: "deposit",
        created_at: c.created_at,
      }));

      const profitShare: Commission[] = (profitShareRes.data || []).map((c) => ({
        id: c.id,
        referrer_id: c.referrer_id,
        referee_id: c.referee_id,
        basis_amount: Number(c.profit_amount || 0),
        commission_amount: Number(c.commission_amount || 0),
        level: c.level,
        type: "profit_share",
        created_at: c.created_at,
      }));

      const commissions = [...legacy, ...deposit, ...profitShare].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return {
        profiles: (profilesRes.data || []) as Profile[],
        commissions,
      };
    },
    refetchInterval: 30000,
  });

  const { roots, byId, ranked, stats } = useMemo(() => {
    if (!data) return { roots: [] as TreeNode[], byId: new Map<string, TreeNode>(), ranked: [] as TreeNode[], stats: { totalReferred: 0, activeReferrers: 0, totalPaid: 0 } };
    const { roots, byId } = buildTree(data.profiles, data.commissions);
    const ranked = Array.from(byId.values())
      .filter((n) => n.children.length > 0 || n.commissionsEarned > 0)
      .sort((a, b) => b.totalDownline - a.totalDownline || b.commissionsEarned - a.commissionsEarned);
    const totalReferred = data.profiles.filter((p) => p.referred_by).length;
    const activeReferrers = ranked.length;
    const totalPaid = data.commissions.reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    return { roots, byId, ranked, stats: { totalReferred, activeReferrers, totalPaid } };
  }, [data]);

  const filteredRoots = useMemo(() => {
    if (!search) return roots;
    const q = search.toLowerCase();
    const match = (n: TreeNode): boolean =>
      (n.full_name || "").toLowerCase().includes(q) ||
      (n.email || "").toLowerCase().includes(q) ||
      (n.referral_code || "").toLowerCase().includes(q) ||
      n.children.some(match);
    return roots.filter(match);
  }, [roots, search]);

  const selectedNode = selectedId ? byId.get(selectedId) : null;

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Referred Users</p><p className="text-xl font-bold">{stats.totalReferred}</p></div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-blue-500/10 text-blue-400"><TrendingUp className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Active Referrers</p><p className="text-xl font-bold">{stats.activeReferrers}</p></div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-success/10 text-success"><Gift className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Total Commissions Paid</p><p className="text-xl font-bold">${stats.totalPaid.toFixed(2)}</p></div>
        </CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle>Top Referrers</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Direct</TableHead>
                  <TableHead className="text-right">Total Downline</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.slice(0, 15).map((n) => (
                  <TableRow key={n.id} className="cursor-pointer" onClick={() => setSelectedId(n.id)}>
                    <TableCell>
                      <div className="text-sm font-medium">{n.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{n.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{n.referral_code}</TableCell>
                    <TableCell className="text-right">{n.children.length}</TableCell>
                    <TableCell className="text-right">{n.totalDownline}</TableCell>
                    <TableCell className="text-right text-success font-medium">${n.commissionsEarned.toFixed(2)}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); }}><ExternalLink className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
                {ranked.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No referrers yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <CardTitle>Referral Tree</CardTitle>
          <Input
            placeholder="Search user, email, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-8 text-sm"
          />
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Click a user's name to open the drill-down panel.</p>
          <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            <div className="w-6"></div>
            <div className="flex-1">User</div>
            <div className="hidden sm:block w-20 text-xs">Code</div>
            <div className="w-20 text-center">Direct</div>
            <div className="w-20 text-center">Downline</div>
            <div className="w-24 text-right">Commissions</div>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {filteredRoots.map((r) => <TreeRow key={r.id} node={r} onSelect={setSelectedId} />)}
            {filteredRoots.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">No users found</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader><CardTitle>Recent Commission Payouts</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Type / Level</TableHead>
                  <TableHead className="text-right">Basis</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.commissions || []).slice(0, 20).map((c) => {
                  const rr = byId.get(c.referrer_id);
                  const re = byId.get(c.referee_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="cursor-pointer hover:text-primary" onClick={() => rr && setSelectedId(rr.id)}>
                        <div className="text-sm">{rr?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{rr?.email}</div>
                      </TableCell>
                      <TableCell className="cursor-pointer hover:text-primary" onClick={() => re && setSelectedId(re.id)}>
                        <div className="text-sm">{re?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{re?.email}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABELS[c.type]} · L{c.level}</Badge></TableCell>
                      <TableCell className="text-right">${Number(c.basis_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-success font-medium">${Number(c.commission_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, HH:mm")}</TableCell>
                    </TableRow>
                  );
                })}
                {(!data?.commissions || data.commissions.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No commissions yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedNode && (
        <UserDetailPanel
          node={selectedNode}
          byId={byId}
          commissions={data?.commissions || []}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
