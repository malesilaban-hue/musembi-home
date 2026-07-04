
-- ============ ENUMS ============
CREATE TYPE public.lease_status AS ENUM ('active','pending','ended','terminated');
CREATE TYPE public.invoice_status AS ENUM ('unpaid','partial','paid','overdue','void');
CREATE TYPE public.payment_method AS ENUM ('cash','cheque','bank_transfer','mpesa','other');
CREATE TYPE public.tenant_doc_type AS ENUM ('national_id','kra_pin','passport','lease_contract','other');

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  national_id TEXT,
  kra_pin TEXT,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  emergency_name TEXT,
  emergency_phone TEXT,
  emergency_relation TEXT,
  occupation TEXT,
  employer TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage tenants" ON public.tenants FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads self" ON public.tenants FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TENANT DOCUMENTS ============
CREATE TABLE public.tenant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type public.tenant_doc_type NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_documents TO authenticated;
GRANT ALL ON public.tenant_documents TO service_role;
ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage tenant docs" ON public.tenant_documents FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own docs" ON public.tenant_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid()));

-- ============ LEASES ============
CREATE TABLE public.leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_rent NUMERIC(12,2) NOT NULL,
  deposit NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  garbage_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  parking_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_day SMALLINT NOT NULL DEFAULT 1,
  status public.lease_status NOT NULL DEFAULT 'active',
  qr_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16),'hex') UNIQUE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leases TO authenticated;
GRANT ALL ON public.leases TO service_role;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage leases" ON public.leases FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own leases" ON public.leases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid()));

CREATE INDEX idx_leases_tenant ON public.leases(tenant_id);
CREATE INDEX idx_leases_unit ON public.leases(unit_id);
CREATE TRIGGER trg_leases_updated BEFORE UPDATE ON public.leases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage invoices" ON public.invoices FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own invoices" ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.tenants t ON t.id=l.tenant_id WHERE l.id = lease_id AND t.user_id = auth.uid()));

CREATE INDEX idx_invoices_lease ON public.invoices(lease_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INVOICE ITEMS ============
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage invoice items" ON public.invoice_items FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own invoice items" ON public.invoice_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.leases l ON l.id=i.lease_id JOIN public.tenants t ON t.id=l.tenant_id WHERE i.id = invoice_id AND t.user_id = auth.uid()));

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  lease_id UUID REFERENCES public.leases(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage payments" ON public.payments FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own payments" ON public.payments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid()));

CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX idx_payments_lease ON public.payments(lease_id);
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENT ALLOCATIONS ============
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage allocations" ON public.payment_allocations FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own allocations" ON public.payment_allocations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.payments p JOIN public.tenants t ON t.id=p.tenant_id WHERE p.id = payment_id AND t.user_id = auth.uid()));

-- ============ INVOICE PAID AUTO-UPDATE ============
CREATE OR REPLACE FUNCTION public.recompute_invoice_paid()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE inv_id UUID; paid NUMERIC(12,2); tot NUMERIC(12,2);
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO paid FROM public.payment_allocations WHERE invoice_id = inv_id;
  SELECT total INTO tot FROM public.invoices WHERE id = inv_id;
  UPDATE public.invoices SET
    amount_paid = paid,
    status = CASE
      WHEN paid >= tot AND tot > 0 THEN 'paid'::invoice_status
      WHEN paid > 0 THEN 'partial'::invoice_status
      WHEN due_date < CURRENT_DATE THEN 'overdue'::invoice_status
      ELSE 'unpaid'::invoice_status END
  WHERE id = inv_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_alloc_recompute AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.recompute_invoice_paid();

-- ============ INVOICE NUMBER + RECEIPT NUMBER SEQUENCES ============
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS public.receipt_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT LANGUAGE sql SET search_path = public AS $$
  SELECT 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 5, '0');
$$;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS TEXT LANGUAGE sql SET search_path = public AS $$
  SELECT 'RCP-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO authenticated;

-- ============ STORAGE POLICIES for tenant-documents bucket ============
CREATE POLICY "staff read tenant docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tenant-documents' AND public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "staff upload tenant docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-documents' AND public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "staff update tenant docs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tenant-documents' AND public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "staff delete tenant docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tenant-documents' AND public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "tenant reads own docs storage" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tenant-documents' AND
  EXISTS (
    SELECT 1 FROM public.tenant_documents td
    JOIN public.tenants t ON t.id = td.tenant_id
    WHERE td.storage_path = storage.objects.name AND t.user_id = auth.uid()
  )
);
