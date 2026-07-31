import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CryptoPrices {
  [pair: string]: number;
}

/**
 * Fetches live-ish crypto prices for UI realism only. Never affects
 * settlement, which is always exactly 1.2% regardless of these numbers.
 */
export function useCryptoPrices() {
  return useQuery({
    queryKey: ["crypto-prices"],
    queryFn: async (): Promise<CryptoPrices> => {
      const { data, error } = await supabase.functions.invoke("get-crypto-prices");
      if (error) throw error;
      return (data?.prices ?? {}) as CryptoPrices;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}
