import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Loader2, ExternalLink, Clock, Bitcoin, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

export function AdminPendingInvestments() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: pendingInvestments, isLoading } = useQuery({
    queryKey: ["admin-pending-investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select(`
          *,
          profiles!investments_user_id_fkey (
            email,
            full_name
          ),
          investment_packages (
            name,
            return_percentage,
            return_period_days
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleVerify = async (investmentId: string, approve: boolean) => {
    if (!profile) return;
    setProcessingId(investmentId);

    try {
      if (approve) {
        const nextEarning = new Date();
        nextEarning.setDate(nextEarning.getDate() + 14);

        const { error } = await supabase
          .from("investments")
          .update({
            status: "active",
            payment_verified_at: new Date().toISOString(),
            payment_verified_by: profile.id,
            next_earning_at: nextEarning.toISOString(),
            last_earning_at: new Date().toISOString(),
          })
          .eq("id", investmentId);

        if (error) throw error;

        toast({
          title: "Investment Approved",
          description: "Payment verified and investment is now active.",
        });
      } else {
        const { error } = await supabase
          .from("investments")
          .update({
            status: "rejected",
            payment_verified_at: new Date().toISOString(),
            payment_verified_by: profile.id,
          })
          .eq("id", investmentId);

        if (error) throw error;

        toast({
          title: "Investment Rejected",
          description: "The investment has been rejected.",
          variant: "destructive",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-pending-investments"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process investment",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Pending Investments
          {pendingInvestments && pendingInvestments.length > 0 && (
            <Badge variant="destructive">{pendingInvestments.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Verify payment transactions and approve investments
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!pendingInvestments || pendingInvestments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pending investments to verify.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Amount (USD)</TableHead>
                  <TableHead>Crypto Payment</TableHead>
                  <TableHead>TX Hash</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvestments.map((investment) => {
                  const profileData = investment.profiles as { email: string | null; full_name: string | null } | null;
                  const packageData = investment.investment_packages as { name: string; return_percentage: number | null; return_period_days: number | null } | null;
                  
                  return (
                    <TableRow key={investment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{profileData?.full_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{profileData?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{packageData?.name || "Unknown"}</TableCell>
                      <TableCell className="font-semibold">${investment.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {investment.crypto_amount && investment.crypto_currency ? (
                          <div className="flex items-center gap-1">
                            {investment.crypto_currency === "BTC" ? (
                              <Bitcoin className="h-4 w-4 text-orange-500" />
                            ) : (
                              <Wallet className="h-4 w-4 text-green-500" />
                            )}
                            <span className="font-medium">
                              {investment.crypto_currency === "BTC" 
                                ? Number(investment.crypto_amount).toFixed(8) 
                                : Number(investment.crypto_amount).toFixed(2)}
                            </span>
                            <span className="text-xs text-muted-foreground">{investment.crypto_currency}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-secondary px-2 py-1 rounded max-w-[150px] truncate block">
                          {investment.payment_tx_hash || "N/A"}
                        </code>
                        {investment.payment_tx_hash && (
                          <a
                            href={`https://tronscan.org/#/transaction/${investment.payment_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View on Explorer
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {investment.created_at ? format(new Date(investment.created_at), "MMM d, yyyy HH:mm") : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerify(investment.id, false)}
                            disabled={processingId === investment.id}
                          >
                            {processingId === investment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleVerify(investment.id, true)}
                            disabled={processingId === investment.id}
                          >
                            {processingId === investment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
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
