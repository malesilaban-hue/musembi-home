# Exact Steps to Fix Missing Leases - Copy & Paste Ready

## The Error You Got
```
ERROR: 23502: null value in column "tenant_id" of relation "leases" violates not-null constraint
```

This means the `tenant_id` column in the `leases` table MUST have a value. We need to change this.

## Solution: Run These Exact Queries in Order

### Query 1: Drop the foreign key constraint
Copy and paste this into Supabase SQL Editor and run:
```sql
ALTER TABLE public.leases
DROP CONSTRAINT leases_tenant_id_fkey;
```

**Wait for success** ✓ You should see "Command completed successfully"

---

### Query 2: Make tenant_id nullable (allow NULL values)
Copy and paste this into a NEW SQL Editor tab and run:
```sql
ALTER TABLE public.leases
ALTER COLUMN tenant_id DROP NOT NULL;
```

**Wait for success** ✓ You should see "Command completed successfully"

---

### Query 3: Create new foreign key that allows NULL
Copy and paste this into a NEW SQL Editor tab and run:
```sql
ALTER TABLE public.leases
ADD CONSTRAINT leases_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
```

**Wait for success** ✓ You should see "Command completed successfully"

---

### Query 4: Verify the change worked
Copy and paste this into a NEW SQL Editor tab and run:
```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'leases' AND column_name = 'tenant_id';
```

**Expected result:** 
```
column_name | is_nullable | data_type
tenant_id   | YES         | uuid
```

If you see `NO` in is_nullable, the change didn't work. Check for errors.

---

## Now Run the Lease Creation Script

Once you see `is_nullable = YES`, copy and paste this into a NEW SQL tab:

```sql
-- Create placeholder leases for occupied units without leases
INSERT INTO public.leases (
  unit_id,
  tenant_id,
  start_date,
  end_date,
  monthly_rent,
  deposit,
  water_charge,
  garbage_charge,
  parking_charge,
  service_charge,
  billing_day,
  status,
  created_by,
  created_at,
  updated_at
)
SELECT 
  u.id as unit_id,
  NULL as tenant_id,  -- NOW ALLOWED!
  CURRENT_DATE as start_date,
  NULL as end_date,
  u.rent as monthly_rent,
  u.deposit,
  0 as water_charge,
  0 as garbage_charge,
  0 as parking_charge,
  0 as service_charge,
  5 as billing_day,
  'active' as status,
  NULL as created_by,
  CURRENT_TIMESTAMP as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM public.units u
WHERE u.status = 'occupied'
AND NOT EXISTS (
  SELECT 1 FROM public.leases l WHERE l.unit_id = u.id
);
```

**Expected result:** Something like "46 rows inserted" (the number of occupied units without leases)

---

## Verify the Fix

```sql
SELECT COUNT(*) as total_active_leases
FROM public.leases
WHERE status = 'active';

SELECT COUNT(*) as leases_without_tenant
FROM public.leases
WHERE status = 'active' AND tenant_id IS NULL;
```

**You should see:**
- total_active_leases: 46 (or more if there were existing leases)
- leases_without_tenant: 46 (or the count of occupied units that had no lease)

---

## Restart Your App

1. Close all browser tabs with MUSEMBI PMS
2. Clear browser cache:
   - **Chrome**: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
   - Select "All time"
   - Check "Cookies and other site data" and "Cached images and files"
   - Click "Clear data"
3. Go back to MUSEMBI PMS
4. Dashboard should now show:
   - ✓ Active Leases: 46
   - ✓ Collected This Month: (shows payments now)

---

## If You Get an Error

**Error: "already exists"** - The constraint already has a different name
```sql
-- Find the actual constraint name
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'leases' AND constraint_type = 'FOREIGN KEY';

-- Then use that name in DROP
ALTER TABLE public.leases
DROP CONSTRAINT [actual_constraint_name];
```

**Error: "Cannot alter column"** - There might be a CHECK constraint
```sql
-- Show all constraints on tenant_id
SELECT constraint_name
FROM information_schema.check_constraints
WHERE table_name = 'leases';
```

Contact Kiro with the exact error message if you get stuck.
