-- TEST: Verify Landlord Can Access All Data
-- Run this in Supabase SQL Editor while logged in as landlord

-- Step 1: Verify your user ID and role
SELECT 
  auth.uid() as my_user_id,
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) as my_role;

-- Step 2: Test direct table access (bypass RLS)
-- Count records in each table
SELECT 'properties' as table_name, COUNT(*) as count FROM public.properties
UNION ALL
SELECT 'units', COUNT(*) FROM public.units
UNION ALL
SELECT 'tenants', COUNT(*) FROM public.tenants
UNION ALL
SELECT 'leases', COUNT(*) FROM public.leases
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'invoices', COUNT(*) FROM public.invoices;

-- Step 3: Test RLS - these queries should return data if RLS is working
-- If these return 0, RLS is blocking access
SELECT COUNT(*) as properties_count FROM public.properties;
SELECT COUNT(*) as units_count FROM public.units;
SELECT COUNT(*) as tenants_count FROM public.tenants;
SELECT COUNT(*) as leases_count FROM public.leases WHERE status = 'active';
SELECT COUNT(*) as payments_count FROM public.payments;
SELECT COUNT(*) as invoices_count FROM public.invoices;

-- Step 4: Check if current_user_has_any_role function exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.routines 
  WHERE routine_name = 'current_user_has_any_role'
);

-- Step 5: Manually test the role check
-- This should return true if you're a landlord
SELECT current_user_has_any_role(ARRAY['landlord'::app_role]);

-- Step 6: Check all policies on key tables
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('tenants', 'units', 'properties', 'leases', 'payments', 'invoices')
ORDER BY tablename, policyname;

-- Step 7: List your roles from user_roles table
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- Step 8: Debug - if all above works, test with explicit auth.uid()
-- Replace 'YOUR_USER_ID' with actual UUID from Step 1
-- SELECT COUNT(*) FROM public.properties WHERE auth.uid() = 'YOUR_USER_ID' OR TRUE;
