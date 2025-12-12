"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";

type ModeFilter = "all" | "sale" | "trade";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "";

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSearchTerm(searchParams.get("q") || "");
    setSelectedCategory(searchParams.get("category") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    if (selectedCategory) params.set("category", selectedCategory);
    router.push(`/search?${params.toString()}`);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const constraints: QueryConstraint[] = [where("status", "==", "active")];

        if (selectedCategory) {
          constraints.push(where("categoryId", "==", selectedCategory));
        }

        const q = query(collection(db, "products"), ...constraints);
        const querySnapshot = await getDocs(q);

        let results = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate
            ? docSnap.data().createdAt.toDate()
            : new Date(),
        })) as Product[];

        if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          results = results.filter(
            (p) =>
              p.title.toLowerCase().includes(lowerTerm) ||
              p.description.toLowerCase().includes(lowerTerm)
          );
        }

        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setProducts(results);
      } catch (error) {
        console.error("Error buscando productos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchTerm, selectedCategory]);

  const filteredProducts = products.filter((product) => {
    const mode = product.mode ?? "sale";
    if (modeFilter === "all") return true;
    if (modeFilter === "sale") return mode === "sale" || mode === "both";
    return mode === "trade" || mode === "both";
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Explorar productos
        </h1>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-8 space-y-4">
          <form
            onSubmit={handleSearch}
            className="flex flex-col md:flex-row gap-4"
          >
            <div className="flex-1 relative">
              <input
                type="text"
                id="search"
                placeholder="¿Qué estás buscando?"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-full md:w-48">
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Todas las categorías</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full md:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Buscar
            </button>
          </form>

          {/* Filtro por modo */}
          <div className="inline-flex rounded-lg bg-gray-50 p-1 border w-fit">
            <button
              type="button"
              onClick={() => setModeFilter("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modeFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-white"
              }`}
            >
              Ambos
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("sale")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modeFilter === "sale"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-white"
              }`}
            >
              Venta
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("trade")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modeFilter === "trade"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-white"
              }`}
            >
              Trueque
            </button>
          </div>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No se encontraron productos
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Intenta con otros términos, categorías o filtros.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("");
                  setModeFilter("all");
                  router.push("/search");
                }}
                className="text-blue-600 hover:text-blue-500 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const mode = product.mode ?? "sale";
              const wantedText =
                product.wanted && product.wanted.length > 0
                  ? product.wanted.slice(0, 2).join(", ")
                  : null;
              const modeBadge =
                mode === "trade"
                  ? "Trueque"
                  : mode === "both"
                  ? "Venta / Trueque"
                  : null;

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
                    <div className="relative h-48 w-full bg-gray-200">
                      {modeBadge && (
                        <div className="absolute top-2 left-2 z-10 bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                          {modeBadge}
                        </div>
                      )}
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={product.images[0]}
                          alt={product.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
                        {product.title}
                      </h3>

                      {mode !== "trade" && product.price != null ? (
                        <p className="text-xl font-bold text-gray-900 mt-1">
                          ${product.price.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-gray-700 mt-1">
                          {mode === "trade" ? "Solo trueque" : "Sin precio"}
                        </p>
                      )}

                      {(mode === "trade" || mode === "both") && wantedText && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          Busco: {wantedText}
                        </p>
                      )}

                      <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
                        <span className="capitalize bg-gray-100 px-2 py-1 rounded text-xs">
                          {CATEGORIES.find((c) => c.id === product.categoryId)
                            ?.name || "Otro"}
                        </span>
                        <span>{product.location}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Cargando...
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
