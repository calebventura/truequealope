"use client";

import type { ChangeEvent } from "react";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ensureUserProfile } from "@/lib/userProfile";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import {
  LOCATIONS,
  PROVINCES_BY_DEPARTMENT,
  Department,
  formatDepartmentLabel,
  formatLocationPart,
} from "@/lib/locations";
import {
  nameRegex,
  phoneRegex,
  instagramRegex,
  normalizeWhitespace,
  validateLocation,
  validateName,
  validatePhone,
  validateContact,
} from "@/lib/userValidation";

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre es muy corto")
      .max(60, "El nombre es muy largo")
      .regex(
        nameRegex,
        "Nombre inválido (solo letras, espacios, guion, apóstrofo)"
      ),
    email: z.string().trim().email("Email inválido"),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "Debe ser un celular válido de 9 dígitos")
      .optional()
      .or(z.literal("").transform(() => "")),
    instagramUser: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || instagramRegex.test(value.replace(/^@/, "")),
        "Usuario de Instagram inválido"
      ),
    aboutMe: z
      .string()
      .trim()
      .max(300, "Máximo 300 caracteres")
      .optional(),
    department: z.string().min(1, "Selecciona un departamento"),
    province: z.string().min(1, "Selecciona una provincia"),
    district: z.string().min(1, "Selecciona un distrito"),
    password: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine(
    (data) =>
      validateContact(
        data.phone?.trim() || "",
        data.instagramUser?.trim().replace(/^@/, "") || ""
      ) === null,
    {
      message: "Ingresa teléfono o Instagram",
      path: ["phone"],
    }
  );

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterContent() {
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next") || "/";
  const nextPath = nextParam.startsWith("/") ? nextParam : "/";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      instagramUser: "",
      aboutMe: "",
      department: "",
      province: "",
      district: "",
    },
  });

  const provinceOptions = selectedDepartment
    ? PROVINCES_BY_DEPARTMENT[selectedDepartment]
    : [];
  const districtOptions = selectedDepartment
    ? LOCATIONS[selectedDepartment]
    : [];

  const needsProfileCompletion = async (uid: string) => {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.data() || {};
    const nameError = validateName(data.displayName ?? "").error;
    const phoneError = validatePhone(data.phoneNumber ?? "").error;
    const locationErrors = validateLocation(
      data.department,
      data.province,
      data.district
    ).errors;
    return Boolean(nameError || phoneError || Object.keys(locationErrors).length);
  };

  const routeAfterAuth = async (uid: string) => {
    try {
      const shouldComplete = await needsProfileCompletion(uid);
      if (shouldComplete) {
        router.push(
          `/profile?completeProfile=1&next=${encodeURIComponent(nextPath)}`
        );
        return;
      }
      router.push(nextPath);
    } catch (err) {
      console.error("Error verificando datos del perfil:", err);
      router.push(
        `/profile?completeProfile=1&next=${encodeURIComponent(nextPath)}`
      );
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    setError("");
    const normalizedName = normalizeWhitespace(data.name);
    const normalizedPhone = (data.phone || "").trim();
    const department = data.department as Department;
    const province = data.province;
    const district = data.district;
    const address = [district, province, department].filter(Boolean).join(", ");
    const instagramUser =
      data.instagramUser?.trim().replace(/^@/, "") || null;
    const aboutMe = data.aboutMe?.trim() || null;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email.trim(),
        data.password
      );
      await updateProfile(userCredential.user, {
        displayName: normalizedName,
      });
      await ensureUserProfile(userCredential.user);

      await setDoc(
        doc(db, "users", userCredential.user.uid),
        {
          displayName: normalizedName,
          phoneNumber: normalizedPhone,
          instagramUser,
          aboutMe,
          department,
          province,
          district,
          address,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      await routeAfterAuth(userCredential.user.uid);
    } catch (e) {
      setError("Error al registrarse. El email podría estar en uso.");
      console.error(e);
    }
  };

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await ensureUserProfile(result.user);
          await routeAfterAuth(result.user.uid);
        }
      } catch (e) {
        console.error("Google redirect error:", e);
      } finally {
        setGoogleLoading(false);
      }
    };

    void handleRedirect();
  }, [router, nextPath]);

  const handleDepartmentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as Department | "";
    setSelectedDepartment(value);
    setValue("department", value);
    const defaultProvince =
      value && PROVINCES_BY_DEPARTMENT[value]?.[0]
        ? PROVINCES_BY_DEPARTMENT[value][0]
        : "";
    setSelectedProvince(defaultProvince);
    setValue("province", defaultProvince);
    setSelectedDistrict("");
    setValue("district", "");
  };

  const handleProvinceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedProvince(value);
    setValue("province", value);
    setSelectedDistrict("");
    setValue("district", "");
  };

  const handleDistrictChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedDistrict(value);
    setValue("district", value);
  };

  const handleGoogleRegister = async () => {
    setError("");
    setGoogleLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user);
      await routeAfterAuth(result.user.uid);
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

      setError("No se pudo crear la cuenta con Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Crear cuenta
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
        onClick={handleGoogleRegister}
        disabled={googleLoading || isSubmitting}
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
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
            Nombre completo
          </label>
          <div className="mt-1">
            <input
              {...register("name")}
              type="text"
              autoComplete="name"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
        </div>

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
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Celular (WhatsApp)
          </label>
          <div className="mt-1">
            <input
              {...register("phone")}
              type="tel"
              placeholder="912345678"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
            )}
            {!errors.phone && (
              <p className="mt-1 text-xs text-gray-500">
                Necesario para que te puedan contactar.
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Usuario de Instagram <span className="text-gray-400">(opcional)</span>
          </label>
          <div className="mt-1">
            <input
              {...register("instagramUser")}
              type="text"
              placeholder="@tuusuario"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.instagramUser && (
              <p className="mt-1 text-xs text-red-500">
                {errors.instagramUser.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Opcional. Se mostrará un botón en tus productos.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sobre mi <span className="text-gray-400">(opcional)</span>
          </label>
          <div className="mt-1">
            <textarea
              {...register("aboutMe")}
              rows={3}
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
              placeholder="Cuenta brevemente sobre ti y cómo prefieres coordinar."
            />
            {errors.aboutMe && (
              <p className="mt-1 text-xs text-red-500">
                {errors.aboutMe.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Máximo 300 caracteres. Se mostrará en tus publicaciones para generar confianza.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Departamento
            </label>
            <select
              {...register("department", { onChange: handleDepartmentChange })}
              value={selectedDepartment}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
            >
              <option value="">Selecciona un departamento</option>
              {Object.keys(LOCATIONS).map((depKey) => (
                <option key={depKey} value={depKey}>
                  {formatDepartmentLabel(depKey as Department)}
                </option>
              ))}
            </select>
            {errors.department && (
              <p className="mt-1 text-xs text-red-500">{errors.department.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Provincia
            </label>
            <select
              {...register("province", { onChange: handleProvinceChange })}
              value={selectedProvince}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
              disabled={!selectedDepartment}
            >
              <option value="">Selecciona una provincia</option>
              {provinceOptions.map((province) => (
                <option key={province} value={province}>
                  {formatLocationPart(province)}
                </option>
              ))}
            </select>
            {errors.province && (
              <p className="mt-1 text-xs text-red-500">{errors.province.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Distrito
            </label>
            <select
              {...register("district", { onChange: handleDistrictChange })}
              value={selectedDistrict}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
              disabled={!selectedProvince}
            >
              <option value="">Selecciona un distrito</option>
              {districtOptions.map((district) => (
                <option key={district} value={district}>
                  {formatLocationPart(district)}
                </option>
              ))}
            </select>
            {errors.district && (
              <p className="mt-1 text-xs text-red-500">{errors.district.message}</p>
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
              autoComplete="new-password"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirmar contraseña
          </label>
          <div className="mt-1">
            <input
              {...register("confirmPassword")}
              type="password"
              autoComplete="new-password"
              className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-500">
                {errors.confirmPassword.message}
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
            {isSubmitting ? "Cargando..." : "Registrarse"}
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
              ¿Ya tienes cuenta?
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`}>
            <Button variant="outline" className="w-full flex justify-center">
              Iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Cargando...
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
