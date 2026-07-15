-- More aggressive fix for tenant_id NOT NULL constraint
-- Run this in Supabase SQL Editor

-- Step 1: Check what constraints exist
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'leases' AND column_name = 'tenant_id';

-- Step 2: Drop all constraints on tenant_id
ALTER TABLE public.leases
DROP CONSTRAINT IF EXISTS leases_tenant_id_fkey CASCADE;

-- Step 3: Recreate column without NOT NULL
-- WARNING: This will fail if there are NOT NULL constraints. If it does, continue to Step 4

ALTER TABLE public.leases
ALTER COLUMN tenant_id DROP NOT NULL;

-- Step 4: If Step 3 failed, try this - recreate the foreign key properly
ALTER TABLE public.leases
ADD CONSTRAINT leases_tenant_id_fkey
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Step 5: Verify the column is now nullable
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'leases' AND column_name = 'tenant_id';
