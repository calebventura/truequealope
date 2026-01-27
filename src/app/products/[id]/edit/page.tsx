
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
  DEPARTMENTS,
  formatDepartmentLabel,
  formatLocationPart,
  buildLocationLabel,
  parseLocationParts,
  getDistrictsFor,
} from "@/lib/locations";
import { Button } from "@/components/ui/Button";
import { COMMUNITIES } from "@/lib/communities";
import { AlertModal } from "@/components/ui/AlertModal";
import { getActiveTrends } from "@/lib/trends";

const exchangeTypes = [
  { id: "money" as const, label: "Venta", desc: "Recibes dinero por tu publicación." },
  { id: "product" as const, label: "Trueque (Artículo)", desc: "Intercambias por otro producto." },
  { id: "service" as const, label: "Trueque (Servicio)", desc: "Intercambias por un servicio." },
  { id: "exchange_plus_cash" as const, label: "Permuta (Mix)", desc: "Producto/Servicio + dinero como diferencia." },
  { id: "giveaway" as const, label: "Regalo", desc: "Lo entregas sin pago." },
];

const productSchema = z
  .object({
    title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    listingType: z.enum(["product", "service"]).default("product"),
    acceptedExchangeTypes: z
      .array(
        z.enum(["money", "product", "service", "exchange_plus_cash", "giveaway"])
      )
      .min(1, "Selecciona al menos una opción"),
    price: z.number().optional(),
    wantedProducts: z.string().optional(),
    wantedServices: z.string().optional(),
    categoryId: z.string().min(1, "Selecciona una categoría"),
    condition: z.enum(["new", "like-new", "used"]).optional(),
    location: z.string().min(3, "Selecciona departamento, provincia y distrito"),
    communityIds: z.array(z.string()).optional(),
    otherCategoryLabel: z.string().optional(),
    trendTags: z.array(z.string()).optional(),
    images: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    const types = data.acceptedExchangeTypes || [];
    const hasPrice = typeof data.price === "number" && data.price > 0;

    if (!hasPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Ingresa el valor referencial",
      });
    }

    if (types.includes("exchange_plus_cash")) {
      if (!hasPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Ingresa el valor total",
        });
      }
      if (!data.wantedProducts?.trim() && !data.wantedServices?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wantedProducts"],
          message: "Especifica qué buscas (producto o servicio)",
        });
      }
    }

    if ((types.includes("product") || types.includes("service")) && !types.includes("exchange_plus_cash")) {
      if (types.includes("product") && !data.wantedProducts?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wantedProducts"],
          message: "Describe qué artículos buscas",
        });
      }
      if (types.includes("service") && !data.wantedServices?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wantedServices"],
          message: "Describe qué servicios buscas",
        });
      }
    }

    if (data.categoryId === "other") {
      const other = data.otherCategoryLabel?.trim();
      if (!other || other.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["otherCategoryLabel"],
          message: "Describe la categoría (min. 3 caracteres)",
        });
      }
    }
  });

type ProductForm = z.input<typeof productSchema>;

const normalizeAccepted = (product: Product): ExchangeType[] => {
  if (product.acceptedExchangeTypes && product.acceptedExchangeTypes.length > 0) {
    return product.acceptedExchangeTypes as ExchangeType[];
  }
  const arr: ExchangeType[] = [];
  if (product.mode === "both") arr.push("money", "product");
  else if (product.mode === "sale") arr.push("money");
  else if (product.mode === "trade") arr.push("product");
  else if (product.mode === "giveaway") arr.push("giveaway");
  return arr.length ? arr : ["product"];
};

