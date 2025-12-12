"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/activity?tab=seller");
  }, [router]);

  return <div className="p-8 text-center">Redirigiendo...</div>;
}

