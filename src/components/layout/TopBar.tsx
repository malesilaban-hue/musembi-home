import { Moon, Sun, LogOut, Monitor } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  landlord: "Landlord",
  caretaker: "Caretaker",
  accountant: "Accountant",
  technician: "Technician",
  security: "Security",
  tenant: "Tenant",
};

export function TopBar() {
  const { theme, setTheme, resolved } = useTheme();
  const { user, roles, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:h-16 md:px-8">
      <div className="flex items-center gap-2 md:hidden">
        <img src={logo} alt="" width={28} height={28} className="h-7 w-7" />
        <span className="text-sm font-bold tracking-tight">MUSEMBI PMS</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {roles.length > 0 && (
          <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary sm:inline">
            {roleLabels[roles[0]] ?? roles[0]}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle theme">
              {resolved === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Light {theme === "light" && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Dark {theme === "dark" && "✓"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> System {theme === "system" && "✓"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:inline">
          {user?.email}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
