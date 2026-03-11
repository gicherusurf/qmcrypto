import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";

export function AdminTokenTransactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["admin-token-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_transactions")
        .select("*, buyer:profiles!token_transactions_buyer_id_fkey(full_name, email), seller:profiles!token_transactions_seller_id_fkey(full_name, email), listing:token_listings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleApprove = async (tx: any) => {
    try {
      // Update transaction status
      await supabase.from("token_transactions").update({ status: "approved", processed_at: new Date().toISOString() }).eq("id", tx.id);

      // Credit buyer's token balance
      const { data: buyerProfile } = await supabase.from("profiles").select("token_balance").eq("id", tx.buyer_id).single();
      await supabase.from("profiles").update({
        token_balance: Number(buyerProfile?.token_balance || 0) + Number(tx.amount),
      }).eq("id", tx.buyer_id);

      // Credit seller's USD balance
      const { data: sellerProfile } = await supabase.from("profiles").select("total_balance").eq("id", tx.seller_id).single();
      await supabase.from("profiles").update({
        total_balance: Number(sellerProfile?.total_balance || 0) + Number(tx.total_price),
      }).eq("id", tx.seller_id);

      // Update listing remaining amount
      if (tx.listing_id) {
        const { data: listing } = await supabase.from("token_listings").select("remaining_amount").eq("id", tx.listing_id).single();
        const newRemaining = Number(listing?.remaining_amount || 0) - Number(tx.amount);
        await supabase.from("token_listings").update({
          remaining_amount: Math.max(0, newRemaining),
          status: newRemaining <= 0 ? "completed" : "active",
        }).eq("id", tx.listing_id);
      }

      toast({ title: "Transaction approved!" });
      queryClient.invalidateQueries({ queryKey: ["admin-token-transactions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (tx: any) => {
    try {
      await supabase.from("token_transactions").update({ status: "rejected", processed_at: new Date().toISOString() }).eq("id", tx.id);
      toast({ title: "Transaction rejected" });
      queryClient.invalidateQueries({ queryKey: ["admin-token-transactions"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  const pending = transactions.filter((t: any) => t.status === "pending");
  const processed = transactions.filter((t: any) => t.status !== "pending");

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Pending Token Transactions ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending transactions</p>
          ) : (
            <div className="space-y-4">
              {pending.map((tx: any) => (
                <div key={tx.id} className="p-4 rounded-lg border border-border bg-secondary/20 space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between gap-2">
                    <div>
                      <p className="font-medium">{Number(tx.amount).toFixed(2)} QMT @ ${Number(tx.total_price / tx.amount).toFixed(2)}/QMT</p>
                      <p className="text-sm text-muted-foreground">Total: ${Number(tx.total_price).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Buyer: {tx.buyer?.full_name || tx.buyer?.email}</p>
                      <p className="text-sm text-muted-foreground">Seller: {tx.seller?.full_name || tx.seller?.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" onClick={() => handleApprove(tx)}>
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(tx)}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                  {tx.payment_proof_url && (
                    <a href={tx.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                      View Payment Proof
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Processed Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {processed.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No processed transactions</p>
          ) : (
            <div className="space-y-3">
              {processed.map((tx: any) => (
                <div key={tx.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-secondary/20">
                  <div>
                    <p className="font-medium">{Number(tx.amount).toFixed(2)} QMT — ${Number(tx.total_price).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{tx.buyer?.full_name} → {tx.seller?.full_name}</p>
                  </div>
                  <Badge variant={tx.status === "approved" ? "default" : "destructive"}>{tx.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
