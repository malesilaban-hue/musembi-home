import { Outlet } from "react-router-dom";
import { SideNav } from "./SideNav";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { InstallPrompt } from "@/components/InstallPrompt";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-4 md:px-8 md:pb-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
        <BottomNav />
        <InstallPrompt />
      </div>
    </div>
  );
}
