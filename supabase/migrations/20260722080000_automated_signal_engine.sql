-- Sprint 2: Automated Signal Engine
--
-- 1. The balance-tampering guard trigger only allowed admins to modify
--    profiles.total_balance / withdrawable_balance. The close-signals edge
--    function settles trades using the service_role key (no auth.uid()),
--    so it was silently blocked by this trigger. Extend the allowlist to
--    the service role, which already bypasses RLS everywhere else — this
--    does not loosen what regular users can do.
CREATE OR REPLACE FUNCTION public.prevent_profile_balance_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (automated settlement) and admins
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.total_balance IS DISTINCT FROM OLD.total_balance
     OR NEW.withdrawable_balance IS DISTINCT FROM OLD.withdrawable_balance
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not permitted to modify protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Schedule automatic signal generation every 4 hours, aligned to
--    02:00 / 06:00 / 10:00 / 14:00 / 18:00 / 22:00 Africa/Nairobi (EAT).
--    EAT is a fixed UTC+3 offset with no daylight saving, so those times
--    are always 23:00 / 03:00 / 07:00 / 11:00 / 15:00 / 19:00 UTC.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'generate-signal-schedule';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'close-signals-schedule';

SELECT cron.schedule(
  'generate-signal-schedule',
  '0 23,3,7,11,15,19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mocixgnbnuotmdbvikdh.supabase.co/functions/v1/generate-signal',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2l4Z25ibnVvdG1kYnZpa2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY1NjMsImV4cCI6MjA4MDg2MjU2M30.GLV4DM-DsJiT0e-iap9Wy-LpE5doQbQMMuFQFA7vW6E", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2l4Z25ibnVvdG1kYnZpa2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY1NjMsImV4cCI6MjA4MDg2MjU2M30.GLV4DM-DsJiT0e-iap9Wy-LpE5doQbQMMuFQFA7vW6E"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Process due closures every minute so the 5-minute window is always
-- settled promptly (idempotent: only 'open' signals / 'active' takes are
-- ever touched, so re-running it does nothing once a signal is closed).
SELECT cron.schedule(
  'close-signals-schedule',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mocixgnbnuotmdbvikdh.supabase.co/functions/v1/close-signals',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2l4Z25ibnVvdG1kYnZpa2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY1NjMsImV4cCI6MjA4MDg2MjU2M30.GLV4DM-DsJiT0e-iap9Wy-LpE5doQbQMMuFQFA7vW6E", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2l4Z25ibnVvdG1kYnZpa2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODY1NjMsImV4cCI6MjA4MDg2MjU2M30.GLV4DM-DsJiT0e-iap9Wy-LpE5doQbQMMuFQFA7vW6E"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
