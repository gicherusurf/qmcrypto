
-- 1. Force withdrawals through request_withdrawal() RPC (SECURITY DEFINER).
DROP POLICY IF EXISTS "Users can create withdrawals" ON public.withdrawals;

-- 2. Prevent users from tampering with their own balance columns via direct UPDATE.
CREATE OR REPLACE FUNCTION public.prevent_profile_balance_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if called by admin
  IF public.has_role(auth.uid(), 'admin') THEN
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

DROP TRIGGER IF EXISTS profiles_prevent_balance_tampering ON public.profiles;
CREATE TRIGGER profiles_prevent_balance_tampering
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_balance_tampering();
