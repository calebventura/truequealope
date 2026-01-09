"use client";

import { useEffect, useMemo, useState, use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Product, ExchangeType } from "@/types/product";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";
import {
  LOCATIONS,
  Department,
  PROVINCES_BY_DEPARTMENT,
  formatDepartmentLabel,
  formatLocationPart,
  buildLocationLabel,
  parseLocationParts,
} from "@/lib/locations";
import { Button } from "@/components/ui/Button";
import { COMMUNITIES } from "@/lib/communities";
import { AlertModal } from "@/components/ui/AlertModal";
import { getActiveTrends } from "@/lib/trends";

const productSchema = z
  .object({
    title: z.string().min(3, "El titulo debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    price: z.number().positive("El precio debe ser mayor a 0").optional(),
    wanted: z.string().optional(),
    categoryId: z.string().min(1, "Selecciona una categoria"),
    condition: z.enum(["new", "like-new", "used"]).optional(),
    location: z.string().min(3, "Selecciona departamento, provincia y distrito"),
    communityId: z.string().nullable().optional(),
    otherCategoryLabel: z.string().optional(),
    exchangeMode: z.enum(["sale", "giveaway", "trade", "permuta"]),
    trendTags: z.array(z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.categoryId === "other") {
      const trimmed = (val.otherCategoryLabel ?? "").trim();
      if (trimmed.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["otherCategoryLabel"],
          message: "Describe la categoria para 'Otros'.",
        });
      }
    }

    if ((val.exchangeMode === "sale" || val.exchangeMode === "permuta") && (!val.price || Number.isNaN(val.price))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Ingresa el precio para este método.",
      });
    }
  });

