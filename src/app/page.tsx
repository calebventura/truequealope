"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
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
import { useAuth } from "@/hooks/useAuth";
import { FiltersPanel } from "@/components/FiltersPanel";
import { COMMUNITIES } from "@/lib/communities";
import { ProductCard } from "@/components/ProductCard";
import { useSearchParams, usePathname, useRouter } from "next/navigation";

function HomePageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeFilters, setExchangeFilters] = useState<ExchangeFilter[]>([]);
  const [listingFilters, setListingFilters] = useState<ListingFilter[]>([]);
  const [communityFilters, setCommunityFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [trendFilters, setTrendFilters] = useState<string[]>([]);
  const trendOptions = getActiveTrends();
  const nowTimestamp = Date.now();
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const activeTrends = useMemo(() => {
    if (trendFilters.length === 0) return [];
    return trendFilters
      .map((trendId) => getTrendById(trendId))
      .filter(
        (trend): trend is TrendConfig => Boolean(trend && isTrendActive(trend))
      );
  }, [trendFilters]);

  useEffect(() => {
    const parseMulti = (key: string) =>
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(",").map((v) => v.trim()))
        .filter(Boolean);

    setTrendFilters(parseMulti("trend"));
    setCategoryFilters(parseMulti("category"));
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
    setFiltersHydrated(true);
  }, [searchParams]);

  const syncQueryFromState = useCallback(() => {
    const params = new URLSearchParams();
    categoryFilters.forEach((id) => params.append("category", id));
    trendFilters.forEach((id) => params.append("trend", id));
    communityFilters.forEach((id) => params.append("community", id));
    exchangeFilters.forEach((id) => params.append("exchange", id));
    listingFilters.forEach((id) => params.append("listing", id));

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    categoryFilters,
    communityFilters,
    exchangeFilters,
    listingFilters,
    pathname,
    router,
    searchParams,
    trendFilters,
  ]);

  useEffect(() => {
    if (!filtersHydrated) return;
    syncQueryFromState();
  }, [
    syncQueryFromState,
    categoryFilters,
    trendFilters,
    communityFilters,
    exchangeFilters,
    listingFilters,
  ]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "products"),
          where("status", "in", ["active", "reserved"])
        );

        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate
              ? docSnap.data().createdAt.toDate()
              : new Date(),
            soldAt: docSnap.data().soldAt?.toDate
              ? docSnap.data().soldAt.toDate()
              : docSnap.data().soldAt ? new Date(docSnap.data().soldAt) : undefined,
          })) as Product[];

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const validProducts = productsData.filter(p => p.status !== 'sold');

        validProducts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        setProducts(validProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [user]);

  const matchesTrend = (product: Product, trend: TrendConfig) => {
    const { filters, productIds } = trend;

    // If the product was tagged explicitly with this trend, count it as match.
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

  const applyTrendFilters = (items: Product[]) => {
    if (activeTrends.length === 0) return items;
    return items.filter((product) =>
      activeTrends.some((trend) => matchesTrend(product, trend))
    );
  };

  const trendFiltered = applyTrendFilters(products);
  const categoryFiltered =
    categoryFilters.length === 0
      ? trendFiltered
      : trendFiltered.filter((product) =>
          categoryFilters.includes(product.categoryId)
        );

  const includePublic = communityFilters.includes("public");
  const communityIds = new Set(
    communityFilters.filter((value) => value !== "public")
  );
  const communityFiltered = categoryFiltered.filter((product) => {
    if (communityFilters.length === 0) return true;
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

  const exchangeFiltered = communityFiltered.filter((product) =>
    exchangeFilters.length === 0
      ? true
      : exchangeFilters.some((filter) => matchesExchangeFilter(product, filter))
  );
  const filteredProducts = exchangeFiltered.filter((product) =>
    listingFilters.length === 0
      ? true
      : listingFilters.some((filter) => matchesListingFilter(product, filter))
  );

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
    categoryFilters,
    (value) =>
      CATEGORIES.find((category) => category.id === value)?.name ?? "Categoria",
    "Todas"
  );
  const trendLabel = formatSelectionLabel(
    trendFilters,
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
    (categoryFilters.length > 0 ? 1 : 0) +
    (trendFilters.length > 0 ? 1 : 0) +
    (communityFilters.length > 0 ? 1 : 0) +
    (exchangeFilters.length > 0 ? 1 : 0) +
    (listingFilters.length > 0 ? 1 : 0);

  const activeFilterPills = [
    categoryFilters.length > 0 && {
      key: "category",
      label: `Categoria: ${categoryLabel}`,
      onClear: () => setCategoryFilters([]),
    },
    trendFilters.length > 0 && {
      key: "trend",
      label: `Tendencia: ${trendLabel}`,
      onClear: () => setTrendFilters([]),
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

  const clearAllFilters = () => {
    setCategoryFilters([]);
    setTrendFilters([]);
    setCommunityFilters([]);
    setExchangeFilters([]);
    setListingFilters([]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 md:p-8 shadow-sm mb-10 transition-colors border border-transparent dark:border-gray-800">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">
            Intercambia lo que ya no usas
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Si no encuentras el trueque ideal, también puedes venderlo.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Link
              href="/products/new"
              className="bg-indigo-600 text-white px-5 py-3 rounded-lg text-center font-semibold hover:bg-indigo-700 transition-colors"
            >
              Publicar ahora
            </Link>
            <Link
              href="/search"
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 px-5 py-3 rounded-lg text-center font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Explorar productos
            </Link>
          </div>
        </section>


        <FiltersPanel
          title="Productos recientes"
          activeCount={activeFilterCount}
          pills={activeFilterPills}
          onClearAll={clearAllFilters}
          category={{
            values: categoryFilters,
            options: CATEGORIES,
            onApply: setCategoryFilters,
          }}
          trend={{
            values: trendFilters,
            options: trendOptions,
            onApply: setTrendFilters,
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

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-sm dark:border dark:border-gray-800 transition-colors mt-6">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No hay productos para este filtro.
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3 text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
              >
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 mt-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                href={`/products/${product.id}`}
                currentUserId={user?.uid ?? null}
                nowTimestamp={nowTimestamp}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
