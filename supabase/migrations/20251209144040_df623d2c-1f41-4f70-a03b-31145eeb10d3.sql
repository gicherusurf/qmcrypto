-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES public.profiles(id),
  total_balance DECIMAL(15, 2) DEFAULT 0,
  total_earnings DECIMAL(15, 2) DEFAULT 0,
  total_withdrawn DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create investment_packages table
CREATE TABLE public.investment_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  return_percentage DECIMAL(5, 2) DEFAULT 10,
  return_period_days INTEGER DEFAULT 14,
  is_active BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  min_amount DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create investments table
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES public.investment_packages(id) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_earning_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_earning_at TIMESTAMP WITH TIME ZONE
);

-- Create earnings_log table
CREATE TABLE public.earnings_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  investment_id UUID REFERENCES public.investments(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  earning_type TEXT DEFAULT 'investment' CHECK (earning_type IN ('investment', 'referral')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create withdrawals table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  wallet_address TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT
);

-- Create settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Get current user's profile id
CREATE OR REPLACE FUNCTION public.get_user_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Allow profile creation during signup" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for investment_packages (public read)
CREATE POLICY "Anyone can view active packages" ON public.investment_packages
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage packages" ON public.investment_packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for investments
CREATE POLICY "Users can view own investments" ON public.investments
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create investments" ON public.investments
  FOR INSERT WITH CHECK (user_id = public.get_user_profile_id());

-- RLS Policies for earnings_log
CREATE POLICY "Users can view own earnings" ON public.earnings_log
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for withdrawals
CREATE POLICY "Users can view own withdrawals" ON public.withdrawals
  FOR SELECT USING (user_id = public.get_user_profile_id() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (user_id = public.get_user_profile_id());

CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for settings
CREATE POLICY "Settings are viewable by admins" ON public.settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage settings" ON public.settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
  new_referral_code TEXT;
BEGIN
  new_referral_code := public.generate_referral_code();
  
  -- Check if there's a referred_by code in metadata
  IF NEW.raw_user_meta_data->>'referred_by' IS NOT NULL THEN
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
  
  -- Give user default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default investment packages
INSERT INTO public.investment_packages (name, amount, return_percentage, return_period_days, is_custom, min_amount) VALUES
  ('Starter', 10, 10, 14, false, NULL),
  ('Basic', 25, 10, 14, false, NULL),
  ('Standard', 50, 10, 14, false, NULL),
  ('Premium', 100, 10, 14, false, NULL),
  ('Custom', 0, 10, 14, true, 150);

-- Insert initial settings
INSERT INTO public.settings (key, value) VALUES
  ('withdrawal_enabled', 'true'),
  ('min_withdrawal', '10'),
  ('withdrawal_period_days', '14');