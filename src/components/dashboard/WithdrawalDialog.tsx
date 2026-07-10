import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Calendar, Wallet } from "lucide-react";
import { addDays, isAfter, format } from "date-fns";

interface WithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WithdrawalDialog({ open, onOpenChange, onSuccess }: WithdrawalDialogProps) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);

  // Get last withdrawal to check bi-weekly restriction
  const { data: lastWithdrawal } = useQuery({
    queryKey: ["last-withdrawal", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", profile.id)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && open,
  });

  const nextWithdrawalDate = lastWithdrawal 
    ? addDays(new Date(lastWithdrawal.requested_at), 14) 
    : null;
  
  const canWithdraw = !nextWithdrawalDate || isAfter(new Date(), nextWithdrawalDate);
  const availableBalance = Number(profile?.withdrawable_balance || 0);
  const withdrawAmountNum = parseFloat(amount) || 0;
  const feeAmount = withdrawAmountNum * 0.20;
  const netAmount = withdrawAmountNum - feeAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast({ title: "Insufficient profits", description: "You can only withdraw profits, not deposits or bonuses.", variant: "destructive" });
      return;
    }

    if (!walletAddress.trim()) {
      toast({ title: "Please enter a wallet address", variant: "destructive" });
      return;
    }

    if (!canWithdraw) {
      toast({ title: "Bi-weekly withdrawal limit reached", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("request_withdrawal", {
        _amount: withdrawAmount,
        _wallet: walletAddress.trim(),
      });

      if (error) throw error;

      toast({ title: "Withdrawal request submitted", description: `You'll receive $${netAmount.toFixed(2)} after the 20% fee.` });
      setAmount("");
      setWalletAddress("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Failed to submit withdrawal", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Request Withdrawal
          </DialogTitle>
        </DialogHeader>

        {!canWithdraw && nextWithdrawalDate && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Withdrawal Not Available</p>
              <p className="text-sm text-muted-foreground">
                Next withdrawal available on {format(nextWithdrawalDate, "MMM d, yyyy")}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-1">
            <p className="text-sm text-muted-foreground">Withdrawable Profits</p>
            <p className="text-2xl font-bold text-primary">${availableBalance.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Only trading profits can be withdrawn. Deposits and bonuses are non-withdrawable.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="1"
              max={availableBalance}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!canWithdraw || loading}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wallet">Wallet Address</Label>
            <Input
              id="wallet"
              type="text"
              placeholder="Enter your crypto wallet address"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              disabled={!canWithdraw || loading}
              className="bg-background"
            />
          </div>

          {nextWithdrawalDate && canWithdraw && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>After this withdrawal, next available: {format(addDays(new Date(), 14), "MMM d, yyyy")}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!canWithdraw || loading}>
            {loading ? "Submitting..." : "Submit Withdrawal Request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
