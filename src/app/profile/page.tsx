"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "@/lib/firebaseClient";
import { uploadImage } from "@/lib/storage";
import { UserProfile } from "@/types/user";
import Image from "next/image";
import { Button } from "@/components/ui/Button";

function ProfileContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const nextPath = nextParam?.startsWith("/") ? nextParam : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
          setFormData(docSnap.data() as UserProfile);
        } else {
          setFormData({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
      const updatedData: Partial<UserProfile> = {
        ...formData,
        photoURL,
        updatedAt: new Date(),
        email: user.email,
        uid: user.uid,
      };

      await setDoc(userRef, updatedData, { merge: true });

      setFormData(updatedData);
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

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
            <p className="mt-1 text-sm text-gray-500">
              Administra tu información personal y pública.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Foto de perfil */}
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
              <div className="relative group">
                <div className="relative h-32 w-32 rounded-full overflow-hidden border-4 border-gray-100 bg-gray-100">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Foto de perfil"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
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
                <h3 className="text-lg font-medium text-gray-900">
                  Foto de perfil
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sube una foto para que otros usuarios puedan reconocerte.
                  <br />
                  JPG, GIF o PNG. Máximo 5MB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6 border-t border-gray-200 pt-8">
              {/* Email (solo lectura) */}
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">
                  Correo electrónico
                </label>
                <div className="mt-1">
                  <input
                    type="email"
                    disabled
                    value={formData.email || ""}
                    className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 text-gray-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    El correo electrónico no se puede cambiar.
                  </p>
                </div>
              </div>

              {/* Nombre */}
              <div className="sm:col-span-3">
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-700"
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
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    placeholder="Tu nombre"
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div className="sm:col-span-3">
                <label
                  htmlFor="phoneNumber"
                  className="block text-sm font-medium text-gray-700"
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
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    placeholder="+56 9 1234 5678"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Necesario para que te puedan contactar.
                </p>
              </div>

              {/* Dirección */}
              <div className="sm:col-span-6">
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-gray-700"
                >
                  Dirección / ubicación
                </label>
                <div className="mt-1">
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={formData.address || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    placeholder="Ciudad, comuna, región..."
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Esta información ayuda a coordinar las entregas.
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-gray-200 flex justify-end">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
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

