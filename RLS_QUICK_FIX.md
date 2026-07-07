# RLS 500 Error - Quick Fix Guide

## Immediate Actions

If you're seeing 500 errors from Supabase API calls (tenants, payments, invoices, leases):

### Step 1: Check User Roles in Supabase Console

1. Go to Supabase Project Console
2. Click "SQL Editor"
3. Paste and run this query:

```sql
SELECT u.id, u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'YOUR_EMAIL_HERE'
ORDER BY u.created_at DESC;
```

**Expected result:** Should show your email with roles like `super_admin` or `landlord`

**If empty roles:** Your user doesn't have roles assigned! Add them:

```sql
INSERT INTO public.user_roles (user_id, role, email)
SELECT id, 'super_admin'::app_role, email FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.users.id
);
```

### Step 2: Clear Browser Cache and Logout/Login

1. Open DevTools (F12)
2. Go to Application tab
3. Clear all storage/cookies
4. Close the app
5. Open fresh and login again

### Step 3: Check if Fixed

Navigate to Dashboard - if charts load without errors, issue is fixed!

---

## If Still Not Fixed

### Option A: Apply Simplified RLS Policies

The Lovable migration created complex RLS policies that might be timing out.

Simplified version available: `supabase/migrations/20260706_fix_rls_policies.sql`

**To apply:**
1. Go to Supabase > SQL Editor
2. Copy content from `supabase/migrations/20260706_fix_rls_policies.sql`
3. Paste and run it
4. Refresh browser

### Option B: Test Without RLS (Debug Only)

To verify it's an RLS issue:

```sql
-- Run in Supabase SQL Editor to temporarily disable RLS
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases DISABLE ROW LEVEL SECURITY;
```

Then refresh browser and test. If it works, it's definitely RLS.

**Re-enable after testing:**
```sql
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
```

---

## Common Causes

| Symptom | Cause | Solution |
|---------|-------|----------|
| 500 on all table queries | User has no roles | Add roles in user_roles table |
| 500 only on joins | Complex RLS policy | Apply simplified policies |
| 500 sometimes | RLS timeout | Check query performance |
| Works without RLS, fails with | RLS policy logic error | Review policy conditions |

---

## Files Created to Help

- `TROUBLESHOOTING_RLS_ERRORS.md` - Detailed diagnostics and solutions
- `supabase/migrations/20260706_fix_rls_policies.sql` - Simplified RLS policies
- `PROJECT_STATUS.md` - Overall project status
- `DEPLOYMENT_VERIFICATION.md` - Deployment checklist

---

## Next Steps

1. ✅ Check user roles (Step 1 above)
2. ✅ Clear cache and re-login (Step 2)
3. ✅ If not fixed, apply simplified policies or disable RLS for testing
4. 📞 If still not working, refer to `TROUBLESHOOTING_RLS_ERRORS.md` for detailed diagnostics

**The app should load dashboard without errors once roles are assigned!**
