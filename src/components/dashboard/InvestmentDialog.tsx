import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, Crown, Loader2, Copy, ArrowLeft, Wallet, Bitcoin, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface InvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type PaymentMethod = "USDT_TRC20" | "USDT_ERC20" | "BTC";

interface CryptoPrices {
  BTC: number;
  USDT: number;
  timestamp: string;
  error?: string;
}

const paymentMethods: { id: PaymentMethod; name: string; icon: React.ReactNode; network: string; crypto: "BTC" | "USDT" }[] = [
  { id: "USDT_TRC20", name: "USDT (TRC20)", icon: <Wallet className="h-5 w-5" />, network: "Tron Network", crypto: "USDT" },
  { id: "USDT_ERC20", name: "USDT (ERC20)", icon: <Wallet className="h-5 w-5" />, network: "Ethereum Network", crypto: "USDT" },
  { id: "BTC", name: "Bitcoin", icon: <Bitcoin className="h-5 w-5" />, network: "Bitcoin Network", crypto: "BTC" },
];

export function InvestmentDialog({ open, onOpenChange, onSuccess }: InvestmentDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [txHash, setTxHash] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["investment-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_packages")
        .select("*")
        .eq("is_active", true)
        .order("amount", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: walletAddresses } = useQuery({
    queryKey: ["wallet-addresses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["USDT_WALLET_TRC20", "USDT_WALLET_ERC20", "BTC_WALLET"]);
      
      if (error) throw error;
      return data?.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string | null>);
    },
  });

  const { data: cryptoPrices, isLoading: isPricesLoading, refetch: refetchPrices } = useQuery({
    queryKey: ["crypto-prices"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<CryptoPrices>("get-crypto-prices");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000,
  });

  const selectedPkg = packages?.find(p => p.id === selectedPackage);
  const isCustomPackage = selectedPkg?.is_custom;

  const getInvestmentAmount = () => {
    if (!selectedPkg) return 0;
    if (isCustomPackage) {
      return parseFloat(customAmount) || 0;
    }
    return selectedPkg.amount;
  };

  const getWalletAddress = () => {
    if (!walletAddresses || !paymentMethod) return "";
    const keyMap: Record<PaymentMethod, string> = {
      USDT_TRC20: "USDT_WALLET_TRC20",
      USDT_ERC20: "USDT_WALLET_ERC20",
      BTC: "BTC_WALLET",
    };
    return walletAddresses[keyMap[paymentMethod]] || "";
  };

  const getCryptoAmount = () => {
    if (!paymentMethod || !cryptoPrices) return null;
    const method = paymentMethods.find(m => m.id === paymentMethod);
    if (!method) return null;
    
    const usdAmount = getInvestmentAmount();
    const price = method.crypto === "BTC" ? cryptoPrices.BTC : cryptoPrices.USDT;
    
    if (!price || price === 0) return null;
    
    return {
      amount: usdAmount / price,
      symbol: method.crypto,
      price: price,
    };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Wallet address copied to clipboard" });
  };

  const handleSubmit = async () => {
    if (!profile || !selectedPackage || !txHash.trim() || !paymentMethod) return;

    const amount = getInvestmentAmount();
    
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid investment amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("investments")
        .insert({
          user_id: profile.id,
          package_id: selectedPackage,
          amount: amount,
          payment_tx_hash: txHash.trim(),
          status: "pending",
          next_earning_at: null, // Will be set when admin verifies
        });

      if (error) throw error;

      toast({
        title: "Investment Submitted!",
        description: "Your payment is being verified. Investment will activate once confirmed.",
      });

      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit investment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setSelectedPackage(null);
    setCustomAmount("");
    setPaymentMethod(null);
    setTxHash("");
  };

  const canProceedStep1 = selectedPackage && (!isCustomPackage || getInvestmentAmount() >= (selectedPkg?.min_amount || 150));
  const canProceedStep2 = paymentMethod;
  const canSubmit = txHash.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {step === 1 && "Select Investment Package"}
            {step === 2 && "Make Payment"}
            {step === 3 && "Confirm Transaction"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Choose a package to begin earning 10% bi-weekly returns"}
            {step === 2 && `Send exactly $${getInvestmentAmount().toFixed(2)} worth of crypto`}
            {step === 3 && "Enter your transaction hash to verify payment"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Step 1: Select Package */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {packages?.filter(p => !p.is_custom).map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg.id)}
                      className={cn(
                        "relative p-4 rounded-lg border-2 transition-all text-left",
                        selectedPackage === pkg.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/50"
                      )}
                    >
                      {selectedPackage === pkg.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="font-display text-xl font-bold">${pkg.amount}</div>
                      <div className="text-xs text-muted-foreground">{pkg.name}</div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-success">
                        <Sparkles className="h-3 w-3" />
                        {pkg.return_percentage}% / {pkg.return_period_days} days
                      </div>
                    </button>
                  ))}
                </div>

                {packages?.filter(p => p.is_custom).map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={cn(
                      "w-full relative p-4 rounded-lg border-2 transition-all text-left",
                      selectedPackage === pkg.id
                        ? "border-accent bg-accent/10"
                        : "border-border bg-secondary/30 hover:border-accent/50"
                    )}
                  >
                    {selectedPackage === pkg.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-accent" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-accent" />
                      <div>
                        <div className="font-display text-lg font-bold">{pkg.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Min ${pkg.min_amount} - {pkg.return_percentage}% / {pkg.return_period_days} days
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {isCustomPackage && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="customAmount">Investment Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="customAmount"
                        type="number"
                        min={selectedPkg?.min_amount || 150}
                        placeholder={`Min $${selectedPkg?.min_amount || 150}`}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  variant="hero"
                  className="w-full"
                >
                  Continue to Payment
                </Button>
              </>
            )}

            {/* Step 2: Select Payment Method & Show Address */}
            {step === 2 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                <div className="bg-secondary/50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount to Pay</span>
                    <span className="font-semibold text-lg">${getInvestmentAmount().toFixed(2)}</span>
                  </div>
                </div>

                <Label>Select Payment Method</Label>
                <div className="grid gap-3">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left",
                        paymentMethod === method.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/50"
                      )}
                    >
                      {method.icon}
                      <div>
                        <div className="font-semibold">{method.name}</div>
                        <div className="text-xs text-muted-foreground">{method.network}</div>
                      </div>
                      {paymentMethod === method.id && (
                        <Check className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>

                {paymentMethod && (
                  <div className="animate-fade-in space-y-3">
                    {/* Crypto Amount Display */}
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Exact Amount to Send</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refetchPrices()}
                          disabled={isPricesLoading}
                          className="h-6 px-2"
                        >
                          <RefreshCw className={cn("h-3 w-3", isPricesLoading && "animate-spin")} />
                        </Button>
                      </div>
                      {isPricesLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Fetching live price...</span>
                        </div>
                      ) : getCryptoAmount() ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-2xl font-bold text-primary">
                              {getCryptoAmount()!.symbol === "BTC" 
                                ? getCryptoAmount()!.amount.toFixed(8) 
                                : getCryptoAmount()!.amount.toFixed(2)}
                            </span>
                            <span className="text-lg font-semibold">{getCryptoAmount()!.symbol}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(
                                getCryptoAmount()!.symbol === "BTC" 
                                  ? getCryptoAmount()!.amount.toFixed(8) 
                                  : getCryptoAmount()!.amount.toFixed(2)
                              )}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            1 {getCryptoAmount()!.symbol} = ${getCryptoAmount()!.price.toLocaleString()} USD
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-warning">
                          Unable to fetch price. Send ${getInvestmentAmount().toFixed(2)} worth.
                        </div>
                      )}
                    </div>

                    <Label>Send to this address</Label>
                    <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg border border-border">
                      <code className="flex-1 text-sm break-all">{getWalletAddress()}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(getWalletAddress())}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Send the exact crypto amount shown above to avoid payment issues.
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  variant="hero"
                  className="w-full"
                >
                  I've Sent Payment
                </Button>
              </>
            )}

            {/* Step 3: Enter Transaction Hash */}
            {step === 3 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(2)}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>

                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Investment Amount</span>
                    <span className="font-semibold">${getInvestmentAmount().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-semibold">{paymentMethods.find(m => m.id === paymentMethod)?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expected Returns (14 days)</span>
                    <span className="font-semibold text-success">+${(getInvestmentAmount() * 0.10).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="txHash">Transaction Hash / TXID</Label>
                  <Input
                    id="txHash"
                    placeholder="Enter your transaction hash..."
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this in your wallet's transaction history after sending payment.
                  </p>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  variant="hero"
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Investment"
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
