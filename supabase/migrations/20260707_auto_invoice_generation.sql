-- Automatic Invoice Generation System
-- Generates invoices for active leases on their billing day

-- Create function to generate monthly invoices for active leases
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices()
RETURNS TABLE(invoice_id uuid, lease_id uuid, invoice_number text, status text) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_billing_day SMALLINT;
  v_month_start DATE;
  v_month_end DATE;
  v_due_date DATE;
  v_lease RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_subtotal NUMERIC;
  v_total NUMERIC;
  v_next_billing_date DATE;
BEGIN
  -- Loop through all active leases
  FOR v_lease IN 
    SELECT 
      l.id,
      l.tenant_id,
      l.unit_id,
      l.billing_day,
      l.monthly_rent,
      l.water_charge,
      l.garbage_charge,
      l.parking_charge,
      l.service_charge,
      l.created_by,
      COALESCE(
        (SELECT period_end FROM public.invoices WHERE lease_id = l.id ORDER BY period_end DESC LIMIT 1),
        l.start_date
      ) as last_period_end
    FROM public.leases l
    WHERE l.status = 'active'
      AND (l.end_date IS NULL OR l.end_date >= v_today)
  LOOP
    -- Calculate billing dates
    v_billing_day := v_lease.billing_day;
    v_month_start := (v_lease.last_period_end + INTERVAL '1 day')::date;
    v_month_end := DATE_TRUNC('month', v_month_start + INTERVAL '1 month')::date - INTERVAL '1 day';
    
    -- Set due date to billing day of next month
    v_due_date := (DATE_TRUNC('month', v_month_end + INTERVAL '1 month') + 
                   (v_billing_day - 1) * INTERVAL '1 day')::date;
    IF v_due_date < v_month_end THEN
      v_due_date := DATE_TRUNC('month', v_month_end + INTERVAL '1 month')::date + 
                    (v_billing_day - 1) * INTERVAL '1 day';
    END IF;
    
    -- Calculate totals
    v_subtotal := v_lease.monthly_rent + v_lease.water_charge + v_lease.garbage_charge + 
                  v_lease.parking_charge + v_lease.service_charge;
    v_total := v_subtotal;
    
    -- Generate invoice number (format: INV-YYYYMM-LEASEID)
    v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || 
                        SUBSTRING(v_lease.id::text, 1, 8);
    
    -- Check if invoice already exists for this lease and period
    IF NOT EXISTS(
      SELECT 1 FROM public.invoices 
      WHERE lease_id = v_lease.id 
        AND period_start = v_month_start 
        AND period_end = v_month_end
    ) THEN
      -- Insert invoice
      INSERT INTO public.invoices (
        invoice_number,
        lease_id,
        period_start,
        period_end,
        due_date,
        subtotal,
        total,
        status,
        created_by
      ) VALUES (
        v_invoice_number,
        v_lease.id,
        v_month_start,
        v_month_end,
        v_due_date,
        v_subtotal,
        v_total,
        'unpaid',
        v_lease.created_by
      ) RETURNING public.invoices.id INTO v_invoice_id;
      
      RETURN QUERY SELECT 
        v_invoice_id,
        v_lease.id,
        v_invoice_number,
        'created'::text;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices() TO service_role;

-- Create index to improve invoice lookup performance
CREATE INDEX IF NOT EXISTS idx_invoices_lease_period 
  ON public.invoices(lease_id, period_start, period_end);

-- Create index for unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid 
  ON public.invoices(status, due_date) 
  WHERE status = 'unpaid';

-- Create index for payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_tenant 
  ON public.payments(tenant_id, created_at);

-- Note: To run this daily, you'll need to either:
-- 1. Use a backend service with a cron job to call: SELECT public.generate_monthly_invoices()
-- 2. Or manually trigger it from your application on the first of each month
-- 3. Or set up a pg_cron extension if your Supabase plan supports it

-- For now, you can manually run this query daily/weekly from your app:
-- SELECT public.generate_monthly_invoices();
