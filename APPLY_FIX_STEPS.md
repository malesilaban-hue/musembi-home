# Apply RLS Fix to Supabase - Step by Step

## Issue
500 errors when querying tenants, leases, payments, invoices because of complex RLS policies with nested JOINs.

## Solution
Apply simplified RLS policies that avoid complex nested queries.

---

## 🔧 How to Apply the Fix

### Option 1: Copy from Migration File (Recommended)

1. **Open Migration File Locally**
   - File: `/supabase/migrations/20260706_fix_rls_policies.sql`
   - Copy ALL the SQL content

2. **Go to Supabase Console**
   - URL: https://app.supabase.com
   - Select your project

3. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query" button

4. **Paste the SQL**
   - Paste the entire migration content into the editor
   - DO NOT paste line by line

5. **Run the Query**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for "Query complete" message
   - If successful: Green checkmark ✅

6. **Verify Success**
   - Should see no errors
   - Should say "Query successful" or similar

---

## ✅ If Query Succeeds

1. **Refresh Application**
   - Open your app URL
   - Press Ctrl+F5 (or Cmd+Shift+R on Mac)
   - Hard refresh to clear cache

2. **Test Each Page**
   - Go to Dashboard → Should load stats
   - Go to Tenants → Should show tenant list
   - Go to Leases → Should show leases
   - Go to Payments → Should show payments
   - Go to Invoices → Should show invoices

3. **Check Browser Console**
   - Press F12 to open DevTools
   - Go to Console tab
   - Should see NO 500 errors

4. **Commit to Git**
   ```bash
   cd /home/laban/Music/musembi-home
   git add supabase/migrations/20260706_fix_rls_policies.sql
   git commit -m "fix: Apply simplified RLS policies to resolve 500 errors"
   git push origin main
   ```

---

## ❌ If Query Fails

### Error: "syntax error"
- **Cause:** Copy-paste broke the SQL formatting
- **Fix:** 
  1. Delete the query content
  2. Re-copy the migration file content
  3. Paste again carefully
  4. Run again

### Error: "undefined function" or "undefined type"
- **Cause:** Custom functions/types missing
- **Status:** These should exist from previous migrations
- **Fix:** Contact support or check previous migrations are applied

### Error: "policy already exists"
- **Cause:** Policies have different names
- **Status:** This is OK - the DROP IF EXISTS handles it
- **Fix:** Run the query again, it should drop and recreate

---

## 📋 SQL Content to Apply

If you need to copy-paste manually, here's the complete SQL:

```sql
-- Fix RLS policies that may be causing 500 errors
DROP POLICY IF EXISTS "tenants_staff_manage" ON public.tenants;
CREATE POLICY tenants_all_staff ON public.tenants FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]) OR user_id = auth.uid()) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

DROP POLICY IF EXISTS "staff manage payments" ON public.payments;
CREATE POLICY payments_all_staff ON public.payments FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]) OR tenant_id = auth.uid()) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

DROP POLICY IF EXISTS "invoices_staff_manage" ON public.invoices;
CREATE POLICY invoices_all_staff ON public.invoices FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role])) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

DROP POLICY IF EXISTS "leases_staff_manage" ON public.leases;
CREATE POLICY leases_all_staff ON public.leases FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]) OR tenant_id = auth.uid()) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'caretaker'::app_role]));

DROP POLICY IF EXISTS "properties_staff_read" ON public.properties;
CREATE POLICY properties_all_staff ON public.properties FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'technician'::app_role, 'security'::app_role]) OR (current_user_has_any_role(ARRAY['caretaker'::app_role]) AND EXISTS(SELECT 1 FROM public.caretaker_properties cp WHERE cp.property_id = properties.id AND cp.user_id = auth.uid()))) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

DROP POLICY IF EXISTS "units_via_property" ON public.units;
CREATE POLICY units_all_staff ON public.units FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role, 'accountant'::app_role, 'technician'::app_role, 'security'::app_role]) OR (current_user_has_any_role(ARRAY['caretaker'::app_role]) AND EXISTS(SELECT 1 FROM public.caretaker_properties cp WHERE cp.property_id = units.property_id AND cp.user_id = auth.uid()))) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

DROP POLICY IF EXISTS "roles_admin_write" ON public.user_roles;
CREATE POLICY roles_admin_write ON public.user_roles FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

DROP POLICY IF EXISTS "roles_self_read" ON public.user_roles;
CREATE POLICY roles_self_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

DROP POLICY IF EXISTS "cp_admin_all" ON public.caretaker_properties;
CREATE POLICY cp_admin_all ON public.caretaker_properties FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));

DROP POLICY IF EXISTS "cp_self_read" ON public.caretaker_properties;
CREATE POLICY cp_self_read ON public.caretaker_properties FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
CREATE POLICY settings_read ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON public.app_settings;
CREATE POLICY settings_admin_write ON public.app_settings FOR ALL TO authenticated USING (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])) WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role]));
```

---

## 🎯 Expected Results After Fix

| Page | Before | After |
|------|--------|-------|
| Dashboard | ❌ 500 errors | ✅ Loads successfully |
| Tenants | ❌ 500 errors | ✅ Shows tenant list |
| Leases | ❌ 500 errors | ✅ Shows active leases |
| Payments | ❌ 500 errors | ✅ Shows payment history |
| Invoices | ❌ 500 errors | ✅ Shows invoice list |

---

## 📞 Support

If you encounter issues:
1. Check Supabase status: https://status.supabase.com
2. Verify migration file syntax is correct (provided above)
3. Ensure all previous migrations have been applied
4. Try refreshing page with Ctrl+F5 (hard refresh)
5. Clear browser localStorage and try logging in again

---

**Created:** July 6, 2026  
**Priority:** High - Blocks application functionality  
**Estimated Time:** 2-3 minutes to apply
