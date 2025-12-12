"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/auth");

  return (
    <>
      {!hideChrome && <Navbar />}
      <main
        className={[
          hideChrome ? "min-h-screen" : "min-h-[calc(100vh-64px)]",
          !hideChrome ? "pb-24 md:pb-0" : "",
        ].join(" ")}
      >
        {children}
      </main>
      {!hideChrome && <BottomNav />}
    </>
  );
}

