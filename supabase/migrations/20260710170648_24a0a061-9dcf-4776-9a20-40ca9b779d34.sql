
-- Add withdrawable balance tracking (profits only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS withdrawable_balance numeric NOT NULL DEFAULT 0;

-- Add fee tracking to withdrawals
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric NOT NULL DEFAULT 0;

-- Approve deposit: credit deposit to spendable balance + instant 10% referral bonus (non-withdrawable)
CREATE OR REPLACE FUNCTION public.approve_deposit(_deposit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dep record;
  _referrer uuid;
  _bonus numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _dep FROM public.deposits WHERE id = _deposit_id;
  IF _dep IS NULL THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF _dep.status <> 'pending' THEN RAISE EXCEPTION 'Deposit already processed'; END IF;

  UPDATE public.deposits
    SET status = 'approved', processed_at = now()
    WHERE id = _deposit_id;

  -- Credit depositor (goes to total_balance, NOT withdrawable)
  UPDATE public.profiles
    SET total_balance = total_balance + _dep.amount_usd
    WHERE id = _dep.user_id;

  -- Instant 10% referral bonus (non-withdrawable)
  SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _dep.user_id;
  IF _referrer IS NOT NULL THEN
    _bonus := _dep.amount_usd * 0.10;
    UPDATE public.profiles
      SET total_balance = total_balance + _bonus
      WHERE id = _referrer;

    INSERT INTO public.referral_commissions (referrer_id, referee_id, stake_amount, commission_amount)
    VALUES (_referrer, _dep.user_id, _dep.amount_usd, _bonus);
  END IF;
END;
$$;

-- Request withdrawal: only from withdrawable_balance, 20% fee
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _wallet text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _withdrawable numeric;
  _fee numeric;
  _net numeric;
  _id uuid;
BEGIN
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _wallet IS NULL OR length(trim(_wallet)) = 0 THEN RAISE EXCEPTION 'Wallet required'; END IF;

  SELECT id, withdrawable_balance INTO _profile_id, _withdrawable
    FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF _amount > _withdrawable THEN
    RAISE EXCEPTION 'Amount exceeds withdrawable profits ($%)', _withdrawable;
  END IF;

  _fee := round((_amount * 0.20)::numeric, 2);
  _net := _amount - _fee;

  -- Lock funds: deduct from both withdrawable & total balance
  UPDATE public.profiles
    SET withdrawable_balance = withdrawable_balance - _amount,
        total_balance = total_balance - _amount
    WHERE id = _profile_id;

  INSERT INTO public.withdrawals (user_id, amount, wallet_address, status, fee_amount, net_amount)
  VALUES (_profile_id, _amount, trim(_wallet), 'pending', _fee, _net)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;
