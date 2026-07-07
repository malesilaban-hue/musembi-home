
-- =========================================================
-- 1. Auto invoice generation RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_due_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  l RECORD;
  due_day INT;
  today DATE := CURRENT_DATE;
  period_s DATE;
  period_e DATE;
  due_d DATE;
  inv_id UUID;
  total_amt NUMERIC(12,2);
  created_count INT := 0;
BEGIN
  SELECT default_due_day INTO due_day FROM public.app_settings LIMIT 1;
  IF due_day IS NULL THEN due_day := 5; END IF;

  -- Only run once we've reached the due day this month
  IF EXTRACT(DAY FROM today)::INT < due_day THEN
    RETURN 0;
  END IF;

  period_s := date_trunc('month', today)::date;
  period_e := (date_trunc('month', today) + interval '1 month - 1 day')::date;
  due_d := (date_trunc('month', today) + make_interval(days => due_day - 1))::date;

  FOR l IN
    SELECT id, monthly_rent, COALESCE(water_charge,0) AS water_charge,
           COALESCE(garbage_charge,0) AS garbage_charge,
           COALESCE(parking_charge,0) AS parking_charge,
           COALESCE(service_charge,0) AS service_charge,
           created_by
    FROM public.leases
    WHERE status = 'active'
  LOOP
    -- skip if already exists for this period
    IF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE lease_id = l.id AND period_start = period_s
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

GRANT EXECUTE ON FUNCTION public.generate_due_invoices() TO authenticated;

-- =========================================================
-- 2. Auto payment allocation trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.auto_allocate_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining NUMERIC(12,2);
  inv RECORD;
  apply_amt NUMERIC(12,2);
BEGIN
  remaining := NEW.amount;

  -- iterate oldest unpaid/partial invoices for this tenant
  FOR inv IN
    SELECT i.id, i.balance
    FROM public.invoices i
    JOIN public.leases le ON le.id = i.lease_id
    WHERE le.tenant_id = NEW.tenant_id
      AND i.balance > 0
      AND i.status <> 'void'
    ORDER BY i.due_date ASC, i.created_at ASC
  LOOP
    EXIT WHEN remaining <= 0;
    apply_amt := LEAST(remaining, inv.balance);
    INSERT INTO public.payment_allocations (payment_id, invoice_id, amount)
    VALUES (NEW.id, inv.id, apply_amt);
    remaining := remaining - apply_amt;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_allocate_payment ON public.payments;
CREATE TRIGGER trg_auto_allocate_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_allocate_payment();

-- Make sure invoice recompute trigger exists on payment_allocations
DROP TRIGGER IF EXISTS trg_recompute_invoice_paid ON public.payment_allocations;
CREATE TRIGGER trg_recompute_invoice_paid
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_paid();

-- =========================================================
-- 3. Chat messages table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_pair ON public.chat_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON public.chat_messages(recipient_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own chat threads"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users send messages as themselves"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients mark messages read"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Senders delete own messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Allow authenticated users to list profiles for chat directory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='Authenticated can list profiles for chat'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated can list profiles for chat" ON public.profiles FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

GRANT SELECT ON public.profiles TO authenticated;
