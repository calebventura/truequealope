"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ensureUserProfile } from "@/lib/userProfile";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginContent() {
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next") || "/";
  const nextPath = nextParam.startsWith("/") ? nextParam : "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      await ensureUserProfile(userCredential.user);
      router.push(nextPath);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setError("Credenciales inválidas. Verifica tu correo y contraseña.");
      } else if (code === "auth/too-many-requests") {
        setError("Demasiados intentos fallidos. Inténtalo más tarde o restablece tu contraseña.");
      } else {
        setError("Error al iniciar sesión. Intenta nuevamente.");
      }
      console.error("Login error:", e);
    }
  };

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await ensureUserProfile(result.user);
          router.push(nextPath);
        }
      } catch (e) {
        console.error("Google redirect error:", e);
      } finally {
        setGoogleLoading(false);
      }
    };

    void handleRedirect();
  }, [router, nextPath]);

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user);
      router.push(nextPath);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError) {
          console.error("Google redirect error:", redirectError);
        }
      } else if (code === "auth/popup-closed-by-user") {
        // ignore
      } else {
        console.error("Google popup error:", e);
      }

      setError("No se pudo iniciar sesion con Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Iniciar sesión
        </h2>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded">
          {error}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full flex justify-center gap-2"
        onClick={handleGoogleLogin}
        disabled={googleLoading || isSubmitting}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 48 48"
          className="h-5 w-5"
        >
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.3-.4-3.5Z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.7 15.2 19 12 24 12c3.1 0 5.9 1.2 8.1 3.1l5.7-5.7C34.2 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7Z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.4 39.6 16.1 44 24 44Z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-3 5.2-5.7 6.6l.1.1 6.3 5.2C39.3 36.7 44 31.7 44 24c0-1.1-.1-2.3-.4-3.5Z"
          />
        </svg>
        {googleLoading ? "Conectando..." : "Continuar con Google"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">o</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="mt-1">
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <div className="mt-1">
            <input
              {...register("password")}
              type="password"
              autoComplete="current-password"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <Link
              href={`/auth/forgot-password?next=${encodeURIComponent(nextPath)}`}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </div>

        <div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center"
          >
            {isSubmitting ? "Cargando..." : "Ingresar"}
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">
              ¿No tienes cuenta?
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Link href={`/auth/register?next=${encodeURIComponent(nextPath)}`}>
            <Button variant="outline" className="w-full flex justify-center">
              Regístrate
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Cargando...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
