
-- 1. Add referral fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Generate codes for existing profiles
UPDATE public.profiles
SET referral_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE referral_code IS NULL;

-- 2. Referral commissions log
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_take_id uuid REFERENCES public.signal_takes(id) ON DELETE SET NULL,
  stake_amount numeric NOT NULL,
  commission_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;

ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own referral commissions"
ON public.referral_commissions
FOR SELECT
TO authenticated
USING (
  referrer_id = public.get_user_profile_id()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON public.referral_commissions(referrer_id);

-- 3. Update handle_new_user to generate code and capture referrer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_bootstrap BOOLEAN := FALSE;
  _ref_code text;
  _referrer_id uuid;
  _new_code text;
BEGIN
  IF NEW.raw_user_meta_data->>'bootstrap_code' = 'ADMIN001' THEN
    is_bootstrap := TRUE;
  END IF;

  _ref_code := upper(nullif(trim(NEW.raw_user_meta_data->>'referral_code'), ''));
  IF _ref_code IS NOT NULL THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _ref_code;
  END IF;

  -- Generate a unique referral code
  LOOP
    _new_code := upper(substr(md5(random()::text || NEW.id::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = _new_code);
  END LOOP;

  INSERT INTO public.profiles (user_id, email, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _new_code,
    _referrer_id
  );

  IF is_bootstrap THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Update take_signal to pay 0.5% commission to referrer
CREATE OR REPLACE FUNCTION public.take_signal(_signal_id uuid, _stake numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _profile_id uuid;
  _balance numeric;
  _status text;
  _closes timestamptz;
  _take_id uuid;
  _referrer_id uuid;
  _commission numeric;
BEGIN
  IF _stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;

  SELECT id, total_balance, referred_by INTO _profile_id, _balance, _referrer_id
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

  -- Referral commission: 0.5% of stake to referrer
  IF _referrer_id IS NOT NULL THEN
    _commission := _stake * 0.005;
    UPDATE public.profiles
      SET total_balance = total_balance + _commission,
          total_earnings = total_earnings + _commission
      WHERE id = _referrer_id;

    INSERT INTO public.referral_commissions (referrer_id, referee_id, signal_take_id, stake_amount, commission_amount)
    VALUES (_referrer_id, _profile_id, _take_id, _stake, _commission);
  END IF;

  RETURN _take_id;
END;
$function$;