const parseWanted = (wanted?: string[] | null) => {
  const result: { products?: string; services?: string } = {};
  if (!wanted) return result;
  wanted.forEach((entry) => {
    const lower = entry.toLowerCase();
    if (lower.startsWith("productos:")) {
      result.products = entry.split(":")[1]?.trim();
    } else if (lower.startsWith("servicios:")) {
      result.services = entry.split(":")[1]?.trim();
    }
  });
  return result;
};

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

  const acceptedExchangeTypesWatch = watch("acceptedExchangeTypes", []);
  const trendTags = watch("trendTags") || [];
  const communityIds = watch("communityIds") || [];
  const trendOptions = useMemo(() => getActiveTrends(), []);

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
          router.replace("/activity");
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

        const accepted = normalizeAccepted(data);
        const wantedParsed = parseWanted(data.wanted);
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
          description: data.description ?? "",
          listingType: (data.listingType as "product" | "service") ?? "product",
          acceptedExchangeTypes: accepted,
          price: data.price ?? undefined,
          wantedProducts: data.wantedProducts ?? wantedParsed.products ?? "",
          wantedServices: data.wantedServices ?? wantedParsed.services ?? "",
          categoryId: data.categoryId,
          otherCategoryLabel: data.otherCategoryLabel ?? "",
          condition: data.condition,
          location: formattedLocation,
          communityIds: data.communityIds ?? (data.communityId ? [data.communityId] : []),
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

  const handleCommunityToggle = (id: string, checked: boolean) => {
    const current = new Set(communityIds);
    if (checked) current.add(id);
    else current.delete(id);
    setValue("communityIds", Array.from(current), { shouldValidate: false });
  };

  const toggleExchangeType = (type: ExchangeType, checked: boolean) => {
    const current = new Set(acceptedExchangeTypesWatch);
    if (checked) {
      current.add(type);
      if (type === "giveaway") {
        current.clear();
        current.add("giveaway");
      } else {
        current.delete("giveaway");
      }
    } else {
      current.delete(type);
    }

    // Limpia campos que ya no aplican cuando se desactivan
    if (!current.has("product") && !current.has("exchange_plus_cash")) {
      setValue("wantedProducts", "", { shouldValidate: true });
    }
    if (!current.has("service") && !current.has("exchange_plus_cash")) {
      setValue("wantedServices", "", { shouldValidate: true });
    }

    setValue("acceptedExchangeTypes", Array.from(current) as ExchangeType[], {
      shouldValidate: true,
    });
  };

  const hasMoney = acceptedExchangeTypesWatch.includes("money");
  const hasPermuta = acceptedExchangeTypesWatch.includes("exchange_plus_cash");
  const hasTruequeProduct = acceptedExchangeTypesWatch.includes("product");
  const hasTruequeService = acceptedExchangeTypesWatch.includes("service");
  const showProductsField = hasTruequeProduct || hasPermuta;
  const showServicesField = hasTruequeService || hasPermuta;

  const priceLabel = hasPermuta
    ? "Precio referencial total (S/.)"
    : hasMoney
    ? "Precio de venta (S/.)"
    : "Valor referencial (S/.)";

  const priceHelper = hasPermuta
    ? "Precio referencial total: valor estimado; el interesado aporta producto/servicio + dinero."
    : hasMoney
    ? "Monto que esperas recibir."
    : "Valor referencial para orientar el trueque o regalo.";

  const onSubmit = async (data: ProductForm) => {
    setSaving(true);
    setError("");

    const selectedCommunities = data.communityIds?.filter(Boolean) ?? [];
    const trimmedOther = data.otherCategoryLabel?.trim() || "";
    const wantedProducts = data.wantedProducts?.trim() || "";
    const wantedServices = data.wantedServices?.trim() || "";

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          acceptedExchangeTypes: data.acceptedExchangeTypes,
          price: data.price ?? null,
          wantedProducts:
            showProductsField && wantedProducts ? wantedProducts : null,
          wantedServices:
            showServicesField && wantedServices ? wantedServices : null,
          wanted: [
            ...(showProductsField && wantedProducts
              ? [`Productos: ${wantedProducts}`]
              : []),
            ...(showServicesField && wantedServices
              ? [`Servicios: ${wantedServices}`]
              : []),
          ],
          visibility: selectedCommunities.length > 0 ? "community" : "public",
          communityId: selectedCommunities[0] ?? null,
          communityIds: selectedCommunities,
          trendTags: data.trendTags ?? [],
          otherCategoryLabel: data.categoryId === "other" ? trimmedOther : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error actualizando el producto");
      }

      router.push("/activity?tab=seller");
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return <div className="p-8 text-center text-gray-800 dark:text-gray-200">Cargando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md rounded-lg mt-10 transition-colors">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Editar publicación</h1>

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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de intercambio</label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exchangeTypes.map((option) => (
              <label
                key={option.id}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                  acceptedExchangeTypesWatch.includes(option.id)
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-300 dark:border-gray-700 hover:border-gray-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptedExchangeTypesWatch.includes(option.id)}
                  onChange={(e) => toggleExchangeType(option.id, e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Puedes combinar Venta + Trueque. Permuta implica producto/servicio + dinero. Regalo es exclusivo.
          </p>
          {errors.acceptedExchangeTypes && (
            <p className="text-xs text-red-500 mt-1">{errors.acceptedExchangeTypes.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{priceLabel}</label>
          <input
            type="number"
            step="0.01"
            {...register("price", { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{priceHelper}</p>
          {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
        </div>

        {(showProductsField || showServicesField) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showProductsField && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Qué productos buscas</label>
                <textarea
                  {...register("wantedProducts")}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Ej: Tablet, TV, cámara"
                />
                {errors.wantedProducts && (
                  <p className="text-xs text-red-500 mt-1">{errors.wantedProducts.message}</p>
                )}
              </div>
            )}
            {showServicesField && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Qué servicios buscas</label>
                <textarea
                  {...register("wantedServices")}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Ej: reparación, clases, diseño"
                />
                {errors.wantedServices && (
                  <p className="text-xs text-red-500 mt-1">{errors.wantedServices.message}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</label>
            <select
              {...register("categoryId")}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {watch("categoryId") === "other" && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Describe la categoría
                </label>
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
            <select
              {...register("condition")}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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
              {DEPARTMENTS.map((dept) => (
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
                (PROVINCES_BY_DEPARTMENT[selectedDepartment] ?? []).map((prov) => (
                  <option key={prov} value={prov}>
                    {formatLocationPart(prov)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Distrito</label>
            <select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              disabled={!selectedDepartment || !selectedProvince}
              data-field="location"
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Selecciona un distrito</option>
              {selectedDepartment &&
                getDistrictsFor(selectedDepartment, selectedProvince).map((dist) => (
                  <option key={dist} value={dist}>
                    {formatLocationPart(dist)}
                  </option>
                ))}
            </select>
          </div>
        </div>
        {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location.message}</p>}

        {trendOptions.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tendencias</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Marca las tendencias que encajan con tu publicación.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trendOptions.map((trend) => (
                <label
                  key={trend.id}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    trendTags.includes(trend.id)
                      ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                      : "border-gray-200 dark:border-gray-700 hover-border-indigo-200"
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
                      <span className="font-medium text-gray-900 dark:text-gray-100">{trend.title}</span>
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
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Comunidades (opcional)</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Si eliges una o más, la publicación será visible solo dentro de esas comunidades.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COMMUNITIES.map((community) => (
              <label key={community.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={communityIds.includes(community.id)}
                  onChange={(e) => handleCommunityToggle(community.id, e.target.checked)}
                />
                <span>{community.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>

      {alertModal && (
        <AlertModal
          open={Boolean(alertModal)}
          onClose={() => setAlertModal(null)}
          onConfirm={() => setAlertModal(null)}
          title={alertModal.title}
          description={alertModal.description}
          tone={alertModal.tone}
          primaryLabel="Entendido"
        />
      )}
    </div>
  );
}
