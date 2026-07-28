-- ============================================================================
-- CONSOLIDATED LIVE DATABASE STATE — 2026-07-28
-- ============================================================================
-- This file captures ALL SQL applied directly to the live Lovable Cloud
-- database via the Cloud tab SQL editor between 2026-07-22 and 2026-07-28,
-- which never existed as migration files. It reflects the FINAL state of
-- every function/table after all bug fixes.
--
-- It is written to be idempotent where possible (IF NOT EXISTS / OR REPLACE)
-- so it can be replayed against a fresh database to rebuild the full schema.
-- NOTE: The live DB already has all of this applied — do NOT re-run this
-- against production; it exists as disaster-recovery source of truth.
--
-- SECRETS: the Resend API key in notify_admin_new_deposit() below is the
-- one configured at time of writing. If rotated, update it here too.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ROLES: moderator role + staff helper
-- ----------------------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'moderator');
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(_target_user_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _role NOT IN ('user', 'moderator', 'admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  IF _role <> 'user' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _role::app_role);
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

-- Staff-widened policies (replacing admin-only originals)
DROP POLICY IF EXISTS "Admins update deposits" ON public.deposits;
DROP POLICY IF EXISTS "Staff update deposits" ON public.deposits;
CREATE POLICY "Staff update deposits" ON public.deposits
  FOR UPDATE USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Staff can update withdrawals" ON public.withdrawals;
CREATE POLICY "Staff can update withdrawals" ON public.withdrawals
  FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "No direct inserts by users" ON public.withdrawals;
DROP POLICY IF EXISTS "Staff insert withdrawals" ON public.withdrawals;
CREATE POLICY "Staff insert withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
CREATE POLICY "Users can view own payment proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));

-- Wallet settings readable by all authenticated users (deposit dialog)
DROP POLICY IF EXISTS "Settings are viewable by admins" ON public.settings;
DROP POLICY IF EXISTS "Wallet settings are viewable by authenticated users" ON public.settings;
CREATE POLICY "Wallet settings are viewable by authenticated users" ON public.settings
  FOR SELECT USING (
    key IN ('btc_wallet', 'usdt_trc20_wallet', 'usdt_erc20_wallet')
    OR public.is_staff(auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 2. PROFILES: new columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_volume numeric NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_rank text NOT NULL DEFAULT 'none';

-- ----------------------------------------------------------------------------
-- 3. BALANCE-TAMPERING GUARD (final: staff + bypass flag)
-- Trusted SECURITY DEFINER functions set the transaction-local flag
-- app.bypass_balance_check before legitimate balance updates.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_balance_tampering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() IS NULL
     OR public.is_staff(auth.uid())
     OR current_setting('app.bypass_balance_check', true) = 'true' THEN
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
END; $$;

-- ----------------------------------------------------------------------------
-- 4. MARKET PRICES (live crypto + forex cache)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_prices (
  pair text PRIMARY KEY,
  price numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read market prices" ON public.market_prices;
CREATE POLICY "Anyone can read market prices" ON public.market_prices FOR SELECT USING (true);

-- pg_net is async: request and processing are split into two cron jobs
-- to avoid same-transaction visibility issues with net._http_response.
CREATE OR REPLACE FUNCTION public.request_market_prices()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana,binancecoin,dogecoin&vs_currencies=usd');
  PERFORM net.http_get('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP');
END; $$;

CREATE OR REPLACE FUNCTION public.process_market_prices()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_crypto_body jsonb;
  v_forex_body jsonb;
BEGIN
  SELECT content::jsonb INTO v_crypto_body FROM net._http_response
    WHERE status_code = 200 AND content LIKE '%bitcoin%' ORDER BY created DESC LIMIT 1;
  SELECT content::jsonb INTO v_forex_body FROM net._http_response
    WHERE status_code = 200 AND content LIKE '%rates%' ORDER BY created DESC LIMIT 1;

  IF v_crypto_body IS NOT NULL THEN
    INSERT INTO public.market_prices (pair, price, updated_at) VALUES
      ('BTC/USDT', (v_crypto_body->'bitcoin'->>'usd')::numeric, now()),
      ('SOL/USDT', (v_crypto_body->'solana'->>'usd')::numeric, now()),
      ('BNB/USDT', (v_crypto_body->'binancecoin'->>'usd')::numeric, now()),
      ('DOGE/USDT', (v_crypto_body->'dogecoin'->>'usd')::numeric, now())
    ON CONFLICT (pair) DO UPDATE SET price = EXCLUDED.price, updated_at = EXCLUDED.updated_at;
  END IF;

  IF v_forex_body IS NOT NULL THEN
    INSERT INTO public.market_prices (pair, price, updated_at) VALUES
      ('EUR/USD', 1 / (v_forex_body->'rates'->>'EUR')::numeric, now()),
      ('GBP/USD', 1 / (v_forex_body->'rates'->>'GBP')::numeric, now())
    ON CONFLICT (pair) DO UPDATE SET price = EXCLUDED.price, updated_at = EXCLUDED.updated_at;
  END IF;

  DELETE FROM net._http_response WHERE created < now() - interval '1 day';
END; $$;

-- ----------------------------------------------------------------------------
-- 5. SIGNAL ENGINE (EAT schedule, live prices, 5-min windows)
-- Slots (Africa/Nairobi, UTC+3, no DST): 02/06/10/14/18/22
-- Rotation: BTC LONG, EUR/USD SHORT, SOL LONG, GBP/USD SHORT, BNB LONG, DOGE SHORT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_signal(_force boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_open_exists boolean;
  v_hour int; v_slot int;
  v_pair text; v_direction text;
  v_fallback_price numeric; v_cached_price numeric;
  v_entry numeric; v_target numeric; v_stop numeric;
  v_message text;
  v_templates text[] := ARRAY[
    '%s momentum building. Clean %s setup forming.',
    '%s breakout confirmed - taking a %s position.',
    '%s RSI divergence, going %s for a quick scalp.',
    '%s volume spike detected. %s signal active.',
    '%s retesting key level - %s entry triggered.'
  ];
BEGIN
  IF NOT _force THEN
    SELECT EXISTS (SELECT 1 FROM public.signals WHERE status = 'open' AND closes_at > now()) INTO v_open_exists;
    IF v_open_exists THEN RETURN; END IF;
  END IF;

  v_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Nairobi'))::int;
  v_slot := (v_hour / 4) % 6;

  CASE v_slot
    WHEN 0 THEN v_pair := 'BTC/USDT'; v_direction := 'LONG';  v_fallback_price := 95000;
    WHEN 1 THEN v_pair := 'EUR/USD';  v_direction := 'SHORT'; v_fallback_price := 1.09;
    WHEN 2 THEN v_pair := 'SOL/USDT'; v_direction := 'LONG';  v_fallback_price := 220;
    WHEN 3 THEN v_pair := 'GBP/USD';  v_direction := 'SHORT'; v_fallback_price := 1.27;
    WHEN 4 THEN v_pair := 'BNB/USDT'; v_direction := 'LONG';  v_fallback_price := 680;
    WHEN 5 THEN v_pair := 'DOGE/USDT'; v_direction := 'SHORT'; v_fallback_price := 0.4;
  END CASE;

  SELECT price INTO v_cached_price FROM public.market_prices
    WHERE pair = v_pair AND updated_at > now() - interval '30 minutes';

  v_entry := COALESCE(v_cached_price, v_fallback_price) * (1 + (random() - 0.5) * 0.004);
  IF v_direction = 'LONG' THEN
    v_target := v_entry * 1.03; v_stop := v_entry * 0.985;
  ELSE
    v_target := v_entry * 0.97; v_stop := v_entry * 1.015;
  END IF;

  v_message := format(v_templates[1 + floor(random() * array_length(v_templates, 1))::int], v_pair, lower(v_direction));

  INSERT INTO public.signals (pair, direction, entry_price, target_price, stop_loss, profit_percentage, message, status, closes_at)
  VALUES (v_pair, v_direction, v_entry, v_target, v_stop, 3.0, v_message, 'open', now() + interval '5 minutes');
END; $$;

-- Settlement (FINAL): pays user's own profit to BOTH balances; 7-level
-- profit-share cascade credits trading balance (total_balance) ONLY.
-- FOR UPDATE SKIP LOCKED prevents double-payout on overlapping cron runs.
CREATE OR REPLACE FUNCTION public.close_due_signals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_signal RECORD; v_take RECORD; v_prof RECORD;
  v_profit_pct numeric; v_profit numeric; v_total numeric;
  v_now timestamptz := now();
  v_current_id uuid; v_next_referrer uuid; v_level int;
  v_rate numeric; v_commission numeric;
  v_rates numeric[] := ARRAY[0.005, 0.003, 0.002, 0.0015, 0.001, 0.0008, 0.0005];
BEGIN
  FOR v_signal IN SELECT id, profit_percentage FROM public.signals WHERE status = 'open' AND closes_at <= v_now LOOP
    FOR v_take IN
      SELECT id, user_id, stake_amount FROM public.signal_takes
      WHERE signal_id = v_signal.id AND status = 'active'
      FOR UPDATE SKIP LOCKED
    LOOP
      v_profit_pct := v_signal.profit_percentage / 100;
      v_profit := v_take.stake_amount * v_profit_pct;
      v_total := v_take.stake_amount + v_profit;

      SELECT total_balance, total_earnings, withdrawable_balance, referred_by INTO v_prof
      FROM public.profiles WHERE id = v_take.user_id;
      IF NOT FOUND THEN CONTINUE; END IF;

      UPDATE public.profiles SET
        total_balance = v_prof.total_balance + v_total,
        total_earnings = v_prof.total_earnings + v_profit,
        withdrawable_balance = COALESCE(v_prof.withdrawable_balance, 0) + v_profit
      WHERE id = v_take.user_id;

      UPDATE public.signal_takes SET status = 'won', profit_amount = v_profit, closed_at = v_now WHERE id = v_take.id;

      v_current_id := v_take.user_id;
      FOR v_level IN 1..7 LOOP
        SELECT referred_by INTO v_next_referrer FROM public.profiles WHERE id = v_current_id;
        EXIT WHEN v_next_referrer IS NULL;
        v_rate := v_rates[v_level];
        v_commission := v_profit * v_rate;
        UPDATE public.profiles SET
          total_balance = total_balance + v_commission,
          total_earnings = total_earnings + v_commission
        WHERE id = v_next_referrer;
        INSERT INTO public.profit_share_commissions (referrer_id, referee_id, signal_take_id, level, profit_amount, commission_rate, commission_amount)
        VALUES (v_next_referrer, v_take.user_id, v_take.id, v_level, v_profit, v_rate, v_commission)
        ON CONFLICT (signal_take_id, level) DO NOTHING;
        v_current_id := v_next_referrer;
      END LOOP;
    END LOOP;
    UPDATE public.signals SET status = 'closed', closed_at = v_now WHERE id = v_signal.id;
  END LOOP;
END; $$;

-- ----------------------------------------------------------------------------
-- 6. SIGNAL TIERS & QUOTA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_of_eat_day()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'Africa/Nairobi';
$$;

-- Tier by DEPOSITED referrals (>=1 approved deposit); expired subscription => 0.
CREATE OR REPLACE FUNCTION public.get_daily_signal_limit(_profile_id uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrals int;
  v_sub_status text;
BEGIN
  SELECT status INTO v_sub_status FROM public.subscriptions WHERE user_id = _profile_id;
  IF v_sub_status = 'expired' THEN RETURN 0; END IF;

  SELECT count(DISTINCT p.id) INTO v_referrals FROM public.profiles p
  WHERE p.referred_by = _profile_id
    AND EXISTS (SELECT 1 FROM public.deposits d WHERE d.user_id = p.id AND d.status = 'approved');

  IF v_referrals >= 10 THEN RETURN 6;
  ELSIF v_referrals >= 5 THEN RETURN 4;
  ELSE RETURN 2;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_my_signal_quota()
RETURNS TABLE(daily_limit int, taken_today int, referral_count int, subscription_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT
    public.get_daily_signal_limit(_profile_id),
    (SELECT count(*)::int FROM public.signal_takes WHERE user_id = _profile_id AND created_at >= public.start_of_eat_day()),
    (SELECT count(DISTINCT p.id)::int FROM public.profiles p WHERE p.referred_by = _profile_id
       AND EXISTS (SELECT 1 FROM public.deposits d WHERE d.user_id = p.id AND d.status = 'approved')),
    (SELECT status FROM public.subscriptions WHERE user_id = _profile_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_signal_quota() TO authenticated;

-- take_signal (FINAL): profile row locked, daily tier limit, bypass flag.
CREATE OR REPLACE FUNCTION public.take_signal(_signal_id uuid, _stake numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _profile_id uuid; _balance numeric; _status text; _closes timestamptz;
  _take_id uuid; _existing uuid; _daily_limit int; _taken_today int;
BEGIN
  IF _stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  SELECT id, total_balance INTO _profile_id, _balance FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT status, closes_at INTO _status, _closes FROM public.signals WHERE id = _signal_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'Signal not found'; END IF;
  IF _status <> 'open' THEN RAISE EXCEPTION 'Signal is no longer open'; END IF;
  IF _closes <= now() THEN RAISE EXCEPTION 'Signal take window has closed'; END IF;
  SELECT id INTO _existing FROM public.signal_takes WHERE user_id = _profile_id AND signal_id = _signal_id;
  IF _existing IS NOT NULL THEN RAISE EXCEPTION 'You have already taken this signal'; END IF;
  _daily_limit := public.get_daily_signal_limit(_profile_id);
  SELECT count(*) INTO _taken_today FROM public.signal_takes WHERE user_id = _profile_id AND created_at >= public.start_of_eat_day();
  IF _taken_today >= _daily_limit THEN
    RAISE EXCEPTION 'Daily signal limit reached (%/% signals). Refer more users to unlock additional signals per day.', _taken_today, _daily_limit;
  END IF;
  IF _balance < _stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  PERFORM set_config('app.bypass_balance_check', 'true', true);
  UPDATE public.profiles SET total_balance = total_balance - _stake WHERE id = _profile_id;
  INSERT INTO public.signal_takes (user_id, signal_id, stake_amount) VALUES (_profile_id, _signal_id, _stake) RETURNING id INTO _take_id;
  RETURN _take_id;
END; $function$;

-- ----------------------------------------------------------------------------
-- 7. SUBSCRIPTIONS ($15 / 30 days, from withdrawable balance only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  auto_renew boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own subscription" ON public.subscriptions;
CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));
-- No client INSERT/UPDATE policies on purpose: all writes go through RPCs.

CREATE TABLE IF NOT EXISTS public.subscription_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  previous_available_balance numeric NOT NULL,
  new_available_balance numeric NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own subscription transactions" ON public.subscription_transactions;
CREATE POLICY "Users view own subscription transactions" ON public.subscription_transactions
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user ON public.subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- Billing core (FINAL: FOR UPDATE on both rows, bypass flag)
CREATE OR REPLACE FUNCTION public.process_subscription_billing(_profile_id uuid, _manual boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub record; _balance numeric; _withdrawable numeric;
  _new_period_start timestamptz; _new_period_end timestamptz;
BEGIN
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _profile_id FOR UPDATE;
  IF _sub IS NULL THEN
    INSERT INTO public.subscriptions (user_id, status, started_at, current_period_start, current_period_end, auto_renew)
    VALUES (_profile_id, 'active', now(), now(), now() + interval '30 days', true)
    RETURNING * INTO _sub;
  END IF;
  IF now() < _sub.current_period_end THEN RETURN 'not_due'; END IF;
  IF _sub.status = 'expired' AND NOT _manual AND NOT _sub.auto_renew THEN RETURN 'skipped_no_autorenew'; END IF;

  SELECT total_balance, COALESCE(withdrawable_balance, 0) INTO _balance, _withdrawable
  FROM public.profiles WHERE id = _profile_id FOR UPDATE;

  IF _withdrawable >= 15 THEN
    PERFORM set_config('app.bypass_balance_check', 'true', true);
    UPDATE public.profiles SET total_balance = total_balance - 15, withdrawable_balance = withdrawable_balance - 15 WHERE id = _profile_id;
    _new_period_start := GREATEST(_sub.current_period_end, now());
    _new_period_end := _new_period_start + interval '30 days';
    UPDATE public.subscriptions SET status = 'active', current_period_start = _new_period_start,
      current_period_end = _new_period_end, updated_at = now() WHERE user_id = _profile_id;
    INSERT INTO public.subscription_transactions (user_id, amount, previous_available_balance, new_available_balance, period_start, period_end, status)
    VALUES (_profile_id, 15, _withdrawable, _withdrawable - 15, _new_period_start, _new_period_end, 'success');
    RETURN 'success';
  ELSE
    UPDATE public.subscriptions SET status = 'expired', updated_at = now() WHERE user_id = _profile_id;
    INSERT INTO public.subscription_transactions (user_id, amount, previous_available_balance, new_available_balance, period_start, period_end, status)
    VALUES (_profile_id, 15, _withdrawable, _withdrawable, _sub.current_period_start, _sub.current_period_end, 'failed');
    RETURN 'failed_insufficient_balance';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.process_all_subscriptions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sub record;
BEGIN
  FOR _sub IN SELECT user_id FROM public.subscriptions WHERE current_period_end <= now() LOOP
    PERFORM public.process_subscription_billing(_sub.user_id, false);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.renew_my_subscription()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN public.process_subscription_billing(_profile_id, true);
END; $$;
GRANT EXECUTE ON FUNCTION public.renew_my_subscription() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_auto_renew(_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  UPDATE public.subscriptions SET auto_renew = _enabled, updated_at = now() WHERE user_id = _profile_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_my_auto_renew(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS TABLE(status text, started_at timestamptz, current_period_end timestamptz, auto_renew boolean, withdrawable_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _profile_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT s.status, s.started_at, s.current_period_end, s.auto_renew, COALESCE(p.withdrawable_balance, 0)
  FROM public.subscriptions s JOIN public.profiles p ON p.id = s.user_id WHERE s.user_id = _profile_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. AFFILIATE MODULE: 7-level deposit commissions, profit share, ranks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deposit_id uuid NOT NULL REFERENCES public.deposits(id) ON DELETE CASCADE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 7),
  deposit_amount numeric NOT NULL,
  commission_rate numeric NOT NULL,
  commission_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deposit_id, level)
);
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own affiliate commissions" ON public.affiliate_commissions;
CREATE POLICY "Users view own affiliate commissions" ON public.affiliate_commissions
  FOR SELECT USING (referrer_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referrer ON public.affiliate_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_deposit ON public.affiliate_commissions(deposit_id);

CREATE TABLE IF NOT EXISTS public.profit_share_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_take_id uuid NOT NULL REFERENCES public.signal_takes(id) ON DELETE CASCADE,
  level int NOT NULL CHECK (level BETWEEN 1 AND 7),
  profit_amount numeric NOT NULL,
  commission_rate numeric NOT NULL,
  commission_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_take_id, level)
);
ALTER TABLE public.profit_share_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own profit share commissions" ON public.profit_share_commissions;
CREATE POLICY "Users view own profit share commissions" ON public.profit_share_commissions
  FOR SELECT USING (referrer_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_profit_share_commissions_referrer ON public.profit_share_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_profit_share_commissions_take ON public.profit_share_commissions(signal_take_id);

CREATE TABLE IF NOT EXISTS public.rank_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_rank text NOT NULL,
  new_rank text NOT NULL,
  team_volume numeric NOT NULL,
  personal_referrals int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rank_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own rank history" ON public.rank_history;
CREATE POLICY "Users view own rank history" ON public.rank_history
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.leadership_bonus_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank text NOT NULL,
  leadership_amount numeric NOT NULL,
  matching_amount numeric NOT NULL,
  total_amount numeric NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);
ALTER TABLE public.leadership_bonus_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own leadership bonus history" ON public.leadership_bonus_history;
CREATE POLICY "Users view own leadership bonus history" ON public.leadership_bonus_history
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));

-- Rank thresholds: bronze $5k TV; silver $20k + 5 deposited refs;
-- gold $50k + 8; platinum $150k + 12; diamond $500k.
CREATE OR REPLACE FUNCTION public.recalculate_rank(_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tv numeric; _referrals int; _old_rank text; _new_rank text;
BEGIN
  SELECT team_volume, current_rank INTO _tv, _old_rank FROM public.profiles WHERE id = _profile_id;
  IF _tv IS NULL THEN RETURN; END IF;
  SELECT count(DISTINCT p.id) INTO _referrals FROM public.profiles p
  WHERE p.referred_by = _profile_id
    AND EXISTS (SELECT 1 FROM public.deposits d WHERE d.user_id = p.id AND d.status = 'approved');
  IF _tv >= 500000 THEN _new_rank := 'diamond';
  ELSIF _tv >= 150000 AND _referrals >= 12 THEN _new_rank := 'platinum';
  ELSIF _tv >= 50000 AND _referrals >= 8 THEN _new_rank := 'gold';
  ELSIF _tv >= 20000 AND _referrals >= 5 THEN _new_rank := 'silver';
  ELSIF _tv >= 5000 THEN _new_rank := 'bronze';
  ELSE _new_rank := 'none';
  END IF;
  IF _new_rank IS DISTINCT FROM _old_rank THEN
    UPDATE public.profiles SET current_rank = _new_rank WHERE id = _profile_id;
    INSERT INTO public.rank_history (user_id, old_rank, new_rank, team_volume, personal_referrals)
    VALUES (_profile_id, COALESCE(_old_rank,'none'), _new_rank, _tv, _referrals);
  END IF;
END; $$;

-- approve_deposit (FINAL): row locked; 7-level cascade 10/6/4/3/2/1.5/1%;
-- commissions credit TRADING balance only; team volume rollup; rank recalc.
CREATE OR REPLACE FUNCTION public.approve_deposit(_deposit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dep record; _current_id uuid; _next_referrer uuid; _level int;
  _rate numeric; _commission numeric;
  _rates numeric[] := ARRAY[0.10, 0.06, 0.04, 0.03, 0.02, 0.015, 0.01];
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _dep FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF _dep IS NULL THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF _dep.status <> 'pending' THEN RAISE EXCEPTION 'Deposit already processed'; END IF;
  UPDATE public.deposits SET status = 'approved', processed_at = now() WHERE id = _deposit_id;
  UPDATE public.profiles SET total_balance = total_balance + _dep.amount_usd WHERE id = _dep.user_id;
  _current_id := _dep.user_id;
  FOR _level IN 1..7 LOOP
    SELECT referred_by INTO _next_referrer FROM public.profiles WHERE id = _current_id;
    EXIT WHEN _next_referrer IS NULL;
    _rate := _rates[_level];
    _commission := _dep.amount_usd * _rate;
    UPDATE public.profiles SET
      total_balance = total_balance + _commission,
      team_volume = team_volume + _dep.amount_usd
    WHERE id = _next_referrer;
    INSERT INTO public.affiliate_commissions (referrer_id, referee_id, deposit_id, level, deposit_amount, commission_rate, commission_amount)
    VALUES (_next_referrer, _dep.user_id, _deposit_id, _level, _dep.amount_usd, _rate, _commission)
    ON CONFLICT (deposit_id, level) DO NOTHING;
    PERFORM public.recalculate_rank(_next_referrer);
    _current_id := _next_referrer;
  END LOOP;
END; $$;

-- Monthly bonuses (calendar month, cron on the 1st): flat leadership by rank
-- + matching % of DIRECT referrals' commissions last month. Trading balance only.
CREATE OR REPLACE FUNCTION public.pay_monthly_leadership_bonuses()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _period_start timestamptz; _period_end timestamptz; _r RECORD;
  _leadership numeric; _match_rate numeric; _matching numeric; _total numeric;
BEGIN
  _period_end := date_trunc('month', now());
  _period_start := _period_end - interval '1 month';
  FOR _r IN SELECT id, current_rank FROM public.profiles WHERE current_rank <> 'none' LOOP
    CASE _r.current_rank
      WHEN 'bronze' THEN _leadership := 150; _match_rate := 0.05;
      WHEN 'silver' THEN _leadership := 500; _match_rate := 0.08;
      WHEN 'gold' THEN _leadership := 1200; _match_rate := 0.10;
      WHEN 'platinum' THEN _leadership := 3500; _match_rate := 0.12;
      WHEN 'diamond' THEN _leadership := 10000; _match_rate := 0.15;
      ELSE CONTINUE;
    END CASE;
    SELECT COALESCE(SUM(x.amt), 0) INTO _matching FROM (
      SELECT commission_amount AS amt, referrer_id FROM public.affiliate_commissions
        WHERE created_at >= _period_start AND created_at < _period_end
      UNION ALL
      SELECT commission_amount AS amt, referrer_id FROM public.profit_share_commissions
        WHERE created_at >= _period_start AND created_at < _period_end
    ) x JOIN public.profiles p ON p.id = x.referrer_id WHERE p.referred_by = _r.id;
    _matching := _matching * _match_rate;
    _total := _leadership + _matching;
    UPDATE public.profiles SET total_balance = total_balance + _total, total_earnings = total_earnings + _total WHERE id = _r.id;
    INSERT INTO public.leadership_bonus_history (user_id, rank, leadership_amount, matching_amount, total_amount, period_start, period_end)
    VALUES (_r.id, _r.current_rank, _leadership, _matching, _total, _period_start, _period_end)
    ON CONFLICT (user_id, period_start) DO NOTHING;
  END LOOP;
END; $$;

-- ----------------------------------------------------------------------------
-- 9. REFERRAL / AFFILIATE DASHBOARD RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS TABLE(total_referrals int, deposited_referrals int, daily_signal_limit int, signup_bonus_earned numeric, signal_commission_earned numeric, total_referral_earnings numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _a numeric; _b numeric; _c numeric; _d numeric;
BEGIN
  SELECT id INTO _pid FROM public.profiles WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RETURN; END IF;
  SELECT COALESCE(sum(commission_amount),0) INTO _a FROM public.referral_commissions WHERE referrer_id = _pid AND signal_take_id IS NULL;
  SELECT COALESCE(sum(commission_amount),0) INTO _b FROM public.affiliate_commissions WHERE referrer_id = _pid;
  SELECT COALESCE(sum(commission_amount),0) INTO _c FROM public.referral_commissions WHERE referrer_id = _pid AND signal_take_id IS NOT NULL;
  SELECT COALESCE(sum(commission_amount),0) INTO _d FROM public.profit_share_commissions WHERE referrer_id = _pid;
  RETURN QUERY SELECT
    (SELECT count(*)::int FROM public.profiles WHERE referred_by = _pid),
    (SELECT count(DISTINCT p.id)::int FROM public.profiles p WHERE p.referred_by = _pid
       AND EXISTS (SELECT 1 FROM public.deposits d WHERE d.user_id = p.id AND d.status = 'approved')),
    public.get_daily_signal_limit(_pid),
    _a+_b, _c+_d, _a+_b+_c+_d;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_referral_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_affiliate_dashboard()
RETURNS TABLE(current_rank text, personal_referrals int, active_team_size int, team_volume numeric, deposit_commissions_earned numeric, profit_share_earned numeric, leadership_bonuses_earned numeric, matching_bonuses_earned numeric, total_affiliate_earnings numeric, available_balance numeric, daily_signal_limit int, taken_today int, subscription_status text, next_billing_date timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pid uuid; _personal_referrals int; _active_team_size int; _team_volume numeric;
  _deposit_comm numeric; _profit_share numeric; _leadership numeric; _matching numeric;
  _available numeric; _daily_limit int; _taken_today int; _sub_status text; _next_billing timestamptz;
BEGIN
  SELECT id INTO _pid FROM public.profiles WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RETURN; END IF;
  SELECT count(DISTINCT p.id)::int INTO _personal_referrals FROM public.profiles p
    WHERE p.referred_by = _pid AND EXISTS (SELECT 1 FROM public.deposits d WHERE d.user_id = p.id AND d.status = 'approved');
  WITH RECURSIVE downline AS (
    SELECT id, 1 AS depth FROM public.profiles WHERE referred_by = _pid
    UNION ALL
    SELECT p.id, dl.depth + 1 FROM public.profiles p JOIN downline dl ON p.referred_by = dl.id WHERE dl.depth < 7
  )
  SELECT count(DISTINCT dl.id)::int INTO _active_team_size FROM downline dl
    WHERE EXISTS (SELECT 1 FROM public.deposits dep WHERE dep.user_id = dl.id AND dep.status = 'approved');
  SELECT p.team_volume INTO _team_volume FROM public.profiles p WHERE p.id = _pid;
  SELECT COALESCE(sum(commission_amount),0) INTO _deposit_comm FROM public.affiliate_commissions WHERE referrer_id = _pid;
  SELECT COALESCE(sum(commission_amount),0) INTO _profit_share FROM public.profit_share_commissions WHERE referrer_id = _pid;
  SELECT COALESCE(sum(leadership_amount),0), COALESCE(sum(matching_amount),0) INTO _leadership, _matching
    FROM public.leadership_bonus_history WHERE user_id = _pid;
  SELECT COALESCE(p.withdrawable_balance,0) INTO _available FROM public.profiles p WHERE p.id = _pid;
  _daily_limit := public.get_daily_signal_limit(_pid);
  SELECT count(*)::int INTO _taken_today FROM public.signal_takes WHERE user_id = _pid AND created_at >= public.start_of_eat_day();
  SELECT s.status, s.current_period_end INTO _sub_status, _next_billing FROM public.subscriptions s WHERE s.user_id = _pid;
  RETURN QUERY SELECT
    COALESCE((SELECT p.current_rank FROM public.profiles p WHERE p.id = _pid), 'none'),
    _personal_referrals, _active_team_size, _team_volume, _deposit_comm, _profit_share,
    _leadership, _matching, _deposit_comm + _profit_share + _leadership + _matching,
    _available, _daily_limit, _taken_today, _sub_status, _next_billing;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_affiliate_dashboard() TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. KYC (ID verification gate on withdrawals)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_verifications;
CREATE POLICY "Users view own kyc" ON public.kyc_verifications
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Users submit own kyc" ON public.kyc_verifications;
CREATE POLICY "Users submit own kyc" ON public.kyc_verifications
  FOR INSERT WITH CHECK (user_id = public.get_user_profile_id());
DROP POLICY IF EXISTS "Staff update kyc" ON public.kyc_verifications;
CREATE POLICY "Staff update kyc" ON public.kyc_verifications
  FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user ON public.kyc_verifications(user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Users upload own kyc documents" ON storage.objects;
CREATE POLICY "Users upload own kyc documents" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users and staff view kyc documents" ON storage.objects;
CREATE POLICY "Users and staff view kyc documents" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));

CREATE OR REPLACE FUNCTION public.get_my_kyc_status()
RETURNS TABLE(status text, admin_notes text, submitted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid FROM public.profiles WHERE user_id = auth.uid();
  IF _pid IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT k.status, k.admin_notes, k.submitted_at
  FROM public.kyc_verifications k WHERE k.user_id = _pid ORDER BY k.submitted_at DESC LIMIT 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_kyc_status() TO authenticated;

-- ----------------------------------------------------------------------------
-- 11. WITHDRAWALS (FINAL): KYC gate, $200 min, 14-day cooldown
-- (rejected withdrawals excluded from cooldown), row locks, bypass flag,
-- 20% fee. Only withdrawable_balance (own signal profits) can be withdrawn.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _wallet text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _profile_id uuid; _withdrawable numeric; _fee numeric; _net numeric; _id uuid;
  _kyc_approved boolean; _last_requested_at timestamptz;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _amount < 200 THEN RAISE EXCEPTION 'Minimum withdrawal is $200'; END IF;
  IF _wallet IS NULL OR length(trim(_wallet)) = 0 THEN RAISE EXCEPTION 'Wallet required'; END IF;
  SELECT id, withdrawable_balance INTO _profile_id, _withdrawable FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT max(requested_at) INTO _last_requested_at FROM public.withdrawals WHERE user_id = _profile_id AND status <> 'rejected';
  IF _last_requested_at IS NOT NULL AND _last_requested_at > now() - interval '14 days' THEN
    RAISE EXCEPTION 'You can only request a withdrawal once every 14 days. Next available: %', (_last_requested_at + interval '14 days')::date;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.kyc_verifications WHERE user_id = _profile_id AND status = 'approved') INTO _kyc_approved;
  IF NOT _kyc_approved THEN
    RAISE EXCEPTION 'KYC_REQUIRED: Please upload a copy of your ID to verify your identity before withdrawing.';
  END IF;
  IF _amount > _withdrawable THEN RAISE EXCEPTION 'Amount exceeds withdrawable profits ($%)', _withdrawable; END IF;
  _fee := round((_amount * 0.20)::numeric, 2);
  _net := _amount - _fee;
  PERFORM set_config('app.bypass_balance_check', 'true', true);
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance - _amount, total_balance = total_balance - _amount WHERE id = _profile_id;
  INSERT INTO public.withdrawals (user_id, amount, wallet_address, status, fee_amount, net_amount)
  VALUES (_profile_id, _amount, trim(_wallet), 'pending', _fee, _net) RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO _status FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _status <> 'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be approved'; END IF;
  UPDATE public.withdrawals SET status='approved', admin_notes=COALESCE(_notes, admin_notes), processed_at=now() WHERE id=_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w record;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF _w IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be rejected'; END IF;
  UPDATE public.profiles SET withdrawable_balance = withdrawable_balance + _w.amount, total_balance = total_balance + _w.amount WHERE id = _w.user_id;
  UPDATE public.withdrawals SET status='rejected', admin_notes=COALESCE(_notes, admin_notes), processed_at=now() WHERE id=_id;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_withdrawal(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO _status FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _status <> 'approved' THEN RAISE EXCEPTION 'Only approved withdrawals can be completed'; END IF;
  UPDATE public.withdrawals SET status='completed', processed_at=now() WHERE id=_id;
END; $$;

-- ----------------------------------------------------------------------------
-- 12. DEPOSITS: $200 minimum (NOT VALID = existing smaller rows grandfathered)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.deposits ADD CONSTRAINT deposits_min_amount CHECK (amount_usd >= 200) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 13. SIGNUP: handle_new_user (FINAL: phone_number + subscription creation)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  is_bootstrap BOOLEAN := FALSE;
  _ref_code text; _referrer_id uuid; _new_code text; _new_profile_id uuid;
BEGIN
  IF NEW.raw_user_meta_data->>'bootstrap_code' = 'ADMIN001' THEN is_bootstrap := TRUE; END IF;
  _ref_code := upper(nullif(trim(NEW.raw_user_meta_data->>'referral_code'), ''));
  IF _ref_code IS NOT NULL THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;
  LOOP
    _new_code := upper(substr(md5(random()::text || NEW.id::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = _new_code);
  END LOOP;
  INSERT INTO public.profiles (user_id, email, full_name, phone_number, referral_code, referred_by)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.raw_user_meta_data->>'phone_number', _new_code, _referrer_id)
  RETURNING id INTO _new_profile_id;
  INSERT INTO public.subscriptions (user_id, status, started_at, current_period_start, current_period_end, auto_renew)
  VALUES (_new_profile_id, 'active', now(), now(), now() + interval '30 days', true);
  IF is_bootstrap THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END; $function$;

-- ----------------------------------------------------------------------------
-- 14. DEPOSIT EMAIL NOTIFICATIONS (Resend via pg_net)
-- NOTE: contains the live Resend API key — rotate in Resend dashboard AND here.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admin_new_deposit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_name text; v_html text;
BEGIN
  SELECT email, full_name INTO v_email, v_name FROM public.profiles WHERE id = NEW.user_id;
  v_html := format(
    '<h2>New Deposit Request</h2><p><b>User:</b> %s (%s)</p><p><b>Amount:</b> $%s</p><p><b>Currency:</b> %s</p><p><b>TX Hash:</b> %s</p><p><a href="https://qmprofits.app/admin">Review in Admin Panel</a></p>',
    COALESCE(v_name, 'Unknown'), COALESCE(v_email, 'unknown'), NEW.amount_usd::text, NEW.crypto_currency, COALESCE(NEW.tx_hash, 'N/A')
  );
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer REPLACE_WITH_RESEND_API_KEY'),
    body := jsonb_build_object('from', 'onboarding@resend.dev', 'to', ARRAY['gicherusurf2@gmail.com'],
      'subject', 'New Deposit Request - $' || NEW.amount_usd::text, 'html', v_html)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_new_deposit_notify ON public.deposits;
CREATE TRIGGER on_new_deposit_notify AFTER INSERT ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_deposit();

-- ----------------------------------------------------------------------------
-- 15. CRON JOBS (idempotent re-registration)
-- Live jobs as of 2026-07-28:
--   generate-signal-schedule        0 23,3,7,11,15,19 * * *   (EAT slots in UTC)
--   close-signals-schedule          * * * * *
--   request-market-prices-schedule  */5 * * * *
--   process-market-prices-schedule  1,6,11,...,56 * * * *     (offset by 1 min)
--   process-subscriptions-schedule  0 * * * *
--   monthly-leadership-bonus-schedule  0 1 1 * *
-- ----------------------------------------------------------------------------
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'generate-signal-schedule';
SELECT cron.schedule('generate-signal-schedule', '0 23,3,7,11,15,19 * * *', $$SELECT public.generate_signal();$$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'close-signals-schedule';
SELECT cron.schedule('close-signals-schedule', '* * * * *', $$SELECT public.close_due_signals();$$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'request-market-prices-schedule';
SELECT cron.schedule('request-market-prices-schedule', '*/5 * * * *', $$SELECT public.request_market_prices();$$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-market-prices-schedule';
SELECT cron.schedule('process-market-prices-schedule', '1,6,11,16,21,26,31,36,41,46,51,56 * * * *', $$SELECT public.process_market_prices();$$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-subscriptions-schedule';
SELECT cron.schedule('process-subscriptions-schedule', '0 * * * *', $$SELECT public.process_all_subscriptions();$$);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'monthly-leadership-bonus-schedule';
SELECT cron.schedule('monthly-leadership-bonus-schedule', '0 1 1 * *', $$SELECT public.pay_monthly_leadership_bonuses();$$);
