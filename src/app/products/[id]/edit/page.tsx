"use client";

import { useEffect, useState, use } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useAuth } from "@/hooks/useAuth";
import { Product } from "@/types/product";
import { CATEGORIES, CONDITIONS } from "@/lib/constants";
import { LOCATIONS, Department } from "@/lib/locations";
import { Button } from "@/components/ui/Button";
import { COMMUNITIES } from "@/lib/communities";

const productSchema = z
  .object({
    title: z.string().min(3, "El titulo debe tener al menos 3 caracteres"),
    description: z.string().optional(),
    price: z.number().positive("El precio debe ser mayor a 0").optional(),
    wanted: z.string().optional(),
    categoryId: z.string().min(1, "Selecciona una categoria"),
    condition: z.enum(["new", "like-new", "used"]).optional(),
    location: z.string().min(3, "Ingresa una ubicacion valida"),
    communityId: z.string().nullable().optional(),
    otherCategoryLabel: z.string().optional(),
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
  });

type ProductForm = z.input<typeof productSchema>;

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Location State
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
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
           alert("No puedes editar un producto vendido o eliminado.");
           router.replace("/activity");
           return;
        }

        reset({
          title: data.title,
          description: data.description,
          price: data.price ?? undefined,
          wanted: data.wanted?.join(", "),
          categoryId: data.categoryId,
          otherCategoryLabel: data.otherCategoryLabel ?? "",
          condition: data.condition,
          location: data.location,
          communityId: data.communityId ?? "",
        } as ProductForm);

        // Parse location
        if (data.location) {
          const parts = data.location.split(",").map((s) => s.trim());
          if (parts.length === 2) {
            const [dist, dept] = parts;
            if (Object.keys(LOCATIONS).includes(dept)) {
              const departmentKey = dept as Department;
              setSelectedDepartment(departmentKey);
              // Verify district exists in department (cast to string array for TS)
              const districts = LOCATIONS[departmentKey] as readonly string[];
              if (districts.includes(dist)) {
                setSelectedDistrict(dist);
              }
            }
          }
        }
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
    setSelectedDistrict("");
    setValue("location", "", { shouldValidate: true });
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dist = e.target.value;
    setSelectedDistrict(dist);
    if (selectedDepartment && dist) {
      setValue("location", `${dist}, ${selectedDepartment}`, { shouldValidate: true });
    }
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Precio (S/.)</label>
          <input
            type="number"
             step="0.01"
            {...register("price", { valueAsNumber: true })}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Departamento</label>
            <select
              value={selectedDepartment}
              onChange={handleDepartmentChange}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Selecciona un departamento</option>
              {Object.keys(LOCATIONS).map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Distrito</label>
            <select
              value={selectedDistrict}
              onChange={handleDistrictChange}
              disabled={!selectedDepartment}
              className="mt-1 block w-full border border-gray-300 dark:border-gray-700 p-2 rounded-md disabled:opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">Selecciona un distrito</option>
              {selectedDepartment &&
                LOCATIONS[selectedDepartment].map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
            </select>
          </div>
        </div>
        {/* Hidden input to register location for validation if needed, or just rely on setValue */}
        {/* We removed the input, so errors.location might not be displayed if we don't add it back or handle it */}
        {errors.location && (
            <p className="text-xs text-red-500 mt-1">{errors.location.message}</p>
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
    </div>
  );
}
