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
import { COMMUNITIES, getCommunityById } from "@/lib/communities";

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
  
  // New state for unified contact logic
  const [contactIntent, setContactIntent] = useState<'buy' | 'trade'>('buy');
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  // Initialize intent based on product type
  useEffect(() => {
    if (product) {
      const acceptedTypes = product.acceptedExchangeTypes || [];
      // Fallback legacy logic
      if (acceptedTypes.length === 0) {
         if (product.mode === 'trade') setContactIntent('trade');
         else setContactIntent('buy');
      } else {
         // Priority: if trade only, set trade. Else default buy.
         const hasMoney = acceptedTypes.includes('money') || acceptedTypes.includes('exchange_plus_cash');
         const hasTrade = acceptedTypes.some(t => ['product', 'service'].includes(t));
         
         if (!hasMoney && hasTrade) {
             setContactIntent('trade');
         } else {
         setContactIntent('buy');
        }
      }
    }
  }, [product]);

  useEffect(() => {
    const loadCommunities = async () => {
      return;
    };

    void loadCommunities();
  }, [user]);

  const openWhatsApp = async (messageText?: string) => {
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

    const wantedList =
      product.wanted && product.wanted.length > 0
        ? product.wanted.join(", ")
        : "lo que buscas";
    const defaultMessage =
      contactIntent === "trade"
        ? `Hola, me interesa tu publicaci¢n "${product.title}" para trueque. Buscas: ${wantedList}. Te puedo ofrecer: _____. ¨Te interesa?`
        : `Hola, vi tu publicaci¢n "${product.title}" en Truequ‚alope. ¨Sigue disponible?`;

    setContacting(true);
    try {
      await logContactClick(product.id!, user.uid, product.sellerId, "whatsapp");
      if (user.uid === product.sellerId) {
        const refreshed = await getContactClicksCount(product.id!, product.sellerId);
        setContactClicks(refreshed);
      }
    } catch (error) {
      console.error("Error registrando clic de contacto:", error);
    } finally {
      setContacting(false);
    }

    const normalizedPhone = phone.replace(/[^\d]/g, "");
    const finalMessage = messageText ?? defaultMessage;
    const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(
      finalMessage
    )}`;
    window.open(waUrl, "_blank");
  };

  const openInstagram = async () => {
    if (!user) {
      router.push(`/auth/login?next=/products/${id}`);
      return;
    }
    if (!product || !sellerProfile?.instagramUser) return;

    setContacting(true);
    try {
      await logContactClick(product.id!, user.uid, product.sellerId, "instagram");
    } catch (error) {
      console.error("Error registrando clic de contacto instagram:", error);
    } finally {
      setContacting(false);
    }

    const igUrl = `https://instagram.com/${sellerProfile.instagramUser}`;
    window.open(igUrl, "_blank");
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
            visibility: data.visibility ?? "public",
            communityId: data.communityId ?? null,
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
        const count = await getContactClicksCount(product.id!, product.sellerId);
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

  const listingType = product.listingType || 'product';
  const acceptedTypes = product.acceptedExchangeTypes || [];
  
  // Fallback for legacy data
  if (acceptedTypes.length === 0) {
      if (product.mode === 'sale') acceptedTypes.push('money');
      else if (product.mode === 'trade') acceptedTypes.push('product');
      else if (product.mode === 'both') { acceptedTypes.push('money'); acceptedTypes.push('product'); }
  }

  const isGiveaway = acceptedTypes.includes('giveaway');
  const isPermuta = acceptedTypes.includes('exchange_plus_cash');
  const acceptsMoney = acceptedTypes.includes('money') || isPermuta;
  const acceptsTrade = acceptedTypes.some(t => ['product', 'service'].includes(t));
  const isMixed = acceptsMoney && acceptsTrade;

  const sellerIsOwner = user?.uid === product.sellerId;
  const hasCommunity = !!product.communityId;
  const communityLabel = product.communityId
    ? getCommunityById(product.communityId)?.name ?? "Comunidad"
    : "Público";
  const whatsappDisabled =
    contacting ||
    buying ||
    (user ? sellerLoading || !sellerProfile?.phoneNumber : false);
  
  const buyDisabled =
    buying ||
    contacting ||
    product.status === "reserved" ||
    (!isGiveaway && product.price == null);

  const wantedItems = product.wanted ?? [];
  const wantedPreview =
    wantedItems.length > 0 ? wantedItems.join(", ") : null;

  const getModeBadge = () => {
      if (isGiveaway) return "Regalo 🎁";
      if (isPermuta) return "Permuta 🔄";
      if (acceptsMoney && acceptsTrade) return "Venta / Trueque";
      if (acceptsMoney) return "Venta";
      if (acceptsTrade) return "Trueque";
      return "Consultar";
  };

  const modeBadge = getModeBadge();

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
              <div className="relative aspect-square w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm transition-colors flex items-center justify-center">
                {selectedImage ? (
                  <Image
                    src={selectedImage}
                    alt={product.title}
                    fill
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-600">
                    <span className="text-6xl mb-2">
                      {listingType === 'service' ? '🛠️' : '📦'}
                    </span>
                    <span className="text-sm font-medium">
                      {listingType === 'service' ? 'Servicio sin imagen' : 'Producto sin imagen'}
                    </span>
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
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        hasCommunity
                          ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {communityLabel}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                      {CATEGORIES.find((c) => c.id === product.categoryId)?.name ||
                        "Otro"}
                    </span>
                    {listingType === 'product' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 capitalize">
                        {product.condition === "like-new"
                          ? "Como nuevo"
                          : product.condition === "new"
                          ? "Nuevo"
                          : "Usado"}
                      </span>
                    )}
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

                {isGiveaway ? (
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                    GRATIS (Regalo)
                  </p>
                ) : acceptsMoney && product.price != null ? (
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {isPermuta ? `S/. ${product.price.toLocaleString()} (Diferencia)` : `S/. ${product.price.toLocaleString()}`}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {acceptsTrade ? "Solo trueque/intercambio" : "Consultar precio"}
                  </p>
                )}

                {(acceptsTrade || isPermuta) && wantedPreview && (
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
                        <div 
                          className={`fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:static md:p-0 md:bg-transparent md:border-none z-40 flex flex-col shadow-[0_-4px_10px_rgba(0,0,0,0.1)] md:shadow-none transition-transform duration-300 ease-in-out ${isPanelExpanded ? "translate-y-0" : "translate-y-[calc(100%-3.25rem)] md:translate-y-0"}`}
                        >
                          {/* Mobile Toggle Header */}
                          <div 
                            className="flex h-13 items-center justify-between px-4 py-3 border-b dark:border-gray-800 md:hidden cursor-pointer bg-gray-50 dark:bg-gray-800"
                            onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                          >
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                              {isPanelExpanded ? "Ocultar acciones" : "Contactar al vendedor"}
                            </span>
                            <button className="text-gray-500 dark:text-gray-400 focus:outline-none">
                              {isPanelExpanded ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                              )}
                            </button>
                          </div>

                          <div className="p-4 flex flex-col gap-3">
                            {/* Intent Selector (Radio Buttons) - Only if mixed */}
                            {isMixed && (
                                <div className="flex gap-4 mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="contactIntent" 
                                            value="buy"
                                            checked={contactIntent === 'buy'}
                                            onChange={() => setContactIntent('buy')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-900 dark:text-gray-100">Pagar precio</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="contactIntent" 
                                            value="trade"
                                            checked={contactIntent === 'trade'}
                                            onChange={() => setContactIntent('trade')}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-900 dark:text-gray-100">Ofrecer trueque</span>
                                    </label>
                                </div>
                            )}

                            {/* Acciones Principales */}
                            <div className="flex flex-col gap-3">
                                {/* Botón Comprar (Solo si es Venta y hay precio) */}
                                {(acceptsMoney || isGiveaway) && contactIntent === 'buy' && (
                                    <button
                                    onClick={handleBuy}
                                    disabled={buyDisabled}
                                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                                        buyDisabled
                                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                        : "bg-green-600 dark:bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-500"
                                    }`}
                                    >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                    {buying
                                        ? "Procesando..."
                                        : isGiveaway ? "Lo quiero (Gratis)" : "Comprar ahora"}
                                    </button>
                                )}

                                {/* Botón Unificado WhatsApp */}
                                <button
                                    onClick={() => openWhatsApp()}
                                    disabled={whatsappDisabled}
                                    className={`w-full bg-white dark:bg-gray-800 border text-green-700 dark:text-green-400 py-3 px-4 rounded-lg font-semibold hover:bg-green-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${contactIntent === 'trade' ? 'border-indigo-600 text-indigo-700 dark:border-indigo-500 dark:text-indigo-400 hover:bg-indigo-50' : 'border-green-600'}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.517 5.516l1.13-2.256a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    {contacting
                                    ? "Abriendo WhatsApp..."
                                    : contactIntent === 'trade' ? "Ofrecer trueque por WhatsApp" : "Contactar por WhatsApp"}
                                </button>

                                {/* Botón Instagram */}
                                {sellerProfile?.instagramUser && (
                                    <button
                                    onClick={openInstagram}
                                    disabled={contacting}
                                    className="w-full bg-white dark:bg-gray-800 border border-pink-500 text-pink-600 dark:text-pink-400 py-3 px-4 rounded-lg font-semibold hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12 6.615 2.25 12 2.25zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" /><circle cx="17.25" cy="6.75" r=".75" fill="currentColor" /></svg>
                                    Contactar por Instagram
                                    </button>
                                )}
                            </div>

                            {user && !sellerLoading && !sellerProfile?.phoneNumber && (
                                <p className="text-xs text-red-600 dark:text-red-400 text-center">
                                El vendedor aún no cargó su número de WhatsApp.
                                </p>
                            )}
                          </div>
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
