import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SubscriptionInfo {
  status: "active" | "expired";
  started_at: string;
  current_period_end: string;
  auto_renew: boolean;
  withdrawable_balance: number;
}

export function useSubscription() {
  return useQuery({
    queryKey: ["my-subscription"],
    queryFn: async (): Promise<SubscriptionInfo | null> => {
      const { data, error } = await supabase.rpc("get_my_subscription");
      if (error) throw error;
      return (data?.[0] as SubscriptionInfo) ?? null;
    },
    refetchInterval: 60_000,
  });
}

export function useRenewSubscription() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("renew_my_subscription");
      if (error) throw error;
      return data as string;
    },
    onSuccess: (result) => {
      if (result === "success") {
        toast({ title: "Subscription renewed", description: "$15 deducted. Signals unlocked for another 30 days." });
      } else if (result === "not_due") {
        toast({ title: "Not due yet", description: "Your subscription is still active." });
      } else if (result === "failed_insufficient_balance") {
        toast({ title: "Insufficient balance", description: "You need at least $15 in your available balance to renew.", variant: "destructive" });
      } else {
        toast({ title: "Nothing to renew" });
      }
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["signal-quota"] });
      qc.invalidateQueries({ queryKey: ["dashboard-profile"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to renew";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });
}

export function useSetAutoRenew() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc("set_my_auto_renew", { _enabled: enabled });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });
}
