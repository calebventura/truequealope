"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { uploadImage } from "@/lib/storage";
import { Product } from "@/types/product";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";

// Esquema de validación con Zod
const productSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
  description: z.string().min(20, "La descripción debe ser más detallada"),
  price: z.number().min(1, "El precio debe ser mayor a 0"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  condition: z.enum(["new", "like-new", "used"], {
    errorMap: () => ({ message: "Selecciona una condición válida" }),
  }),
  location: z.string().min(3, "Ingresa una ubicación válida"),
  images: z
    .any() // Validaremos los archivos manualmente o con refinamientos más complejos
    .refine((files) => files?.length > 0, "Debes subir al menos una imagen."),
});

type ProductForm = z.infer<typeof productSchema>;

export default function NewProductPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  // Redirigir si no está autenticado (aunque el layout protegido ya debería hacerlo)
  if (!authLoading && !user) {
    router.push("/auth/login");
    return null;
  }

  const onSubmit = async (data: ProductForm) => {
    if (!user) return;
    setUploading(true);
    setGeneralError("");

    try {
      // 1. Subir imágenes
      const imageFiles = Array.from(data.images as FileList);
      const imageUrls: string[] = [];

      for (const file of imageFiles) {
        const path = `products/${user.uid}/${Date.now()}_${file.name}`;
        const url = await uploadImage(file, path);
        imageUrls.push(url);
      }

      // 2. Crear objeto producto
      const newProduct: Omit<Product, "id"> = {
        sellerId: user.uid,
        title: data.title,
        description: data.description,
        price: data.price,
        categoryId: data.categoryId,
        condition: data.condition,
        location: data.location,
        images: imageUrls,
        status: "active",
        createdAt: new Date(), // Firestore lo convertirá, o usar serverTimestamp() si cambiamos el tipo
        searchKeywords: data.title.toLowerCase().split(" "),
      };

      // 3. Guardar en Firestore
      // Usamos 'any' temporalmente para createdAt si usamos serverTimestamp()
      await addDoc(collection(db, "products"), {
        ...newProduct,
        createdAt: serverTimestamp(),
      });

      router.push("/dashboard"); // O a la página del producto
    } catch (error) {
      console.error("Error al publicar:", error);
      setGeneralError(
        "Ocurrió un error al publicar el producto. Inténtalo de nuevo.",
      );
    } finally {
      setUploading(false);
    }
  };

  if (authLoading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Publicar un nuevo producto
      </h1>

      {generalError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Título
          </label>
          <input
            type="text"
            {...register("title")}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
            placeholder="Ej: Bicicleta de montaña Trek"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Descripción
          </label>
          <textarea
            {...register("description")}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-base"
            placeholder="Describe los detalles, estado y características..."
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Precio */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Precio ($)
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Condición */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Condición
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
            {errors.condition && (
              <p className="mt-1 text-xs text-red-500">
                {errors.condition.message}
              </p>
            )}
          </div>

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
        </div>

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

        {/* Botón Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || uploading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {uploading
              ? "Subiendo imágenes..."
              : isSubmitting
                ? "Publicando..."
                : "Publicar Producto"}
          </button>
        </div>
      </form>
    </div>
  );
}
