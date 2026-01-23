"use client";

import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletionGuard } from "@/hooks/useProfileCompletionGuard";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { checking } = useProfileCompletionGuard(user, loading);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`
      );
      router.replace(`/auth/login?next=${next}`);
    }
  }, [user, loading, router]);

  if (loading || checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // Si no hay usuario, no renderizamos nada mientras redirige (o podrías dejar el spinner)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
