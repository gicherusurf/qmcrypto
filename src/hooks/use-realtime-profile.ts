import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useRealtimeProfile() {
  const queryClient = useQueryClient();
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` }, () => {
        refreshProfile();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "signal_takes", filter: `user_id=eq.${profile.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-takes"] });
        queryClient.invalidateQueries({ queryKey: ["recent-trades"] });
        refreshProfile();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${profile.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-withdrawals"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${profile.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["user-deposits"] });
        refreshProfile();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "signals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["signals"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, queryClient, refreshProfile]);
}
