-- Add columns to store crypto payment details
ALTER TABLE public.investments 
ADD COLUMN IF NOT EXISTS crypto_amount NUMERIC,
ADD COLUMN IF NOT EXISTS crypto_currency TEXT,
ADD COLUMN IF NOT EXISTS crypto_price_usd NUMERIC;