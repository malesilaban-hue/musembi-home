import { Moon, Sun, LogOut, Monitor, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate();
  const { theme, setTheme, resolved } = useTheme();
  const { user, roles, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      console.log("Logout initiated");
      
      // Call signOut which clears UI immediately and tries API in background
      await signOut();
      
      console.log("Sign out completed, redirecting to auth");
      // Navigate away immediately - UI is already cleared
      navigate("/auth", { replace: true });
      toast.success("Signed out");
    } catch (err) {
      console.error("Sign out error:", err);
      // Still navigate away - UI was already cleared in signOut()
      navigate("/auth", { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:h-16 md:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
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
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
