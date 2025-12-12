"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage } from "@/lib/storage";
import { Product } from "@/types/product";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";

const productSchema = z
  .object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    mode: z.enum(["sale", "trade", "both"] as const, {
      message: "Selecciona un modo de publicación",
    }),
    price: z.number().positive("El precio debe ser mayor a 0").optional(),
    wanted: z.string().optional(),
    categoryId: z.string().min(1, "Selecciona una categoría"),
    condition: z.enum(["new", "like-new", "used"]).optional(),
    location: z.string().min(3, "Ingresa una ubicación válida"),
    images: z
      .any()
      .refine((files) => files?.length > 0, "Debes subir al menos una imagen."),
  })
  .superRefine((data, ctx) => {
    if ((data.mode === "sale" || data.mode === "both") && !data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Ingresa un precio",
      });
    }
    if ((data.mode === "trade" || data.mode === "both") && !data.wanted?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wanted"],
        message: "Ingresa qué buscas a cambio",
      });
    }
  });

type ProductForm = z.infer<typeof productSchema>;

const DRAFT_KEY = "draftProduct";

export default function NewProductPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      mode: "sale",
      condition: "used",
    },
  });

  const mode = watch("mode");

  useEffect(() => {
    // Restaurar borrador si existe (sin imágenes)
    const draftRaw = localStorage.getItem(DRAFT_KEY);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as Partial<ProductForm>;
        reset({
          ...draft,
          images: undefined,
        });
      } catch {
        // ignore
      }
    }
  }, [reset]);

  const saveDraft = (data: Partial<ProductForm>) => {
    const { images: _images, ...rest } = data;
    void _images;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
  };

  const nextStep = async () => {
    if (step === 1) {
      const ok = await trigger(["images", "title"]);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await trigger([
        "mode",
        "price",
        "wanted",
        "categoryId",
        "condition",
      ]);
      if (ok) setStep(3);
    }
  };

  const prevStep = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const onSubmit = async (data: ProductForm) => {
    setGeneralError("");

    if (!user) {
      saveDraft(data);
      router.push("/auth/login?next=/products/new");
      return;
    }

    // Verificar que el usuario tenga WhatsApp configurado
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const phoneNumber = profileSnap.exists()
      ? (profileSnap.data().phoneNumber as string | undefined)
      : undefined;

    if (!phoneNumber) {
      saveDraft(data);
      alert("Antes de publicar debes agregar tu número de WhatsApp en tu perfil.");
      router.push("/profile?next=/products/new");
      return;
    }

    setUploading(true);
    try {
      const imageFiles = Array.from(data.images as FileList);
      const imageUrls: string[] = [];

      for (const file of imageFiles) {
        const path = `products/${user.uid}/${Date.now()}_${file.name}`;
        const url = await uploadImage(file, path);
        imageUrls.push(url);
      }

      const wantedItems =
        data.wanted
          ?.split(/[,\n]/)
          .map((w) => w.trim())
          .filter(Boolean) || [];

      const newProduct: Omit<Product, "id"> = {
        sellerId: user.uid,
        title: data.title.trim(),
        description: data.description?.trim() || "",
        price: data.mode === "trade" ? null : data.price!,
        categoryId: data.categoryId,
        condition: data.condition ?? "used",
        location: data.location.trim(),
        images: imageUrls,
        status: "active",
        createdAt: new Date(),
        searchKeywords: data.title.toLowerCase().split(" "),
        mode: data.mode,
        wanted: data.mode === "sale" ? [] : wantedItems,
      };

      await addDoc(collection(db, "products"), {
        ...newProduct,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem(DRAFT_KEY);
      router.push("/activity?tab=seller");
    } catch (error) {
      console.error("Error al publicar:", error);
      setGeneralError("Ocurrió un error al publicar el producto. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-center">Cargando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">
        Publicar un producto
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Paso {step} de 3
      </p>

      {generalError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {step === 1 && (
          <>
            {/* Imágenes */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Imágenes del producto
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                {...register("images")}
                className="mt-1 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                Puedes seleccionar múltiples archivos.
              </p>
              {errors.images && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.images.message as string}
                </p>
              )}
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Título
              </label>
              <input
                type="text"
                {...register("title")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
                placeholder="Ej: Bicicleta de montaña"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.title.message}
                </p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Modo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Cómo quieres publicarlo?
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input type="radio" value="sale" {...register("mode")} />
                  Solo venta
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="trade" {...register("mode")} />
                  Solo trueque
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="both" {...register("mode")} />
                  Venta o trueque
                </label>
              </div>
              {errors.mode && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.mode.message}
                </p>
              )}
            </div>

            {/* Precio */}
            {(mode === "sale" || mode === "both") && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Precio (S/.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
                />
                {errors.price && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.price.message}
                  </p>
                )}
              </div>
            )}

            {/* Busco */}
            {(mode === "trade" || mode === "both") && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Busco a cambio
                </label>
                <input
                  type="text"
                  {...register("wanted")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
                  placeholder="Ej: consola, tablet, ropa de bebé"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Puedes separar varias opciones con comas.
                </p>
                {errors.wanted && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.wanted.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Categoría
                </label>
                <select
                  {...register("categoryId")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base bg-white"
                >
                  <option value="">Selecciona una categoría</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.categoryId.message}
                  </p>
                )}
              </div>

              {/* Condición */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Condición (opcional)
                </label>
                <select
                  {...register("condition")}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base bg-white"
                >
                  <option value="">Selecciona el estado</option>
                  {CONDITIONS.map((cond) => (
                    <option key={cond.id} value={cond.id}>
                      {cond.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {/* Ubicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Ubicación
              </label>
              <input
                type="text"
                {...register("location")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
                placeholder="Ej: Palermo, Buenos Aires"
              />
              {errors.location && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.location.message}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Descripción (opcional)
              </label>
              <textarea
                {...register("description")}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
                placeholder="Describe brevemente el estado y detalles."
              />
            </div>
          </>
        )}

        <div className="flex justify-between pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Atrás
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Continuar
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading
                ? "Subiendo imágenes..."
                : isSubmitting
                ? "Publicando..."
                : "Publicar"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
