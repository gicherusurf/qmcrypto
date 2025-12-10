-- Update handle_new_user to grant admin role for ADMIN001 bootstrap code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_id UUID;
  new_referral_code TEXT;
  is_bootstrap BOOLEAN := FALSE;
BEGIN
  new_referral_code := public.generate_referral_code();
  
  -- Check if using bootstrap code
  IF NEW.raw_user_meta_data->>'referred_by' = 'ADMIN001' THEN
    is_bootstrap := TRUE;
    referrer_id := NULL;
  ELSIF NEW.raw_user_meta_data->>'referred_by' IS NOT NULL THEN
    SELECT id INTO referrer_id 
    FROM public.profiles 
    WHERE referral_code = NEW.raw_user_meta_data->>'referred_by';
  END IF;
  
  INSERT INTO public.profiles (user_id, email, full_name, referral_code, referred_by)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    new_referral_code,
    referrer_id
  );
  
  -- Give admin role if bootstrap, otherwise user role
  IF is_bootstrap THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;