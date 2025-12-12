import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push requires these for signing
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = "mailto:admin@cryptoinvest.com";

async function sendPushNotification(subscription: any, payload: any) {
  const { endpoint, p256dh, auth } = subscription;
  
  // Import web-push compatible library
  const webPush = await import("https://esm.sh/web-push@3.6.7");
  
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  
  try {
    await webPush.sendNotification(
      {
        endpoint,
        keys: { p256dh, auth }
      },
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (error) {
    console.error("Push notification error:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, url, type } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = { title, body, url: url || "/dashboard", type };
    const results = [];

    for (const sub of subscriptions) {
      const result = await sendPushNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, ...result });
      
      // Remove invalid subscriptions
      if (!result.success && result.error?.includes("410")) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
