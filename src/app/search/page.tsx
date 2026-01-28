"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { CATEGORIES, DEFAULT_EXPLORE_PAGE_SIZE, SORT_OPTIONS, DEFAULT_SORT, SortOption } from "@/lib/constants";
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
import { useAuth } from "@/hooks/useAuth";
import { FiltersPanel } from "@/components/FiltersPanel";
import {
  COMMUNITIES,
} from "@/lib/communities";
import { ProductCard } from "@/components/ProductCard";

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  const initialQuery = searchParams.get("q") || "";

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTrends, setSelectedTrends] = useState<string[]>([]);
  const [exchangeFilters, setExchangeFilters] = useState<ExchangeFilter[]>([]);
  const [listingFilters, setListingFilters] = useState<ListingFilter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [communityFilters, setCommunityFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);
  const nowTimestamp = Date.now();
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_EXPLORE_PAGE_SIZE);

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
    setDebouncedSearch(searchParams.get("q") || "");

    const parseMulti = (key: string) =>
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(",").map((v) => v.trim()))
        .filter(Boolean);

    setSelectedTrends(parseMulti("trend"));
    setSelectedCategories(parseMulti("category"));
    setCommunityFilters(parseMulti("community"));
    setExchangeFilters(
      parseMulti("exchange").filter((v): v is ExchangeFilter =>
        ["sale", "trade", "permuta", "giveaway"].includes(v)
      )
    );
    setListingFilters(
      parseMulti("listing").filter((v): v is ListingFilter =>
        ["product", "service"].includes(v)
      )
    );
    const sortParam = searchParams.get("sort");
    if (sortParam && SORT_OPTIONS.some((opt) => opt.value === sortParam)) {
      setSortBy(sortParam as SortOption);
    } else {
      setSortBy(DEFAULT_SORT);
    }
    setFiltersHydrated(true);
  }, [searchParams]);

  const syncQueryFromState = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    selectedCategories.forEach((id) => params.append("category", id));
    selectedTrends.forEach((id) => params.append("trend", id));
    communityFilters.forEach((id) => params.append("community", id));
    exchangeFilters.forEach((id) => params.append("exchange", id));
    listingFilters.forEach((id) => params.append("listing", id));
    if (sortBy !== DEFAULT_SORT) {
      params.set("sort", sortBy);
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    communityFilters,
    exchangeFilters,
    listingFilters,
    pathname,
    router,
    searchParams,
    sortBy,
    debouncedSearch,
    selectedCategories,
    selectedTrends,
  ]);

  useEffect(() => {
    if (!filtersHydrated) return;
    syncQueryFromState();
    setVisibleCount(DEFAULT_EXPLORE_PAGE_SIZE);
  }, [
    syncQueryFromState,
    selectedCategories,
    selectedTrends,
    communityFilters,
    exchangeFilters,
    listingFilters,
    sortBy,
  ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchTerm.trim());
    syncQueryFromState();
    setVisibleCount(DEFAULT_EXPLORE_PAGE_SIZE);
  };

  const applyTrendFilters = useCallback(
    (items: Product[]) => {
      if (activeTrends.length === 0) return items;

      const matchesTrend = (product: Product, trend: TrendConfig) => {
        const { filters, productIds } = trend;

        // If the product was etiquetado explícitamente con esta tendencia, ya cuenta.
        if (product.trendTags?.includes(trend.id)) return true;

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

      // Basta con que coincida con una de las tendencias seleccionadas.
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
    setSortBy(DEFAULT_SORT);
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

    if (debouncedSearch) {
      const lowerTerm = debouncedSearch.toLowerCase();
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
        const productCommunities = (
          [product.communityId, ...(product.communityIds ?? [])].filter(
            (id): id is string => Boolean(id)
          )
        );
        const isPublic =
          (product.visibility ?? "public") !== "community" ||
          productCommunities.length === 0;
        if (includePublic && isPublic) return true;
        for (const cid of productCommunities) {
          if (communityIds.has(cid)) return true;
        }
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

    // Aplicar ordenamiento
    const sorted = [...filtered];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case "popular":
        sorted.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
        break;
      case "price_asc":
        sorted.sort((a, b) => {
          if (a.price == null && b.price == null) return 0;
          if (a.price == null) return 1;
          if (b.price == null) return -1;
          return a.price - b.price;
        });
        break;
      case "price_desc":
        sorted.sort((a, b) => {
          if (a.price == null && b.price == null) return 0;
          if (a.price == null) return 1;
          if (b.price == null) return -1;
          return b.price - a.price;
        });
        break;
    }

    return sorted;
  }, [
    products,
    applyTrendFilters,
    selectedCategories,
    searchTerm,
    debouncedSearch,
    communityFilters,
    exchangeFilters,
    listingFilters,
    sortBy,
  ]);

  const displayedProducts = filteredProducts.slice(0, visibleCount);
  const hasMoreProducts = filteredProducts.length > visibleCount;
  const loadMore = () =>
    setVisibleCount((prev) => prev + DEFAULT_EXPLORE_PAGE_SIZE);

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

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
              <div className="flex items-center gap-2 sm:ml-auto">
                <label htmlFor="sort-select-search" className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  Ordenar:
                </label>
                <select
                  id="sort-select-search"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  href={`/products/${product.id}`}
                  currentUserId={user?.uid ?? null}
                  nowTimestamp={nowTimestamp}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              {hasMoreProducts ? (
                <button
                  type="button"
                  onClick={loadMore}
                  className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-100 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Mostrar más
                </button>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No hay más resultados.
                </p>
              )}
            </div>
          </>
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
