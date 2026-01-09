"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/auth");
  const isPrivateRoute =
    pathname.startsWith("/products/new") ||
    pathname.includes("/products/") && pathname.endsWith("/edit") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/mis-compras");

  const showFooter = !hideChrome && !isPrivateRoute;

  return (
    <>
      {!hideChrome && <Navbar />}
      <main
        className={[
          hideChrome ? "min-h-screen" : "min-h-[calc(100vh-64px)]",
          !hideChrome ? "pb-24 md:pb-0" : "",
          "bg-gray-50 dark:bg-gray-950 transition-colors",
        ].join(" ")}
      >
        {children}
      </main>
      {showFooter && <Footer />}
      {!hideChrome && <BottomNav />}
    </>
  );
}
