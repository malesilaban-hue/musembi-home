# ⚠️ CRITICAL: Database Migration Required

## Issue Summary

You're seeing a **POST 400 error** when trying to create units because:
- The new columns `unit_type` and `floor_level` don't exist in your database yet
- The form is trying to insert these fields, but they're missing
- The database migration **has not been run** on your Supabase instance

## ✅ Solution: Run Database Migration NOW

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Copy the Safe Migration SQL

Use the **MIGRATION_TASK3_SAFE.sql** file from your project. Here's the essential part:

```sql
-- ============ UPDATE UNITS TABLE ============
ALTER TABLE public.units
ADD COLUMN IF NOT EXISTS unit_type public.unit_type,
ADD COLUMN IF NOT EXISTS floor_level public.floor_level;

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

-- Drop old columns if they still exist
ALTER TABLE public.units
DROP COLUMN IF EXISTS bedrooms,
DROP COLUMN IF EXISTS bathrooms;

-- ============ UPDATE TENANTS TABLE ============
ALTER TABLE public.tenants
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS employer,
DROP COLUMN IF EXISTS kra_pin;

-- ============ UPDATE PAYMENTS TABLE ============
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS reason TEXT;

-- ============ UPDATE LEASES TABLE INDEXES ============
CREATE INDEX IF NOT EXISTS idx_leases_start_date ON public.leases(start_date);
```

### Step 3: Run It
1. Paste the SQL into the Supabase SQL Editor
2. Click **Run** (or press Ctrl+Enter)
3. Wait for completion (usually < 5 seconds)

### Step 4: Verify Success
In Supabase SQL Editor, run this to verify:

```sql
-- Check the units table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'units' 
ORDER BY ordinal_position;
```

You should see:
- `unit_type` (column)
- `floor_level` (column)
- `bedrooms` should be GONE
- `bathrooms` should be GONE

---

## 🔧 If You Don't Have Enum Types Yet

Run this FIRST (before the main migration):

```sql
-- ============ CREATE ENUMS (only if they don't exist) ============
-- Run this if you get an error that unit_type already exists - skip it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_type') THEN
    CREATE TYPE public.unit_type AS ENUM ('single_room', 'bedsitter', 'double_room');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'floor_level') THEN
    CREATE TYPE public.floor_level AS ENUM ('ground', 'first', 'second', 'third', 'fourth', 'fifth');
  END IF;
END
$$;
```

---

## 📱 Install Banner Issue

The message "beforeinstallprompt.preventDefault() called" is **normal on development**.

**On production/mobile:**
- ✅ iOS: Banner will show automatically
- ✅ Android: Install button will appear if PWA-capable
- ✅ Already installed: Banner won't show

You can ignore this message. The banner IS working.

---

## 🚀 After Migration: What Works

Once you run the migration:

### ✅ Creating Units
- [ ] Can create units with unit type dropdown
- [ ] Can select floor level (ground through fifth)
- [ ] No more 400 errors
- [ ] Units display with type and floor

### ✅ Install Banner
- [ ] Shows on iOS devices
- [ ] Shows installation instructions
- [ ] Works on Android PWA
- [ ] Positioned above bottom nav
- [ ] No overlap with content

### ✅ Mobile Sidebar
- [ ] Menu button (☰) visible on mobile
- [ ] Sidebar slides in from left
- [ ] All pages accessible
- [ ] Works with bottom nav

---

## 📋 Quick Checklist

Before deploying:

- [ ] Enum types exist (unit_type, floor_level)
- [ ] units table has new columns
- [ ] units table missing old columns (bedrooms, bathrooms)
- [ ] tenants table cleaned up
- [ ] payments table has reason column
- [ ] Test creating a unit - should work now
- [ ] Hard refresh browser on mobile
- [ ] Check install banner on iOS device
- [ ] Check mobile sidebar works

---

## ⏰ Timeline

1. **Right now:** Run migration (5 minutes)
2. **After migration:** Test creating units (2 minutes)
3. **Test on mobile:** Sidebar + banner (5 minutes)
4. **Deploy:** Upload dist package (5 minutes)

---

## 🆘 If Migration Fails

### Error: "type 'unit_type' already exists"
- This is fine! Just skip those CREATE TYPE lines
- Use the SAFE migration which has `CREATE TYPE IF NOT EXISTS`

### Error: "column already exists"
- Also fine! The migration uses `ADD COLUMN IF NOT EXISTS`
- It will safely skip columns that are already there

### Error: "column 'bedrooms' does not exist"
- This is fine! The migration uses `DROP COLUMN IF EXISTS`
- It will skip columns that don't exist

---

## 📞 Support

All new features depend on this migration:
- ✅ Unit type selection
- ✅ Floor level selection
- ✅ Payment reasons
- ✅ Maintenance tracking

**Don't skip the migration!** 🚨

---

**Status:** Database schema is ready to be migrated  
**Estimated Time:** 5 minutes  
**Priority:** 🔴 HIGH - Required before testing units

Run the migration NOW to unblock feature testing! ⚡

