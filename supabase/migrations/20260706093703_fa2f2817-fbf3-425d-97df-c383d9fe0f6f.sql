
-- Property theme
DO $$ BEGIN
  CREATE TYPE public.property_theme AS ENUM ('default','orange','green','blue','purple');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS theme public.property_theme NOT NULL DEFAULT 'default';

-- App settings (singleton)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  overdue_grace_days smallint NOT NULL DEFAULT 5,
  default_due_day smallint NOT NULL DEFAULT 5,
  business_name text,
  business_kra_pin text,
  business_address text,
  business_phone text,
  business_email text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id)
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_read ON public.app_settings;
CREATE POLICY settings_read ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS settings_admin_write ON public.app_settings;
CREATE POLICY settings_admin_write ON public.app_settings FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]));
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Caretaker → property assignments
CREATE TABLE IF NOT EXISTS public.caretaker_properties (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);
GRANT SELECT, INSERT, DELETE ON public.caretaker_properties TO authenticated;
GRANT ALL ON public.caretaker_properties TO service_role;
ALTER TABLE public.caretaker_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cp_admin_all ON public.caretaker_properties;
CREATE POLICY cp_admin_all ON public.caretaker_properties FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]));
DROP POLICY IF EXISTS cp_self_read ON public.caretaker_properties;
CREATE POLICY cp_self_read ON public.caretaker_properties FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Helper: property access for staff
CREATE OR REPLACE FUNCTION public.can_access_property(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT has_role(auth.uid(),'super_admin'::app_role)
    OR EXISTS(SELECT 1 FROM public.properties WHERE id=_pid AND owner_id=auth.uid())
    OR current_user_has_any_role(ARRAY['accountant'::app_role,'technician'::app_role,'security'::app_role])
    OR EXISTS(SELECT 1 FROM public.caretaker_properties WHERE property_id=_pid AND user_id=auth.uid())
$$;

-- Scoped RLS: caretakers limited to assigned properties
DROP POLICY IF EXISTS properties_staff_read ON public.properties;
CREATE POLICY properties_staff_read ON public.properties FOR SELECT TO authenticated
  USING (
    current_user_has_any_role(ARRAY['accountant'::app_role,'technician'::app_role,'security'::app_role])
    OR (current_user_has_any_role(ARRAY['caretaker'::app_role])
        AND EXISTS(SELECT 1 FROM public.caretaker_properties cp WHERE cp.property_id = properties.id AND cp.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS units_via_property ON public.units;
CREATE POLICY units_via_property ON public.units FOR ALL TO authenticated
  USING (public.can_access_property(property_id))
  WITH CHECK (public.can_access_property(property_id));

DROP POLICY IF EXISTS "staff manage tenants" ON public.tenants;
CREATE POLICY tenants_staff_manage ON public.tenants FOR ALL TO authenticated
  USING (
    current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role])
    OR (current_user_has_any_role(ARRAY['caretaker'::app_role])
        AND (created_by = auth.uid()
             OR EXISTS(
               SELECT 1 FROM public.leases l
               JOIN public.units u ON u.id = l.unit_id
               JOIN public.caretaker_properties cp ON cp.property_id = u.property_id
               WHERE l.tenant_id = tenants.id AND cp.user_id = auth.uid()
             )))
  )
  WITH CHECK (
    current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role,'caretaker'::app_role])
  );

DROP POLICY IF EXISTS "staff manage leases" ON public.leases;
CREATE POLICY leases_staff_manage ON public.leases FOR ALL TO authenticated
  USING (
    current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role])
    OR (current_user_has_any_role(ARRAY['caretaker'::app_role])
        AND EXISTS(SELECT 1 FROM public.units u JOIN public.caretaker_properties cp ON cp.property_id=u.property_id WHERE u.id=leases.unit_id AND cp.user_id=auth.uid()))
  )
  WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role,'caretaker'::app_role]));

DROP POLICY IF EXISTS "staff manage invoices" ON public.invoices;
CREATE POLICY invoices_staff_manage ON public.invoices FOR ALL TO authenticated
  USING (
    current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role])
    OR (current_user_has_any_role(ARRAY['caretaker'::app_role])
        AND EXISTS(SELECT 1 FROM public.leases l JOIN public.units u ON u.id=l.unit_id JOIN public.caretaker_properties cp ON cp.property_id=u.property_id WHERE l.id=invoices.lease_id AND cp.user_id=auth.uid()))
  )
  WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role,'caretaker'::app_role]));

DROP POLICY IF EXISTS "staff manage payments" ON public.payments;
CREATE POLICY payments_staff_manage ON public.payments FOR ALL TO authenticated
  USING (
    current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role])
    OR (current_user_has_any_role(ARRAY['caretaker'::app_role])
        AND EXISTS(SELECT 1 FROM public.tenants t JOIN public.leases l ON l.tenant_id=t.id JOIN public.units u ON u.id=l.unit_id JOIN public.caretaker_properties cp ON cp.property_id=u.property_id WHERE t.id=payments.tenant_id AND cp.user_id=auth.uid()))
  )
  WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role,'accountant'::app_role,'caretaker'::app_role]));

-- Admin visibility of all users for Team page
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]));

DROP POLICY IF EXISTS roles_self_read ON public.user_roles;
CREATE POLICY roles_self_read ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]));

DROP POLICY IF EXISTS roles_admin_write ON public.user_roles;
CREATE POLICY roles_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['super_admin'::app_role,'landlord'::app_role]));

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leases;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.units;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
