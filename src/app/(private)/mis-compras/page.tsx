"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MyPurchasesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/activity?tab=buyer");
  }, [router]);

  return <div className="p-8 text-center">Redirigiendo...</div>;
}

