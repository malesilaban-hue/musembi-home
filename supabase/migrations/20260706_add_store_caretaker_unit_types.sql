-- Add store and caretaker_unit to unit_type enum
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'store';
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'caretaker_unit';
