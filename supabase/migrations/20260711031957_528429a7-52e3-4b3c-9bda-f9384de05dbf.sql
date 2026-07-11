
DROP POLICY IF EXISTS "Admins can update withdrawals" ON public.withdrawals;
CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "No direct inserts by users" ON public.withdrawals;
CREATE POLICY "No direct inserts by users" ON public.withdrawals
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "No deletes except admins" ON public.withdrawals;
CREATE POLICY "No deletes except admins" ON public.withdrawals
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO _status FROM public.withdrawals WHERE id = _id;
  IF _status IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _status <> 'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be approved'; END IF;
  UPDATE public.withdrawals SET status='approved', admin_notes=COALESCE(_notes, admin_notes), processed_at=now() WHERE id=_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _id;
  IF _w IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _w.status <> 'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be rejected'; END IF;
  UPDATE public.profiles
    SET withdrawable_balance = withdrawable_balance + _w.amount,
        total_balance = total_balance + _w.amount
    WHERE id = _w.user_id;
  UPDATE public.withdrawals SET status='rejected', admin_notes=COALESCE(_notes, admin_notes), processed_at=now() WHERE id=_id;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_withdrawal(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO _status FROM public.withdrawals WHERE id = _id;
  IF _status IS NULL THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF _status <> 'approved' THEN RAISE EXCEPTION 'Only approved withdrawals can be completed'; END IF;
  UPDATE public.withdrawals SET status='completed', processed_at=now() WHERE id=_id;
END; $$;

REVOKE ALL ON FUNCTION public.approve_withdrawal(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.reject_withdrawal(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.complete_withdrawal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_withdrawal(uuid) TO authenticated;

DROP POLICY IF EXISTS "Public read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read payment-proofs" ON storage.objects;
DROP POLICY IF EXISTS "payment-proofs public read" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own payment proofs" ON storage.objects;

CREATE POLICY "Users can view own payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can upload own payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
