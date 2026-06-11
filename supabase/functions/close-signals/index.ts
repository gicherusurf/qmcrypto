import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString();

    const { data: dueSignals, error: fetchErr } = await supabase
      .from("signals")
      .select("id, profit_percentage")
      .eq("status", "open")
      .lte("closes_at", now);
    if (fetchErr) throw fetchErr;

    let closedCount = 0;

    for (const signal of dueSignals || []) {
      const profitPct = Number(signal.profit_percentage) / 100;

      const { data: takes, error: takesErr } = await supabase
        .from("signal_takes")
        .select("id, user_id, stake_amount")
        .eq("signal_id", signal.id)
        .eq("status", "active");
      if (takesErr) { console.error(takesErr); continue; }

      for (const take of takes || []) {
        const profit = Number(take.stake_amount) * profitPct;
        const total = Number(take.stake_amount) + profit;

        const { data: prof } = await supabase
          .from("profiles")
          .select("total_balance, total_earnings")
          .eq("id", take.user_id)
          .maybeSingle();
        if (!prof) continue;

        const newBal = Number(prof.total_balance) + total;
        const newEarn = Number(prof.total_earnings) + profit;

        const { error: profErr } = await supabase
          .from("profiles")
          .update({ total_balance: newBal, total_earnings: newEarn })
          .eq("id", take.user_id);
        if (profErr) { console.error(profErr); continue; }

        await supabase
          .from("signal_takes")
          .update({ status: "won", profit_amount: profit, closed_at: now })
          .eq("id", take.id);
      }

      await supabase.from("signals").update({ status: "closed", closed_at: now }).eq("id", signal.id);
      closedCount++;
    }

    return new Response(JSON.stringify({ ok: true, closed: closedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
