# Deployment Steps

## Pre-Deployment

1. **Backup your database** (recommended)
   ```bash
   # In Supabase dashboard, go to Project Settings > Backups
   # Create a backup before running migration
   ```

## Step 1: Run Database Migration

### Via Supabase Dashboard (Easiest)
1. Go to Supabase Dashboard → SQL Editor
2. Open the migration file: `supabase/migrations/20260705_update_schema.sql`
3. Copy all SQL content
4. Paste into SQL Editor
5. Click "Run"

### Via Supabase CLI
```bash
cd /home/laban/Music/musembi-home
supabase migration up
```

**Expected Output:**
- Two new ENUMs created: `unit_type`, `floor_level`
- Units table updated with new columns
- Tenants table columns removed
- Maintenance table created
- Policies and indexes configured

## Step 2: Verify Migration

Run these queries in Supabase SQL Editor to confirm:

```sql
-- Check new unit fields
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'units' 
ORDER BY column_name;

-- Check enums
SELECT * FROM pg_enum 
WHERE enumname IN ('unit_type', 'floor_level');

-- Check maintenance table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'maintenance' 
ORDER BY column_name;
```

## Step 3: Review Existing Data

### Check Units
```sql
SELECT id, house_number, unit_type, floor_level, status 
FROM units 
LIMIT 10;
```
- Verify all units have unit_type and floor_level populated
- floor_level should match original floor numbers (0→ground, 1→first, etc.)

### Check Tenants
```sql
SELECT id, full_name, phone, national_id, occupation 
FROM tenants 
LIMIT 10;
```
- Verify no null important fields
- Old employer/kra_pin/notes data is now gone

## Step 4: Deploy Frontend

1. **Install dependencies** (if needed)
   ```bash
   cd /home/laban/Music/musembi-home
   bun install  # or npm install / yarn install
   ```

2. **Build**
   ```bash
   bun run build  # or npm run build
   ```

3. **Push to Git** (respecting Lovable integration)
   ```bash
   git add .
   git commit -m "feat: Add unit types, maintenance tracking, role-based dashboards"
   git push -u origin feature/unit-types-maintenance  # New branch
   ```

4. **Create Pull Request** (if using GitHub)
   ```bash
   gh pr create --title "Add unit types and maintenance system" \
     --body "- Replace bedrooms/bathrooms with unit types
   - Add unit floor levels
   - Implement maintenance tracking
   - Add role-based dashboards
   - Simplify tenant KYC form"
   ```

## Step 5: Testing Checklist

### Tenant Management
- [ ] Create new tenant (no KRA PIN, Employer, or Notes fields visible)
- [ ] Edit existing tenant
- [ ] Search tenants works

### Unit Management
- [ ] Create new unit with unit_type dropdown
- [ ] Create new unit with floor_level dropdown
- [ ] Edit existing unit shows new fields
- [ ] Unit list displays type and floor

### Lease Management
- [ ] Create lease - only VACANT units shown
- [ ] Occupied units not in dropdown
- [ ] Can select vacant unit and assign tenant
- [ ] Unit status updates to "occupied"

### Maintenance
- [ ] Navigate to Maintenance page
- [ ] Create new maintenance request
- [ ] Filter by status (Pending, In Progress, etc.)
- [ ] View cost summaries
- [ ] See priority badges

### Dashboard
- [ ] **As Tenant:** See only rent, lease count, total paid
- [ ] **As Staff:** See full property overview
- [ ] No permission errors

## Rollback Plan

If issues occur, you can rollback:

### Database Rollback (in Supabase Dashboard)
1. Go to Project Settings → Backups
2. Restore from pre-migration backup
3. All schema changes will be reverted

### Frontend Rollback
```bash
git revert <commit-hash>  # Revert the deployment commit
git push
```

## Post-Deployment

1. **Monitor for errors** - Check browser console and server logs
2. **Get user feedback** - Have team test new unit selection experience
3. **Verify data integrity** - Spot check some units and leases
4. **Update documentation** - Update any internal docs about unit types/floors

## Common Issues & Fixes

### "Maintenance page not found"
- Clear browser cache (Ctrl+Shift+Del or Cmd+Shift+Delete)
- Hard refresh page (Ctrl+F5)

### "Unit type dropdown empty"
- Verify migration ran successfully
- Check browser console for errors
- Ensure you're looking at a property with units

### "Can't assign tenant to unit"
- Verify unit status is "vacant"
- Check that unit has both unit_type and floor_level set
- Try creating a new vacant unit

### "Tenant form still shows old fields"
- Clear browser cache
- Hard refresh
- Check network tab to ensure updated files loaded

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check Supabase SQL Editor for any failed queries
3. Review the migration SQL in `supabase/migrations/20260705_update_schema.sql`
4. Check the IMPLEMENTATION_SUMMARY.md for detailed changes

---

**Ready to deploy?** Start with Step 1: Run Database Migration
