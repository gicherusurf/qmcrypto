import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Wallet, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const currencyOptions = [
  { value: "BTC", label: "Bitcoin (BTC)", settingKey: "btc_wallet" },
  { value: "USDT_TRC20", label: "USDT (TRC20)", settingKey: "usdt_trc20_wallet" },
  { value: "USDT_ERC20", label: "USDT (ERC20)", settingKey: "usdt_erc20_wallet" },
] as const;

export function DepositDialog({ open, onOpenChange, onSuccess }: Props) {
  const { profile } = useAuth();
  const [currency, setCurrency] = useState<"BTC" | "USDT_TRC20" | "USDT_ERC20">("USDT_TRC20");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

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
        const { data } = supabase.storage.from("payment-proofs").getPublicUrl(path);
        proofUrl = data.publicUrl;
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
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencyOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
            <p className="text-xs text-muted-foreground">Send to this address:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all">{walletAddress || "Loading..."}</code>
              <Button type="button" variant="outline" size="icon" onClick={copy}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input id="amount" type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          </div>

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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit Deposit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
