"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { Product, ExchangeType } from "@/types/product";
import { CATEGORIES, CONDITIONS, DRAFT_KEY } from "@/lib/constants";
import {
  LOCATIONS,
  Department,
  PROVINCES_BY_DEPARTMENT,
  formatDepartmentLabel,
  formatLocationPart,
  buildLocationLabel,
  parseLocationParts,
} from "@/lib/locations";
import { COMMUNITIES } from "@/lib/communities";
import { getActiveTrends } from "@/lib/trends";
import { AlertModal } from "@/components/ui/AlertModal";

const productSchema = z
  .object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    
    listingType: z.enum(["product", "service"] as const),
    acceptedExchangeTypes: z.array(z.enum(["money", "product", "service", "exchange_plus_cash", "giveaway"] as const)).min(1, "Selecciona una opción de intercambio"),
    communityId: z.string().nullable().optional(),

    price: z.number().min(0, "El valor no puede ser negativo").optional(),
    
    // Separate fields for specific exchange wants
    wantedProducts: z.string().optional(),
    wantedServices: z.string().optional(),
    wanted: z.string().optional(), // Legacy/Fallback
    otherCategoryLabel: z.string().optional(),

    categoryId: z.string().min(1, "Selecciona una categoría"),
    condition: z.enum(["new", "like-new", "used"]).optional(),
    location: z.string().min(3, "Selecciona departamento, provincia y distrito"),
    trendTags: z.array(z.string()).optional(),
    images: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    const types = data.acceptedExchangeTypes || [];
    
    // 1. Dinero (Solo Venta)
    if (types.includes("money")) {
        if (!data.price || data.price <= 0) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Ingresa el precio de venta" });
        }
    }

    // 2. Permuta (Mix)
    if (types.includes("exchange_plus_cash")) {
        if (!data.price || data.price <= 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Ingresa el valor total estimado del producto/servicio" });
        }
        
        // At least one wanted field required for Permuta
        if (!data.wantedProducts?.trim() && !data.wantedServices?.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wantedProducts"], message: "Debes especificar qué artículo o servicio buscas recibir" });
        }
    }

    // 3. Trueque Puro (Artículo y/o Servicio)
    if ((types.includes("product") || types.includes("service")) && !types.includes("exchange_plus_cash")) {
        
        if (types.includes("product") && !data.wantedProducts?.trim()) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wantedProducts"], message: "Describe qué artículos buscas" });
        }
        
        if (types.includes("service") && !data.wantedServices?.trim()) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wantedServices"], message: "Describe qué servicios buscas" });
        }
    }
    
    // Categoria Otros
    if (data.categoryId === "other") {
        const otherLabel = data.otherCategoryLabel?.trim();
        if (!otherLabel || otherLabel.length < 3) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherCategoryLabel"], message: "Describe la categor¡a (min. 3 caracteres)" });
        }
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

type ProductForm = z.input<typeof productSchema>;



