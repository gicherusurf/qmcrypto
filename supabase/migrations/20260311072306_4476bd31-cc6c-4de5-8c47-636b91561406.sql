
-- Add token_balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS token_balance numeric DEFAULT 0;

-- Token listings (P2P sell orders)
CREATE TABLE public.token_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  price_per_token numeric NOT NULL DEFAULT 1,
  remaining_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.token_listings ENABLE ROW LEVEL SECURITY;

-- Everyone can view active listings
CREATE POLICY "Anyone can view active listings" ON public.token_listings
  FOR SELECT TO authenticated
  USING (status = 'active' OR seller_id = get_user_profile_id() OR has_role(auth.uid(), 'admin'));

-- Users can create listings
CREATE POLICY "Users can create listings" ON public.token_listings
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = get_user_profile_id());

-- Users can update own listings (cancel)
CREATE POLICY "Users can update own listings" ON public.token_listings
  FOR UPDATE TO authenticated
  USING (seller_id = get_user_profile_id() OR has_role(auth.uid(), 'admin'));

-- Token transactions (trade history)
CREATE TABLE public.token_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.token_listings(id),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id),
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric NOT NULL,
  total_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_proof_url text,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone
);

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view own transactions
CREATE POLICY "Users can view own transactions" ON public.token_transactions
  FOR SELECT TO authenticated
  USING (buyer_id = get_user_profile_id() OR seller_id = get_user_profile_id() OR has_role(auth.uid(), 'admin'));

-- Users can create transactions (buy)
CREATE POLICY "Users can create transactions" ON public.token_transactions
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = get_user_profile_id());

-- Admins can update transactions (approve/reject)
CREATE POLICY "Admins can update transactions" ON public.token_transactions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Enable realtime for token tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_transactions;
