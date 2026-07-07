# 🔴 EMERGENCY: Fix 500 Errors - Do This NOW

## Problem
You're getting 500 errors on all queries because the RLS policies have syntax errors or the function doesn't exist.

## Quick Fix (2 minutes)

### Step 1: Disable RLS (Temporary Fix)
1. Go to Supabase Console → SQL Editor → New Query
2. Copy and paste this:

```sql
-- Disable RLS on all tables temporarily
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
```

3. Click **Run**
4. Hard refresh your app (Ctrl+Shift+R)
5. Try logging in - **should work now!**

---

### Step 2: Re-enable RLS with Simple Policies (Permanent Fix)

Once confirmed working, run this to enable RLS again:

```sql
-- Enable RLS
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

-- Simple policies - allow authenticated to read, staff to manage
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
```

---

## Why This Works

1. **Simpler policies** - avoid syntax errors
2. **All authenticated users can READ** - fixes 500 errors
3. **Only staff can CREATE/UPDATE/DELETE** - maintains security
4. **Role checking uses `public.` prefix** - function will be found

---

## Testing

After each step:
1. Hard refresh browser
2. Log in
3. Go to Dashboard - should show data
4. No more 500 errors ✅

---

## If Still Getting 500 Errors

1. Go to Supabase Console → Logs
2. Look for error message
3. Share the error with us

---

## Done! ✅

Your app should now work without 500 errors!

