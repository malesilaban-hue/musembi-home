import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth-context";
import { ThemeProvider } from "./components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

// Register a minimal service worker so Android/Chrome shows the install prompt.
// Guarded: never register in Lovable preview / dev / iframe. Supports ?sw=off kill switch.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const host = window.location.hostname;
  const inIframe = window.self !== window.top;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";
  const isPreview =
    !import.meta.env.PROD ||
    inIframe ||
    killSwitch ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" || host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev");

  if (isPreview) {
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).forEach((r) => r.unregister()),
    ).catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW registration failed", e));
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
