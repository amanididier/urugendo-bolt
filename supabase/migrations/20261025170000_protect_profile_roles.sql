-- Prevent self-service profile writes from granting staff or manager privileges.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, phone, email, branch) ON public.profiles TO authenticated;
GRANT UPDATE (id, full_name, phone, email, branch) ON public.profiles TO authenticated;
