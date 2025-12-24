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
import { Product, ListingType, ExchangeType } from "@/types/product";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";

const productSchema = z
  .object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    
    listingType: z.enum(["product", "service"] as const).default("product"),
    acceptedExchangeTypes: z.array(z.enum(["money", "product", "service", "exchange_plus_cash", "giveaway"] as const)).min(1, "Selecciona al menos una opción de intercambio"),
    exchangeCashDelta: z.number().optional(),

    price: z.number().min(0, "El precio no puede ser negativo").optional(),
    wanted: z.string().optional(),
    categoryId: z.string().min(1, "Selecciona una categoría"),
    condition: z.enum(["new", "like-new", "used"]).optional(),
    location: z.string().min(3, "Ingresa una ubicación válida"),
    images: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    const types = data.acceptedExchangeTypes || [];
    
    // Validation for Money or Permuta
    if ((types.includes("money") || types.includes("exchange_plus_cash")) && (data.price === undefined || data.price === null)) {
       ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Ingresa un precio o monto referencial",
      });
    }

    // Validation for Product/Service exchange
    if ((types.includes("product") || types.includes("service") || types.includes("exchange_plus_cash")) && !data.wanted?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wanted"],
        message: "Describe qué buscas a cambio",
      });
    }
    
    // Validation for Condition (only for products)
    if (data.listingType === "product" && !data.condition) {
        ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition"],
        message: "Selecciona la condición del producto",
      });
    }

    // Validation for Images (required for products)
    if (data.listingType === "product" && (!data.images || data.images.length === 0)) {
        ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["images"],
        message: "Debes subir al menos una imagen para un producto.",
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      listingType: "product",
      acceptedExchangeTypes: ["money"],
      condition: "used",
    },
  });

  const listingType = watch("listingType");
  const acceptedExchangeTypes = watch("acceptedExchangeTypes");

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
      const ok = await trigger(["images", "title", "listingType"]);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await trigger([
        "acceptedExchangeTypes",
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

  const handleExchangeTypeChange = (type: ExchangeType, checked: boolean) => {
    const current = acceptedExchangeTypes || [];
    if (checked) {
      setValue("acceptedExchangeTypes", [...current, type]);
    } else {
      setValue("acceptedExchangeTypes", current.filter((t) => t !== type));
    }
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

      // Determine legacy mode
      let mode: "sale" | "trade" | "both" = "trade";
      const hasMoney = data.acceptedExchangeTypes.includes("money");
      const hasOthers = data.acceptedExchangeTypes.some(t => t !== "money");
      
      if (hasMoney && !hasOthers) mode = "sale";
      else if (hasMoney && hasOthers) mode = "both";
      else mode = "trade";

      const newProduct: Omit<Product, "id"> = {
        sellerId: user.uid,
        title: data.title.trim(),
        description: data.description?.trim() || "",
        price: (hasMoney || data.acceptedExchangeTypes.includes("exchange_plus_cash")) ? data.price : null,
        categoryId: data.categoryId,
        condition: data.listingType === "product" ? (data.condition ?? "used") : "new", // Default for service
        location: data.location.trim(),
        images: imageUrls,
        status: "active",
        createdAt: new Date(),
        searchKeywords: data.title.toLowerCase().split(" "),
        mode: mode,
        wanted: wantedItems,
        listingType: data.listingType,
        acceptedExchangeTypes: data.acceptedExchangeTypes,
        exchangeCashDelta: data.exchangeCashDelta ?? null
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
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md rounded-lg mt-10 transition-colors">
      <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">
        Publicar un producto
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Paso {step} de 3
      </p>

      {generalError && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-200 rounded-md text-sm transition-colors">
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {step === 1 && (
          <>
            {/* Tipo de Publicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ¿Qué vas a publicar?
              </label>
              <div className="flex gap-4">
                <label className={`flex-1 cursor-pointer border rounded-lg p-4 text-center transition-colors ${listingType === 'product' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="radio" value="product" {...register("listingType")} className="sr-only" />
                  <span className="block text-2xl mb-1">📦</span>
                  <span className="font-medium text-gray-900 dark:text-white">Producto</span>
                </label>
                <label className={`flex-1 cursor-pointer border rounded-lg p-4 text-center transition-colors ${listingType === 'service' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <input type="radio" value="service" {...register("listingType")} className="sr-only" />
                  <span className="block text-2xl mb-1">🛠️</span>
                  <span className="font-medium text-gray-900 dark:text-white">Servicio</span>
                </label>
              </div>
            </div>

            {/* Imágenes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Imágenes
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                {...register("images")}
                className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md transition-colors
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  dark:file:bg-gray-700 dark:file:text-gray-100
                  hover:file:bg-blue-100 dark:hover:file:bg-gray-600"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Puedes seleccionar múltiples archivos.
              </p>
              {errors.images && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.images.message as string}
                </p>
              )}
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Título del {listingType === 'product' ? 'producto' : 'servicio'}
              </label>
              <input
                type="text"
                {...register("title")}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                placeholder={listingType === 'product' ? "Ej: Bicicleta de montaña" : "Ej: Clases de Matemáticas"}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.title.message}
                </p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Tipos de Intercambio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ¿Qué aceptas a cambio?
              </label>
              <div className="space-y-2">
                {[
                  { id: 'money', label: 'Dinero (Venta)', icon: '💵' },
                  { id: 'product', label: 'Otro Producto (Trueque)', icon: '📦' },
                  { id: 'service', label: 'Servicio (Intercambio)', icon: '🛠️' },
                  { id: 'exchange_plus_cash', label: 'Permuta (Objeto + Dinero)', icon: '🔄' },
                  { id: 'giveaway', label: 'Regalo (Gratis)', icon: '🎁' },
                ].map((type) => (
                  <label key={type.id} className="flex items-center gap-3 p-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      value={type.id}
                      checked={acceptedExchangeTypes?.includes(type.id as ExchangeType)}
                      onChange={(e) => handleExchangeTypeChange(type.id as ExchangeType, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-xl">{type.icon}</span>
                    <span className="text-gray-900 dark:text-gray-100">{type.label}</span>
                  </label>
                ))}
              </div>
              {errors.acceptedExchangeTypes && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.acceptedExchangeTypes.message}
                </p>
              )}
            </div>

            {/* Precio */}
            {(acceptedExchangeTypes?.includes("money") || acceptedExchangeTypes?.includes("exchange_plus_cash")) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {acceptedExchangeTypes.includes("exchange_plus_cash") && !acceptedExchangeTypes.includes("money") 
                    ? "Diferencia en dinero (S/.)" 
                    : "Precio (S/.)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                />
                {errors.price && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {errors.price.message}
                  </p>
                )}
              </div>
            )}

            {/* Busco */}
            {(acceptedExchangeTypes?.some(t => ['product', 'service', 'exchange_plus_cash'].includes(t))) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  ¿Qué buscas a cambio?
                </label>
                <input
                  type="text"
                  {...register("wanted")}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                  placeholder="Ej: consola, tablet, clases de inglés"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Describe lo que te gustaría recibir.
                </p>
                {errors.wanted && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {errors.wanted.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoría
                </label>
                <select
                  {...register("categoryId")}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                >
                  <option value="">Selecciona una categoría</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    {errors.categoryId.message}
                  </p>
                )}
              </div>

              {/* Condición (Solo Productos) */}
              {listingType === 'product' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Condición
                  </label>
                  <select
                    {...register("condition")}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                  >
                    <option value="">Selecciona el estado</option>
                    {CONDITIONS.map((cond) => (
                      <option key={cond.id} value={cond.id}>
                        {cond.name}
                      </option>
                    ))}
                  </select>
                  {errors.condition && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {errors.condition.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            {/* Ubicación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Ubicación
              </label>
              <input
                type="text"
                {...register("location")}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                placeholder="Ej: Palermo, Buenos Aires"
              />
              {errors.location && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.location.message}
                </p>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Descripción (opcional)
              </label>
              <textarea
                {...register("description")}
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
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
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
            >
              Continuar
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors"
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