type ProductForm = z.input<typeof productSchema>;

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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

  // Location State
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });
  const categoryId = watch("categoryId");
  const exchangeModeWatch = watch("exchangeMode");
  const trendTags = watch("trendTags") || [];
  const trendOptions = useMemo(() => getActiveTrends(), []);

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

  const deriveExchangeMode = (product: Product): "sale" | "giveaway" | "trade" | "permuta" => {
    const accepted = product.acceptedExchangeTypes || [];
    if (accepted.includes("giveaway")) return "giveaway";
    if (accepted.includes("exchange_plus_cash")) return "permuta";
    if (accepted.some((t) => t === "product" || t === "service")) return "trade";
    return "sale";
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, "products", productId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          router.replace("/activity");
          return;
        }

        const data = snap.data() as Product;
        
        if (user && data.sellerId !== user.uid) {
             router.replace("/activity"); // Unauthorized
             return;
        }

        if (data.status === "sold" || data.status === "deleted") {
           showAlert("No puedes editar un producto vendido o eliminado.", {
             tone: "info",
             title: "Edición no disponible",
           });
           router.replace("/activity");
           return;
        }

        const exchangeMode = deriveExchangeMode(data);

        const parsedLocation = parseLocationParts(data.location);
        const formattedLocation =
          parsedLocation.department &&
          parsedLocation.province &&
          parsedLocation.district
            ? buildLocationLabel(
                parsedLocation.district,
                parsedLocation.province,
                parsedLocation.department
              )
            : data.location;

        reset({
          title: data.title,
          description: data.description,
          price: data.price ?? undefined,
          wanted: data.wanted?.join(", "),
          categoryId: data.categoryId,
          otherCategoryLabel: data.otherCategoryLabel ?? "",
          condition: data.condition,
          location: formattedLocation,
          communityId: data.communityId ?? "",
          exchangeMode,
          trendTags: data.trendTags ?? [],
        } as ProductForm);

        setSelectedDepartment(parsedLocation.department);
        setSelectedProvince(parsedLocation.province);
        setSelectedDistrict(parsedLocation.district);
      } catch (err) {
        console.error(err);
        setError("Error cargando el producto");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
        fetchProduct();
    }
  }, [productId, user, authLoading, reset, router]);

  // Limpiar precio si el modo no requiere monto
  useEffect(() => {
    if (exchangeModeWatch === "giveaway" || exchangeModeWatch === "trade") {
      setValue("price", undefined, { shouldValidate: true });
    }
  }, [exchangeModeWatch, setValue]);

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
    setSaving(true);
    setError("");

    const selectedCommunity = data.communityId || null;
    const trimmedOther = data.otherCategoryLabel?.trim() || "";

    try {
        const token = await user?.getIdToken();
        const res = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ...data,
                visibility: "public",
                communityId: selectedCommunity,
                trendTags: data.trendTags ?? [],
                exchangeMode: undefined, // evitar guardar el helper directo
                acceptedExchangeTypes: (() => {
                  const mode = data.exchangeMode;
                  const list: ExchangeType[] = [];
                  if (mode === "sale") list.push("money");
                  else if (mode === "giveaway") list.push("giveaway");
                  else if (mode === "trade") list.push("product");
                  else if (mode === "permuta") list.push("exchange_plus_cash", "product");
                  return list;
                })(),
                price:
                  data.exchangeMode === "sale" || data.exchangeMode === "permuta"
                    ? data.price ?? null
                    : null,
                wanted: data.wanted ? data.wanted.split(',').map(s => s.trim()).filter(Boolean) : [],
                otherCategoryLabel: data.categoryId === "other" ? trimmedOther : null,
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Error updating product");
        }

        router.push("/activity?tab=seller");
    } catch (err) {
        console.error(err);
        setError((err as Error).message);
    } finally {
        setSaving(false);
    }
  };

  if (loading || authLoading) return <div className="p-8 text-center text-gray-800 dark:text-gray-200">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md rounded-lg mt-10 transition-colors">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Editar Producto</h1>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
          <input
            type="text"
            {...register("title")}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Método de intercambio</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { id: "sale", label: "Venta" },
              { id: "permuta", label: "Permuta" },
              { id: "trade", label: "Trueque" },
              { id: "giveaway", label: "Regalo" },
            ].map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                  exchangeModeWatch === option.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-300 dark:border-gray-700"
                }`}
              >
                <input
                  type="radio"
                  value={option.id}
                  {...register("exchangeMode")}
                  checked={exchangeModeWatch === option.id}
                  onChange={(e) => setValue("exchangeMode", e.target.value as ProductForm["exchangeMode"])}
                />
                <span className="text-sm text-gray-800 dark:text-gray-100">{option.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Venta y permuta requieren precio. Trueque y regalo no necesitan monto.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Precio (S/.)</label>
          <input
            type="number"
             step="0.01"
            {...register("price", { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={exchangeModeWatch === "giveaway" || exchangeModeWatch === "trade"}
          />
          {(exchangeModeWatch === "giveaway" || exchangeModeWatch === "trade") && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No se requiere precio para este método.</p>
          )}
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
        </div>

         <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Busco a cambio</label>
            <input
            type="text"
            {...register("wanted")}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
                <select {...register("categoryId")} className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {categoryId === "other" && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Describe la categor��a</label>
                    <input
                      type="text"
                      {...register("otherCategoryLabel")}
                      className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Ej: Repuestos de autos, Manualidades"
                    />
                    {errors.otherCategoryLabel && (
                      <p className="text-xs text-red-500 mt-1">{errors.otherCategoryLabel.message}</p>
                    )}
                  </div>
                )}
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Condición</label>
                <select {...register("condition")} className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                     {CONDITIONS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
            <select
              value={selectedDepartment}
              onChange={handleDepartmentChange}
              data-field="location"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provincia</label>
            <select
              value={selectedProvince}
              onChange={handleProvinceChange}
              disabled={!selectedDepartment}
              data-field="location"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Distrito</label>
            <select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              disabled={!selectedDepartment}
              data-field="location"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
            <p className="text-xs text-red-500 mt-1">{errors.location.message}</p>
        )}

        {trendOptions.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tendencias</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Marca las tendencias que encajan con tu publicaci¢n.
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{trend.subtitle}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="border border-gray-200 rounded-md p-3 space-y-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Comunidad (opcional)</p>
          <select
            {...register("communityId")}
            className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 text-sm"
          >
            <option value="">Público (todas las comunidades)</option>
            {COMMUNITIES.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descripción</label>
          <textarea
            {...register("description")}
            rows={4}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar Cambios"}</Button>
        </div>
      </form>

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
