-- Diagnostic queries for missing leases issue
-- Run these in Supabase SQL editor to understand the data problem

-- 1. Count occupied units without active leases
SELECT COUNT(*) as occupied_units_without_active_leases
FROM public.units u
WHERE u.status = 'occupied'
AND NOT EXISTS (
  SELECT 1 FROM public.leases l 
  WHERE l.unit_id = u.id AND l.status = 'active'
);

-- 2. List occupied units without any lease (active or inactive)
SELECT u.id, u.house_number, u.status, p.name as property_name
FROM public.units u
LEFT JOIN public.properties p ON p.id = u.property_id
WHERE u.status = 'occupied'
AND NOT EXISTS (
  SELECT 1 FROM public.leases l WHERE l.unit_id = u.id
)
ORDER BY p.name, u.house_number;

-- 3. Count total leases by status
SELECT status, COUNT(*) as count
FROM public.leases
GROUP BY status;

-- 4. Check if there's a caretaker_properties assignment for your Green property
SELECT cp.user_id, cp.property_id, p.name, u.id as user_id_from_table
FROM public.caretaker_properties cp
JOIN public.properties p ON p.id = cp.property_id
LEFT JOIN auth.users u ON u.id = cp.user_id
WHERE p.name = 'Green' OR p.name LIKE '%green%'
LIMIT 10;

-- 5. Count leases for units in Green property
SELECT COUNT(*) as green_leases
FROM public.leases l
JOIN public.units u ON u.id = l.unit_id
JOIN public.properties p ON p.id = u.property_id
WHERE p.name = 'Green' OR p.name LIKE '%green%';

-- 6. See all units for Green property with their lease status
SELECT u.house_number, u.status, COUNT(l.id) as lease_count, 
       MAX(l.status) as lease_status
FROM public.units u
LEFT JOIN public.leases l ON l.unit_id = u.id
JOIN public.properties p ON p.id = u.property_id
WHERE p.name = 'Green' OR p.name LIKE '%green%'
GROUP BY u.id, u.house_number, u.status
ORDER BY u.house_number;
