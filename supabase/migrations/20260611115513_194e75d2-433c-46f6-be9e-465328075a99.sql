
-- Drop unused tables (cascade clears FKs)
DROP TABLE IF EXISTS public.earnings_log CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.investment_packages CASCADE;
DROP TABLE IF EXISTS public.token_transactions CASCADE;
DROP TABLE IF EXISTS public.token_listings CASCADE;

-- Reshape profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS token_balance;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS referred_by;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS referral_code;

-- Replace handle_new_user to not depend on referral logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_bootstrap BOOLEAN := FALSE;
BEGIN
  IF NEW.raw_user_meta_data->>'bootstrap_code' = 'ADMIN001' THEN
    is_bootstrap := TRUE;
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  IF is_bootstrap THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP FUNCTION IF EXISTS public.generate_referral_code();

-- Deposits table
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_usd numeric(15,2) NOT NULL CHECK (amount_usd > 0),
  crypto_currency text NOT NULL CHECK (crypto_currency IN ('BTC','USDT_TRC20','USDT_ERC20')),
  crypto_amount numeric(20,8),
  tx_hash text,
  proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own deposits" ON public.deposits FOR SELECT
  USING (user_id = public.get_user_profile_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own deposits" ON public.deposits FOR INSERT
  WITH CHECK (user_id = public.get_user_profile_id());
CREATE POLICY "Admins update deposits" ON public.deposits FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- Signals
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('LONG','SHORT')),
  entry_price numeric(20,8) NOT NULL,
  target_price numeric(20,8) NOT NULL,
  stop_loss numeric(20,8),
  profit_percentage numeric(5,2) NOT NULL DEFAULT 3.00,
  message text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.signals TO authenticated, anon;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view signals" ON public.signals FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage signals" ON public.signals FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Signal takes
CREATE TABLE public.signal_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  stake_amount numeric(15,2) NOT NULL CHECK (stake_amount > 0),
  profit_amount numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','won')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (user_id, signal_id)
);
GRANT SELECT, INSERT ON public.signal_takes TO authenticated;
GRANT ALL ON public.signal_takes TO service_role;
ALTER TABLE public.signal_takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own takes" ON public.signal_takes FOR SELECT
  USING (user_id = public.get_user_profile_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own takes" ON public.signal_takes FOR INSERT
  WITH CHECK (user_id = public.get_user_profile_id());

-- Atomic take_signal function: deduct stake from balance, insert take
CREATE OR REPLACE FUNCTION public.take_signal(_signal_id uuid, _stake numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _balance numeric;
  _status text;
  _closes timestamptz;
  _take_id uuid;
BEGIN
  IF _stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;

  SELECT id, total_balance INTO _profile_id, _balance
  FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT status, closes_at INTO _status, _closes
  FROM public.signals WHERE id = _signal_id;
  IF _status IS NULL THEN RAISE EXCEPTION 'Signal not found'; END IF;
  IF _status <> 'open' OR _closes <= now() THEN RAISE EXCEPTION 'Signal is no longer open'; END IF;

  IF _balance < _stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles SET total_balance = total_balance - _stake WHERE id = _profile_id;

  INSERT INTO public.signal_takes (user_id, signal_id, stake_amount)
  VALUES (_profile_id, _signal_id, _stake)
  RETURNING id INTO _take_id;

  RETURN _take_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_signal(uuid, numeric) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.signal_takes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;

-- Seed default crypto wallet settings if missing
INSERT INTO public.settings (key, value) VALUES
  ('btc_wallet', 'bc1qexamplebtcwalletaddress00000000000000'),
  ('usdt_trc20_wallet', 'TExampleTRC20WalletAddress0000000000'),
  ('usdt_erc20_wallet', '0xExampleERC20WalletAddress00000000000000000')
ON CONFLICT (key) DO NOTHING;
