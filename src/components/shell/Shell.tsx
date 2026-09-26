"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { useUI } from "@/stores/ui";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Moving the mouse brings the chrome back while a test is running.
  useEffect(() => {
    let last = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      if (now - last < 80) return;
      last = now;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 3) useUI.getState().setTyping(false);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Leaving a page always restores the chrome.
  useEffect(() => {
    useUI.getState().setTyping(false);
  }, [pathname]);

  // focus mode is fullscreen: no header or footer at all
  if (pathname === "/focus") {
    return (
      <main id="main" className="relative flex min-h-dvh flex-col">
        {children}
      </main>
    );
  }

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-bg2 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Header />
      <main id="main" className="relative flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
