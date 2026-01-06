"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { CATEGORIES } from "@/lib/constants";
import {
  TrendConfig,
  getActiveTrends,
  getTrendById,
  isTrendActive,
} from "@/lib/trends";
import {
  ExchangeFilter,
  ListingFilter,
  getAcceptedExchangeTypes,
  matchesExchangeFilter,
  matchesListingFilter,
} from "@/lib/productFilters";
import Link from "next/link";
import Image from "next/image";
import { ImageCarousel } from "@/components/ui/ImageCarousel";
import { useAuth } from "@/hooks/useAuth";
import { FiltersPanel } from "@/components/FiltersPanel";
import {
  COMMUNITIES,
  getCommunityById,
} from "@/lib/communities";

const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const initialQuery = searchParams.get("q") || "";

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [exchangeFilters, setExchangeFilters] = useState<ExchangeFilter[]>([]);
  const [listingFilters, setListingFilters] = useState<ListingFilter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityFilters, setCommunityFilters] = useState<string[]>([]);
  const nowTimestamp = Date.now();

  const activeTrends = useMemo(() => {
    if (selectedTrends.length === 0) return [];
    return selectedTrends
      .map((trendId) => getTrendById(trendId))
      .filter(
        (trend): trend is TrendConfig => Boolean(trend && isTrendActive(trend))
      );
  }, [selectedTrends]);
  const trendOptions = getActiveTrends();

  useEffect(() => {
    setSearchTerm(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm) params.set("q", searchTerm);
    const queryString = params.toString();
    router.push(queryString ? `/search?${queryString}` : "/search");
  };

  const applyTrendFilters = useCallback(
    (items: Product[]) => {
      if (activeTrends.length === 0) return items;

      const matchesTrend = (product: Product, trend: TrendConfig) => {
        const { filters, productIds } = trend;

        if (productIds && productIds.length > 0) {
          if (!product.id || !productIds.includes(product.id)) return false;
        }

        if (filters?.categoryId && product.categoryId !== filters.categoryId) {
          return false;
        }

        if (filters?.categoryIds && filters.categoryIds.length > 0) {
          if (!filters.categoryIds.includes(product.categoryId)) return false;
        }

        if (filters?.condition && product.condition !== filters.condition) {
          return false;
        }

        if (
          filters?.listingType &&
          (product.listingType ?? "product") !== filters.listingType
        ) {
          return false;
        }

        if (filters?.trendTagsAny && filters.trendTagsAny.length > 0) {
          const tags = product.trendTags ?? [];
          const matchesTag = tags.some((tag) => filters.trendTagsAny?.includes(tag));
          if (!matchesTag) return false;
        }

        if (filters?.exchangeTypesAny && filters.exchangeTypesAny.length > 0) {
          const accepted = getAcceptedExchangeTypes(product);
          const matchesType = filters.exchangeTypesAny.some((type) =>
            accepted.includes(type)
          );
          if (!matchesType) return false;
        }

        if (filters?.searchQuery) {
          const lowerQuery = filters.searchQuery.toLowerCase();
          const matchesQuery =
            product.title.toLowerCase().includes(lowerQuery) ||
            product.description.toLowerCase().includes(lowerQuery);
          if (!matchesQuery) return false;
        }

        return true;
      };

      return items.filter((product) =>
        activeTrends.some((trend) => matchesTrend(product, trend))
      );
    },
    [activeTrends]
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedCategories([]);
    setSelectedTrends([]);
    setCommunityFilters([]);
    setExchangeFilters([]);
    setListingFilters([]);
    router.push("/search");
  };

  const exchangeLabels: Record<ExchangeFilter, string> = {
    all: "Todos",
    sale: "Venta",
    trade: "Trueque",
    permuta: "Permuta",
    giveaway: "Regalo",
  };
  const listingLabels: Record<ListingFilter, string> = {
    all: "Todos",
    product: "Producto",
    service: "Servicio",
  };

  const formatSelectionLabel = (
    values: string[],
    labelForValue: (value: string) => string,
    fallback: string
  ) => {
    if (values.length === 0) return fallback;
    const labels = values.map(labelForValue);
    if (labels.length <= 2) return labels.join(", ");
    return `${labels[0]} +${labels.length - 1}`;
  };

  const formatFilterLabels = <T extends string>(
    values: T[],
    labels: Record<T, string>,
    fallback: string
  ) => {
    if (values.length === 0) return fallback;
    const names = values.map((value) => labels[value]);
    if (names.length <= 2) return names.join(", ");
    return `${names[0]} +${names.length - 1}`;
  };

  const communityLabel = formatSelectionLabel(
    communityFilters,
    (value) =>
      value === "public"
        ? "Publico"
        : COMMUNITIES.find((community) => community.id === value)?.name ??
          "Comunidad",
    "Todas"
  );
  const categoryLabel = formatSelectionLabel(
    selectedCategories,
    (value) =>
      CATEGORIES.find((category) => category.id === value)?.name ?? "Categoria",
    "Todas"
  );
  const trendLabel = formatSelectionLabel(
    selectedTrends,
    (value) => getTrendById(value)?.title ?? "Tendencia",
    "Todas"
  );
  const exchangeLabel = formatFilterLabels(
    exchangeFilters,
    exchangeLabels,
    exchangeLabels.all
  );
  const listingLabel = formatFilterLabels(
    listingFilters,
    listingLabels,
    listingLabels.all
  );

  const activeFilterCount =
    (selectedCategories.length > 0 ? 1 : 0) +
    (selectedTrends.length > 0 ? 1 : 0) +
    (communityFilters.length > 0 ? 1 : 0) +
    (exchangeFilters.length > 0 ? 1 : 0) +
    (listingFilters.length > 0 ? 1 : 0);

  const activeFilterPills = [
    selectedCategories.length > 0 && {
      key: "category",
      label: `Categoria: ${categoryLabel}`,
      onClear: () => setSelectedCategories([]),
    },
    selectedTrends.length > 0 && {
      key: "trend",
      label: `Tendencia: ${trendLabel}`,
      onClear: () => setSelectedTrends([]),
    },
    communityFilters.length > 0 && {
      key: "community",
      label: `Comunidad: ${communityLabel}`,
      onClear: () => setCommunityFilters([]),
    },
    exchangeFilters.length > 0 && {
      key: "exchange",
      label: `Intercambio: ${exchangeLabel}`,
      onClear: () => setExchangeFilters([]),
    },
    listingFilters.length > 0 && {
      key: "listing",
      label: `Publicacion: ${listingLabel}`,
      onClear: () => setListingFilters([]),
    },
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    onClear: () => void;
  }>;


  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "products"),
          where("status", "in", ["active", "reserved"])
        );
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
  }, [user, authLoading]);

  const filteredProducts = useMemo(() => {
    let filtered = applyTrendFilters(products);

    if (selectedCategories.length > 0) {
      const categorySet = new Set(selectedCategories);
      filtered = filtered.filter((product) => categorySet.has(product.categoryId));
    }

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.title.toLowerCase().includes(lowerTerm) ||
          product.description.toLowerCase().includes(lowerTerm)
      );
    }

    if (communityFilters.length > 0) {
      const includePublic = communityFilters.includes("public");
      const communityIds = new Set(
        communityFilters.filter((value) => value !== "public")
      );

      filtered = filtered.filter((product) => {
        const isPublic = (product.visibility ?? "public") !== "community";
        if (includePublic && isPublic) return true;
        if (product.communityId && communityIds.has(product.communityId)) return true;
        return false;
      });
    }

    if (exchangeFilters.length > 0) {
      filtered = filtered.filter((product) =>
        exchangeFilters.some((filter) => matchesExchangeFilter(product, filter))
      );
    }

    if (listingFilters.length > 0) {
      filtered = filtered.filter((product) =>
        listingFilters.some((filter) => matchesListingFilter(product, filter))
      );
    }

    return filtered;
  }, [
    products,
    applyTrendFilters,
    selectedCategories,
    searchTerm,
    communityFilters,
    exchangeFilters,
    listingFilters,
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Explorar productos
        </h1>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm mb-8 space-y-4 dark:border dark:border-gray-800 transition-colors">
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    id="search"
                    placeholder="Que estas buscando?"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full md:w-auto bg-indigo-600 dark:bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors font-medium"
                >
                  Buscar
                </button>
              </div>
            </form>

            <FiltersPanel
              activeCount={activeFilterCount}
              pills={activeFilterPills}
              onClearAll={clearAllFilters}
              emptyLabel="Sin filtros activos"
              category={{
                values: selectedCategories,
                options: CATEGORIES,
                onApply: setSelectedCategories,
              }}
              trend={{
                values: selectedTrends,
                options: trendOptions,
                onApply: setSelectedTrends,
              }}
              community={{
                values: communityFilters,
                options: [
                  { id: "all", name: "Todas" },
                  { id: "public", name: "Publico" },
                  ...COMMUNITIES,
                ],
                onApply: setCommunityFilters,
              }}
              exchange={{
                values: exchangeFilters,
                labels: exchangeLabels,
                onApply: setExchangeFilters,
              }}
              listing={{
                values: listingFilters,
                labels: listingLabels,
                onApply: setListingFilters,
              }}
            />
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
              Intenta con otros terminos, categorias o filtros.
            </p>
            <div className="mt-6">
              <button
                onClick={clearAllFilters}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const acceptedTypes = getAcceptedExchangeTypes(product);
              const isGiveaway = acceptedTypes.includes("giveaway");
              const isPermuta = acceptedTypes.includes("exchange_plus_cash");
              const acceptsMoney = acceptedTypes.includes("money");
              const isOwn = Boolean(user && product.sellerId === user.uid);
              const isNew =
                product.status !== "sold" &&
                nowTimestamp - product.createdAt.getTime() < NEW_BADGE_WINDOW_MS;
              const acceptsTrade =
                acceptedTypes.includes("product") ||
                acceptedTypes.includes("service") ||
                acceptedTypes.includes("exchange_plus_cash");
              const communityLabel =
                product.visibility === "community" && product.communityId
                  ? getCommunityById(product.communityId)?.name ?? "Comunidad privada"
                  : "Público";

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
                  <div
                    className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col border ${
                      isOwn
                        ? "border-indigo-200 dark:border-indigo-900 ring-1 ring-indigo-200/60 dark:ring-indigo-900/60"
                        : "border-transparent dark:border-gray-800"
                    }`}
                  >
                    <div className="relative h-48 w-full bg-gray-200 dark:bg-gray-800">
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        {isOwn && (
                          <span className="bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                            Tu publicacion
                          </span>
                        )}
                        {isNew && (
                          <span className="bg-yellow-100 dark:bg-yellow-900/80 text-yellow-800 dark:text-yellow-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                            Nuevo
                          </span>
                        )}
                        {modeBadge && (
                          <span className="bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                            {modeBadge}
                          </span>
                        )}
                      </div>
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
                          {isPermuta
                            ? `S/. ${product.price.toLocaleString()} (Ref.)`
                            : `S/. ${product.price.toLocaleString()}`}
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
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            {product.viewCount ?? 0}
                          </span>
                          <span>{product.location}</span>
                          <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium">
                            {communityLabel}
                          </span>
                        </div>
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
