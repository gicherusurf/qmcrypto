import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, Crown, Loader2 } from "lucide-react";
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

export function InvestmentDialog({ open, onOpenChange, onSuccess }: InvestmentDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
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

  const selectedPkg = packages?.find(p => p.id === selectedPackage);
  const isCustomPackage = selectedPkg?.is_custom;

  const getInvestmentAmount = () => {
    if (!selectedPkg) return 0;
    if (isCustomPackage) {
      return parseFloat(customAmount) || 0;
    }
    return selectedPkg.amount;
  };

  const handleInvest = async () => {
    if (!profile || !selectedPackage) return;

    const amount = getInvestmentAmount();
    
    if (isCustomPackage && amount < (selectedPkg?.min_amount || 150)) {
      toast({
        title: "Invalid Amount",
        description: `Minimum investment for custom package is $${selectedPkg?.min_amount || 150}`,
        variant: "destructive",
      });
      return;
    }

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
      const nextEarning = new Date();
      nextEarning.setDate(nextEarning.getDate() + 14);

      const { error } = await supabase
        .from("investments")
        .insert({
          user_id: profile.id,
          package_id: selectedPackage,
          amount: amount,
          next_earning_at: nextEarning.toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Investment Created!",
        description: `You've invested $${amount.toFixed(2)}. Earnings start in 14 days.`,
      });

      onOpenChange(false);
      setSelectedPackage(null);
      setCustomAmount("");
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create investment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Start New Investment</DialogTitle>
          <DialogDescription>
            Select a package to begin earning 10% bi-weekly returns
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
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

            {/* Custom Package */}
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

            {selectedPackage && (
              <div className="bg-secondary/50 rounded-lg p-4 space-y-2 animate-fade-in">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Investment Amount</span>
                  <span className="font-semibold">${getInvestmentAmount().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expected Earnings (14 days)</span>
                  <span className="font-semibold text-success">
                    +${(getInvestmentAmount() * 0.10).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={handleInvest}
              disabled={!selectedPackage || isSubmitting || (isCustomPackage && getInvestmentAmount() < (selectedPkg?.min_amount || 150))}
              variant="hero"
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Invest $${getInvestmentAmount().toFixed(2)}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
