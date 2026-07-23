import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SignalQuota {
  daily_limit: number;
  taken_today: number;
  referral_count: number;
}

/**
 * Tiered daily signal limit based on referral count:
 * 10+ referrals -> 6 signals/day, 5-9 -> 4/day, under 5 -> 2/day.
 */
export function useSignalQuota() {
  return useQuery({
    queryKey: ["signal-quota"],
    queryFn: async (): Promise<SignalQuota | null> => {
      const { data, error } = await supabase.rpc("get_my_signal_quota");
      if (error) throw error;
      return (data?.[0] as SignalQuota) ?? null;
    },
    refetchInterval: 30_000,
  });
}

/** How many more referrals are needed to reach the next tier, or null if already at the top tier. */
export function nextTierInfo(referralCount: number): { needed: number; unlocksLimit: number } | null {
  if (referralCount < 5) return { needed: 5 - referralCount, unlocksLimit: 4 };
  if (referralCount < 10) return { needed: 10 - referralCount, unlocksLimit: 6 };
  return null;
}
