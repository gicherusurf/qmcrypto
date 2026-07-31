import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Calendar, Wallet, ShieldCheck, Upload, Clock } from "lucide-react";
import { addDays, isAfter, format } from "date-fns";

interface WithdrawalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WithdrawalDialog({ open, onOpenChange, onSuccess }: WithdrawalDialogProps) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [method, setMethod] = useState<"usdt" | "mpesa">("usdt");
  const [phone, setPhone] = useState("254");
  const [loading, setLoading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  const WITHDRAWAL_RATE = 128;

  const { data: kyc, isLoading: kycLoading } = useQuery({
    queryKey: ["my-kyc-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_kyc_status");
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: open,
  });

  const handleKycUpload = async () => {
    if (!idFile || !profile?.user_id || !profile?.id) return;
    setUploadingKyc(true);
    try {
      const ext = idFile.name.split(".").pop();
      const path = `${profile.user_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, idFile);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("kyc_verifications").insert({
        user_id: profile.id,
        document_url: path,
      });
      if (insertError) throw insertError;

      toast({ title: "ID submitted", description: "Your document is under review. This usually takes a short while." });
      setIdFile(null);
      qc.invalidateQueries({ queryKey: ["my-kyc-status"] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast({ title: "Failed to submit ID", description: msg, variant: "destructive" });
    } finally {
      setUploadingKyc(false);
    }
  };

  // Get last withdrawal to check bi-weekly restriction
  const { data: lastWithdrawal } = useQuery({
    queryKey: ["last-withdrawal", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", profile.id)
        .neq("status", "rejected")
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

    if (withdrawAmount < 200) {
      toast({ title: "Minimum withdrawal is $200", variant: "destructive" });
      return;
    }

    if (withdrawAmount > availableBalance) {
      toast({ title: "Insufficient profits", description: "You can only withdraw profits, not deposits or bonuses.", variant: "destructive" });
      return;
    }

    if (method === "usdt" && !walletAddress.trim()) {
      toast({ title: "Please enter a wallet address", variant: "destructive" });
      return;
    }

    if (method === "mpesa" && !/^254\d{9}$/.test(phone.trim())) {
      toast({ title: "Invalid phone", description: "Use format 254712345678 (12 digits).", variant: "destructive" });
      return;
    }

    if (!canWithdraw) {
      toast({ title: "Bi-weekly withdrawal limit reached", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } =
        method === "mpesa"
          ? await supabase.rpc("request_mpesa_withdrawal", {
              _amount_usd: withdrawAmount,
              _phone: phone.trim(),
            })
          : await supabase.rpc("request_withdrawal", {
              _amount: withdrawAmount,
              _wallet: walletAddress.trim(),
            });

      if (error) throw error;

      toast({
        title: "Withdrawal request submitted",
        description:
          method === "mpesa"
            ? `You'll receive KSh ${Math.round(netAmount * WITHDRAWAL_RATE).toLocaleString()} to M-Pesa after approval (20% fee applied).`
            : `You'll receive $${netAmount.toFixed(2)} after the 20% fee.`,
      });
      setAmount("");
      setWalletAddress("");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes("KYC_REQUIRED")) {
        toast({ title: "ID verification required", description: "Please upload a copy of your ID before withdrawing.", variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["my-kyc-status"] });
      } else {
        toast({ title: "Failed to submit withdrawal", description: msg, variant: "destructive" });
      }
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

        {kycLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Checking verification status...</div>
        ) : !kyc || kyc.status === "rejected" ? (
          <div className="space-y-4">
            {kyc?.status === "rejected" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                <p className="font-medium text-destructive">Your previous ID was rejected</p>
                {kyc.admin_notes && <p className="text-muted-foreground mt-1">{kyc.admin_notes}</p>}
                <p className="text-muted-foreground mt-1">Please upload a clearer copy.</p>
              </div>
            )}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Identity verification required</p>
                <p className="text-sm text-muted-foreground">Upload a clear photo or scan of your government ID or passport to enable withdrawals.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="idFile">ID / Passport copy</Label>
              <Input id="idFile" type="file" accept="image/*,.pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleKycUpload} disabled={!idFile || uploadingKyc} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              {uploadingKyc ? "Uploading..." : "Submit for Verification"}
            </Button>
          </div>
        ) : kyc.status === "pending" ? (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Clock className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">ID under review</p>
              <p className="text-sm text-muted-foreground">Submitted {format(new Date(kyc.submitted_at), "MMM d, yyyy")}. You'll be able to withdraw once it's approved.</p>
            </div>
          </div>
        ) : (
          <>
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
            <Label htmlFor="amount">Amount (USD) — $200 minimum</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="200"
              max={availableBalance}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!canWithdraw || loading}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label>Payout Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={method === "usdt" ? "default" : "outline"} onClick={() => setMethod("usdt")} disabled={!canWithdraw || loading}>
                USDT (TRC20)
              </Button>
              <Button type="button" variant={method === "mpesa" ? "default" : "outline"} onClick={() => setMethod("mpesa")} disabled={!canWithdraw || loading}>
                M-Pesa
              </Button>
            </div>
          </div>

          {method === "usdt" ? (
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
          ) : (
          <div className="space-y-2">
            <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
            <Input
              id="mpesa-phone"
              type="text"
              placeholder="254712345678"
              maxLength={12}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              disabled={!canWithdraw || loading}
              className="bg-background"
            />
          </div>
          )}

          {withdrawAmountNum > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Requested</span><span>${withdrawAmountNum.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal fee (20%)</span><span className="text-destructive">-${feeAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold pt-1 border-t border-border"><span>You receive</span><span className="text-success">{method === "mpesa" ? `KSh ${Math.round(netAmount * WITHDRAWAL_RATE).toLocaleString()}` : `$${netAmount.toFixed(2)}`}</span></div>
              {method === "mpesa" && (
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Rate</span><span className="text-muted-foreground">128 KSh/$</span></div>
              )}
            </div>
          )}


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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
