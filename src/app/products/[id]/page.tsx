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
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [contactClicks, setContactClicks] = useState<number | null>(null);

  const openWhatsApp = async (messageText: string) => {
    if (!user) {
      router.push(`/auth/login?next=/products/${id}`);
      return;
    }
    if (!product) return;

    let fetchedPhone: string | null | undefined;
    if (!sellerProfile?.phoneNumber) {
      try {
        const sellerDoc = await getDoc(doc(db, "users", product.sellerId));
        const sellerData = sellerDoc.exists()
          ? (sellerDoc.data() as UserProfile)
          : null;
        if (sellerData) {
          setSellerProfile(sellerData);
          fetchedPhone = sellerData.phoneNumber ?? null;
        }
      } catch (error) {
        console.error("Error fetching seller profile:", error);
      }
    }

    const phone = sellerProfile?.phoneNumber ?? fetchedPhone;
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
    const message = `Hola, vi tu publicación "${product.title}" en Truequéalope. ¿Sigue disponible?`;
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
      const orderId = await createOrder(product.id!);
      alert(`Orden creada con éxito. ID: ${orderId.orderId}`);
    } catch (error) {
      console.error("Error al comprar:", error);
      alert(`Error al crear la orden: ${(error as Error).message}`);
    } finally {
      setBuying(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;

    const url = window.location.href;
    const title = product.title;
    const text = `Mira este producto en Truequéalope: ${title}`;

    setSharing(true);
    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }

      if ("clipboard" in navigator && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        alert("Link copiado.");
        return;
      }

      window.prompt("Copia este enlace:", url);
    } catch (error) {
      console.error("Error sharing:", error);
    } finally {
      setSharing(false);
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

          setSellerProfile(null);
          setSellerLoading(false);
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
    const fetchSellerProfile = async () => {
      if (!product) return;

      if (!user) {
        setSellerProfile(null);
        setSellerLoading(false);
        return;
      }

      setSellerLoading(true);
      try {
        const sellerDoc = await getDoc(doc(db, "users", product.sellerId));
        setSellerProfile(
          sellerDoc.exists() ? (sellerDoc.data() as UserProfile) : null
        );
      } catch (error) {
        console.error("Error fetching seller profile:", error);
        setSellerProfile(null);
      } finally {
        setSellerLoading(false);
      }
    };

    void fetchSellerProfile();
  }, [product, user]);

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          Producto no encontrado
        </h1>
        <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
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
    contacting ||
    buying ||
    (user ? sellerLoading || !sellerProfile?.phoneNumber : false);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
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

          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 8a3 3 0 1 0-2.816-4H15a3 3 0 0 0 .184 1.02L8.91 8.49a3 3 0 0 0-1.91-.69 3 3 0 1 0 2.816 4H10a3 3 0 0 0-.184-1.02l6.274-3.47A3 3 0 0 0 18 8Zm-11 7a3 3 0 0 0 1.91-.69l6.274 3.47A3 3 0 0 0 15 19h.184A3 3 0 1 0 18 16a3 3 0 0 0-1.91.69l-6.274-3.47A3 3 0 0 0 10 12H9.816A3 3 0 0 0 7 15Z"
              />
            </svg>
            {sharing ? "Compartiendo..." : "Compartir"}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-gray-800 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Galería de imágenes */}
            <div className="p-6 bg-gray-100 dark:bg-gray-800 flex flex-col gap-4 transition-colors">
              <div className="relative aspect-square w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm transition-colors">
                {selectedImage ? (
                  <Image
                    src={selectedImage}
                    alt={product.title}
                    fill
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
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
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-100 uppercase">
                        {modeBadge}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                      {CATEGORIES.find((c) => c.id === product.categoryId)?.name ||
                        "Otro"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 capitalize">
                      {product.condition === "like-new"
                        ? "Como nuevo"
                        : product.condition === "new"
                        ? "Nuevo"
                        : "Usado"}
                    </span>
                    {product.status === "reserved" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 uppercase">
                        Reservado
                      </span>
                    )}
                    {product.status === "sold" && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 uppercase">
                        Vendido
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {product.createdAt.toLocaleDateString()}
                  </span>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {product.title}
                </h1>

                {canSell && product.price != null ? (
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    S/. {product.price.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {canTrade ? "Solo trueque" : "Sin precio"}
                  </p>
                )}

                {canTrade && wantedPreview && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Busco a cambio:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {wantedItems.map((item, index) => (
                        <span
                          key={`${item}-${index}`}
                          className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="prose prose-sm text-gray-600 dark:text-gray-300 mb-8">
                  <p>{product.description || "Sin descripción."}</p>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
                  {!sellerIsOwner ? (
                    <>
                      {product.status === "sold" ? (
                        <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 py-4 px-4 rounded-lg text-center">
                          <p className="font-semibold">
                            Este producto ya se vendió
                          </p>
                          <p className="text-sm mt-1">
                            Busca otros productos similares en el catálogo.
                          </p>
                        </div>
                      ) : (
                        <div className="fixed bottom-16 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 md:static md:p-0 md:bg-transparent md:border-none z-40 flex flex-col md:flex-col gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] md:shadow-none transition-colors">
                          {canSell && (
                            <button
                              onClick={handleBuy}
                              disabled={buyDisabled}
                              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                                buyDisabled
                                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                  : "bg-green-600 dark:bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500"
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
                              className="w-full bg-white dark:bg-gray-800 border border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 py-3 px-4 rounded-lg font-semibold hover:bg-green-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                              className="w-full bg-white dark:bg-gray-800 border border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 py-3 px-4 rounded-lg font-semibold hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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

                          {user && !sellerLoading && !sellerProfile?.phoneNumber && (
                            <p className="text-xs text-red-600 dark:text-red-400 text-center">
                              El vendedor aún no cargó su número de WhatsApp.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-3 px-4 rounded-lg font-semibold text-center transition-colors">
                        Esta es tu publicación
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900 transition-colors">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                          Clics en “Contactar” (WhatsApp)
                        </p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                          {contactClicks !== null ? contactClicks : "—"}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Se cuentan cada vez que un usuario abre el enlace de
                          WhatsApp.
                        </p>
                      </div>

                      <Link
                        href="/activity?tab=seller"
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold text-center hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
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