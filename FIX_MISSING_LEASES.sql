-- Fix script to create placeholder leases for occupied units without leases
-- IMPORTANT: 
-- 1. First run the migration: 20260710_make_tenant_optional_in_leases.sql
-- 2. Then run this script

-- 1. Create placeholder leases for occupied units that don't have any lease
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
  NULL as tenant_id,  -- No tenant assigned yet (now optional after migration)
  CURRENT_DATE as start_date,
  NULL as end_date,
  u.rent as monthly_rent,
  u.deposit,
  0 as water_charge,
  0 as garbage_charge,
  0 as parking_charge,
  0 as service_charge,
  5 as billing_day,  -- Default billing on 5th
  'active' as status,
  NULL as created_by,
  CURRENT_TIMESTAMP as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM public.units u
WHERE u.status = 'occupied'
AND NOT EXISTS (
  SELECT 1 FROM public.leases l WHERE l.unit_id = u.id
)
ON CONFLICT DO NOTHING;

-- 2. Verify the fix
SELECT COUNT(*) as newly_created_leases
FROM public.leases l
WHERE l.tenant_id IS NULL
AND l.status = 'active'
AND EXISTS (
  SELECT 1 FROM public.units u WHERE u.id = l.unit_id AND u.status = 'occupied'
);
