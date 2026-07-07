-- ENABLE RLS with SIMPLE policies (after fixing the issue)
-- Run this AFTER verifying data loads without errors

-- Step 1: Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caretaker_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Step 2: Create SIMPLE policies - allow authenticated users to see all data
-- Filtering will be done in the app, not in RLS

CREATE POLICY "all authenticated can read tenants" ON public.tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff can manage tenants" ON public.tenants FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

CREATE POLICY "all authenticated can read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff can manage units" ON public.units FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role]));

CREATE POLICY "all authenticated can read properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff can manage properties" ON public.properties FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

CREATE POLICY "all authenticated can read leases" ON public.leases FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff can manage leases" ON public.leases FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

CREATE POLICY "all authenticated can read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff can manage payments" ON public.payments FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

CREATE POLICY "all authenticated can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff can manage invoices" ON public.invoices FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role]));

CREATE POLICY "users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));
CREATE POLICY "admin can manage roles" ON public.user_roles FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

CREATE POLICY "users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));
CREATE POLICY "users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "all authenticated can read caretaker props" ON public.caretaker_properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin can manage caretaker props" ON public.caretaker_properties FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

CREATE POLICY "all authenticated can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin can manage settings" ON public.app_settings FOR INSERT, UPDATE, DELETE TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));
