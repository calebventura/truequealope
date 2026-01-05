"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { CATEGORIES } from "@/lib/constants";
import { buildTrendHref, getActiveTrends } from "@/lib/trends";
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
import {
  COMMUNITIES,
  getCommunityById,
} from "@/lib/communities";

const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function HomePage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>("all");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("all");
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const trends = getActiveTrends();
  const nowTimestamp = Date.now();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "products"),
          where("status", "in", ["active", "reserved", "sold"])
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

        const validProducts = productsData.filter(p => {
            if (p.status === 'sold') {
                if (!p.soldAt) return false; // Hide if soldAt missing
                return p.soldAt > oneDayAgo;
            }
            return true;
        });

        validProducts.sort((a, b) => {
            // Priority: Active/Reserved (0) < Sold (1)
            const scoreA = a.status === 'sold' ? 1 : 0;
            const scoreB = b.status === 'sold' ? 1 : 0;
            
            if (scoreA !== scoreB) return scoreA - scoreB;
            
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        setProducts(validProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [user]);

  const communityFiltered = products.filter((product) => {
    if (communityFilter === "all") return true;
    if (communityFilter === "public") {
      return (product.visibility ?? "public") !== "community";
    }
    return product.communityId === communityFilter;
  });

  const exchangeFiltered = communityFiltered.filter((product) =>
    matchesExchangeFilter(product, exchangeFilter)
  );
  const filteredProducts = exchangeFiltered.filter((product) =>
    matchesListingFilter(product, listingFilter)
  );

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

        {trends.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Tendencias
              </h2>
              <Link
                href="/search"
                className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
              >
                Ver todas
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {trends.map((trend) => (
                <Link
                  key={trend.id}
                  href={buildTrendHref(trend)}
                  className="group rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-950/40 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {trend.title}
                      </p>
                      {trend.subtitle && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          {trend.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl text-indigo-600 dark:text-indigo-300">
                      {trend.icon ?? "#"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Categorías */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Categorías
          </h2>
          <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide snap-x snap-mandatory">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className="flex-shrink-0 w-32 h-32 bg-white dark:bg-gray-900 rounded-xl shadow-sm flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all border border-gray-100 dark:border-gray-800 snap-start"
              >
                <span className="text-3xl">{category.icon}</span>
                <span className="font-medium text-gray-900 dark:text-gray-200 text-sm text-center px-2">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Header + filtros */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Productos recientes
            </h2>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filtra por comunidad
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", name: "Todas" },
                  { id: "public", name: "Público" },
                  ...COMMUNITIES,
                ].map((community) => {
                  const active = communityFilter === community.id;
                  return (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => setCommunityFilter(community.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:border-indigo-400"
                      }`}
                    >
                      {community.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo de intercambio
            </span>
            <div className="flex flex-wrap rounded-lg bg-white dark:bg-gray-900 p-1 border dark:border-gray-800 shadow-sm w-fit transition-colors gap-1">
              <button
                type="button"
                onClick={() => setExchangeFilter("all")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  exchangeFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setExchangeFilter("sale")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  exchangeFilter === "sale"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Venta
              </button>
              <button
                type="button"
                onClick={() => setExchangeFilter("trade")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  exchangeFilter === "trade"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Trueque
              </button>
              <button
                type="button"
                onClick={() => setExchangeFilter("permuta")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  exchangeFilter === "permuta"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Permuta
              </button>
              <button
                type="button"
                onClick={() => setExchangeFilter("giveaway")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  exchangeFilter === "giveaway"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Regalo
              </button>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tipo de publicacion
            </span>
            <div className="flex flex-wrap rounded-lg bg-white dark:bg-gray-900 p-1 border dark:border-gray-800 shadow-sm w-fit transition-colors gap-1">
              <button
                type="button"
                onClick={() => setListingFilter("all")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  listingFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setListingFilter("product")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  listingFilter === "product"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Producto
              </button>
              <button
                type="button"
                onClick={() => setListingFilter("service")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  listingFilter === "service"
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                Servicio
              </button>
            </div>
          </div>
        </div>

{filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-sm dark:border dark:border-gray-800 transition-colors">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No hay productos para este filtro.
            </p>
            {(exchangeFilter !== "all" || listingFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setExchangeFilter("all");
                  setListingFilter("all");
                }}
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
                        <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-medium">
                          {communityLabel}
                        </span>
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
