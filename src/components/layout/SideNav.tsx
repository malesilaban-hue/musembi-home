import { NavLink } from "react-router-dom";
import { Home, Building2, Users, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/logo.png";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/team", label: "Team", icon: Users, adminOnly: true },
  { to: "/profile", label: "Profile", icon: User },
];

export function SideNav() {
  const { hasRole } = useAuth();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <img src={logo} alt="MUSEMBI PMS" width={32} height={32} className="h-8 w-8" />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">MUSEMBI</span>
          <span className="text-[11px] font-medium text-muted-foreground">PMS</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items
          .filter((i) => !i.adminOnly || hasRole(["super_admin", "landlord"]))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
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
