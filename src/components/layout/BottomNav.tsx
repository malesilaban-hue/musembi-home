import { NavLink } from "react-router-dom";
import { Home, Building2, Users, FileSignature, Wallet, ReceiptText, User } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";

type Item = { to: string; label: string; icon: typeof Home; roles?: AppRole[] };

const STAFF: AppRole[] = ["super_admin", "landlord", "caretaker", "accountant"];

const allItems: Item[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/properties", label: "Property", icon: Building2, roles: STAFF },
  { to: "/tenants", label: "Tenants", icon: Users, roles: STAFF },
  { to: "/leases", label: "Leases", icon: FileSignature, roles: STAFF },
  { to: "/invoices", label: "Bills", icon: ReceiptText },
  { to: "/payments", label: "Pay", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const { hasRole } = useAuth();
  const items = allItems.filter((i) => !i.roles || hasRole(i.roles)).slice(0, 5);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
