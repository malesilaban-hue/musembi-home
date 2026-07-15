-- Make tenant_id optional in leases table
-- This allows leases to exist for occupied units even without tenant registration

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.leases
DROP CONSTRAINT leases_tenant_id_fkey;

-- Step 2: Make tenant_id nullable
ALTER TABLE public.leases
ALTER COLUMN tenant_id DROP NOT NULL;

-- Step 3: Create new foreign key with ON DELETE SET NULL
ALTER TABLE public.leases
ADD CONSTRAINT leases_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
