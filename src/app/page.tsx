"use client";

import { useEffect, useMemo, useState } from "react";
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
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { ImageCarousel } from "@/components/ui/ImageCarousel";
import { FiltersPanel } from "@/components/FiltersPanel";
import {
  COMMUNITIES,
  getCommunityById,
} from "@/lib/communities";

const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function HomePage() {
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
  const activeTrends = useMemo(() => {
    if (trendFilters.length === 0) return [];
    return trendFilters
      .map((trendId) => getTrendById(trendId))
      .filter(
        (trend): trend is TrendConfig => Boolean(trend && isTrendActive(trend))
      );
  }, [trendFilters]);

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
    const isPublic = (product.visibility ?? "public") !== "community";
    if (includePublic && isPublic) return true;
    if (product.communityId && communityIds.has(product.communityId)) return true;
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
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-sm dark:border dark:border-gray-800 transition-colors">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
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
                    className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col border ${
                      isOwn
                        ? "border-indigo-200 dark:border-indigo-900 ring-1 ring-indigo-200/60 dark:ring-indigo-900/60"
                        : "border-transparent dark:border-gray-800"
                    }`}
                  >
                    <div className="relative aspect-square w-full bg-gray-200 dark:bg-gray-800">
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
                      {product.status === "reserved" && (
                        <div className="absolute top-2 right-2 z-10 bg-yellow-100 dark:bg-yellow-900/80 text-yellow-800 dark:text-yellow-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                          Reservado
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
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
                        <span className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {product.location}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium">
                            {communityLabel}
                          </span>
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
