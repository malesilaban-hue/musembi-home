-- FIX: Add public. prefix to current_user_has_any_role function calls
-- This fixes the issue where landlord sees all zeros
-- Run this in Supabase SQL Editor immediately

-- ============ STAFF VISIBILITY ============
DROP POLICY IF EXISTS "tenants_all_staff" ON public.tenants;
CREATE POLICY tenants_all_staff ON public.tenants FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]) OR user_id = auth.uid()) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "payments_all_staff" ON public.payments;
CREATE POLICY payments_all_staff ON public.payments FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]) OR tenant_id = auth.uid()) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

-- ============ INVOICES ============
DROP POLICY IF EXISTS "invoices_all_staff" ON public.invoices;
CREATE POLICY invoices_all_staff ON public.invoices FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

-- ============ LEASES ============
DROP POLICY IF EXISTS "leases_all_staff" ON public.leases;
CREATE POLICY leases_all_staff ON public.leases FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]) OR tenant_id = auth.uid()) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

-- ============ PROPERTIES ============
DROP POLICY IF EXISTS "properties_all_staff" ON public.properties;
CREATE POLICY properties_all_staff ON public.properties FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'technician'::app_role, 'security'::app_role]) OR (public.current_user_has_any_role(ARRAY['caretaker'::app_role]) AND EXISTS(SELECT 1 FROM public.caretaker_properties cp WHERE cp.property_id = properties.id AND cp.user_id = auth.uid()))) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

-- ============ UNITS ============
DROP POLICY IF EXISTS "units_all_staff" ON public.units;
CREATE POLICY units_all_staff ON public.units FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'technician'::app_role, 'security'::app_role]) OR (public.current_user_has_any_role(ARRAY['caretaker'::app_role]) AND EXISTS(SELECT 1 FROM public.caretaker_properties cp WHERE cp.property_id = units.property_id AND cp.user_id = auth.uid()))) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

-- ============ USER ROLES ============
DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
DROP POLICY IF EXISTS "roles_self_read" ON public.user_roles;
CREATE POLICY roles_admin_write ON public.user_roles FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

CREATE POLICY roles_self_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

-- ============ PROFILES ============
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

-- ============ CARETAKER PROPERTIES ============
DROP POLICY IF EXISTS "cp_admin_all" ON public.caretaker_properties;
DROP POLICY IF EXISTS "cp_self_read" ON public.caretaker_properties;
CREATE POLICY cp_admin_all ON public.caretaker_properties FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

CREATE POLICY cp_self_read ON public.caretaker_properties FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ APP SETTINGS ============
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;
CREATE POLICY settings_admin_write ON public.app_settings FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));
