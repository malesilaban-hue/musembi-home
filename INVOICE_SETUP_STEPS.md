# Invoice Generation Setup - Step by Step

If you're getting this error when clicking "Generate Invoices":
```
Failed to load resource: the server responded with a status of 400
Invoice generation failed: generate_monthly_invoices function not found
```

Follow these exact steps:

## STEP 1: Create the Invoice Generation Function in Supabase

1. Go to your **Supabase Project Dashboard**
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. **Delete any default text**
5. **Copy and paste THIS entire block:**

```sql
-- Create the invoice generation function
CREATE OR REPLACE FUNCTION public.generate_monthly_invoices()
RETURNS TABLE(invoice_id uuid, lease_id uuid, invoice_number text, status text) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_default_due_day SMALLINT;
  v_month_start DATE;
  v_month_end DATE;
  v_due_date DATE;
  v_lease RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_subtotal NUMERIC;
  v_total NUMERIC;
  v_last_invoice_end DATE;
BEGIN
  -- Get default due day from app settings (e.g., 5)
  SELECT default_due_day INTO v_default_due_day FROM public.app_settings LIMIT 1;
  IF v_default_due_day IS NULL THEN
    v_default_due_day := 5; -- Default to 5th if not set
  END IF;
  
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
      l.start_date,
      COALESCE(
        (SELECT period_end FROM public.invoices WHERE lease_id = l.id ORDER BY period_end DESC LIMIT 1),
        l.start_date - INTERVAL '1 day'
      ) as last_period_end
    FROM public.leases l
    WHERE l.status = 'active'
      AND (l.end_date IS NULL OR l.end_date >= v_today)
  LOOP
    v_last_invoice_end := v_lease.last_period_end;
    
    -- Generate invoices for each month from last invoice to today
    v_month_start := (v_last_invoice_end + INTERVAL '1 day')::date;
    
    -- Only generate if there's a gap
    WHILE v_month_start <= v_today LOOP
      v_month_end := DATE_TRUNC('month', v_month_start + INTERVAL '1 month')::date - INTERVAL '1 day';
      
      -- Set due date to default_due_day of the month after billing period ends
      v_due_date := DATE_TRUNC('month', v_month_end + INTERVAL '1 month')::date + 
                    (v_default_due_day - 1) * INTERVAL '1 day';
      
      -- Calculate totals
      v_subtotal := v_lease.monthly_rent + v_lease.water_charge + v_lease.garbage_charge + 
                    v_lease.parking_charge + v_lease.service_charge;
      v_total := v_subtotal;
      
      -- Generate invoice number (format: INV-YYYYMM-LEASEID)
      v_invoice_number := 'INV-' || TO_CHAR(v_month_end, 'YYYYMM') || '-' || 
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
      
      -- Move to next month
      v_month_start := (v_month_end + INTERVAL '1 day')::date;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoices() TO service_role;
```

6. Click **Run** button (or Ctrl+Enter)
7. Wait for success message

## STEP 2: Test the Function

In the same SQL Editor, run this test query:

```sql
SELECT * FROM public.generate_monthly_invoices();
```

You should see results like:
```
invoice_id | lease_id | invoice_number | status
-----------+----------+----------------+--------
uuid...    | uuid...  | INV-202407-... | created
```

If you get invoices created, you're done!

## STEP 3: Go Back to App and Click "Generate Invoices"

1. Refresh your app (Ctrl+R or Cmd+R)
2. Go to Dashboard
3. Click **Generate Invoices** button
4. You should see: "Generated X invoices"

## What This Does:

✅ Creates invoices for all active leases
✅ Sets due date to the 5th of each month (from app_settings)
✅ Generates invoices for ALL months from lease start to today
✅ Marks all invoices as 'unpaid'
✅ Calculates rent + water + garbage + parking + service charges

## If You Still Get Errors:

1. Check if `invoices` table exists - run:
   ```sql
   SELECT * FROM public.invoices LIMIT 1;
   ```
   If this fails, you need to run ALL migrations first.

2. Check if function was created:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'generate_monthly_invoices';
   ```

3. Check app_settings has default_due_day:
   ```sql
   SELECT default_due_day FROM public.app_settings;
   ```
   If empty, run:
   ```sql
   UPDATE public.app_settings SET default_due_day = 5;
   ```

## Need More Help?

- Make sure you have 16 active leases (you mentioned this)
- Each lease should have monthly_rent > 0
- Check that leases have status = 'active' and no end_date (or end_date in future)
