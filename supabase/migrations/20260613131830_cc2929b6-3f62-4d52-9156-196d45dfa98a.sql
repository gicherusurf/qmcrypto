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
$function$;