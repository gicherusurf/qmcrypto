-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload payment proofs
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access to payment proofs
CREATE POLICY "Payment proofs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

-- Allow users to update their own payment proofs
CREATE POLICY "Users can update own payment proofs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own payment proofs
CREATE POLICY "Users can delete own payment proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add column to investments table for proof image
ALTER TABLE public.investments 
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;