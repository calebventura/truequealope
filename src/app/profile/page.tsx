"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "@/lib/firebaseClient";
import { uploadImage } from "@/lib/storage";
import { UserProfile } from "@/types/user";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
  LOCATIONS,
  Department,
  PROVINCES_BY_DEPARTMENT,
  formatDepartmentLabel,
  formatLocationPart,
  normalizeDepartment,
  normalizeProvince,
  normalizeDistrict,
  parseLocationParts,
} from "@/lib/locations";
import { validateProfile } from "./validation";

const resolveProfileLocation = (profile: Partial<UserProfile>) => {
  const fallback = parseLocationParts(profile.address ?? null);
  const explicitDepartment = normalizeDepartment(profile.department ?? null);
  if (!explicitDepartment) {
    return fallback;
  }

  const province = normalizeProvince(
    explicitDepartment,
    profile.province ?? fallback.province ?? null
  );
  const district = normalizeDistrict(
    explicitDepartment,
    profile.district ?? fallback.district ?? null
  );

  return {
    department: explicitDepartment,
    province,
    district,
  };
};

function ProfileContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const nextPath = nextParam?.startsWith("/") ? nextParam : null;
  const mustCompleteProfile = searchParams.get("completeProfile") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [initialProfile, setInitialProfile] = useState<Partial<UserProfile> | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const provinceOptions = selectedDepartment
    ? PROVINCES_BY_DEPARTMENT[selectedDepartment]
    : [];
  const districtOptions = selectedDepartment ? LOCATIONS[selectedDepartment] : [];

  useEffect(() => {
    if (mustCompleteProfile) {
      setMessage({
        type: "error",
        text: "Completa tu perfil para continuar.",
      });
    }
  }, [mustCompleteProfile]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
      return;
    }

    const fetchUserData = async () => {
      if (!user) return;

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setFormData(data);
          setInitialProfile(data);
          const location = resolveProfileLocation(data);
          setSelectedDepartment(location.department ?? "");
          setSelectedProvince(location.province ?? "");
          setSelectedDistrict(location.district ?? "");
        } else {
          setFormData({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
          setInitialProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
          setSelectedDepartment("");
          setSelectedProvince("");
          setSelectedDistrict("");
        }

        if (user.photoURL) {
          setPreviewUrl(user.photoURL);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setMessage({
          type: "error",
          text: "Error al cargar los datos del perfil.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, authLoading, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const department = e.target.value as Department | "";
    setSelectedDepartment(department);
    if (department) {
      const defaultProvince = PROVINCES_BY_DEPARTMENT[department]?.[0] ?? "";
      setSelectedProvince(defaultProvince);
    } else {
      setSelectedProvince("");
    }
    setSelectedDistrict("");
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const province = e.target.value;
    setSelectedProvince(province);
    setSelectedDistrict("");
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDistrict(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { errors: newErrors, normalized } = validateProfile({
      displayName: formData.displayName,
      phoneNumber: formData.phoneNumber,
      instagramUser: formData.instagramUser,
      aboutMe: formData.aboutMe,
      department: selectedDepartment,
      province: selectedProvince,
      district: selectedDistrict,
    });

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setMessage({ type: "error", text: "Corrige los campos marcados." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let photoURL = formData.photoURL;

      if (selectedImage) {
        const path = `profile_images/${user.uid}/${Date.now()}_${selectedImage.name}`;
        photoURL = await uploadImage(selectedImage, path);
      }

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: formData.displayName,
          photoURL: photoURL,
        });
      }

      const userRef = doc(db, "users", user.uid);
      const departmentValue = selectedDepartment || null;
      const provinceValue = selectedDepartment ? selectedProvince || null : null;
      const districtValue = selectedDepartment ? selectedDistrict || null : null;
      const combinedAddress = [districtValue, provinceValue, departmentValue]
        .filter(Boolean)
        .join(", ");

      const updatedData: Partial<UserProfile> = {
        ...formData,
        displayName: normalized.name,
        phoneNumber: normalized.phone,
        instagramUser: normalized.instagram || null,
        aboutMe: normalized.aboutMe || null,
        photoURL,
        updatedAt: new Date(),
        email: user.email,
        uid: user.uid,
        address: combinedAddress || null,
        addressLine: null,
        department: departmentValue,
        province: provinceValue,
        district: districtValue,
      };

      await setDoc(userRef, updatedData, { merge: true });

      // Confirm persistence with a fresh read
      try {
        const refreshedSnap = await getDoc(userRef);
        if (refreshedSnap.exists()) {
          const refreshed = refreshedSnap.data() as UserProfile;
          setFormData(refreshed);
          setInitialProfile(refreshed);
          const refreshedLocation = resolveProfileLocation(refreshed);
          setSelectedDepartment(refreshedLocation.department ?? "");
          setSelectedProvince(refreshedLocation.province ?? "");
          setSelectedDistrict(refreshedLocation.district ?? "");
        } else {
          setFormData(updatedData);
          setInitialProfile(updatedData);
        }
      } catch (readError) {
        console.warn("No se pudo confirmar la lectura del perfil actualizado:", readError);
        setFormData(updatedData);
        setInitialProfile(updatedData);
      }

      setMessage({
        type: "success",
        text: "Perfil actualizado correctamente.",
      });

      if (nextPath && updatedData.phoneNumber) {
        router.push(nextPath);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: "Error al guardar los cambios." });
    } finally {
      setSaving(false);
    }
  };

  const normalize = (value?: string | null) => (value ?? "").trim();
  const isDirty = useMemo(() => {
    if (!initialProfile) return false;
    const hasImageChange = Boolean(selectedImage);
    return (
      hasImageChange ||
      normalize(formData.displayName) !== normalize(initialProfile.displayName) ||
      normalize(formData.phoneNumber) !== normalize(initialProfile.phoneNumber) ||
      normalize(formData.instagramUser) !== normalize(initialProfile.instagramUser) ||
      normalize(formData.aboutMe) !== normalize(initialProfile.aboutMe) ||
      normalize(formData.department) !== normalize(initialProfile.department) ||
      normalize(formData.province) !== normalize(initialProfile.province) ||
      normalize(formData.district) !== normalize(initialProfile.district)
    );
  }, [formData, initialProfile, selectedImage]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

    return (

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 transition-colors duration-300">

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-gray-800 transition-colors">

            <div className="px-6 py-8 border-b border-gray-200 dark:border-gray-800">

              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mi perfil</h1>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">

                Administra tu información personal y pública.

              </p>

            </div>

  

            <form onSubmit={handleSubmit} className="p-6 space-y-8">

              {message && (

                <div

                  className={`p-4 rounded-md ${

                    message.type === "success"

                      ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"

                      : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"

                  }`}

                >

                  {message.text}

                </div>

              )}

  

              {/* Foto de perfil */}

              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">

                <div className="relative group">

                  <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">

                    {previewUrl ? (

                      <Image

                        src={previewUrl}

                        alt="Foto de perfil"

                        fill

                        className="object-cover"

                      />

                    ) : (

                      <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-600">

                        <svg

                          className="h-12 w-12"

                          fill="none"

                          stroke="currentColor"

                          viewBox="0 0 24 24"

                        >

                          <path

                            strokeLinecap="round"

                            strokeLinejoin="round"

                            strokeWidth={2}

                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"

                          />

                        </svg>

                      </div>

                    )}

                  </div>

                  <label

                    htmlFor="photo-upload"

                    className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-colors"

                  >

                    <svg

                      className="w-4 h-4"

                      fill="none"

                      stroke="currentColor"

                      viewBox="0 0 24 24"

                    >

                      <path

                        strokeLinecap="round"

                        strokeLinejoin="round"

                        strokeWidth={2}

                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"

                      />

                      <path

                        strokeLinecap="round"

                        strokeLinejoin="round"

                        strokeWidth={2}

                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"

                      />

                    </svg>

                  </label>

                  <input

                    id="photo-upload"

                    type="file"

                    accept="image/*"

                    className="hidden"

                    onChange={handleImageChange}

                  />

                </div>

                <div className="flex-1 text-center sm:text-left">

                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">

                    Foto de perfil

                  </h3>

                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">

                    Sube una foto para que otros usuarios puedan reconocerte.

                    <br />

                    JPG, GIF o PNG. Máximo 5MB.

                  </p>

                </div>

              </div>

  

              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6 border-t border-gray-200 dark:border-gray-800 pt-8">

                {/* Email (solo lectura) */}

                <div className="sm:col-span-4">

                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">

                    Correo electrónico

                  </label>

                  <div className="mt-1">

                    <input

                      type="email"

                      disabled

                      value={formData.email || ""}

                      className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 text-gray-500 dark:text-gray-400 cursor-not-allowed transition-colors"

                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">

                      El correo electrónico no se puede cambiar.

                    </p>

                  </div>

                </div>

  

                {/* Nombre */}

                <div className="sm:col-span-3">

                  <label

                    htmlFor="displayName"

                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"

                  >

                    Nombre completo

                  </label>

                  <div className="mt-1">

                    <input

                      type="text"

                      name="displayName"

                      id="displayName"

                      value={formData.displayName || ""}

                      onChange={(e) =>

                        setFormData({ ...formData, displayName: e.target.value })

                      }

                      className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors"

                      placeholder="Tu nombre"

                    />
                    {errors.displayName && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {errors.displayName}
                      </p>
                    )}
                  </div>

                </div>

  

                {/* Teléfono */}

                <div className="sm:col-span-3">

                  <label

                    htmlFor="phoneNumber"

                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"

                  >

                    Teléfono (WhatsApp)

                  </label>

                  <div className="mt-1">

                    <input

                      type="tel"

                      name="phoneNumber"

                      id="phoneNumber"

                      value={formData.phoneNumber || ""}

                      onChange={(e) =>

                        setFormData({ ...formData, phoneNumber: e.target.value })

                      }

                      className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors"

                      placeholder="+56 9 1234 5678"

                    />

                  </div>

                  {errors.phoneNumber && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.phoneNumber}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">

                    Necesario para que te puedan contactar.

                  </p>

                </div>

                {/* Instagram (Opcional) */}
                <div className="sm:col-span-3">
                  <label
                    htmlFor="instagramUser"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Usuario de Instagram
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">@</span>
                    </div>
                    <input
                      type="text"
                      name="instagramUser"
                      id="instagramUser"
                      value={formData.instagramUser || ""}
                      onChange={(e) => {
                        // Limpiar input: quitar @, espacios y urls
                        const val = e.target.value.replace(/@| |https?:\/\/(www\.)?instagram\.com\//g, "");
                        setFormData({ ...formData, instagramUser: val })
                      }}
                      className="block w-full pl-7 rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors"
                      placeholder="usuario_ig"
                    />
                  </div>
                  {errors.instagramUser && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.instagramUser}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Opcional. Se mostrará un botón en tus productos.
                  </p>
                </div>

                {/* Sobre mi */}
                <div className="sm:col-span-6">
                  <label
                    htmlFor="aboutMe"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Sobre mi
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="aboutMe"
                      name="aboutMe"
                      rows={4}
                      value={formData.aboutMe || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, aboutMe: e.target.value })
                      }
                    className="block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors"
                    placeholder="Cuenta brevemente sobre ti y cómo prefieres coordinar los trueques."
                  />
                </div>
                {errors.aboutMe && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {errors.aboutMe}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Se mostrará en tus publicaciones para generar confianza.
                </p>
              </div>

                {/* Ubicación */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Departamento
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={handleDepartmentChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors"
                  >
                    <option value="">Selecciona un departamento</option>
                    {(Object.keys(LOCATIONS) as Department[]).map((dept) => (
                      <option key={dept} value={dept}>
                        {formatDepartmentLabel(dept)}
                      </option>
                    ))}
                  </select>
                  {errors.department && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.department}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Provincia
                  </label>
                  <select
                    value={selectedProvince}
                    onChange={handleProvinceChange}
                    disabled={!selectedDepartment}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors disabled:opacity-50"
                  >
                    <option value="">Selecciona una provincia</option>
                    {provinceOptions.map((province) => (
                        <option key={province} value={province}>
                          {formatLocationPart(province)}
                        </option>
                      ))}
                  </select>
                  {errors.province && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.province}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Distrito
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={handleDistrictChange}
                    disabled={!selectedDepartment || !selectedProvince}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border transition-colors disabled:opacity-50"
                  >
                    <option value="">Selecciona un distrito</option>
                    {districtOptions.map((district) => (
                        <option key={district} value={district}>
                          {formatLocationPart(district)}
                        </option>
                      ))}
                  </select>
                  {errors.district && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.district}
                    </p>
                  )}
                </div>

              </div>

  

              <div className="pt-5 border-t border-gray-200 dark:border-gray-800 flex justify-end">

                <Button type="submit" disabled={saving || !isDirty} className="w-full sm:w-auto">

                  {saving ? "Guardando..." : "Guardar cambios"}

                </Button>

              </div>

            </form>

          </div>

        </div>

      </div>

    );

  }

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Cargando...
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
