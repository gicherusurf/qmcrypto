import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AffiliateDashboardData {
  current_rank: string;
  personal_referrals: number;
  active_team_size: number;
  team_volume: number;
  deposit_commissions_earned: number;
  profit_share_earned: number;
  leadership_bonuses_earned: number;
  matching_bonuses_earned: number;
  total_affiliate_earnings: number;
  available_balance: number;
  daily_signal_limit: number;
  taken_today: number;
  subscription_status: "active" | "expired" | null;
  next_billing_date: string | null;
}

export function useAffiliateDashboard() {
  return useQuery({
    queryKey: ["affiliate-dashboard"],
    queryFn: async (): Promise<AffiliateDashboardData | null> => {
      const { data, error } = await supabase.rpc("get_my_affiliate_dashboard");
      if (error) throw error;
      return (data?.[0] as AffiliateDashboardData) ?? null;
    },
    refetchInterval: 60_000,
  });
}

export const RANK_INFO: Record<string, { label: string; color: string; nextRank?: string; nextTV?: number; nextReferrals?: number }> = {
  none: { label: "Unranked", color: "text-muted-foreground", nextRank: "Bronze", nextTV: 5000 },
  bronze: { label: "Bronze", color: "text-amber-600", nextRank: "Silver", nextTV: 20000, nextReferrals: 5 },
  silver: { label: "Silver", color: "text-slate-400", nextRank: "Gold", nextTV: 50000, nextReferrals: 8 },
  gold: { label: "Gold", color: "text-yellow-500", nextRank: "Platinum", nextTV: 150000, nextReferrals: 12 },
  platinum: { label: "Platinum", color: "text-cyan-300", nextRank: "Diamond", nextTV: 500000 },
  diamond: { label: "Diamond", color: "text-primary" },
};
