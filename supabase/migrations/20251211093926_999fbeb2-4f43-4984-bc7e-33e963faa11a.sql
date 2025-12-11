-- Add payment tracking columns to investments
ALTER TABLE public.investments 
ADD COLUMN IF NOT EXISTS payment_tx_hash text,
ADD COLUMN IF NOT EXISTS payment_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_verified_by uuid;

-- Insert default wallet addresses in settings (admin can update these)
INSERT INTO public.settings (key, value) VALUES 
  ('USDT_WALLET_TRC20', 'YOUR_USDT_TRC20_ADDRESS'),
  ('USDT_WALLET_ERC20', 'YOUR_USDT_ERC20_ADDRESS'),
  ('BTC_WALLET', 'YOUR_BTC_ADDRESS')
ON CONFLICT (key) DO NOTHING;