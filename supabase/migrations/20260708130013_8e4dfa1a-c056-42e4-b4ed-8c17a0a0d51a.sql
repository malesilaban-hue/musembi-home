
-- Dedupe current-month invoices and add a robust "generate for this month" RPC
-- 1) Remove duplicate invoices for the current month per lease, keeping the oldest
WITH dupes AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY lease_id, date_trunc('month', period_start)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.invoices
  WHERE date_trunc('month', period_start) = date_trunc('month', CURRENT_DATE)
)
DELETE FROM public.invoices WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- 2) Recompute status for surviving current-month invoices (in case totals changed)
UPDATE public.invoices i SET
  status = CASE
    WHEN i.amount_paid >= i.total AND i.total > 0 THEN 'paid'::invoice_status
    WHEN i.amount_paid > 0 THEN 'partial'::invoice_status
    WHEN i.due_date < CURRENT_DATE THEN 'overdue'::invoice_status
    ELSE 'unpaid'::invoice_status END
WHERE date_trunc('month', i.period_start) = date_trunc('month', CURRENT_DATE);

-- 3) New RPC: always generate current-month invoices for ALL active leases,
--    skipping any lease that already has an invoice for this month (idempotent).
CREATE OR REPLACE FUNCTION public.generate_current_month_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  SELECT default_due_day INTO due_day FROM public.app_settings LIMIT 1;
  IF due_day IS NULL THEN due_day := 5; END IF;
  due_d := (date_trunc('month', today) + make_interval(days => due_day - 1))::date;

  FOR l IN
    SELECT id, monthly_rent,
           COALESCE(water_charge,0) AS water_charge,
           COALESCE(garbage_charge,0) AS garbage_charge,
           COALESCE(parking_charge,0) AS parking_charge,
           COALESCE(service_charge,0) AS service_charge,
           created_by
    FROM public.leases
    WHERE status = 'active'
  LOOP
    -- Skip if ANY invoice already exists for this lease in the current month
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE lease_id = l.id
        AND date_trunc('month', period_start) = date_trunc('month', today)
    ) THEN CONTINUE; END IF;

    total_amt := l.monthly_rent + l.water_charge + l.garbage_charge + l.parking_charge + l.service_charge;

    INSERT INTO public.invoices (
      invoice_number, lease_id, period_start, period_end, due_date,
      subtotal, total, amount_paid, balance, status, created_by
    ) VALUES (
      public.next_invoice_number(), l.id, period_s, period_e, due_d,
      total_amt, total_amt, 0, total_amt,
      CASE WHEN due_d < today THEN 'overdue'::invoice_status ELSE 'unpaid'::invoice_status END,
      l.created_by
    ) RETURNING id INTO inv_id;

    INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount)
    VALUES (inv_id, 'Monthly rent', 1, l.monthly_rent, l.monthly_rent);
    IF l.water_charge   > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Water', 1, l.water_charge, l.water_charge); END IF;
    IF l.garbage_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Garbage', 1, l.garbage_charge, l.garbage_charge); END IF;
    IF l.parking_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Parking', 1, l.parking_charge, l.parking_charge); END IF;
    IF l.service_charge > 0 THEN INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (inv_id, 'Service', 1, l.service_charge, l.service_charge); END IF;

    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_current_month_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_current_month_invoices() TO service_role;

-- 4) One-off admin helper: remove duplicate current-month invoices on demand.
CREATE OR REPLACE FUNCTION public.dedupe_current_month_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE removed INT;
BEGIN
  WITH dupes AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY lease_id, date_trunc('month', period_start)
      ORDER BY created_at ASC, id ASC
    ) AS rn
    FROM public.invoices
    WHERE date_trunc('month', period_start) = date_trunc('month', CURRENT_DATE)
  ), del AS (
    DELETE FROM public.invoices WHERE id IN (SELECT id FROM dupes WHERE rn > 1) RETURNING 1
  )
  SELECT COUNT(*) INTO removed FROM del;
  RETURN removed;
END $$;

GRANT EXECUTE ON FUNCTION public.dedupe_current_month_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dedupe_current_month_invoices() TO service_role;
