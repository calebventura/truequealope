"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  key: string;
  label: string;
  href: string;
  activeWhen: (pathname: string) => boolean;
  private?: boolean;
  icon: React.ReactNode;
};

function isActivePathname(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const privateHref = (href: string) => {
    if (loading) return href;
    if (user) return href;
    return `/auth/login?next=${encodeURIComponent(href)}`;
  };

  const items: NavItem[] = [
    {
      key: "home",
      label: "Inicio",
      href: "/",
      activeWhen: (p) => p === "/",
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
          />
        </svg>
      ),
    },
    {
      key: "search",
      label: "Buscar",
      href: "/search",
      activeWhen: (p) => isActivePathname(p, "/search"),
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 1 0-14 0 7 7 0 0 0 14 0Z"
          />
        </svg>
      ),
    },
    {
      key: "publish",
      label: "Publicar",
      href: "/products/new",
      activeWhen: (p) => isActivePathname(p, "/products/new"),
      private: true,
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 5v14m7-7H5"
          />
        </svg>
      ),
    },
    {
      key: "activity",
      label: "Actividad",
      href: "/activity",
      activeWhen: (p) => isActivePathname(p, "/activity") || isActivePathname(p, "/dashboard") || isActivePathname(p, "/mis-compras"),
      private: true,
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 19V5m0 14h16M8 17V9m4 8V7m4 10v-6"
          />
        </svg>
      ),
    },
    {
      key: "profile",
      label: "Perfil",
      href: "/profile",
      activeWhen: (p) => isActivePathname(p, "/profile"),
      private: true,
      icon: (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación inferior"
    >
      <div className="mx-auto max-w-7xl px-2">
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const isActive = item.activeWhen(pathname);
            const href = item.private ? privateHref(item.href) : item.href;

            const base =
              "flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium";
            const active = "text-indigo-700";
            const inactive = "text-gray-600 hover:text-gray-900";

            return (
              <li key={item.key}>
                <Link
                  href={href}
                  className={`${base} ${isActive ? active : inactive}`}
                >
                  <span className={isActive ? "text-indigo-700" : ""}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

