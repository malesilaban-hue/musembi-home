# Quick Reference - What Changed

## For End Users

### Units Now Have...
**Before:** Bedrooms (0-5), Bathrooms (0-3), Floor (number)
**Now:** 
- **Unit Type:** Single Room, Bedsitter, Double Room
- **Floor Level:** Ground Floor, 1st Floor, 2nd Floor, 3rd Floor, 4th Floor

Example: "Bedsitter on 1st Floor" instead of "1 bedroom, 1 bathroom, floor 1"

### Tenant Registration Form
**Removed Fields:**
- ❌ KRA PIN
- ❌ Employer
- ❌ Notes

**Still Here:**
- ✅ Full name, Phone, Email, National ID
- ✅ Emergency contact info
- ✅ Occupation

### Creating a Lease
**What's New:** Only **vacant units** appear in the dropdown
- Occupied units won't show
- Reserved/Maintenance units won't show
- Only units ready to rent appear

### Maintenance Page
**New Page** → Navigate from sidebar to "Maintenance"
- Create maintenance requests
- Track estimated vs actual costs
- Filter by status (Pending, In Progress, Completed, Cancelled)
- Assign to properties and units

### Your Dashboard (if you're a Tenant)
**Before:** Saw full property stats (confusing!)
**Now:** See only YOUR info:
- Your monthly rent
- Your active lease
- Your total paid

### Staff Dashboard (if you're admin/landlord/caretaker)
**No change** - Still shows full overview

## For Developers

### Database Changes
```sql
-- New types
CREATE TYPE unit_type AS ENUM ('single_room', 'bedsitter', 'double_room');
CREATE TYPE floor_level AS ENUM ('ground', 'first', 'second', 'third', 'fourth');

-- Units table
-- REMOVED: bedrooms, bathrooms
-- ADDED: unit_type, floor_level

-- Tenants table
-- REMOVED: notes, employer, kra_pin

-- NEW TABLE: maintenance
-- Tracks maintenance requests, costs, status
```

### API Changes

#### Units Query
```typescript
// OLD
supabase.from("units").select("id,bedrooms,bathrooms,floor")

// NEW
supabase.from("units").select("id,unit_type,floor_level")
```

#### Leases Query (Units Dropdown)
```typescript
// OLD - showed all units
supabase.from("units").select("*")

// NEW - shows only vacant units
supabase.from("units").select("*").eq("status", "vacant")
```

#### Tenant Registration
```typescript
// OLD
{
  full_name: "John",
  phone: "+254...",
  kra_pin: "A001234567B",    // REMOVED
  employer: "Acme Corp",       // REMOVED
  notes: "..."                 // REMOVED
}

// NEW
{
  full_name: "John",
  phone: "+254...",
  national_id: "12345678",    // KEPT
  occupation: "Engineer"      // KEPT
}
```

### Components Updated
- `Tenants.tsx` - Removed form fields
- `PropertyDetail.tsx` - Added unit_type and floor_level dropdowns
- `Leases.tsx` - Added unit filtering
- `Dashboard.tsx` - Added role-based views
- `Maintenance.tsx` - New page
- `SideNav.tsx` - Added maintenance link
- `App.tsx` - Added maintenance route

### Pages Modified
- `/properties/:id` - Unit creation uses new types
- `/tenants` - Simplified form
- `/leases` - Only vacant units shown
- `/maintenance` - New page
- `/dashboard` - Different views for tenants vs staff

## File Locations

### Migration
```
supabase/migrations/20260705_update_schema.sql
```

### New Files
```
src/pages/Maintenance.tsx          # New maintenance page
MIGRATION_GUIDE.md                 # How to run migration
IMPLEMENTATION_SUMMARY.md          # Detailed changes
DEPLOYMENT_STEPS.md               # Step-by-step deployment
QUICK_REFERENCE.md                # This file
```

### Modified Files
```
src/pages/Tenants.tsx              # Removed form fields
src/pages/PropertyDetail.tsx       # New dropdowns for unit type/floor
src/pages/Leases.tsx               # Unit filtering
src/pages/Dashboard.tsx            # Role-based views
src/App.tsx                        # Added route
src/components/layout/SideNav.tsx  # Added nav link
```

## Deployment Order

1. ✅ Run SQL migration
2. ✅ Verify database changes
3. ✅ Deploy frontend code
4. ✅ Test each feature
5. ✅ Monitor for errors

## Rollback

**Database:** Restore from backup in Supabase dashboard
**Frontend:** `git revert <commit-hash>`

## Test Cases

| Feature | Test | Expected Result |
|---------|------|-----------------|
| New Unit | Create unit with Bedsitter + 1st Floor | Unit saved with correct type/floor |
| Lease | Try to assign occupied unit | Only vacant units shown in dropdown |
| Tenant | Create tenant without KRA PIN | Form accepts (field removed) |
| Maintenance | Create request | Appears in maintenance list |
| Dashboard (Tenant) | Login as tenant | Only shows rent/lease info |
| Dashboard (Staff) | Login as admin | Shows full property stats |

## Common Questions

**Q: What happened to my unit bedrooms/bathrooms data?**
A: It's been replaced with unit_type and floor_level. Old data is not migrated. You may need to update existing units.

**Q: Can tenants still see their payments?**
A: Yes! Tenants can view their own payments in the Payments page. Dashboard just shows summary.

**Q: Can I still have occupied units?**
A: Yes, but they won't appear in the lease creation dropdown. Prevents double-booking.

**Q: Is there a maintenance API?**
A: Yes, maintenance records are in the `maintenance` table with full RLS policies for access control.

**Q: Can I rollback if issues occur?**
A: Yes, restore the pre-migration database backup in Supabase dashboard.

---

**Last Updated:** 2026-07-05
**Version:** 1.0
