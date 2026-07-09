
GRANT SELECT ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
GRANT SELECT, INSERT ON public.signal_takes TO authenticated;
GRANT ALL ON public.signal_takes TO service_role;
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
