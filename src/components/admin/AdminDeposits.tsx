import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function AdminDeposits() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: deposits, isLoading } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deposits")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const process = async (id: string, userProfileId: string, amount: number, action: "approved" | "rejected") => {
    setBusyId(id);
    try {
      if (action === "approved") {
        const { error } = await supabase.rpc("approve_deposit", { _deposit_id: id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("deposits")
          .update({ status: "rejected", processed_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }

      toast({ title: `Deposit ${action}` });
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader><CardTitle>All Deposits</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>TX Hash</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits?.map((d) => {
                  const p = d.profiles as { full_name: string | null; email: string | null } | null;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{p?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email}</div>
                      </TableCell>
                      <TableCell>${Number(d.amount_usd).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{d.crypto_currency}</Badge></TableCell>
                      <TableCell><code className="text-xs">{d.tx_hash?.slice(0, 14)}...</code></TableCell>
                      <TableCell>
                        <Badge variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d")}</TableCell>
                      <TableCell>
                        {d.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" disabled={busyId === d.id} onClick={() => process(d.id, d.user_id, Number(d.amount_usd), "approved")}><Check className="h-3 w-3" /></Button>
                            <Button size="sm" variant="destructive" disabled={busyId === d.id} onClick={() => process(d.id, d.user_id, Number(d.amount_usd), "rejected")}><X className="h-3 w-3" /></Button>
                          </div>
                        )}
                        {d.proof_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              const path = d.proof_url.includes("://")
                                ? d.proof_url.split("/payment-proofs/")[1]
                                : d.proof_url;
                              const { data, error } = await supabase.storage
                                .from("payment-proofs")
                                .createSignedUrl(path, 300);
                              if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank");
                            }}
                            className="text-xs text-primary block mt-1 underline"
                          >
                            View proof
                          </button>
                        )}
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
  );
}
