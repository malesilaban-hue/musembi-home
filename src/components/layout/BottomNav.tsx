import { NavLink } from "react-router-dom";
import { Home, Building2, Users, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const base = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/team", label: "Team", icon: Users, adminOnly: true },
  { to: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const { hasRole } = useAuth();
  const items = base.filter((i) => !i.adminOnly || hasRole(["super_admin", "landlord"]));
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
