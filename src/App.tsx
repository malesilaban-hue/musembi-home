import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { RequireAuth } from "./components/RequireAuth";
import { RequireRole } from "./components/RequireRole";
import { AppShell } from "./components/layout/AppShell";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { Loader2 } from "lucide-react";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Tenants = lazy(() => import("./pages/Tenants"));
const TenantDetail = lazy(() => import("./pages/TenantDetail"));
const Leases = lazy(() => import("./pages/Leases"));
const LeaseDetail = lazy(() => import("./pages/LeaseDetail"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const Payments = lazy(() => import("./pages/Payments"));
const UnitPaymentStatus = lazy(() => import("./pages/UnitPaymentStatus"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Team = lazy(() => import("./pages/Team"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PWAInstallPrompt />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/properties" element={<RequireRole roles={["super_admin","landlord","caretaker","accountant"]}><Properties /></RequireRole>} />
          <Route path="/properties/:id" element={<RequireRole roles={["super_admin","landlord","caretaker","accountant"]}><PropertyDetail /></RequireRole>} />
          <Route path="/tenants" element={<RequireRole roles={["super_admin","landlord","caretaker","accountant"]}><Tenants /></RequireRole>} />
          <Route path="/tenants/:id" element={<TenantDetail />} />
          <Route path="/leases" element={<RequireRole roles={["super_admin","landlord","caretaker","accountant"]}><Leases /></RequireRole>} />
          <Route path="/leases/:id" element={<LeaseDetail />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/paid-units" element={<UnitPaymentStatus mode="paid" />} />
          <Route path="/unpaid-units" element={<UnitPaymentStatus mode="unpaid" />} />
          <Route path="/maintenance" element={<RequireRole roles={["super_admin","landlord","caretaker","accountant"]}><Maintenance /></RequireRole>} />
          <Route path="/team" element={<RequireRole roles={["super_admin","landlord"]}><Team /></RequireRole>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<RequireRole roles={["super_admin","landlord"]}><Settings /></RequireRole>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
