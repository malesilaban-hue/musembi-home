# Fix: Landlord Seeing All Zeros on Dashboard

## 🔍 Problem Found

**Cause:** The RLS migration was using `current_user_has_any_role()` but the correct function name is `public.current_user_has_any_role()` - missing the `public.` schema prefix.

When the function can't be found, the RLS policy silently fails and returns NO DATA, causing all stats to show as zeros (—).

## ✅ Solution: Apply This SQL NOW

### Step 1: Go to Supabase Console
1. Open https://app.supabase.com
2. Select your project
3. Click **SQL Editor**
4. Click **New Query**

### Step 2: Copy This SQL

```sql
-- FIX: Add public. prefix to current_user_has_any_role function calls

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
```

### Step 3: Run the Query
1. Paste all the SQL above
2. Click **Run** (or Ctrl+Enter)
3. Wait for it to complete (should see no errors)

### Step 4: Test
1. Close the SQL Editor
2. Go back to your app in browser
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Log out and log back in as landlord
5. Go to Dashboard
6. **Stats should now show real numbers instead of dashes!**

---

## What Changed

### Before (Broken)
```sql
USING (current_user_has_any_role(ARRAY['landlord'::app_role]))
-- ❌ Function not found - returns NO data
```

### After (Fixed)
```sql
USING (public.current_user_has_any_role(ARRAY['landlord'::app_role]))
-- ✅ Function found - returns ALL data for landlord
```

---

## Expected Results After Fix

### Landlord Dashboard Should Show:
- ✅ Properties: Actual count (e.g., 5)
- ✅ Total units: Actual count (e.g., 45)
- ✅ Vacant units: Actual count (e.g., 12)
- ✅ Tenants: Actual count (e.g., 33)
- ✅ Active leases: Actual count (e.g., 33)
- ✅ Expected rent: KES amount (e.g., KES 500,000)
- ✅ Collected today: KES amount (e.g., KES 50,000)
- ✅ Collected this month: KES amount (e.g., KES 300,000)
- ✅ Outstanding: KES amount (e.g., KES 200,000)

NOT showing dashes (—) anymore!

---

## Why This Happened

1. The RLS migration used function without schema prefix
2. PostgreSQL couldn't find the function in the search path
3. When RLS function fails, it denies access (zero results)
4. Frontend shows dashes (—) when no data returned

Now fixed! All roles should see their correct data.

---

## Quick Checklist

- [ ] Copy SQL above
- [ ] Go to Supabase SQL Editor
- [ ] Paste and run
- [ ] Hard refresh app
- [ ] Log back in as landlord
- [ ] Check Dashboard has real numbers
- [ ] Done! ✅

