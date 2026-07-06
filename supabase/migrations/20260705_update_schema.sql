-- ============ ADD ENUMS ============
CREATE TYPE public.unit_type AS ENUM ('single_room', 'bedsitter', 'double_room');
CREATE TYPE public.floor_level AS ENUM ('ground', 'first', 'second', 'third', 'fourth', 'fifth');

-- ============ UPDATE UNITS TABLE ============
-- Add new columns
ALTER TABLE public.units
ADD COLUMN unit_type public.unit_type,
ADD COLUMN floor_level public.floor_level;

-- Migrate existing data - set defaults for existing records
UPDATE public.units
SET 
  unit_type = 'single_room',
  floor_level = CASE 
    WHEN floor = 0 THEN 'ground'::public.floor_level
    WHEN floor = 1 THEN 'first'::public.floor_level
    WHEN floor = 2 THEN 'second'::public.floor_level
    WHEN floor = 3 THEN 'third'::public.floor_level
    WHEN floor = 4 THEN 'fourth'::public.floor_level
    ELSE 'ground'::public.floor_level
  END
WHERE unit_type IS NULL;

-- Drop old columns after backup
ALTER TABLE public.units
DROP COLUMN bedrooms,
DROP COLUMN bathrooms;

-- ============ UPDATE TENANTS TABLE ============
-- Remove notes, employer, kra_pin
ALTER TABLE public.tenants
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS employer,
DROP COLUMN IF EXISTS kra_pin;

-- ============ UPDATE PAYMENTS TABLE ============
-- Add reason column (optional) for payment notes
ALTER TABLE public.payments
ADD COLUMN reason TEXT;

-- ============ MAINTENANCE TABLE ============
CREATE TABLE public.maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_cost NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  completion_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance TO authenticated;
GRANT ALL ON public.maintenance TO service_role;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage maintenance" ON public.maintenance FOR ALL TO authenticated
USING (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]))
WITH CHECK (public.current_user_has_any_role(ARRAY['super_admin','landlord','accountant','caretaker']::app_role[]));

CREATE POLICY "technician reads maintenance" ON public.maintenance FOR SELECT TO authenticated
USING (public.current_user_has_any_role(ARRAY['technician']::app_role[]) OR 
       assigned_to = auth.uid() OR 
       reported_by = auth.uid());

CREATE INDEX idx_maintenance_property ON public.maintenance(property_id);
CREATE INDEX idx_maintenance_unit ON public.maintenance(unit_id);
CREATE INDEX idx_maintenance_status ON public.maintenance(status);

CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON public.maintenance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ UPDATE LEASES TABLE INDEXES ============
-- Add index for start_date to help with payment calculations
CREATE INDEX IF NOT EXISTS idx_leases_start_date ON public.leases(start_date);

-- ============ VERIFY CHANGES ============
-- The following is informational - no action needed
-- Units table: bedrooms/bathrooms replaced with unit_type (single_room, bedsitter, double_room) and floor_level (ground-fourth)
-- Tenants table: notes, employer, kra_pin fields removed
-- New maintenance table: tracks maintenance requests, costs, and status
-- Use start_date from leases table for payment calculations
