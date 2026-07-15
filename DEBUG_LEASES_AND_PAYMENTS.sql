-- Debug script to check if leases and payments were created

-- 1. Count how many leases exist now
SELECT COUNT(*) as total_leases
FROM public.leases;

-- 2. Count active leases
SELECT COUNT(*) as active_leases
FROM public.leases
WHERE status = 'active';

-- 3. Count leases without tenant
SELECT COUNT(*) as leases_without_tenant
FROM public.leases
WHERE tenant_id IS NULL;

-- 4. Count occupied units
SELECT COUNT(*) as occupied_units
FROM public.units
WHERE status = 'occupied';

-- 5. Count occupied units with leases
SELECT COUNT(*) as occupied_with_leases
FROM public.units u
WHERE u.status = 'occupied'
AND EXISTS (SELECT 1 FROM public.leases l WHERE l.unit_id = u.id);

-- 6. List the caretaker's assigned properties
SELECT 
  cp.user_id,
  p.id as property_id,
  p.name as property_name,
  (SELECT COUNT(*) FROM public.units WHERE property_id = p.id) as total_units,
  (SELECT COUNT(*) FROM public.units WHERE property_id = p.id AND status = 'occupied') as occupied_units,
  (SELECT COUNT(*) FROM public.leases l 
   JOIN public.units u ON u.id = l.unit_id 
   WHERE u.property_id = p.id AND l.status = 'active') as active_leases
FROM public.caretaker_properties cp
JOIN public.properties p ON p.id = cp.property_id
WHERE p.name LIKE '%green%' OR p.name LIKE '%Green%'
LIMIT 1;

-- 7. Check payments table for the caretaker's property
SELECT COUNT(*) as total_payments
FROM public.payments p
WHERE p.lease_id IS NOT NULL
AND EXISTS (
  SELECT 1 FROM public.leases l
  JOIN public.units u ON u.id = l.unit_id
  WHERE l.id = p.lease_id
  AND u.property_id IN (
    SELECT property_id FROM public.caretaker_properties 
    WHERE property_id IN (SELECT id FROM public.properties WHERE name LIKE '%green%')
  )
);

-- 8. Show actual payments for this property
SELECT 
  p.id,
  p.receipt_number,
  p.amount,
  p.tenant_id,
  p.lease_id,
  l.unit_id,
  u.house_number
FROM public.payments p
LEFT JOIN public.leases l ON l.id = p.lease_id
LEFT JOIN public.units u ON u.id = l.unit_id
WHERE u.property_id IN (SELECT property_id FROM public.caretaker_properties 
  WHERE property_id IN (SELECT id FROM public.properties WHERE name LIKE '%green%'))
OR p.tenant_id IN (
  SELECT t.id FROM public.tenants t
  JOIN public.leases l ON l.tenant_id = t.id
  JOIN public.units u ON u.id = l.unit_id
  WHERE u.property_id IN (SELECT property_id FROM public.caretaker_properties 
    WHERE property_id IN (SELECT id FROM public.properties WHERE name LIKE '%green%'))
)
LIMIT 20;
