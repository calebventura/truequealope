"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product, ProductMode } from "@/types/product";
import { createOrder } from "@/lib/orders";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { logContactClick, getContactClicksCount } from "@/lib/contact";
import { UserProfile } from "@/types/user";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const router = useRouter();
  const { user } = useAuth();
  const [contacting, setContacting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [sellerProfile, setSellerProfile] =
    useState<Partial<UserProfile> | null>(null);
  const [contactClicks, setContactClicks] = useState<number | null>(null);

  const openWhatsApp = async (messageText: string) => {
    if (!user) {
      router.push(`/auth/login?next=/products/${id}`);
      return;
    }
    if (!product) return;

    const phone = sellerProfile?.phoneNumber;
    if (!phone) {
      alert("El vendedor no ha configurado su número de WhatsApp.");
      return;
    }

    setContacting(true);
    try {
      await logContactClick(product.id!, user.uid, product.sellerId, "whatsapp");
      if (user.uid === product.sellerId) {
        const refreshed = await getContactClicksCount(product.id!);
        setContactClicks(refreshed);
      }
    } catch (error) {
      console.error("Error registrando clic de contacto:", error);
    } finally {
      setContacting(false);
    }

    const normalizedPhone = phone.replace(/[^\d]/g, "");
    const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(
      messageText
    )}`;
    window.open(waUrl, "_blank");
  };

  const handleContactSale = () => {
    if (!product) return;
    const message = `Hola, vi tu publicación "${product.title}" en Reutilizalope. ¿Sigue disponible?`;
    openWhatsApp(message);
  };

  const handleOfferTrade = () => {
    if (!product) return;
    const wantedList =
      product.wanted && product.wanted.length > 0
        ? product.wanted.join(", ")
        : "lo que buscas";
    const message = `Hola, me interesa tu publicación "${product.title}" para trueque. Buscas: ${wantedList}. Te puedo ofrecer: _____. ¿Te interesa?`;
    openWhatsApp(message);
  };

  const handleBuy = async () => {
    if (!user) {
      router.push(`/auth/login?next=/products/${id}`);
      return;
    }
    if (!product) return;

    if (product.price == null) {
      alert("Este producto no tiene precio de venta.");
      return;
    }

    setBuying(true);
    try {
      const orderId = await createOrder(
        product.sellerId,
        product.id!,
        product.price
      );
      alert(`Orden creada con éxito. ID: ${orderId.orderId}`);
    } catch (error) {
      console.error("Error al comprar:", error);
      alert(`Error al crear la orden: ${(error as Error).message}`);
    } finally {
      setBuying(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const productData = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate()
              : new Date(),
            mode: data.mode ?? "sale",
          } as Product;

          setProduct(productData);
          if (productData.images && productData.images.length > 0) {
            setSelectedImage(productData.images[0]);
          }

          const sellerDoc = await getDoc(doc(db, "users", productData.sellerId));
          setSellerProfile(
            sellerDoc.exists() ? (sellerDoc.data() as UserProfile) : null
          );
        } else {
          setProduct(null);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    const fetchContactClicks = async () => {
      if (!product || !user || product.sellerId !== user.uid) return;
      try {
        const count = await getContactClicksCount(product.id!);
        setContactClicks(count);
      } catch (error) {
        console.error("Error obteniendo clics de contacto:", error);
        setContactClicks(null);
      }
    };

    fetchContactClicks();
  }, [product, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Producto no encontrado
        </h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const mode: ProductMode = product.mode ?? "sale";
  const canSell = mode === "sale" || mode === "both";
  const canTrade = mode === "trade" || mode === "both";
  const sellerIsOwner = user?.uid === product.sellerId;
  const whatsappDisabled =
    contacting || buying || !sellerProfile?.phoneNumber;
  const buyDisabled =
    buying ||
    contacting ||
    product.status === "reserved" ||
    product.price == null;

  const wantedItems = product.wanted ?? [];
  const wantedPreview =
    wantedItems.length > 0 ? wantedItems.join(", ") : null;

  const modeBadge =
    mode === "trade" ? "Trueque" : mode === "both" ? "Venta / Trueque" : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Volver al listado
        </Link>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Galería de imágenes */}
            <div className="p-6 bg-gray-100 flex flex-col gap-4">
              <div className="relative aspect-square w-full bg-white rounded-lg overflow-hidden shadow-sm">
                {selectedImage ? (
                  <Image
                    src={selectedImage}
                    alt={product.title}
                    fill
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Sin imagen
                  </div>
                )}
              </div>

              {product.images && product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(img)}
                      className={`relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 ${
                        selectedImage === img
                          ? "border-blue-600"
                          : "border-transparent"
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`Vista ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detalles del producto */}
            <div className="p-8 flex flex-col">
              <div className="mb-auto">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2 flex-wrap">
                    {modeBadge && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 uppercase">
                        {modeBadge}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {CATEGORIES.find((c) => c.id === product.categoryId)?.name ||
                        "Otro"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {product.condition === "like-new"
                        ? "Como nuevo"
                        : product.condition === "new"
                        ? "Nuevo"
                        : "Usado"}
                    </span>
                    {product.status === "reserved" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 uppercase">
                        Reservado
                      </span>
                    )}
                    {product.status === "sold" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 uppercase">
                        Vendido
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {product.createdAt.toLocaleDateString()}
                  </span>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {product.title}
                </h1>

                {canSell && product.price != null ? (
                  <p className="text-2xl font-bold text-blue-600 mb-2">
                    ${product.price.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    {canTrade ? "Solo trueque" : "Sin precio"}
                  </p>
                )}

                {canTrade && wantedPreview && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-800">
                      Busco a cambio:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {wantedItems.map((item, index) => (
                        <span
                          key={`${item}-${index}`}
                          className="px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-sm"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="prose prose-sm text-gray-600 mb-8">
                  <p>{product.description || "Sin descripción."}</p>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200">
                  {!sellerIsOwner ? (
                    <>
                      {product.status === "sold" ? (
                        <div className="w-full bg-red-50 border border-red-200 text-red-700 py-4 px-4 rounded-lg text-center">
                          <p className="font-semibold">
                            Este producto ya se vendió
                          </p>
                          <p className="text-sm mt-1">
                            Busca otros productos similares en el catálogo.
                          </p>
                        </div>
                      ) : (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t md:static md:p-0 md:bg-transparent md:border-none z-40 flex flex-col md:flex-col gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none">
                          {canSell && (
                            <button
                              onClick={handleBuy}
                              disabled={buyDisabled}
                              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                                buyDisabled
                                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              }`}
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                                />
                              </svg>
                              {buying
                                ? "Procesando..."
                                : buyDisabled && product.price == null
                                ? "Sin precio"
                                : product.status === "reserved"
                                ? "Reservado"
                                : "Comprar ahora"}
                            </button>
                          )}

                          {canSell && !canTrade && (
                            <button
                              onClick={handleContactSale}
                              disabled={whatsappDisabled}
                              className="w-full bg-white border border-green-600 text-green-700 py-3 px-4 rounded-lg font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.517 5.516l1.13-2.256a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              {contacting
                                ? "Abriendo WhatsApp..."
                                : "Contactar por WhatsApp"}
                            </button>
                          )}

                          {canTrade && (
                            <button
                              onClick={handleOfferTrade}
                              disabled={whatsappDisabled}
                              className="w-full bg-white border border-indigo-600 text-indigo-700 py-3 px-4 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 7h6m0 0V3m0 4L3 6m17 11h-6m0 0v4m0-4l7 1"
                                />
                              </svg>
                              {contacting
                                ? "Abriendo WhatsApp..."
                                : "Ofrecer trueque por WhatsApp"}
                            </button>
                          )}

                          {!sellerProfile?.phoneNumber && (
                            <p className="text-xs text-red-600 text-center">
                              El vendedor aún no cargó su número de WhatsApp.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="w-full bg-gray-100 text-gray-500 py-3 px-4 rounded-lg font-semibold text-center">
                        Esta es tu publicación
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-sm font-medium text-blue-900 mb-1">
                          Clics en “Contactar” (WhatsApp)
                        </p>
                        <p className="text-2xl font-bold text-blue-800">
                          {contactClicks !== null ? contactClicks : "—"}
                        </p>
                        <p className="text-xs text-blue-700">
                          Se cuentan cada vez que un usuario abre el enlace de
                          WhatsApp.
                        </p>
                      </div>

                      <Link
                        href="/activity?tab=seller"
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-blue-700 transition-colors"
                      >
                        Gestionar en Dashboard
                      </Link>
                    </div>
                  )}
                </div>

                <div className="h-32 md:hidden"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
