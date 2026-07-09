
-- Make tenant/lease optional; add unit_id to payments and invoices so caretakers can transact by unit.
ALTER TABLE public.payments ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

ALTER TABLE public.invoices ALTER COLUMN lease_id DROP NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL;

-- Require at least one identifier on both
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_tenant_or_unit_chk;
ALTER TABLE public.payments ADD CONSTRAINT payments_tenant_or_unit_chk CHECK (tenant_id IS NOT NULL OR unit_id IS NOT NULL);

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_lease_or_unit_chk;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_lease_or_unit_chk CHECK (lease_id IS NOT NULL OR unit_id IS NOT NULL);

-- Backfill payments.unit_id from lease when possible
UPDATE public.payments p
SET unit_id = l.unit_id
FROM public.leases l
WHERE p.lease_id IS NOT NULL AND p.unit_id IS NULL AND l.id = p.lease_id;

-- Backfill invoices.unit_id from lease
UPDATE public.invoices i
SET unit_id = l.unit_id
FROM public.leases l
WHERE i.lease_id IS NOT NULL AND i.unit_id IS NULL AND l.id = i.lease_id;

-- Updated allocation: works with either tenant_id or unit_id
CREATE OR REPLACE FUNCTION public.allocate_payment(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  p RECORD;
  remaining NUMERIC(12,2);
  inv RECORD;
  apply_amt NUMERIC(12,2);
BEGIN
  SELECT id, tenant_id, unit_id, amount INTO p FROM public.payments WHERE id = _payment_id;
  IF p.id IS NULL THEN RETURN; END IF;

  SELECT p.amount - COALESCE(SUM(pa.amount), 0) INTO remaining
  FROM public.payment_allocations pa WHERE pa.payment_id = p.id;
  IF remaining <= 0 THEN RETURN; END IF;

  FOR inv IN
    SELECT i.id, i.balance
    FROM public.invoices i
    LEFT JOIN public.leases le ON le.id = i.lease_id
    WHERE i.balance > 0
      AND i.status <> 'void'
      AND (
        (p.tenant_id IS NOT NULL AND le.tenant_id = p.tenant_id)
        OR (p.unit_id IS NOT NULL AND (i.unit_id = p.unit_id OR le.unit_id = p.unit_id))
      )
    ORDER BY i.due_date ASC, i.created_at ASC, i.id ASC
  LOOP
    EXIT WHEN remaining <= 0;
    apply_amt := LEAST(remaining, inv.balance);
    INSERT INTO public.payment_allocations (payment_id, invoice_id, amount)
    VALUES (p.id, inv.id, apply_amt);
    remaining := remaining - apply_amt;
  END LOOP;
END
$function$;

-- Updated current-month generator: also creates invoices for occupied units without an active lease
CREATE OR REPLACE FUNCTION public.generate_current_month_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  l RECORD;
  u RECORD;
  due_day INT;
  today DATE := CURRENT_DATE;
  period_s DATE := date_trunc('month', CURRENT_DATE)::date;
  period_e DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  due_d DATE;
  inv_id UUID;
  total_amt NUMERIC(12,2);
  created_count INT := 0;
  grace_days INT;
BEGIN
  PERFORM public.dedupe_current_month_invoices();

  SELECT default_due_day, COALESCE(overdue_grace_days, 0)
  INTO due_day, grace_days FROM public.app_settings LIMIT 1;
  IF due_day IS NULL THEN due_day := 5; END IF;
  IF grace_days IS NULL THEN grace_days := 0; END IF;

  due_d := (date_trunc('month', today) + make_interval(days => due_day - 1))::date;

  -- Active leases
  FOR l IN
    SELECT id, tenant_id, unit_id, monthly_rent,
           COALESCE(water_charge,0) AS water_charge,
           COALESCE(garbage_charge,0) AS garbage_charge,
           COALESCE(parking_charge,0) AS parking_charge,
           COALESCE(service_charge,0) AS service_charge,
           created_by
    FROM public.leases WHERE status = 'active'
  LOOP
    IF EXISTS (SELECT 1 FROM public.invoices WHERE lease_id = l.id AND date_trunc('month', period_start) = date_trunc('month', today)) THEN
      PERFORM public.allocate_payment(p.id) FROM public.payments p
      WHERE (p.tenant_id = l.tenant_id OR p.unit_id = l.unit_id)
        AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
      ORDER BY p.paid_at ASC, p.created_at ASC;
      CONTINUE;
    END IF;

    total_amt := l.monthly_rent + l.water_charge + l.garbage_charge + l.parking_charge + l.service_charge;

    INSERT INTO public.invoices (invoice_number, lease_id, unit_id, period_start, period_end, due_date, subtotal, total, amount_paid, status, created_by)
    VALUES (public.next_invoice_number(), l.id, l.unit_id, period_s, period_e, due_d, total_amt, total_amt, 0,
      CASE WHEN due_d + grace_days < today THEN 'overdue'::invoice_status ELSE 'unpaid'::invoice_status END, l.created_by)
    RETURNING id INTO inv_id;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Monthly rent', 1, l.monthly_rent, l.monthly_rent);
    IF l.water_charge   > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Water', 1, l.water_charge, l.water_charge); END IF;
    IF l.garbage_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Garbage', 1, l.garbage_charge, l.garbage_charge); END IF;
    IF l.parking_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Parking', 1, l.parking_charge, l.parking_charge); END IF;
    IF l.service_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Service', 1, l.service_charge, l.service_charge); END IF;

    PERFORM public.allocate_payment(p.id) FROM public.payments p
    WHERE (p.tenant_id = l.tenant_id OR p.unit_id = l.unit_id)
      AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
    ORDER BY p.paid_at ASC, p.created_at ASC;

    created_count := created_count + 1;
  END LOOP;

  -- Occupied units WITHOUT an active lease: invoice keyed on unit_id only
  FOR u IN
    SELECT id AS unit_id, rent AS monthly_rent,
           COALESCE(water_charge,0) AS water_charge,
           COALESCE(garbage_charge,0) AS garbage_charge,
           COALESCE(parking_charge,0) AS parking_charge,
           COALESCE(service_charge,0) AS service_charge
    FROM public.units
    WHERE status = 'occupied'
      AND NOT EXISTS (SELECT 1 FROM public.leases le WHERE le.unit_id = units.id AND le.status = 'active')
  LOOP
    IF EXISTS (SELECT 1 FROM public.invoices WHERE unit_id = u.unit_id AND lease_id IS NULL
                 AND date_trunc('month', period_start) = date_trunc('month', today)) THEN
      PERFORM public.allocate_payment(p.id) FROM public.payments p
      WHERE p.unit_id = u.unit_id
        AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
      ORDER BY p.paid_at ASC, p.created_at ASC;
      CONTINUE;
    END IF;

    total_amt := u.monthly_rent + u.water_charge + u.garbage_charge + u.parking_charge + u.service_charge;

    INSERT INTO public.invoices (invoice_number, lease_id, unit_id, period_start, period_end, due_date, subtotal, total, amount_paid, status)
    VALUES (public.next_invoice_number(), NULL, u.unit_id, period_s, period_e, due_d, total_amt, total_amt, 0,
      CASE WHEN due_d + grace_days < today THEN 'overdue'::invoice_status ELSE 'unpaid'::invoice_status END)
    RETURNING id INTO inv_id;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Monthly rent', 1, u.monthly_rent, u.monthly_rent);
    IF u.water_charge   > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Water', 1, u.water_charge, u.water_charge); END IF;
    IF u.garbage_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Garbage', 1, u.garbage_charge, u.garbage_charge); END IF;
    IF u.parking_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Parking', 1, u.parking_charge, u.parking_charge); END IF;
    IF u.service_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Service', 1, u.service_charge, u.service_charge); END IF;

    PERFORM public.allocate_payment(p.id) FROM public.payments p
    WHERE p.unit_id = u.unit_id
      AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
    ORDER BY p.paid_at ASC, p.created_at ASC;

    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END
$function$;

-- Dedupe should include unit-only invoices
CREATE OR REPLACE FUNCTION public.dedupe_current_month_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE removed INT;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY COALESCE(lease_id::text, 'u:'||unit_id::text), date_trunc('month', period_start)
      ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM public.invoices
    WHERE date_trunc('month', period_start) = date_trunc('month', CURRENT_DATE)
  ), del AS (
    DELETE FROM public.invoices WHERE id IN (SELECT id FROM ranked WHERE rn > 1) RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM del;
  RETURN removed;
END
$function$;
