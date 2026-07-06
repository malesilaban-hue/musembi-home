# Database Migration Guide

## Migration File
**Location:** `supabase/migrations/20260705_update_schema.sql`

## Changes Made

### 1. Units Table
- **Added:** `unit_type` enum (single_room, bedsitter, double_room)
- **Added:** `floor_level` enum (ground, first, second, third, fourth)
- **Removed:** `bedrooms` column
- **Removed:** `bathrooms` column
- **Migration:** Existing floor data (0-4) mapped to floor_level; all units default to 'single_room' type

### 2. Tenants Table
- **Removed:** `notes` column
- **Removed:** `employer` column
- **Removed:** `kra_pin` column
- **Kept:** full_name, phone, alt_phone, email, national_id, emergency contact info, occupation

### 3. New Maintenance Table
- **Tracks:** maintenance requests/work orders
- **Fields:** 
  - title, description
  - estimated_cost, actual_cost
  - status (pending, in_progress, completed, cancelled)
  - priority (low, medium, high, urgent)
  - reported_by, assigned_to user references
  - reported_date, completion_date
- **Access:** Staff (super_admin, landlord, accountant, caretaker) can manage all; technicians, reporters, and assignees can read own records

### 4. Leases Table
- **No schema changes** - use existing `start_date` for payment history calculations

## How to Run

1. **Using Supabase CLI:**
   ```bash
   supabase migration up
   ```

2. **Manual in Supabase Dashboard:**
   - Go to SQL Editor
   - Copy the entire content of `supabase/migrations/20260705_update_schema.sql`
   - Paste and execute

## Verification

After migration, verify:
```sql
-- Check units table structure
\d public.units

-- Check enums
SELECT * FROM pg_enum WHERE enumname IN ('unit_type', 'floor_level');

-- Check tenants removed columns
\d public.tenants

-- Check maintenance table exists
\d public.maintenance
```

## What Happens Next

The frontend code needs updates to:
1. **Properties/Units pages** - Update unit creation/edit forms to use dropdowns for unit_type and floor_level
2. **Tenants pages** - Remove form fields for notes, employer, kra_pin
3. **Leases pages** - Add unit search/filter dropdown that shows only unoccupied units
4. **Dashboard** - Add tenant-specific view (restrict non-staff from seeing overall stats)
5. **New Maintenance page** - Create caretaker-accessible page to track maintenance costs

## Data Preservation

- No existing lease, tenant, or payment data is affected
- Unit rent/charges remain unchanged
- Only unit type/floor and tenant KYC fields updated
