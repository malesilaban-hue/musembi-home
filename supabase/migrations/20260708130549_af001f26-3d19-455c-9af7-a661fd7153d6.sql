-- Fix invoice paid/status recomputation so it works with the generated balance column
CREATE OR REPLACE FUNCTION public.recompute_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  inv_id UUID;
  paid NUMERIC(12,2);
  tot NUMERIC(12,2);
  due_d DATE;
  grace_days INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    inv_id := OLD.invoice_id;
  ELSE
    inv_id := NEW.invoice_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid
  FROM public.payment_allocations
  WHERE invoice_id = inv_id;

  SELECT total, due_date INTO tot, due_d
  FROM public.invoices
  WHERE id = inv_id;

  IF inv_id IS NULL OR tot IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(overdue_grace_days, 0) INTO grace_days
  FROM public.app_settings
  LIMIT 1;

  UPDATE public.invoices
  SET
    amount_paid = paid,
    status = CASE
      WHEN paid >= tot AND tot > 0 THEN 'paid'::invoice_status
      WHEN paid > 0 THEN 'partial'::invoice_status
      WHEN due_d + COALESCE(grace_days, 0) < CURRENT_DATE THEN 'overdue'::invoice_status
      ELSE 'unpaid'::invoice_status
    END
  WHERE id = inv_id;

  RETURN NULL;
END
$function$;

-- Allocate any remaining amount from a payment to the tenant's oldest outstanding invoices
CREATE OR REPLACE FUNCTION public.allocate_payment(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  remaining NUMERIC(12,2);
  inv RECORD;
  apply_amt NUMERIC(12,2);
BEGIN
  SELECT id, tenant_id, amount
  INTO p
  FROM public.payments
  WHERE id = _payment_id;

  IF p.id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.amount - COALESCE(SUM(pa.amount), 0)
  INTO remaining
  FROM public.payment_allocations pa
  WHERE pa.payment_id = p.id;

  IF remaining <= 0 THEN
    RETURN;
  END IF;

  FOR inv IN
    SELECT i.id, i.balance
    FROM public.invoices i
    JOIN public.leases le ON le.id = i.lease_id
    WHERE le.tenant_id = p.tenant_id
      AND i.balance > 0
      AND i.status <> 'void'
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

CREATE OR REPLACE FUNCTION public.auto_allocate_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.allocate_payment(NEW.id);
  RETURN NEW;
END
$function$;

-- Rebuild automatic payment/invoice triggers if they are missing or stale
DROP TRIGGER IF EXISTS auto_allocate_payment_after_insert ON public.payments;
CREATE TRIGGER auto_allocate_payment_after_insert
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.auto_allocate_payment();

DROP TRIGGER IF EXISTS recompute_invoice_paid_after_insert ON public.payment_allocations;
CREATE TRIGGER recompute_invoice_paid_after_insert
AFTER INSERT ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.recompute_invoice_paid();

DROP TRIGGER IF EXISTS recompute_invoice_paid_after_update ON public.payment_allocations;
CREATE TRIGGER recompute_invoice_paid_after_update
AFTER UPDATE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.recompute_invoice_paid();

DROP TRIGGER IF EXISTS recompute_invoice_paid_after_delete ON public.payment_allocations;
CREATE TRIGGER recompute_invoice_paid_after_delete
AFTER DELETE ON public.payment_allocations
FOR EACH ROW
EXECUTE FUNCTION public.recompute_invoice_paid();

-- Keep the due invoice generator compatible with balance as a generated column
CREATE OR REPLACE FUNCTION public.generate_due_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  l RECORD;
  due_day INT;
  today DATE := CURRENT_DATE;
  period_s DATE;
  period_e DATE;
  due_d DATE;
  inv_id UUID;
  total_amt NUMERIC(12,2);
  created_count INT := 0;
  grace_days INT;
BEGIN
  SELECT default_due_day, COALESCE(overdue_grace_days, 0)
  INTO due_day, grace_days
  FROM public.app_settings
  LIMIT 1;

  IF due_day IS NULL THEN due_day := 5; END IF;
  IF grace_days IS NULL THEN grace_days := 0; END IF;

  IF EXTRACT(DAY FROM today)::INT < due_day THEN
    RETURN 0;
  END IF;

  period_s := date_trunc('month', today)::date;
  period_e := (date_trunc('month', today) + interval '1 month - 1 day')::date;
  due_d := (date_trunc('month', today) + make_interval(days => due_day - 1))::date;

  FOR l IN
    SELECT id, tenant_id, monthly_rent,
           COALESCE(water_charge,0) AS water_charge,
           COALESCE(garbage_charge,0) AS garbage_charge,
           COALESCE(parking_charge,0) AS parking_charge,
           COALESCE(service_charge,0) AS service_charge,
           created_by
    FROM public.leases
    WHERE status = 'active'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE lease_id = l.id
        AND date_trunc('month', period_start) = date_trunc('month', period_s)
    ) THEN
      CONTINUE;
    END IF;

    total_amt := l.monthly_rent + l.water_charge + l.garbage_charge + l.parking_charge + l.service_charge;

    INSERT INTO public.invoices (
      invoice_number, lease_id, period_start, period_end, due_date,
      subtotal, total, amount_paid, status, created_by
    ) VALUES (
      public.next_invoice_number(), l.id, period_s, period_e, due_d,
      total_amt, total_amt, 0,
      CASE WHEN due_d + grace_days < today THEN 'overdue'::invoice_status ELSE 'unpaid'::invoice_status END,
      l.created_by
    ) RETURNING id INTO inv_id;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount)
    VALUES (inv_id, 'Monthly rent', 1, l.monthly_rent, l.monthly_rent);

    IF l.water_charge   > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Water', 1, l.water_charge, l.water_charge); END IF;
    IF l.garbage_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Garbage', 1, l.garbage_charge, l.garbage_charge); END IF;
    IF l.parking_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Parking', 1, l.parking_charge, l.parking_charge); END IF;
    IF l.service_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Service', 1, l.service_charge, l.service_charge); END IF;

    -- If the tenant already paid before this invoice existed, apply any unallocated payments now.
    PERFORM public.allocate_payment(p.id)
    FROM public.payments p
    WHERE p.tenant_id = l.tenant_id
      AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
    ORDER BY p.paid_at ASC, p.created_at ASC;

    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END
