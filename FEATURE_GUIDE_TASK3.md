# Feature Guide: Mobile Navigation & Team/Payment Management

## Quick Start Guide for New Features

---

## 1. Mobile Navigation

### For Mobile Users (Phones):
- **Bottom Navigation Bar** appears with 5 key functions:
  - 🏠 Home (Dashboard)
  - 🏢 Property (if you have staff role)
  - 👥 Tenants (if you have staff role)
  - 📄 Leases (if you have staff role)
  - 💰 Bills (Invoices)

### For Desktop Users:
- **Left Sidebar** shows all navigation links
- Full menu with 9 items
- Quick access to Profile, Team, Maintenance, etc.

---

## 2. Team Member Management

### Who Can Access:
- **Super Admin** ✅
- **Landlord** ✅
- Everyone else: ❌ (Access denied)

### How to Add a Team Member:

1. **Navigate to Team** → Click "Add member" button (top right)

2. **Fill the Form:**
   - **Email Address:** Team member's email (e.g., caretaker@example.com)
   - **Role:** Select from dropdown:
     - 🔹 **Caretaker:** Property management, payment recording, maintenance tracking
     - 🔹 **Accountant:** Financial management, invoices, payments
     - 🔹 **Technician:** Maintenance request handling

3. **Send Invitation:**
   - Click "Send invitation" button
   - Team member receives email to set up account
   - Role is assigned automatically upon signup

### View Team List:
- **Team & Roles** card shows all current members
- Displays: Email, User ID, and assigned role
- Read-only view (management in Phase 2)

---

## 3. Payment Recording

### Who Can Record Payments:
- **Super Admin** ✅
- **Landlord** ✅
- **Accountant** ✅
- **Caretaker** ✅
- Tenants & Technicians: ❌

### How to Record a Payment:

1. **Navigate to Payments** → Click "Record payment" button (top right)

2. **Select Tenant:**
   - Start typing tenant name
   - Dropdown shows matching tenants
   - Click to select

3. **Enter Payment Details:**
   - **Amount (KES):** Payment amount (e.g., 5000)
   - **Method:** Select payment method:
     - 💵 Cash
     - 📱 M-Pesa
     - 🏦 Bank Transfer
     - ✅ Cheque

4. **Payment Date:**
   - Default: Today's date
   - Click to change if different date

5. **Optional Fields:**
   - **Reference Number:** M-Pesa transaction ID, bank receipt, cheque number
   - **Note/Reason:** E.g., "Late payment settlement", "Partial payment", "Deposit"

6. **Record Payment:**
   - Click "Record payment" button
   - System generates receipt automatically
   - Receipt format: `RCP-YYYYMMDD-XXXXXX` (e.g., RCP-20260705-123456)

### View Payment History:

- All recorded payments shown in list
- Displays:
  - Receipt number
  - Tenant name & payment date
  - Reference number (if provided)
  - Payment reason (if provided) in italics
  - Payment method badge
  - Amount in KES

- **Search:** Filter by:
  - Receipt number
  - Tenant name
  - Reference number

- **Total Shown:** Sum of filtered payments displayed at top

---

## 4. Dashboard by Role

### Tenant Dashboard:
- 💰 Your rent amount
- 📄 Active leases count
- 💸 Total paid (calculates from payment history)

### Caretaker Dashboard:
- 🏢 Properties count (assigned properties)
- 🚪 Total units (across all properties)
- 👥 Occupied units (currently rented)
- 💰 Expected rent (from all occupied units)
- 📊 This month (current month expected rent)

### Staff/Admin Dashboard:
- 🏢 Properties
- 🚪 Total units
- 🔓 Vacant units
- 👥 Tenants count
- 📄 Active leases
- 💰 Expected rent (all units)
- 📊 This month rent
- 📋 Outstanding balance
- ⚠️ Overdue invoices

---

## 5. Database Changes (For Admins)

### New Columns Added:
1. **payments.reason** (TEXT, optional)
   - For storing payment notes
   - Displayed in payment history

2. **units.unit_type** (enum)
   - single_room
   - bedsitter
   - double_room

3. **units.floor_level** (enum)
   - ground
   - first
   - second
   - third
   - fourth
   - fifth

### Columns Removed from:
- **tenants:** notes, employer, kra_pin

### Run Migration:
```sql
-- Execute: supabase/migrations/20260705_update_schema.sql
```

---

## 6. Mobile Testing Checklist

- ✅ Bottom navigation visible on phone
- ✅ Can tap between Home, Property, Tenants, Leases, Bills
- ✅ Content doesn't overlap with bottom nav
- ✅ Forms are touch-friendly on mobile
- ✅ Tenant search autocomplete works on small screens
- ✅ Payment recording dialog fits on screen

---

## 7. Common Tasks

### Task: Add New Caretaker
1. Go to **Team & Roles**
2. Click **Add member**
3. Enter email, select "Caretaker"
4. Click **Send invitation**
5. Caretaker receives email and sets up account

### Task: Record Tenant Payment
1. Go to **Payments**
2. Click **Record payment**
3. Search and select tenant
4. Enter amount, method, date
5. Add reference if M-Pesa/bank transfer
6. (Optional) Add reason note
7. Click **Record payment**
8. Receipt prints automatically

### Task: View Payment History with Notes
1. Go to **Payments**
2. Scroll through payment list
3. Look for italic text "Note: ..." below reference
4. Search payments by tenant name or reference

### Task: Check Caretaker Performance
1. Switch role to Caretaker (if admin with multiple roles)
2. View **Dashboard**
3. See:
   - Number of properties managed
   - Total units and occupied units
   - Expected rent this month

---

## 8. Troubleshooting

### "Record Payment" Button Not Showing:
- Check your role (must be admin, accountant, or caretaker)
- Check role assignment in Team page
- Reload page to refresh permissions

### Tenant Not Appearing in Search:
- Verify tenant is created in **Tenants** page
- Try typing different part of name
- Check spelling

### Payment Recording Not Working:
- Ensure all required fields are filled:
  - ✅ Tenant selected
  - ✅ Amount entered
  - ✅ Method selected
  - ✅ Date set
- Check browser console for errors
- Try refreshing page

### Mobile Navigation Overlapping Content:
- Content should have bottom padding of ~80px on mobile
- If overlapping, try clearing browser cache
- Check if bottom nav is visible at all

---

## 9. Permission Matrix

| Feature | Super Admin | Landlord | Caretaker | Accountant | Technician | Tenant |
|---------|------------|----------|-----------|------------|-----------|--------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Manage Team | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Add/Edit Properties | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Tenants | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create Leases | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Record Payments | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Payments | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Manage Maintenance | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| View Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 10. Support & Next Steps

### For Deployment:
1. Run the database migration
2. Deploy the new build
3. Test on mobile device
4. Verify bottom nav appears
5. Test team member addition
6. Test payment recording

### For Backend Integration:
- Team member creation needs: `create-team-member` Supabase function
- Should handle email invitations
- Should assign roles automatically

### For Feedback:
- Test on actual mobile devices
- Check touch-friendly button sizes
- Verify autocomplete works smoothly
- Confirm payment reasons display correctly

---

**Version:** 1.0  
**Last Updated:** July 5, 2026  
**Status:** Production Ready ✅

