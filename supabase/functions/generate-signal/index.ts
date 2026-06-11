import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAIRS = [
  { pair: "BTC/USDT", price: 95000 },
  { pair: "ETH/USDT", price: 3500 },
  { pair: "SOL/USDT", price: 220 },
  { pair: "BNB/USDT", price: 680 },
  { pair: "XRP/USDT", price: 2.4 },
  { pair: "ADA/USDT", price: 1.1 },
  { pair: "DOGE/USDT", price: 0.4 },
  { pair: "AVAX/USDT", price: 42 },
  { pair: "LINK/USDT", price: 24 },
  { pair: "MATIC/USDT", price: 0.55 },
];

const TEMPLATES = [
  "Momentum building on {pair}. Clean {dir} setup forming.",
  "Breakout confirmed on {pair} — taking a {dir} position.",
  "RSI divergence on {pair}, going {dir} for a quick scalp.",
  "Volume spike detected on {pair}. {dir} signal active.",
  "{pair} retesting key level — {dir} entry triggered.",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const choice = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const direction: "LONG" | "SHORT" = Math.random() > 0.5 ? "LONG" : "SHORT";
    const variance = (Math.random() - 0.5) * 0.02;
    const entry = choice.price * (1 + variance);
    const target = direction === "LONG" ? entry * 1.03 : entry * 0.97;
    const stopLoss = direction === "LONG" ? entry * 0.985 : entry * 1.015;
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const message = template.replace("{pair}", choice.pair).replace("{dir}", direction.toLowerCase());

    const closesAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("signals")
      .insert({
        pair: choice.pair,
        direction,
        entry_price: entry,
        target_price: target,
        stop_loss: stopLoss,
        profit_percentage: 3.0,
        message,
        status: "open",
        closes_at: closesAt,
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, signal: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
