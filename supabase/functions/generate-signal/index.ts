import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fixed rotation — index is derived from the EAT hour-of-day, so the same
// pair/direction always lands on the same scheduled slot:
//   02:00 BTC LONG · 06:00 ETH SHORT · 10:00 SOL LONG
//   14:00 XRP SHORT · 18:00 BNB LONG · 22:00 DOGE SHORT
const ROTATION: { pair: string; direction: "LONG" | "SHORT"; coingeckoId: string; fallbackPrice: number }[] = [
  { pair: "BTC/USDT", direction: "LONG", coingeckoId: "bitcoin", fallbackPrice: 95000 },
  { pair: "ETH/USDT", direction: "SHORT", coingeckoId: "ethereum", fallbackPrice: 3500 },
  { pair: "SOL/USDT", direction: "LONG", coingeckoId: "solana", fallbackPrice: 220 },
  { pair: "XRP/USDT", direction: "SHORT", coingeckoId: "ripple", fallbackPrice: 2.4 },
  { pair: "BNB/USDT", direction: "LONG", coingeckoId: "binancecoin", fallbackPrice: 680 },
  { pair: "DOGE/USDT", direction: "SHORT", coingeckoId: "dogecoin", fallbackPrice: 0.4 },
];

const SIGNAL_DURATION_MS = 5 * 60 * 1000;
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000; // Africa/Nairobi is fixed UTC+3, no DST

const TEMPLATES = [
  "Momentum building on {pair}. Clean {dir} setup forming.",
  "Breakout confirmed on {pair} — taking a {dir} position.",
  "RSI divergence on {pair}, going {dir} for a quick scalp.",
  "Volume spike detected on {pair}. {dir} signal active.",
  "{pair} retesting key level — {dir} entry triggered.",
];

async function fetchLivePrice(coingeckoId: string, fallback: number): Promise<number> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!res.ok) return fallback;
    const json = await res.json();
    const price = json?.[coingeckoId]?.usd;
    return typeof price === "number" && price > 0 ? price : fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let force = false;
    try {
      const body = await req.json();
      force = body?.force === true;
    } catch {
      // no body (e.g. cron invocation) — that's fine
    }

    if (!force) {
      // Idempotency guard: never generate a second signal while one is
      // still open (each slot's 5-minute window always closes long before
      // the next slot begins 4 hours later).
      const { data: openSignal } = await supabase
        .from("signals")
        .select("id")
        .eq("status", "open")
        .gt("closes_at", new Date().toISOString())
        .maybeSingle();

      if (openSignal) {
        return new Response(JSON.stringify({ ok: true, skipped: true, reason: "A signal is already open" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const nowEat = new Date(Date.now() + EAT_OFFSET_MS);
    const eatHour = nowEat.getUTCHours();
    const slotIndex = Math.floor(eatHour / 4) % ROTATION.length;
    const choice = ROTATION[slotIndex];

    const livePrice = await fetchLivePrice(choice.coingeckoId, choice.fallbackPrice);
    const variance = (Math.random() - 0.5) * 0.004; // tiny cosmetic jitter around the live price
    const entry = livePrice * (1 + variance);
    const target = choice.direction === "LONG" ? entry * 1.03 : entry * 0.97;
    const stopLoss = choice.direction === "LONG" ? entry * 0.985 : entry * 1.015;

    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const message = template.replace("{pair}", choice.pair).replace("{dir}", choice.direction.toLowerCase());

    const createdAt = new Date();
    const closesAt = new Date(createdAt.getTime() + SIGNAL_DURATION_MS).toISOString();

    const { data, error } = await supabase
      .from("signals")
      .insert({
        pair: choice.pair,
        direction: choice.direction,
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
