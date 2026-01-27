"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletionGuard } from "@/hooks/useProfileCompletionGuard";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { checking } = useProfileCompletionGuard(user, loading, {
    skipPrefixes: ["/auth", "/profile"],
  });
  const hideChrome = pathname.startsWith("/auth");
  const isPrivateRoute =
    pathname.startsWith("/products/new") ||
    pathname.includes("/products/") && pathname.endsWith("/edit") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/mis-compras");

  const showFooter = !hideChrome && !isPrivateRoute;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

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
