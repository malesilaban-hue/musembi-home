-- Make tenant_id optional in payments table (focus on units instead)
-- This allows payments to be recorded even when no tenant is registered

ALTER TABLE public.payments
ALTER COLUMN tenant_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL
ALTER TABLE public.payments
DROP CONSTRAINT payments_tenant_id_fkey,
ADD CONSTRAINT payments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Update the RLS policy for tenants to handle NULL tenant_id
-- (This is already handled by the lease relationship)
