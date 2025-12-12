"use client";

import { Suspense, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { useSearchParams } from "next/navigation";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

function ForgotPasswordContent() {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") || "/";
  const nextPath = nextParam.startsWith("/") ? nextParam : "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, data.email);
      setMessage({
        type: "success",
        text: "Se ha enviado un enlace de recuperación a tu correo.",
      });
    } catch (error) {
      console.error(error);
      setMessage({
        type: "error",
        text:
          "Error al enviar el correo. Verifica que la dirección sea correcta.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Recuperar contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Ingresa tu correo y te enviaremos un enlace para restablecerla.
        </p>
      </div>

      {message && (
        <div
          className={`p-3 text-sm rounded ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Correo electrónico
          </label>
          <div className="mt-1">
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center"
          >
            {isSubmitting ? "Enviando..." : "Enviar enlace"}
          </Button>
        </div>
      </form>

      <div className="text-center text-sm">
        <Link
          href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-blue-600 hover:text-blue-500"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}

