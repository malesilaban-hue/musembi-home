import { NavLink } from "react-router-dom";
import { Home, Building2, Users, User, FileSignature, ReceiptText, Wallet, UserCog, Wrench, Settings } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import logo from "@/assets/logo.png";

type Item = { to: string; label: string; icon: typeof Home; roles?: AppRole[]; hideFor?: AppRole[] };

const STAFF: AppRole[] = ["super_admin", "landlord", "caretaker", "accountant"];

const items: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/properties", label: "Properties", icon: Building2, roles: STAFF },
  { to: "/tenants", label: "Tenants", icon: Users, roles: STAFF },
  { to: "/leases", label: "Leases", icon: FileSignature, roles: STAFF },
  { to: "/invoices", label: "Invoices", icon: ReceiptText },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/payments/status/unpaid", label: "Payment status", icon: ReceiptText, roles: STAFF },
  { to: "/payments/status/paid", label: "Paid units", icon: ReceiptText, roles: STAFF },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, roles: STAFF },
  { to: "/team", label: "Team", icon: UserCog, roles: ["super_admin", "landlord"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin", "landlord"] },
  { to: "/profile", label: "Profile", icon: User },
];

interface SideNavProps {
  onClose?: () => void;
}

export function SideNav({ onClose }: SideNavProps) {
  const { hasRole } = useAuth();
  return (
    <aside className="flex w-full flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <img src={logo} alt="MUSEMBI PMS" width={32} height={32} className="h-8 w-8" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">MUSEMBI</span>
          <span className="text-[11px] font-medium text-muted-foreground">PMS</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items
          .filter((i) => !i.roles || hasRole(i.roles))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
      </nav>
      <div className="border-t border-border p-4 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} MUSEMBI PMS
      </div>
    </aside>
  );
}
