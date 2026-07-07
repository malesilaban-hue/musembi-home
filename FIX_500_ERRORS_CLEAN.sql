-- CLEAN FIX FOR 500 ERRORS
-- Copy each section one at a time and run separately

-- ============ SECTION 1: DROP ALL BROKEN POLICIES ============
DROP POLICY IF EXISTS "tenants_staff_manage" ON public.tenants;
DROP POLICY IF EXISTS "tenants_all_staff" ON public.tenants;
DROP POLICY IF EXISTS "tenant reads self" ON public.tenants;
DROP POLICY IF EXISTS "staff manage payments" ON public.payments;
DROP POLICY IF EXISTS "payments_all_staff" ON public.payments;
DROP POLICY IF EXISTS "invoices_staff_manage" ON public.invoices;
DROP POLICY IF EXISTS "invoices_all_staff" ON public.invoices;
DROP POLICY IF EXISTS "leases_staff_manage" ON public.leases;
DROP POLICY IF EXISTS "leases_all_staff" ON public.leases;
DROP POLICY IF EXISTS "properties_staff_read" ON public.properties;
DROP POLICY IF EXISTS "properties_all_staff" ON public.properties;
DROP POLICY IF EXISTS "units_via_property" ON public.units;
DROP POLICY IF EXISTS "units_all_staff" ON public.units;
DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
DROP POLICY IF EXISTS "roles_self_read" ON public.user_roles;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
DROP POLICY IF EXISTS "cp_admin_all" ON public.caretaker_properties;
DROP POLICY IF EXISTS "cp_self_read" ON public.caretaker_properties;
DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;

-- ============ SECTION 2: DISABLE RLS ON ALL TABLES ============
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.caretaker_properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
