import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, Wallet, Upload, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const currencyOptions = [
  { value: "USDT_TRC20", label: "USDT (TRC20)", settingKey: "usdt_trc20_wallet" },
] as const;

export function DepositDialog({ open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth();
  const currency = "USDT_TRC20" as const;
  const [method, setMethod] = useState<"usdt" | "mpesa">("usdt");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [phone, setPhone] = useState("254");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [stkSent, setStkSent] = useState(false);

  const DEPOSIT_RATE = 133;
  const amtNum = parseFloat(amount) || 0;
  const kesAmount = Math.round(amtNum * DEPOSIT_RATE);

  const { data: walletAddress } = useQuery({
    queryKey: ["wallet", currency],
    queryFn: async () => {
      const key = currencyOptions.find((c) => c.value === currency)!.settingKey;
      const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
      return data?.value || "";
    },
    enabled: open,
  });

  const copy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast({ title: "Address copied" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (amt < 200) {
      toast({ title: "Minimum deposit is $200", variant: "destructive" });
      return;
    }
    if (method === "mpesa") {
      if (!/^254\d{9}$/.test(phone.trim())) {
        toast({ title: "Invalid phone", description: "Use format 254712345678 (12 digits).", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        const { error } = await supabase.rpc("request_mpesa_deposit", { _amount_usd: amt, _phone: phone.trim() });
        if (error) throw error;
        setStkSent(true);
        toast({ title: "M-Pesa request sent", description: `Check your phone and enter your M-Pesa PIN to pay KSh ${kesAmount.toLocaleString()}.` });
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to initiate M-Pesa payment";
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!txHash.trim()) {
      toast({ title: "Transaction hash required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let proofUrl: string | null = null;
      if (proofFile) {
        const path = `${profile.user_id}/${Date.now()}-${proofFile.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile);
        if (upErr) throw upErr;
        // Store storage path; admins fetch a short-lived signed URL to view
        proofUrl = path;
      }
      const { error } = await supabase.from("deposits").insert({
        user_id: profile.id,
        amount_usd: amt,
        crypto_currency: currency,
        tx_hash: txHash.trim(),
        proof_url: proofUrl,
      });
      if (error) throw error;
      toast({ title: "Deposit submitted", description: "Awaiting admin verification." });
      setAmount("");
      setTxHash("");
      setProofFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Deposit Crypto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={method === "usdt" ? "default" : "outline"} onClick={() => { setMethod("usdt"); setStkSent(false); }}>
                USDT (TRC20)
              </Button>
              <Button type="button" variant={method === "mpesa" ? "default" : "outline"} onClick={() => { setMethod("mpesa"); setStkSent(false); }}>
                M-Pesa
              </Button>
            </div>
          </div>

          {method === "usdt" && (
          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
            <p className="text-xs text-muted-foreground">Send to this address:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all">{walletAddress || "Loading..."}</code>
              <Button type="button" variant="outline" size="icon" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
            <a
              href="https://www.binance.com/en/buy-USDT"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Don't have USDT? Buy it on Binance <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD) — $200 minimum</Label>
            <Input id="amount" type="number" step="0.01" min="200" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="200" />
          </div>

          {method === "mpesa" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa Phone Number</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="254712345678" maxLength={12} />
              </div>
              {amtNum >= 200 && (
                <div className="p-3 rounded-lg bg-muted/40 border border-border text-sm">
                  You'll pay <span className="font-semibold text-primary">KSh {kesAmount.toLocaleString()}</span> via M-Pesa (rate: 133 KSh/$)
                </div>
              )}
              {stkSent && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm">
                  Payment request sent — check your phone and enter your M-Pesa PIN. Your balance updates automatically within a few minutes of payment.
                </div>
              )}
            </>
          )}

          {method === "usdt" && (
          <>
          <div className="space-y-2">
            <Label htmlFor="tx">Transaction Hash</Label>
            <Input id="tx" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proof">Payment Proof (optional)</Label>
            <div className="flex items-center gap-2">
              <Input id="proof" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          </>
          )}

          <Button type="submit" className="w-full" disabled={loading || (method === "mpesa" && stkSent)}>
            {loading ? "Submitting..." : method === "mpesa" ? (stkSent ? "Awaiting payment..." : "Send M-Pesa Request") : "Submit Deposit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
