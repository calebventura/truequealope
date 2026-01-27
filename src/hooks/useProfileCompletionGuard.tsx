import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { validateProfile } from "@/app/profile/validation";
import type { User } from "firebase/auth";
import { TERMS_VERSION } from "@/lib/constants";

/**
 * Hook que obliga a completar el perfil antes de seguir navegando.
 * Devuelve `checking` para mostrar loader mientras se valida y redirige.
 */
export function useProfileCompletionGuard(
  user: User | null,
  authLoading: boolean,
  options?: { skipPrefixes?: string[] }
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const skipList = options?.skipPrefixes ?? [];
    if (skipList.some((p) => pathname.startsWith(p))) return;

    let cancelled = false;
    const run = async () => {
      setChecking(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() || {};
        const { errors } = validateProfile({
          displayName: data.displayName ?? user.displayName ?? "",
          phoneNumber: data.phoneNumber ?? "",
          instagramUser: data.instagramUser ?? null,
          aboutMe: data.aboutMe ?? null,
          department: data.department ?? null,
          province: data.province ?? null,
          district: data.district ?? null,
        });

        const termsMissing =
          !data.termsAcceptedVersion ||
          data.termsAcceptedVersion !== TERMS_VERSION;

        const isIncomplete = Object.keys(errors).length > 0 || termsMissing;
        if (!cancelled && isIncomplete) {
          const query = searchParams?.toString();
          const next = encodeURIComponent(
            `${pathname}${query ? `?${query}` : ""}`
          );
          const target = termsMissing
            ? `/profile?acceptTerms=1&next=${next}`
            : `/profile?completeProfile=1&next=${next}`;
          router.replace(target);
        }
      } catch (err) {
        console.error("Error verificando perfil completo:", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router, pathname, searchParams]);

  return { checking: checking || authLoading };
}
