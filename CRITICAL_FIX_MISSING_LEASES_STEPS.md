# CRITICAL FIX: Missing Leases for Occupied Units

## Problem Identified
- ✗ 46 occupied units but only 1 active lease
- ✗ Caretaker shows 0 payments despite making several
- ✗ Payments cannot be linked to units without leases

## Root Cause
Units were marked as "occupied" WITHOUT creating corresponding leases. Leases are required for:
- Creating invoices
- Recording payments
- Filtering data for caretakers
- Calculating rent statistics

## Solution: Create Missing Leases

### Step 1: Diagnose the Issue
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Copy contents of `DIAGNOSE_MISSING_LEASES.sql`
4. Paste and run each query to understand the data:
   - Query 1: How many occupied units have no active lease?
   - Query 2: Which occupied units need leases?
   - Query 5-6: Specific issues with Green property

### Step 2: Back Up Your Data
```sql
-- In Supabase SQL Editor, run:
SELECT COUNT(*) FROM public.leases;
SELECT COUNT(*) FROM public.units WHERE status = 'occupied';
```
Note the counts for recovery if needed.

### Step 3: Make tenant_id Optional in Leases (Migration)
1. Go to Supabase SQL Editor
2. Copy and run this migration FIRST:
```sql
ALTER TABLE public.leases
ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE public.leases
DROP CONSTRAINT leases_tenant_id_fkey,
ADD CONSTRAINT leases_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
```
3. Wait for success message

### Step 4: Auto-Create Missing Leases
1. Go to Supabase SQL Editor (same session)
2. Copy contents of `FIX_MISSING_LEASES.sql`
3. Paste and run

**What this does:**
- Creates placeholder leases for all occupied units without leases
- Sets tenant_id to NULL (tenant registration is optional now)
- Uses unit's existing rent amount
- Sets status to 'active'
- Uses billing day 5 (default)

### Step 5: Verify the Fix
Run diagnostic query again:
```sql
SELECT COUNT(*) as active_leases
FROM public.leases
WHERE status = 'active';
```
Should now show 46 leases instead of 1.

### Step 6: Restart the App
1. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. Refresh the page
3. Dashboard should now show:
   - Active Leases: 46 ✓
   - Payments should appear ✓

## What Changed in Application
- Payments are now linked to units via `lease_id` instead of requiring `tenant_id`
- Caretaker can see payments for their property's units even without tenant info
- Invoices can be generated for units without registered tenants

## Next Steps After Fix
1. **For each occupied unit, eventually assign a tenant:**
   - Go to Tenants page
   - Register tenant info
   - Assign to unit during registration
   - This will update the lease with tenant_id

2. **Update lease details if needed:**
   - Go to Leases page
   - Click on placeholder lease
   - Edit monthly_rent, deposit, water/garbage charges, etc.
   - Add tenant information

3. **Data remains consistent:**
   - Payments recorded BEFORE tenant assignment stay on unit
   - Once tenant is assigned, can see payments in tenant history too

## Troubleshooting

### "Query Error: leases violates check constraint"
- The leases table may have validation constraints
- Contact Kiro and provide the full error message

### "Still seeing 0 payments after refresh"
- Force a full page refresh (Ctrl+Shift+R)
- Check browser DevTools Console for errors
- Verify the fix script ran without errors

### "Payments show but not in Dashboard stats"
- Need to rebuild the app: `npm run build`
- Restart dev server if needed

## Files to Reference
- `DIAGNOSE_MISSING_LEASES.sql` - Diagnostic queries
- `FIX_MISSING_LEASES.sql` - Auto-create leases script
- `ARCHITECTURE_UPDATE_UNITS_FIRST.md` - Why tenants are now optional
