# Role-Based Data Access Verification

## Current Architecture

**Data filtering happens at TWO levels:**

1. **Database RLS Policies (Primary)** - Filters at query time
2. **Frontend (UI Control)** - Shows/hides buttons based on role

---

## How Each Role Should Work

### ✅ Landlord & Super Admin
- **Database:** Can see ALL data (RLS policy allows)
- **Pages:** See all properties, tenants, leases, payments, invoices
- **Action:** Can create, edit, delete

```sql
-- RLS Policy: Super admin and landlord have full access
WHERE current_user_has_any_role(ARRAY['super_admin'::app_role, 'landlord'::app_role])
```

### ✅ Caretaker
- **Database:** Can see ONLY their assigned properties' units and related data
- **Pages:** See only units from assigned properties
- **Action:** Can view and manage only assigned properties

```sql
-- RLS Policy: Caretaker sees only assigned properties
WHERE current_user_has_any_role(ARRAY['caretaker'::app_role]) 
  AND EXISTS(SELECT 1 FROM public.caretaker_properties cp 
    WHERE cp.property_id = units.property_id 
    AND cp.user_id = auth.uid())
```

### ✅ Accountant
- **Database:** Can see financial data (payments, invoices) globally
- **Pages:** See all payments, invoices, tenants
- **Action:** Can record payments, create invoices

### ✅ Technician
- **Database:** Can see all properties and units
- **Pages:** See all properties for maintenance
- **Action:** Can create/manage maintenance tasks

### ✅ Security
- **Database:** Can read all data (read-only)
- **Pages:** Can view but not modify anything
- **Action:** View-only access

### ✅ Tenant
- **Database:** Can see only their own tenant record and lease
- **Pages:** See only their own information
- **Action:** View-only access to their data

---

## Testing Each Role

### Test 1: Landlord Login
1. Go to Dashboard → Should see:
   - Total properties (all)
   - Total units (all)
   - Vacant units (all)
   - All tenants
   - All active leases

2. Go to Properties → Should see:
   - All properties listed

3. Go to Tenants → Should see:
   - All tenants

4. Go to Leases → Should see:
   - All leases

5. Go to Payments → Should see:
   - All payments

**Expected:** Everything shows actual numbers, not dashes (—)

---

### Test 2: Caretaker Login (Assigned to Green Flat)
1. Go to Dashboard → Should see:
   - Properties: 1 (Green Flat only)
   - Total units: X (Green Flat's units)
   - Vacant units: Y (Green Flat's vacant)
   - Occupied units: Z (Green Flat's occupied)
   - Expected rent: Sum of Green Flat's occupied units

2. Go to Properties → Should see:
   - Green Flat (if allowed to view)
   - NOT Orange Flat or other properties

3. Go to Tenants → Should see:
   - Only tenants in Green Flat's units
   - NOT all tenants

4. Go to Leases → Should see:
   - Only leases for Green Flat's units

5. Go to Payments → Should see:
   - Only payments from Green Flat's tenants

**Expected:** Numbers match Green Flat only, not zeros

---

### Test 3: Accountant Login
1. Go to Dashboard → Should see:
   - Payments and invoices (all)
   - Can see all financial data

2. Go to Payments → Should see:
   - All payments

3. Go to Invoices → Should see:
   - All invoices

**Expected:** Can view but may not see property-specific management

---

### Test 4: Technician Login
1. Go to Dashboard → May see limited stats
2. Go to Properties → Should see:
   - All properties

3. Go to Maintenance → Should see:
   - All maintenance tasks

**Expected:** Can view properties and maintenance

---

### Test 5: Security Login
1. All pages should be VIEW-ONLY
2. No "Create" or "Edit" buttons visible
3. Can browse all data but cannot modify

**Expected:** Read-only access to everything

---

### Test 6: Tenant Login
1. Dashboard → See own rent and payment status
2. Properties → May not see (or see in read-only)
3. Tenants → See only own information
4. Leases → See own lease

**Expected:** See only own data

---

## Current Issues Found

### ❌ Frontend doesn't validate role-based filtering
- Pages fetch all data globally
- RLS should filter at database, but frontend doesn't verify
- **Solution:** Trust RLS policies are working (they should be after migration)

### ⚠️ Caretaker seeing zeros
- **Cause:** RLS policies were complex before, causing timeouts
- **Fix:** Applied simplified RLS migration
- **Action:** Verify RLS migration was applied successfully

---

## How to Verify RLS is Working

1. **Open Browser DevTools** (F12)
2. **Go to Network tab**
3. **Login as Caretaker**
4. **Go to Dashboard**
5. **Look for Supabase REST API calls**
6. **Check the response data:**
   - If response is filtered (only assigned properties), ✅ RLS works
   - If response is empty or error, ❌ RLS failed

---

## If RLS is NOT Working

### Symptoms:
- Caretaker sees dashes (—) instead of numbers
- Caretaker sees all tenants/payments instead of just assigned
- Different roles see same data

### Solution:
1. **Check if migration was applied:**
   - Go to Supabase Console → SQL Editor
   - Run: `SELECT * FROM pg_policies WHERE tablename = 'tenants';`
   - Should show the new policies

2. **Check role assignment:**
   - Go to Team page
   - Verify caretaker has "caretaker" role
   - Verify caretaker is assigned to a property

3. **Re-apply RLS migration if needed:**
   - Go to SQL Editor
   - Run the migration SQL again

---

## Summary

✅ **Landlord:** Should see everything  
✅ **Caretaker:** Should see only assigned properties  
✅ **Accountant:** Should see financial data  
✅ **Technician:** Should see properties  
✅ **Security:** Should see everything but read-only  
✅ **Tenant:** Should see only own data  

**All filtering is done via RLS policies at the database level, not frontend filtering.**

If dashes appear, the RLS migration likely wasn't applied successfully.

---

## Quick Checklist

- [ ] Login as each role
- [ ] Check Dashboard numbers
- [ ] Verify no dashes (—) for assigned data
- [ ] Confirm role-specific pages show filtered data
- [ ] Test that roles can't see other users' data

