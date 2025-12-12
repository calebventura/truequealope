"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { CATEGORIES } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";

type ModeFilter = "all" | "sale" | "trade";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  useEffect(() => {
    const fetchProducts = async () => {
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
          })) as Product[];

        productsData.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const mode = product.mode ?? "sale";
    if (modeFilter === "all") return true;
    if (modeFilter === "sale") return mode === "sale" || mode === "both";
    return mode === "trade" || mode === "both";
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">
            Cambia o vende lo que no usas
          </h1>
          <p className="mt-2 text-gray-600">
            Publica en minutos, coordina por WhatsApp y encuentra oportunidades
            cerca de ti.
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
              className="bg-white border border-gray-300 text-gray-800 px-5 py-3 rounded-lg text-center font-semibold hover:bg-gray-50 transition-colors"
            >
              Explorar productos
            </Link>
          </div>
        </section>

        {/* Categorías */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Categorías
          </h2>
          <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide snap-x snap-mandatory">
            {CATEGORIES.map((category) => (
              <Link
                key={category.id}
                href={`/search?category=${category.id}`}
                className="flex-shrink-0 w-32 h-32 bg-white rounded-xl shadow-sm flex flex-col items-center justify-center gap-3 hover:shadow-md transition-shadow border border-gray-100 snap-start"
              >
                <span className="text-3xl">{category.icon}</span>
                <span className="font-medium text-gray-900 text-sm text-center px-2">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Header + filtro modo */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Productos recientes
          </h2>
          <div className="inline-flex rounded-lg bg-white p-1 border shadow-sm w-fit">
            <button
              type="button"
              onClick={() => setModeFilter("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modeFilter === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
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
                  : "text-gray-700 hover:bg-gray-100"
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
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Trueque
            </button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 text-lg">
              No hay productos para este filtro.
            </p>
            {modeFilter !== "all" && (
              <button
                type="button"
                onClick={() => setModeFilter("all")}
                className="mt-3 text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
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
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
                    <div className="relative aspect-square w-full bg-gray-200">
                      {modeBadge && (
                        <div className="absolute top-2 left-2 z-10 bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                          {modeBadge}
                        </div>
                      )}
                      {product.status === "reserved" && (
                        <div className="absolute top-2 right-2 z-10 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                          Reservado
                        </div>
                      )}
                      {product.images && product.images.length > 0 ? (
                        <Image
                          src={product.images[0]}
                          alt={product.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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

