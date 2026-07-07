# Database Setup Instructions

The error "relation public.invoices does not exist" means your Supabase database hasn't been initialized with the schema.

## Steps to Set Up:

### 1. First Time Setup - Run All Migrations

Go to your **Supabase Dashboard** → **SQL Editor** → **New Query**

Copy and paste **ALL** migration files in order:
1. `supabase/migrations/20260704133233_ba8c88ea-6d35-4da7-ab85-c488c97c8b21.sql`
2. `supabase/migrations/20260704133245_cd2ef4f6-7025-4346-9df0-7cbbd17ce4ae.sql`
3. `supabase/migrations/20260704133259_b2e9abb8-e9b0-4bd6-b9d4-68f22b225677.sql`
4. `supabase/migrations/20260704134426_dddbe04d-3bc7-4575-8b66-664dae036126.sql` (creates invoices table)
5. `supabase/migrations/20260705_update_schema.sql`
6. `supabase/migrations/20260706093703_fa2f2817-fbf3-425d-97df-c383d9fe0f6f.sql`
7. `supabase/migrations/20260706_fix_rls_policies.sql`
8. `supabase/migrations/20260706_add_store_caretaker_unit_types.sql`

### 2. Then Run the Invoice Generation Setup

Copy and paste `RUN_IN_SUPABASE_FIRST.sql` to create the invoice generation function.

### 3. Test Invoice Generation

In Supabase SQL Editor, run:
```sql
SELECT * FROM public.generate_monthly_invoices();
```

This will generate invoices for all active leases with due date set to the 5th of each month (or your custom default_due_day setting).

## What Gets Created:

- ✅ All tables (properties, units, leases, invoices, payments, etc.)
- ✅ User roles and permissions
- ✅ RLS (Row Level Security) policies
- ✅ Invoice generation function
- ✅ Store and caretaker_unit types

## After Setup:

1. Your app will work and show all data
2. Click "Generate Invoices" button on Dashboard to create invoices
3. Invoices will be created for all months since lease start date until today
4. Outstanding balance will show on Dashboard and Invoices page

## Notes:

- Due date is always the 5th of the month (changeable in app_settings)
- Invoices are marked 'unpaid' until payment is recorded
- Once a payment is made, invoice balance updates automatically
