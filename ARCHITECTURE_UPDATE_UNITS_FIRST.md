# Architecture Update: Units as Primary Entity

## Problem Statement
- 100 occupied units but only 26 registered tenants
- Payments and invoices couldn't be recorded without tenant information
- System design assumed every unit must have a registered tenant
- This prevented 74% of units from having billing records

## Solution: Make Units Primary, Tenants Optional

### Key Changes

#### 1. Database Schema (Migration: 20260710_make_tenant_optional_in_payments.sql)
```sql
-- Before: tenant_id UUID NOT NULL
-- After: tenant_id UUID (nullable)
```
- Changed `payments.tenant_id` from NOT NULL to nullable
- Foreign key constraint updated to `ON DELETE SET NULL`
- `leases.id` remains the primary relationship (Unit → Lease → Tenant)

#### 2. Application Logic
- **Invoices**: Already correct (linked to leases, not directly to tenants)
- **Payments**: Now accepts either:
  - Payment with `tenant_id` + `lease_id` (full data)
  - Payment with `lease_id` only (no tenant info needed)
  - Payment with `tenant_id` only (fallback for legacy data)

#### 3. Payment Recording Form
- Tenant field is now optional
- Unit number search is primary method
- Selecting a unit auto-populates tenant info IF available
- Can record payment for unit even without tenant assignment

#### 4. Data Filtering (Caretaker & Admin Views)
```
Caretakers see payments from:
1. Payments linked to their property's units (via lease_id)
2. + Fallback to payments with their tenant_id (for old records)
```

### Entity Relationships

**Old Model:**
```
Unit ← Lease → Tenant
               ↓
            Payment
            Invoice
```

**New Model:**
```
Unit ← Lease → Payment (lease_id PRIMARY, tenant_id OPTIONAL)
       ↙ ↘
   Tenant Invoice
```

### Benefits

1. **Complete Unit Coverage**: All 100 occupied units can generate invoices/payments
2. **Flexible Tenant Management**: Tenant info is optional metadata
3. **Faster Setup**: Caretakers can record payments without tenant registration overhead
4. **Progressive Tenant Entry**: Tenant info can be added later without affecting billing

### Migration Path for Existing Data

Existing payments have:
- ✓ `tenant_id` (populated)
- ✓ `lease_id` (may be null)

The system now handles both:
1. Payments with both tenant and lease info
2. Payments with only tenant info (no lease_id)
3. Payments with only lease info (no tenant_id)

### Implementation Checklist

- [x] Make tenant_id optional in payments table
- [x] Update Payments page reload to filter by lease_id first
- [x] Add fallback filtering for payments without lease_id
- [x] Make tenant_id optional in payment form schema
- [ ] Update Invoices to also support unit-only entries (if needed)
- [ ] Update Dashboard stats to work with unit-based payment data
- [ ] Add migration guide for existing installations
- [ ] Update UI labels to emphasize units over tenants

### Next Steps

1. Run migration in Supabase to apply schema changes:
   ```sql
   -- File: supabase/migrations/20260710_make_tenant_optional_in_payments.sql
   ```

2. Test payment recording flow:
   - Record payment by selecting unit (no tenant) ✓
   - Record payment by selecting tenant (auto-fills unit)
   - Verify caretaker sees payments in all views

3. Update API/RLS policies if needed to handle NULL tenant_id

4. Consider future enhancements:
   - Bulk tenant import from payment records
   - Auto-suggest tenant names based on payment history
   - Unit-level analytics independent of tenant data
