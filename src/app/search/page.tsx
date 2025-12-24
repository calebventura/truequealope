"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, QueryConstraint } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import { ImageCarousel } from "@/components/ui/ImageCarousel";

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
        const constraints: QueryConstraint[] = [
           where("status", "in", ["active", "reserved", "sold"])
        ];

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
          soldAt: docSnap.data().soldAt?.toDate
              ? docSnap.data().soldAt.toDate()
              : docSnap.data().soldAt ? new Date(docSnap.data().soldAt) : undefined,
        })) as Product[];

        // Filter sold items > 24h
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        results = results.filter(p => {
             if (p.status === 'sold') {
                 if (!p.soldAt) return false;
                 return p.soldAt > oneDayAgo;
             }
             return true;
        });

        if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          results = results.filter(
            (p) =>
              p.title.toLowerCase().includes(lowerTerm) ||
              p.description.toLowerCase().includes(lowerTerm)
          );
        }

        results.sort((a, b) => {
            // Priority: Active/Reserved (0) < Sold (1)
            const scoreA = a.status === 'sold' ? 1 : 0;
            const scoreB = b.status === 'sold' ? 1 : 0;
            
            if (scoreA !== scoreB) return scoreA - scoreB;
            
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Explorar productos
        </h1>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm mb-8 space-y-4 dark:border dark:border-gray-800 transition-colors">
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
                className="w-full pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
              />
            </div>
            <div className="w-full md:w-48">
              <select
                id="category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
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
              className="w-full md:w-auto bg-indigo-600 dark:bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors font-medium"
            >
              Buscar
            </button>
          </form>

          {/* Filtro por modo */}
          <div className="inline-flex rounded-lg bg-gray-50 dark:bg-gray-800 p-1 border dark:border-gray-700 w-fit transition-colors">
            <button
              type="button"
              onClick={() => setModeFilter("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modeFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
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
                  : "text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
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
                  : "text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
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
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-sm dark:border dark:border-gray-800 transition-colors">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
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
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              No se encontraron productos
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const acceptedTypes =
                product.acceptedExchangeTypes ||
                (product.mode === "trade"
                  ? ["product"]
                  : product.mode === "both"
                  ? ["money", "product"]
                  : ["money"]);
              const isGiveaway = acceptedTypes.includes("giveaway");
              const isPermuta = acceptedTypes.includes("exchange_plus_cash");
              const acceptsMoney = acceptedTypes.includes("money");
              const acceptsTrade =
                acceptedTypes.includes("product") ||
                acceptedTypes.includes("service") ||
                acceptedTypes.includes("exchange_plus_cash");

              const wantedText =
                product.wanted && product.wanted.length > 0
                  ? product.wanted.slice(0, 2).join(", ")
                  : null;
              
              let modeBadge = null;
              if (isGiveaway) modeBadge = "Regalo";
              else if (isPermuta) modeBadge = "Permuta";
              else if (acceptsTrade && acceptsMoney) modeBadge = "Venta / Trueque";
              else if (acceptsTrade) modeBadge = "Trueque";

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group"
                >
                  <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col border border-transparent dark:border-gray-800">
                    <div className="relative h-48 w-full bg-gray-200 dark:bg-gray-800">
                      {modeBadge && (
                        <div className="absolute top-2 left-2 z-10 bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                          {modeBadge}
                        </div>
                      )}
                      {product.images && product.images.length > 0 ? (
                        product.images.length > 1 ? (
                          <ImageCarousel images={product.images} alt={product.title} />
                        ) : (
                          <Image
                            src={product.images[0]}
                            alt={product.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        )
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800">
                          <span className="text-4xl">
                            {product.listingType === 'service' ? '🛠️' : '📦'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-grow">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                        {product.title}
                      </h3>

                      {isGiveaway ? (
                        <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
                          Gratis
                        </p>
                      ) : acceptsMoney && product.price != null ? (
                        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                          {isPermuta ? `S/. ${product.price.toLocaleString()} (Dif.)` : `S/. ${product.price.toLocaleString()}`}
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                          {acceptsTrade ? "Solo trueque" : "Consultar"}
                        </p>
                      )}

                      {(acceptsTrade || isPermuta) && wantedText && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                          Busco: {wantedText}
                        </p>
                      )}

                      <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
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