$function$;

-- Remove duplicate invoices for the current month, keeping the oldest invoice for each lease/month
CREATE OR REPLACE FUNCTION public.dedupe_current_month_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  removed INT;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY lease_id, date_trunc('month', period_start)
      ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM public.invoices
    WHERE date_trunc('month', period_start) = date_trunc('month', CURRENT_DATE)
  ), del AS (
    DELETE FROM public.invoices
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM del;

  RETURN removed;
END
$function$;

-- Generate exactly one invoice per active lease for the current month
CREATE OR REPLACE FUNCTION public.generate_current_month_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  l RECORD;
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
  -- Clean duplicates first, so rerunning the button is safe.
  PERFORM public.dedupe_current_month_invoices();

  SELECT default_due_day, COALESCE(overdue_grace_days, 0)
  INTO due_day, grace_days
  FROM public.app_settings
  LIMIT 1;

  IF due_day IS NULL THEN due_day := 5; END IF;
  IF grace_days IS NULL THEN grace_days := 0; END IF;

  due_d := (date_trunc('month', today) + make_interval(days => due_day - 1))::date;

  FOR l IN
    SELECT id, tenant_id, monthly_rent,
           COALESCE(water_charge,0) AS water_charge,
           COALESCE(garbage_charge,0) AS garbage_charge,
           COALESCE(parking_charge,0) AS parking_charge,
           COALESCE(service_charge,0) AS service_charge,
           created_by
    FROM public.leases
    WHERE status = 'active'
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE lease_id = l.id
        AND date_trunc('month', period_start) = date_trunc('month', today)
    ) THEN
      -- Existing invoice: still apply any already-recorded but unallocated payments.
      PERFORM public.allocate_payment(p.id)
      FROM public.payments p
      WHERE p.tenant_id = l.tenant_id
        AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
      ORDER BY p.paid_at ASC, p.created_at ASC;
      CONTINUE;
    END IF;

    total_amt := l.monthly_rent + l.water_charge + l.garbage_charge + l.parking_charge + l.service_charge;

    INSERT INTO public.invoices (
      invoice_number, lease_id, period_start, period_end, due_date,
      subtotal, total, amount_paid, status, created_by
    ) VALUES (
      public.next_invoice_number(), l.id, period_s, period_e, due_d,
      total_amt, total_amt, 0,
      CASE WHEN due_d + grace_days < today THEN 'overdue'::invoice_status ELSE 'unpaid'::invoice_status END,
      l.created_by
    ) RETURNING id INTO inv_id;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount)
    VALUES (inv_id, 'Monthly rent', 1, l.monthly_rent, l.monthly_rent);

    IF l.water_charge   > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Water', 1, l.water_charge, l.water_charge); END IF;
    IF l.garbage_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Garbage', 1, l.garbage_charge, l.garbage_charge); END IF;
    IF l.parking_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Parking', 1, l.parking_charge, l.parking_charge); END IF;
    IF l.service_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Service', 1, l.service_charge, l.service_charge); END IF;

    -- If payment was recorded before invoice generation, allocate it immediately.
    PERFORM public.allocate_payment(p.id)
    FROM public.payments p
    WHERE p.tenant_id = l.tenant_id
      AND p.amount > COALESCE((SELECT SUM(pa.amount) FROM public.payment_allocations pa WHERE pa.payment_id = p.id), 0)
    ORDER BY p.paid_at ASC, p.created_at ASC;

    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END
$function$;

-- Re-sync statuses for existing invoices based on existing payment allocations
UPDATE public.invoices i
SET
  amount_paid = COALESCE(pa.paid, 0),
  status = CASE
    WHEN COALESCE(pa.paid, 0) >= i.total AND i.total > 0 THEN 'paid'::invoice_status
    WHEN COALESCE(pa.paid, 0) > 0 THEN 'partial'::invoice_status
    WHEN i.due_date + COALESCE((SELECT overdue_grace_days FROM public.app_settings LIMIT 1), 0) < CURRENT_DATE THEN 'overdue'::invoice_status
    ELSE 'unpaid'::invoice_status
  END
FROM (
  SELECT invoice_id, SUM(amount) AS paid
  FROM public.payment_allocations
  GROUP BY invoice_id
) pa
WHERE i.id = pa.invoice_id;

UPDATE public.invoices i
SET
  amount_paid = 0,
  status = CASE
    WHEN i.due_date + COALESCE((SELECT overdue_grace_days FROM public.app_settings LIMIT 1), 0) < CURRENT_DATE THEN 'overdue'::invoice_status
    ELSE 'unpaid'::invoice_status
  END
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_allocations pa WHERE pa.invoice_id = i.id
)
AND i.status <> 'void';