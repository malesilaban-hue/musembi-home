-- Check if payments have lease_id set

-- 1. Count payments with lease_id
SELECT COUNT(*) as payments_with_lease_id
FROM public.payments
WHERE lease_id IS NOT NULL;

-- 2. Count payments WITHOUT lease_id
SELECT COUNT(*) as payments_without_lease_id
FROM public.payments
WHERE lease_id IS NULL;

-- 3. For each tenant with payments, check if they have a lease
SELECT 
  t.id,
  t.full_name,
  COUNT(p.id) as payment_count,
  COUNT(l.id) as lease_count,
  MAX(CASE WHEN p.lease_id IS NOT NULL THEN 1 ELSE 0 END) as has_payments_with_lease_id
FROM public.payments p
JOIN public.tenants t ON t.id = p.tenant_id
LEFT JOIN public.leases l ON l.tenant_id = t.id
GROUP BY t.id, t.full_name
HAVING COUNT(p.id) > 0
ORDER BY COUNT(p.id) DESC;

-- 4. Show specific payments for debugging
SELECT 
  p.id,
  p.receipt_number,
  p.amount,
  p.tenant_id,
  p.lease_id,
  t.full_name,
  l.id as lease_id_from_join,
  l.unit_id
FROM public.payments p
JOIN public.tenants t ON t.id = p.tenant_id
LEFT JOIN public.leases l ON l.tenant_id = t.id AND l.status = 'active'
LIMIT 10;