export default function NewProductPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    description: string;
    tone?: "info" | "error" | "success";
  } | null>(null);

  const showAlert = (
    description: string,
    options?: { title?: string; tone?: "info" | "error" | "success" }
  ) => {
    setAlertModal({
      title:
        options?.title ??
        (options?.tone === "success"
          ? "Listo"
          : options?.tone === "error"
          ? "Hubo un problema"
          : "Aviso"),
      description,
      tone: options?.tone ?? "info",
    });
  };

  // Image Preview State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Location State
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

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
      acceptedExchangeTypes: [], // Start empty to force selection
      condition: "used",
      communityId: null,
      otherCategoryLabel: "",
      trendTags: [],
    },
  });

  const listingType = watch("listingType");
  const acceptedExchangeTypes = watch("acceptedExchangeTypes");
  const communityId = watch("communityId");
  const categoryId = watch("categoryId");
  const trendTags = watch("trendTags") || [];
  const trendOptions = useMemo(() => getActiveTrends(), []);

  const focusFirstError = (fieldOrder: (keyof ProductForm)[]) => {
    const target = fieldOrder.find((field) => errors[field]);
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-field='${target}']`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus?.({ preventScroll: true });
    }
  };

  const updateLocationValue = (
    department: Department | "",
    province: string,
    district: string
  ) => {
    if (department && province && district) {
      setValue(
        "location",
        buildLocationLabel(district, province, department),
        { shouldValidate: true }
      );
    } else {
      setValue("location", "", { shouldValidate: true });
    }
  };

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => {
        const updated = [...prev, ...newFiles];
        setValue("images", updated, { shouldValidate: true });
        return updated;
      });

      const newUrls = newFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setValue("images", updated, { shouldValidate: true });
      return updated;
    });
    setPreviewUrls((prev) => {
      const urlToRemove = prev[index];
      URL.revokeObjectURL(urlToRemove);
      return prev.filter((_, i) => i !== index);
    });
  };

  useEffect(() => {
    // Restaurar borrador si existe (sin imágenes)
    const draftRaw = localStorage.getItem(DRAFT_KEY);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as Partial<ProductForm>;

        // Restore location state (supports old "Distrito, Departamento" and new "Distrito, Provincia, Departamento")
        const parsedLocation = parseLocationParts(draft.location ?? null);
        setSelectedDepartment(parsedLocation.department);
        setSelectedProvince(parsedLocation.province);
        setSelectedDistrict(parsedLocation.district);

        reset({
          ...draft,
          location:
            parsedLocation.department &&
            parsedLocation.province &&
            parsedLocation.district
              ? buildLocationLabel(
                  parsedLocation.district,
                  parsedLocation.province,
                  parsedLocation.department
                )
              : draft.location ?? "",
          images: undefined,
        });

        setDraftRestored(true);
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
      const ok = await trigger(["images", "title", "listingType"], {
        shouldFocus: true,
      });
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      const step2Fields: (keyof ProductForm)[] = [
        "acceptedExchangeTypes",
        "price",
        "wantedProducts",
        "wantedServices",
        "otherCategoryLabel",
        "categoryId",
        "condition",
      ];
      const ok = await trigger(step2Fields, { shouldFocus: true });
      if (ok) setStep(3);
      else focusFirstError(step2Fields);
    }
  };

  const prevStep = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleExchangeTypeChange = (type: ExchangeType, checked: boolean) => {
    const current = new Set(acceptedExchangeTypes || []);

    if (checked) {
      // Reglas de exclusividad
      if (type === 'giveaway') {
        current.clear(); // Regalo borra todo lo demás
      } else if (type === 'exchange_plus_cash') {
        current.clear(); // Permuta borra todo lo demás
      } else if (type === 'money') {
        current.clear(); // Dinero borra todo lo demás
      } else {
        // Si selecciona Producto o Servicio (Trueque puro)
        // Borramos los exclusivos
        if (current.has('giveaway')) current.delete('giveaway');
        if (current.has('exchange_plus_cash')) current.delete('exchange_plus_cash');
        if (current.has('money')) current.delete('money');
      }
      current.add(type);
    } else {
      current.delete(type);
    }

    setValue("acceptedExchangeTypes", Array.from(current) as ExchangeType[]);
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dept = e.target.value as Department | "";
    setSelectedDepartment(dept);
    const defaultProvince = dept ? PROVINCES_BY_DEPARTMENT[dept]?.[0] ?? "" : "";
    setSelectedProvince(defaultProvince);
    setSelectedDistrict("");
    updateLocationValue(dept, defaultProvince, "");
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const province = e.target.value;
    setSelectedProvince(province);
    updateLocationValue(selectedDepartment, province, selectedDistrict);
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dist = e.target.value;
    setSelectedDistrict(dist);
    updateLocationValue(selectedDepartment, selectedProvince, dist);
  };

  const handleTrendToggle = (id: string, checked: boolean) => {
    const current = new Set(trendTags);
    if (checked) current.add(id);
    else current.delete(id);
    setValue("trendTags", Array.from(current), { shouldValidate: false });
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
      showAlert("Antes de publicar debes agregar tu número de WhatsApp en tu perfil.", {
        tone: "info",
        title: "Configura tu WhatsApp",
      });
      router.push("/profile?next=/products/new");
      return;
    }

    const selectedCommunity = data.communityId || null;

    setUploading(true);
    try {
      // Use selectedFiles directly
      const imageFiles = selectedFiles;
      const imageUrls: string[] = [];

      for (const file of imageFiles) {
        const path = `products/${user.uid}/${Date.now()}_${file.name}`;
        const url = await uploadImage(file, path);
        imageUrls.push(url);
      }

      // Combine wanted items for legacy support and display
      const trimmedWantedProducts = data.wantedProducts?.trim() || null;
      const trimmedWantedServices = data.wantedServices?.trim() || null;
      const sanitizedWantedProducts = trimmedWantedProducts || undefined;
      const sanitizedWantedServices = trimmedWantedServices || undefined;
      const trimmedOtherCategory = data.otherCategoryLabel?.trim() || null;
      const wantedItems: string[] = [];
      if (trimmedWantedProducts) wantedItems.push(`Productos: ${trimmedWantedProducts}`);
      if (trimmedWantedServices) wantedItems.push(`Servicios: ${trimmedWantedServices}`);

      // Determine legacy mode logic (internal use)
      let mode: "sale" | "trade" | "both" = "trade";
      if (data.acceptedExchangeTypes.includes("money")) mode = "sale";
      else if (data.acceptedExchangeTypes.includes("exchange_plus_cash")) mode = "both"; // Permuta is basically both
      else if (data.acceptedExchangeTypes.includes("giveaway")) mode = "sale"; // Treat as sale 0 price
      else mode = "trade";

      const newProductBase: Omit<Product, "id"> = {
        sellerId: user.uid,
        title: data.title.trim(),
        description: data.description?.trim() || "",
        // Price logic:
        // - Money: price
        // - Permuta: price (total value)
        // - Others: null or 0
        price: (data.acceptedExchangeTypes.includes("money") || data.acceptedExchangeTypes.includes("exchange_plus_cash")) 
                ? data.price 
                : 0, 
        categoryId: data.categoryId,
        condition: data.listingType === "product" ? (data.condition ?? "used") : "new", 
        location: data.location.trim(),
        images: imageUrls,
        status: "active",
        createdAt: new Date(),
        searchKeywords: data.title.toLowerCase().split(" "),
        mode: mode,
        wanted: wantedItems,
        listingType: data.listingType,
        acceptedExchangeTypes: data.acceptedExchangeTypes,
        visibility: "public",
        communityId: selectedCommunity,
        trendTags: data.trendTags ?? [],
      };

      const newProduct: Omit<Product, "id"> = {
        ...newProductBase,
        ...(sanitizedWantedProducts !== undefined
          ? { wantedProducts: sanitizedWantedProducts }
          : {}),
        ...(sanitizedWantedServices !== undefined
          ? { wantedServices: sanitizedWantedServices }
          : {}),
        otherCategoryLabel:
          data.categoryId === "other" ? trimmedOtherCategory || null : null,
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

      {draftRestored && (
        <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 rounded-md text-sm transition-colors flex justify-between items-center">
          <span>Hemos recuperado tu publicación pendiente.</span>
          <button
            type="button"
            onClick={() => setDraftRestored(false)}
            className="text-xs underline hover:text-blue-800 dark:hover:text-blue-100"
          >
            Cerrar
          </button>
        </div>
      )}

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
                  <span className="font-medium text-gray-900 dark:text-white">Artículo</span>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Imágenes
              </label>
              
              <div className="mb-4 grid grid-cols-3 gap-4">
                {previewUrls.map((url, index) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                    <Image
                      src={url}
                      alt={`Preview ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 33vw, 120px"
                      className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setZoomedImage(url)}
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(index);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                      aria-label="Eliminar imagen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors">
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Agregar</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {errors.images && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.images.message as string}
                </p>
              )}
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Título del {listingType === 'product' ? 'artículo' : 'servicio'}
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
                  { id: 'money', label: 'Dinero (Venta pura)', icon: '💵', desc: 'Solo aceptas efectivo/transferencia.' },
                  { id: 'product', label: 'Artículo (Trueque)', icon: '📦', desc: 'Cambias por otro objeto.' },
                  { id: 'service', label: 'Servicio (Trueque)', icon: '🛠️', desc: 'Cambias por un servicio.' },                  { id: 'exchange_plus_cash', label: 'Permuta (Mix)', icon: '??', desc: 'Art¡culo/Servicio + monto que proponga el comprador (usa precio referencial total).' },
                  { id: 'giveaway', label: 'Regalo', icon: '🎁', desc: 'Lo entregas gratis.' },
                ].map((type) => (
                  <label key={type.id} className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer transition-colors ${acceptedExchangeTypes?.includes(type.id as ExchangeType) ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <input
                      type="checkbox"
                      value={type.id}
                      checked={acceptedExchangeTypes?.includes(type.id as ExchangeType)}
                      onChange={(e) => handleExchangeTypeChange(type.id as ExchangeType, e.target.checked)}
                      data-field="acceptedExchangeTypes"
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{type.icon}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{type.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.acceptedExchangeTypes && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.acceptedExchangeTypes.message}
                </p>
              )}
            </div>

            {/* CAMPOS DINÁMICOS SEGÚN SELECCIÓN */}
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                
                {/* 1. DINERO o PERMUTA -> Pide Valor Total */}
                {(acceptedExchangeTypes?.includes("money") || acceptedExchangeTypes?.includes("exchange_plus_cash")) && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Valor Referencial del {listingType === 'product' ? 'artículo' : 'servicio'} (S/.)
                    </label>
                    <input
                    type="number"
                    step="0.01"
                    {...register("price", { valueAsNumber: true })}
                    placeholder="0.00"
                    data-field="price"
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                    />
                    {acceptedExchangeTypes?.includes("exchange_plus_cash") && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Precio referencial total: el valor estimado de tu producto/servicio. La oferta del interesado (producto/servicio) + el monto que pague debe acercarse a este valor.
                    </p>
                    )}
                    {errors.price && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {errors.price.message}
                    </p>
                    )}
                </div>
                )}

                {/* 3. TRUEQUE DE PRODUCTOS */}
                {(acceptedExchangeTypes?.includes("product") || acceptedExchangeTypes?.includes("exchange_plus_cash")) && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ¿Qué artículos buscas recibir?
                    </label>
                    <textarea
                    rows={3}
                    {...register("wantedProducts")}
                    data-field="wantedProducts"
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                    placeholder="Ej: Celular, Laptop, Bicicleta..."
                    />
                    {errors.wantedProducts && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {errors.wantedProducts.message}
                    </p>
                    )}
                </div>
                )}

                {/* 4. TRUEQUE DE SERVICIOS */}
                {(acceptedExchangeTypes?.includes("service") || acceptedExchangeTypes?.includes("exchange_plus_cash")) && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ¿Qué servicios buscas recibir?
                    </label>
                    <textarea
                    rows={3}
                    {...register("wantedServices")}
                    data-field="wantedServices"
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 p-2 text-base transition-colors"
                    placeholder="Ej: Clases de inglés, Fontanería, Asesoría legal..."
                    />
                    {errors.wantedServices && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {errors.wantedServices.message}
                    </p>
                    )}
                </div>
                )}

                {acceptedExchangeTypes?.includes("giveaway") && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md text-sm">
                        ✨ Tu publicación aparecerá en la sección de &quot;Regalos&quot; y será gratuita para quien la solicite.
                    </div>
                )}

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoría
                </label>
                <select
                  {...register("categoryId")}
                  data-field="categoryId"
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
                {categoryId === "other" && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Describe la categor¡a
                    </label>
                    <input
                      type="text"
                      {...register("otherCategoryLabel")}
                      data-field="otherCategoryLabel"
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                      placeholder="Ej: Repuestos de autos, Manualidades, Antigüedades"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Si no encuentras tu categor¡a, escribe c¢mo la llamar¡as.
                    </p>
                    {errors.otherCategoryLabel && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {errors.otherCategoryLabel.message}
                      </p>
                    )}
                  </div>
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
                    data-field="condition"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Departamento
                </label>
                <select
                  value={selectedDepartment}
                  onChange={handleDepartmentChange}
                  data-field="location"
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                >
                  <option value="">Selecciona un departamento</option>
                  {(Object.keys(LOCATIONS) as Department[]).map((dept) => (
                    <option key={dept} value={dept}>
                      {formatDepartmentLabel(dept)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Provincia
                </label>
                <select
                  value={selectedProvince}
                  onChange={handleProvinceChange}
                  disabled={!selectedDepartment}
                  data-field="location"
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors disabled:opacity-50"
                >
                  <option value="">Selecciona una provincia</option>
                    {selectedDepartment &&
                    (PROVINCES_BY_DEPARTMENT[selectedDepartment] ?? []).map(
                      (prov) => (
                        <option key={prov} value={prov}>
                          {formatLocationPart(prov)}
                        </option>
                      )
                    )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Distrito
                </label>
                <select
                  value={selectedDistrict}
                  onChange={handleDistrictChange}
                  disabled={!selectedDepartment}
                  data-field="location"
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors disabled:opacity-50"
                >
                  <option value="">Selecciona un distrito</option>
                  {selectedDepartment &&
                    LOCATIONS[selectedDepartment].map((dist) => (
                      <option key={dist} value={dist}>
                        {formatLocationPart(dist)}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {errors.location && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.location.message}
              </p>
            )}

            {/* Comunidad (opcional) */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Comunidad (opcional)
              </label>
              <select
                {...register("communityId")}
                value={communityId ?? ""}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
              >
                <option value="">Público (todas las comunidades)</option>
                {COMMUNITIES.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>

            {trendOptions.length > 0 && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tendencias
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Elige las tendencias que describen tu publicación para destacarla en búsquedas.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trendOptions.map((trend) => (
                    <label
                      key={trend.id}
                      className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                        trendTags.includes(trend.id)
                          ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-indigo-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={trendTags.includes(trend.id)}
                        onChange={(e) => handleTrendToggle(trend.id, e.target.checked)}
                        data-field="trendTags"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          {trend.icon && <span className="text-lg">{trend.icon}</span>}
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {trend.title}
                          </span>
                        </div>
                        {trend.subtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {trend.subtitle}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

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

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <Image
              src={zoomedImage}
              alt="Zoomed preview"
              width={1600}
              height={1600}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              unoptimized
            />
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute -top-4 -right-4 bg-white text-black rounded-full p-2 shadow-lg hover:bg-gray-200 transition-colors"
              aria-label="Cerrar vista previa"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <AlertModal
        open={!!alertModal}
        title={alertModal?.title ?? ""}
        description={alertModal?.description ?? ""}
        tone={alertModal?.tone}
        onClose={() => setAlertModal(null)}
      />
    </div>
  );
}
