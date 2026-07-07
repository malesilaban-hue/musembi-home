# Troubleshooting 500 Errors from Supabase API Queries

## Issue Summary

The application is experiencing 500 errors when querying the following tables:
- `tenants` - Error when fetching all tenants
- `payments` - Error when querying payments with date filters
- `invoices` - Error when selecting balance and status
- `leases` - Error when querying active leases

All errors are HTTP 500, suggesting a Row-Level Security (RLS) policy issue or query constraint violation.

---

## Root Cause Analysis

### Likely Causes

1. **RLS Policies Using Undefined Functions**
   - The latest migration uses `current_user_has_any_role()` and `has_role()` functions
   - These must be defined in earlier migrations and working correctly
   - ✅ Verified: Both functions ARE defined in migration `20260704133233_*.sql`

2. **Complex JOIN Conditions in RLS Policies**
   - The tenants RLS policy joins to `leases` and `units` and `caretaker_properties`
   - This can cause:
     - Query timeouts (500 error after timeout)
     - Performance issues with large datasets
     - Potential circular references

3. **User Role Data Missing**
   - If a user doesn't have any roles assigned, `current_user_has_any_role()` might fail
   - Need to verify user roles are properly seeded

4. **Missing Table References**
   - The RLS policy references `created_by` column on tenants (exists ✅)
   - References `unit_id` and `property_id` relationships (should exist)

---

## Diagnostic Steps

### Step 1: Check Applied Migrations

**In Supabase Console:**
1. Go to SQL Editor
2. Run this query to list applied migrations:
```sql
SELECT name, executed_at FROM _realtime_migrations ORDER BY executed_at DESC LIMIT 10;
```

Expected output should include:
- `20260704133233_*.sql` - Role functions
- `20260704133245_*.sql` - User management  
- `20260704133259_*.sql` - Role access
- `20260704134426_*.sql` - Leases and payments
- `20260705_update_schema.sql` - Unit types
- `20260706093703_*.sql` - Property themes and caretaker assignments

### Step 2: Verify User Has Roles

```sql
-- Check if your user has any roles assigned
SELECT ur.* FROM public.user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'your-email@example.com';
```

If no results, your user needs roles assigned:
```sql
INSERT INTO public.user_roles (user_id, role, email)
SELECT id, 'super_admin'::app_role, email FROM auth.users
WHERE email = 'your-email@example.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.users.id
);
```

### Step 3: Check RLS Functions

```sql
-- Verify the helper functions exist
SELECT proname, prosrc FROM pg_proc 
WHERE proname IN ('has_role', 'current_user_has_any_role')
AND pronamespace = 'public'::regnamespace;
```

Should return 2 rows with the function code.

### Step 4: Test Basic Queries

```sql
-- Enable RLS debugging (run as a user with service_role)
SET app.current_user_id = 'YOUR_USER_ID_HERE';

-- Test tenants query
SELECT id, full_name FROM public.tenants LIMIT 1;

-- Test payments query  
SELECT id, amount FROM public.payments LIMIT 1;

-- Test leases query
SELECT id, status FROM public.leases LIMIT 1;
```

### Step 5: Check RLS Policy Logic

```sql
-- View current RLS policies on problematic tables
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('tenants', 'payments', 'invoices', 'leases')
ORDER BY tablename, policyname;
```

This will show the actual policy definitions applied.

---

## Solution Options

### Option A: Simple Fix (Recommended for Development)

If the RLS policies are too complex and causing issues, simplify them:

```sql
-- Simplify tenants policy to avoid complex JOINs
DROP POLICY IF EXISTS "tenants_staff_manage" ON public.tenants;

CREATE POLICY tenants_all_users ON public.tenants 
FOR ALL TO authenticated
USING (
  -- Staff can see all tenants
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role)
  )
  -- Tenants can only see their own record
  OR user_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role)
  )
);
```

### Option B: Fix Lovable Migration

The migration file `supabase/migrations/20260706093703_*.sql` has complex RLS policies. A simplified version is available at:
- `supabase/migrations/20260706_fix_rls_policies.sql`

To apply it:
1. Delete the overly-complex Lovable migration (or back it up)
2. Use the simplified version instead
3. Re-run migrations

### Option C: Rollback and Reapply

If something went wrong with migrations:

```sql
-- Check what broke (run in SQL Editor with service_role)
-- Look at the postgres_logs table if available
SELECT * FROM postgres_logs 
ORDER BY timestamp DESC 
LIMIT 20;
```

---

## Quick Fixes to Try

### Fix 1: Ensure User Roles Exist

```sql
-- Assign admin role to current user
INSERT INTO public.user_roles (user_id, role, email)
VALUES (auth.uid(), 'super_admin'::app_role, (SELECT email FROM auth.users WHERE id = auth.uid()))
ON CONFLICT (user_id, role) DO NOTHING;
```

### Fix 2: Disable RLS Temporarily (Testing Only)

```sql
-- WARNING: This disables all security! Only for testing!
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases DISABLE ROW LEVEL SECURITY;
```

Then test queries. If they work without RLS, the issue is definitely in the policies.

Then re-enable:
```sql
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
```

### Fix 3: Rebuild RLS from Scratch

If all else fails, apply the simplified RLS migration:

```bash
# Run from Supabase SQL Editor
-- Run this to apply simplified, tested policies:
-- Content of: supabase/migrations/20260706_fix_rls_policies.sql
```

---

## Verification After Fix

### Test Each Table

```sql
-- Test tenants
SELECT COUNT(*) as total_tenants FROM public.tenants;

-- Test payments
SELECT COUNT(*) as total_payments FROM public.payments;

-- Test invoices  
SELECT COUNT(*) as total_invoices FROM public.invoices;

-- Test leases
SELECT COUNT(*) as total_leases FROM public.leases WHERE status = 'active';
```

### Test from Application

1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear browser cache
3. Log out and back in
4. Try navigating to each page:
   - Dashboard
   - Tenants
   - Payments
   - Leases
   - Invoices

### Check Browser Console

Open DevTools (F12) and look for:
- API response codes
- Actual error messages
- Network timeline showing request details

---

## Prevention for Future

### Best Practices for RLS

1. **Keep Policies Simple**
   - Avoid complex JOINs in RLS conditions
   - Use indexed columns for conditions
   - Cache role checks when possible

2. **Test Policies Before Deployment**
   - Test as different user roles
   - Test with large datasets
   - Monitor query performance

3. **Version Control**
   - Always test migrations locally first
   - Keep before/after snapshots
   - Document RLS logic clearly

4. **Monitoring**
   - Set up error alerts for 500 errors
   - Monitor slow queries
   - Check RLS policy execution time

---

## Migration Ordering

The migrations must be applied in this order:

1. ✅ `20260704133233_*.sql` - Defines helper functions
2. ✅ `20260704133245_*.sql` - Sets up user management
3. ✅ `20260704133259_*.sql` - Creates role access
4. ✅ `20260704134426_*.sql` - Initial tables and policies
5. ✅ `20260705_update_schema.sql` - Adds unit_type and floor_level
6. ⚠️ `20260706093703_*.sql` - Updated RLS (might be causing issues)
7. 🔧 `20260706_fix_rls_policies.sql` - Simplified policies (optional fix)

---

## Contacting Support

If issues persist after following these steps:

1. Note the exact error message
2. Check the table causing issues
3. Run diagnostic steps 1-4 above
4. Provide:
   - Your user ID / email
   - Table name
   - Exact query that fails
   - Output of policy check (Step 5)

---

**Last Updated:** July 6, 2026  
**Created by:** Kiro Development Assistant
