import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";

type ProfileLite = { full_name: string | null; email: string | null } | null;

export function AdminDepositsHistory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposits")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 20000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!search) return true;
      const p = d.profiles as ProfileLite;
      const q = search.toLowerCase();
      return (
        (p?.full_name || "").toLowerCase().includes(q) ||
        (p?.email || "").toLowerCase().includes(q) ||
        (d.tx_hash || "").toLowerCase().includes(q) ||
        (d.crypto_currency || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, status]);

  const totals = useMemo(() => {
    const t = { count: data?.length || 0, approved: 0, pending: 0, rejected: 0, volume: 0 };
    (data || []).forEach((d) => {
      const amt = Number(d.amount_usd || 0);
      if (d.status === "approved") { t.approved += amt; }
      else if (d.status === "pending") { t.pending += amt; }
      else if (d.status === "rejected") { t.rejected += amt; }
      t.volume += amt;
    });
    return t;
  }, [data]);

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 text-primary"><DollarSign className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Total Volume</p><p className="text-xl font-bold">${totals.volume.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Approved</p><p className="text-xl font-bold">${totals.approved.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-yellow-500/10 text-yellow-400"><Clock className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">${totals.pending.toFixed(2)}</p></div>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-6 flex items-center gap-3">
          <div className="p-3 rounded-full bg-destructive/10 text-destructive"><XCircle className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">Rejected</p><p className="text-xl font-bold">${totals.rejected.toFixed(2)}</p></div>
        </CardContent></Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <CardTitle>Deposit History</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1 text-xs rounded-md border transition ${status === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 border-border hover:bg-secondary"}`}
              >
                {s}
              </button>
            ))}
            <Input
              placeholder="Search user, email, tx hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount (USD)</TableHead>
                  <TableHead>Crypto</TableHead>
                  <TableHead>TX Hash</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const p = d.profiles as ProfileLite;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email}</div>
                      </TableCell>
                      <TableCell className="font-medium">${Number(d.amount_usd).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">
                        <div>{Number(d.crypto_amount || 0)} {d.crypto_currency}</div>
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[140px] truncate" title={d.tx_hash || ""}>
                        {d.tx_hash || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.created_at ? format(new Date(d.created_at), "MMM d, HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.processed_at ? format(new Date(d.processed_at), "MMM d, HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No deposits found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
