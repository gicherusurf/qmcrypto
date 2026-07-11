import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, X, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function AdminWithdrawals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order("requested_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-withdrawal-stats"],
    queryFn: async () => {
      const { data: pending } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("status", "pending");

      const { data: approved } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("status", "approved");

      const { data: completed } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("status", "completed");

      return {
        pending: pending?.reduce((sum, w) => sum + Number(w.amount), 0) || 0,
        approved: approved?.reduce((sum, w) => sum + Number(w.amount), 0) || 0,
        completed: completed?.reduce((sum, w) => sum + Number(w.amount), 0) || 0,
        pendingCount: pending?.length || 0,
      };
    },
  });

  const processWithdrawal = async (status: "approved" | "rejected") => {
    if (!selectedWithdrawal) return;
    setIsProcessing(true);

    try {
      const rpcName = status === "approved" ? "approve_withdrawal" : "reject_withdrawal";
      const { error } = await supabase.rpc(rpcName as any, {
        _id: selectedWithdrawal.id,
        _notes: adminNotes || null,
      });

      if (error) throw error;

      toast({
        title: `Withdrawal ${status}`,
        description: `The withdrawal request has been ${status}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawal-stats"] });
      setSelectedWithdrawal(null);
      setAdminNotes("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const completeWithdrawal = async (withdrawalId: string) => {
    try {
      const { error } = await supabase.rpc("complete_withdrawal" as any, {
        _id: withdrawalId,
      });

      if (error) throw error;

      toast({
        title: "Withdrawal Completed",
        description: "The withdrawal has been marked as completed.",
      });

      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawal-stats"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Approved</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-green-500/20 text-green-400">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending ({stats?.pendingCount})</p>
                <p className="text-2xl font-display font-bold text-yellow-400">${stats?.pending?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <CheckCircle className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-display font-bold text-blue-400">${stats?.approved?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-success/10">
                <XCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-display font-bold text-success">${stats?.completed?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawals Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : withdrawals?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No withdrawal requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals?.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{withdrawal.profiles?.full_name || "—"}</div>
                          <div className="text-sm text-muted-foreground">{withdrawal.profiles?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">${Number(withdrawal.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">
                          {withdrawal.wallet_address?.slice(0, 8)}...{withdrawal.wallet_address?.slice(-6)}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {withdrawal.requested_at ? format(new Date(withdrawal.requested_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {withdrawal.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedWithdrawal(withdrawal)}
                            >
                              Review
                            </Button>
                          )}
                          {withdrawal.status === "approved" && (
                            <Button
                              size="sm"
                              variant="hero"
                              onClick={() => completeWithdrawal(withdrawal.id)}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedWithdrawal} onOpenChange={() => setSelectedWithdrawal(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Review Withdrawal Request</DialogTitle>
            <DialogDescription>
              Approve or reject this withdrawal request
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-medium">{selectedWithdrawal.profiles?.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-bold text-lg">${Number(selectedWithdrawal.amount).toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Wallet Address</p>
                  <code className="text-sm break-all">{selectedWithdrawal.wallet_address}</code>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Admin Notes (optional)</label>
                <Textarea
                  placeholder="Add notes about this withdrawal..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => processWithdrawal("rejected")}
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={() => processWithdrawal("approved")}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
