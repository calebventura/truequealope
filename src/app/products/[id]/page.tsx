"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { Product } from "@/types/product";
import { createOrder } from "@/lib/orders";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/lib/constants";
import { logContactClick, getContactClicksCount } from "@/lib/contact";
import { UserProfile } from "@/types/user";
import { getCommunityById } from "@/lib/communities";
import { createPermutaOffer } from "@/lib/offers";
import { getAcceptedExchangeTypes } from "@/lib/productFilters";
import { AlertModal } from "@/components/ui/AlertModal";
import { getTrendById, isTrendActive } from "@/lib/trends";

const resolveProfileDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate();
    }
  }
  return null;
};

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
  const [tradeOfferText, setTradeOfferText] = useState("");
  const [permutaCashOffer, setPermutaCashOffer] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  
  // New state for unified contact logic
  const [contactIntent, setContactIntent] = useState<'buy' | 'trade'>('buy');
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [showSellerDetails, setShowSellerDetails] = useState(false);
  const [sellerStats, setSellerStats] = useState<{
    publications: number | null;
    completed: number | null;
  }>({ publications: null, completed: null });
  const [statsLoading, setStatsLoading] = useState(false);
  const [hasRegisteredView, setHasRegisteredView] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    title: string;
    description: string;
    tone?: "info" | "error" | "success";
  } | null>(null);
  const [confirmBuyOpen, setConfirmBuyOpen] = useState(false);

  const trendBadges = useMemo(() => {
    if (!product?.trendTags || product.trendTags.length === 0) return [];
    return product.trendTags
      .map((id) => getTrendById(id))
      .filter((trend): trend is NonNullable<ReturnType<typeof getTrendById>> => Boolean(trend && isTrendActive(trend)))
      .map((trend) => ({
        id: trend.id,
        title: trend.title,
        icon: trend.icon,
      }));
  }, [product]);

  const showAlert = (
    description: string,
    options?: { title?: string; tone?: "info" | "error" | "success" }
  ) => {
    setAlertModal({
      title:
        options?.title ??
        (options?.tone === "success"
          ? "Listo"
          : options?.tone === "error"
          ? "Hubo un problema"
          : "Aviso"),
      description,
      tone: options?.tone ?? "info",
    });
  };

  // Initialize intent based on product type
  useEffect(() => {
    if (product) {
      const acceptedTypes = getAcceptedExchangeTypes(product);
      const hasMoney =
        acceptedTypes.includes("money") ||
        acceptedTypes.includes("exchange_plus_cash");
      const hasTrade = acceptedTypes.some((t) =>
        ["product", "service"].includes(t)
      );
      const isPermutaType = acceptedTypes.includes("exchange_plus_cash");

      if (isPermutaType) {
        setContactIntent("trade");
      } else if (!hasMoney && hasTrade) {
        setContactIntent("trade");
      } else {
        setContactIntent("buy");
      }
    }
  }, [product]);

  useEffect(() => {
    const loadCommunities = async () => {
      return;
    };

    void loadCommunities();
  }, [user]);

  const openWhatsApp = async (
    messageText?: string,
    options?: { beforeLog?: () => Promise<void> }
  ) => {
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
      showAlert("El vendedor no ha configurado su número de WhatsApp.", {
        tone: "info",
        title: "WhatsApp no disponible",
      });
      return;
    }

    const wantedList =
      product.wanted && product.wanted.length > 0
        ? product.wanted.join(", ")
        : "lo que buscas";
    const priceText =
      product.price != null ? ` (S/. ${product.price.toLocaleString()})` : "";
    const defaultMessage =
      contactIntent === "trade"
        ? `Hola, me interesa tu publicacion "${product.title}" para trueque. Buscas: ${wantedList}. Te puedo ofrecer: _____. Te interesa?`
        : `Hola, vi tu publicacion "${product.title}" en Truequealope y estoy interesado en pagar el precio completo${priceText}. Sigue disponible?`;

    setContacting(true);
    try {
      if (options?.beforeLog) {
        await options.beforeLog();
      }
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
    const priceText =
      product.price != null ? ` (S/. ${product.price.toLocaleString()})` : "";
    const message = `Hola, vi tu publicacion "${product.title}" en Truequealope y estoy interesado en pagar el precio completo${priceText}. Sigue disponible?`;
    openWhatsApp(message);
  };

  const handleContactTrade = () => {
    if (!product) return;
    const offer = tradeOfferText.trim();
    if (!offer) {
      setFormError("Describe que ofreces para el trueque.");
      return;
    }
    setFormError(null);
    const wantedList =
      product.wanted && product.wanted.length > 0
        ? product.wanted.join(", ")
        : "lo que buscas";
    const message = `Hola, me interesa tu publicacion "${product.title}" para trueque. Buscas: ${wantedList}. Te puedo ofrecer: ${offer}. Te interesa?`;
    openWhatsApp(message);
  };

  const handleContactPermuta = async () => {
    if (!product) return;
    if (!user) {
      router.push(`/auth/login?next=/products/${id}`);
      return;
    }

    const offer = tradeOfferText.trim();
    const cashValue = permutaCashOffer.trim();
    const cash = Number(cashValue);

    if (!offer) {
      setFormError("Describe el producto o servicio que ofreces.");
      return;
    }
    if (cashValue === "" || Number.isNaN(cash) || cash < 0) {
      setFormError("Ingresa el monto que quieres pagar (0 o mayor).");
      return;
    }

    setFormError(null);
    const referential =
      product.price != null ? `S/. ${product.price.toLocaleString()}` : "N/A";
    const message = `Hola, me interesa permutar tu publicacion "${product.title}". Propongo pagar S/. ${cash.toFixed(2)} y ofrecer: ${offer}. Entiendo que el precio referencial total es ${referential}. Te interesa?`;

    await openWhatsApp(message, {
      beforeLog: async () => {
        await createPermutaOffer({
          productId: product.id!,
          sellerId: product.sellerId,
          userId: user.uid,
          itemOffer: offer,
          cashOffer: Number(cash.toFixed(2)),
        });
      },
    });
  };

  const handleBuy = async () => {
    if (!user) {
      router.push(`/auth/login?next=/products/${id}`);
      return;
    }
    if (!product) return;

    const priceToUse =
      product.price != null
        ? product.price
        : isGiveaway
        ? 0
        : null;

    if (priceToUse == null) {
      showAlert("Este producto no tiene precio de venta.", {
        tone: "info",
        title: "Precio no disponible",
      });
      return;
    }

    setBuying(true);
    try {
      const orderId = await createOrder(product.id!);
      showAlert(`Orden creada con éxito. ID: ${orderId.orderId}`, {
        tone: "success",
        title: "Orden creada",
      });
    } catch (error) {
      console.error("Error al comprar:", error);
      showAlert(`Error al crear la orden: ${(error as Error).message}`, {
        tone: "error",
        title: "No se pudo crear la orden",
      });
    } finally {
      setBuying(false);
    }
  };
  const confirmBuy = async () => {
    setConfirmBuyOpen(false);
    await handleBuy();
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
        showAlert("Link copiado.", {
          tone: "success",
          title: "Listo",
        });
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
    setTradeOfferText("");
    setPermutaCashOffer("");
    setFormError(null);
  }, [product?.id]);

  useEffect(() => {
    const fetchSellerProfile = async () => {
      if (!product) return;

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

  useEffect(() => {
    const fetchSellerStats = async () => {
      if (!product) return;
      setStatsLoading(true);
      try {
        const publicationsSnap = await getDocs(
          query(
            collection(db, "products"),
            where("sellerId", "==", product.sellerId),
            where("status", "in", ["active", "reserved", "sold"])
          )
        );

        const completedOrdersSnap = await getDocs(
          query(
            collection(db, "orders"),
            where("sellerId", "==", product.sellerId),
            where("status", "==", "completed")
          )
        );

        setSellerStats({
          publications: publicationsSnap.size,
          completed: completedOrdersSnap.size,
        });
      } catch (error) {
        console.error("Error fetching seller stats:", error);
        setSellerStats({ publications: null, completed: null });
      } finally {
        setStatsLoading(false);
      }
    };

    void fetchSellerStats();
  }, [product]);

  useEffect(() => {
    const registerView = async () => {
      if (!product?.id) return;
      if (hasRegisteredView) return;
      // No contar al vendedor
      if (user && product.sellerId === user.uid) return;

      // Generar viewerId persistido para anónimos
      let viewerId = user?.uid;
      if (!viewerId) {
        try {
          const key = "viewer_id";
          const existing = localStorage.getItem(key);
          if (existing) {
            viewerId = existing;
          } else {
            const generated = crypto.randomUUID();
            localStorage.setItem(key, generated);
            viewerId = generated;
          }
        } catch (error) {
          console.warn("No se pudo leer/generar viewer_id", error);
          return;
        }
      }

      if (!viewerId) return;

      try {
        await runTransaction(db, async (tx) => {
          const productRef = doc(db, "products", product.id!);
          const viewRef = doc(collection(productRef, "views"), viewerId!);

          const viewSnap = await tx.get(viewRef);
          const productSnap = await tx.get(productRef);

          if (viewSnap.exists()) {
            return;
          }

          const currentCount = (productSnap.data()?.viewCount as number | undefined) ?? 0;

          tx.set(viewRef, {
            viewerId,
            createdAt: serverTimestamp(),
          });

          tx.update(productRef, { viewCount: currentCount + 1 });
        });
        setHasRegisteredView(true);
      } catch (error) {
        console.error("Error registrando vista:", error);
      }
    };

    void registerView();
  }, [product?.id, product?.sellerId, user, hasRegisteredView]);

  // Derivados principales (se calculan siempre para no romper el orden de hooks)
  const listingType = product?.listingType || "product";
  const acceptedTypes = product ? getAcceptedExchangeTypes(product) : [];

  const isGiveaway = acceptedTypes.includes("giveaway");
  const isPermuta = acceptedTypes.includes("exchange_plus_cash");
  const acceptsMoney = acceptedTypes.includes("money") || isPermuta;
  const acceptsTrade = acceptedTypes.some((t) =>
    ["product", "service"].includes(t)
  );
  const isMixed = acceptsMoney && acceptsTrade;

  const sellerIsOwner = user?.uid === product?.sellerId;
  const hasCommunity = !!product?.communityId;
  const communityLabel = product?.communityId
    ? getCommunityById(product.communityId)?.name ?? "Comunidad"
    : "Público";
  const whatsappDisabled =
    contacting ||
    buying ||
    (user ? sellerLoading || !sellerProfile?.phoneNumber : false);

  const buyDisabled =
    buying ||
    contacting ||
    product?.status === "reserved" ||
    (!isGiveaway && product?.price == null);

  const wantedItems = product?.wanted ?? [];
  const wantedPreview =
    wantedItems.length > 0 ? wantedItems.join(", ") : null;

  const categoryLabel =
    product?.categoryId === "other"
      ? product?.otherCategoryLabel || "Otros"
      : (product?.categoryId
          ? CATEGORIES.find((c) => c.id === product.categoryId)?.name
          : null) || "Otro";
  const sellerDisplayName = sellerProfile?.displayName || "Vendedor";
  const sellerPhoto = sellerProfile?.photoURL ?? null;
  const sellerRating =
    typeof sellerProfile?.rating === "number" ? sellerProfile.rating : null;
  const sellerLocationParts = [
    sellerProfile?.district,
    sellerProfile?.province,
    sellerProfile?.department,
  ]
    .filter(Boolean)
    .join(", ");
  const sellerLocation = sellerProfile?.address || sellerLocationParts || null;
  const sellerCreatedAt = resolveProfileDate(sellerProfile?.createdAt);
  const sellerSinceLabel = sellerCreatedAt
    ? sellerCreatedAt.toLocaleDateString()
    : null;
  const sellerStatusMessage = sellerLoading
    ? "Cargando datos del vendedor..."
    : !sellerProfile
    ? "Datos del vendedor no disponibles."
    : null;

  const getModeBadge = () => {
    if (isGiveaway) return "Regalo 🎁";
    if (isPermuta) return "Permuta 🔄";
    if (acceptsMoney && acceptsTrade) return "Venta / Trueque";
    if (acceptsMoney) return "Venta";
    if (acceptsTrade) return "Trueque";
    return "Consultar";
  };

  const modeBadge = getModeBadge();
  const showContactIntentSelector = isMixed && !isPermuta;
  const whatsappAction = isPermuta
    ? handleContactPermuta
    : contactIntent === "trade"
    ? handleContactTrade
    : handleContactSale;
  const whatsappLabel = isPermuta
    ? "Enviar oferta y contactar"
    : contactIntent === "trade"
    ? "Ofrecer trueque por WhatsApp"
    : "Contactar por WhatsApp";
  const shouldShowTradeFields =
    isPermuta || (acceptsTrade && contactIntent === "trade");
  const permutaTooltipText =
    "Precio referencial total: valor estimado del producto/servicio. Lo que ofreces (producto o servicio) + el monto que propones debe acercarse a este valor.";

  useEffect(() => {
    if (contactIntent === "buy" && !isPermuta) {
      setFormError(null);
    }
  }, [contactIntent, isPermuta]);

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
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
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
                        sizes="80px"
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
                      {categoryLabel}
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
                    {trendBadges.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {trendBadges.map((trend) => (
                          <span
                            key={trend.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800"
                          >
                            {trend.icon && <span>{trend.icon}</span>}
                            {trend.title}
                          </span>
                        ))}
                      </div>
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
                  <div className="flex flex-col gap-1 mb-2">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {`S/. ${product.price.toLocaleString()}`}
                    </p>
                    {isPermuta && (
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 font-medium">
                          Precio referencial total
                        </span>
                        <div className="relative inline-block group">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-gray-500 dark:text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div className="absolute z-10 left-1/2 -translate-x-1/2 mt-2 w-64 rounded-md bg-gray-900 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            {permutaTooltipText}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {acceptsTrade ? "Solo trueque/intercambio" : "Consultar precio"}
                  </p>
                )}

                {shouldShowTradeFields && wantedPreview && (
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

                <div className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/70 p-5 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center">
                        {sellerPhoto ? (
                          <Image
                            src={sellerPhoto}
                            alt={sellerDisplayName}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <svg
                            className="h-8 w-8 text-gray-400 dark:text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Publicado por
                        </p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {sellerDisplayName}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {sellerSinceLabel && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              Miembro desde {sellerSinceLabel}
                            </span>
                          )}
                          {sellerLocation && (
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4s-3 1.567-3 3.5S10.343 11 12 11z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19.5 8.5c0 7-7.5 11.5-7.5 11.5S4.5 15.5 4.5 8.5A7.5 7.5 0 1119.5 8.5z"
                                />
                              </svg>
                              {sellerLocation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold">
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
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {product.viewCount ?? 0} visitas
                      </span>
                      {sellerRating != null && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold">
                          <svg
                            className="h-4 w-4 text-yellow-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.369 2.449a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118L10.5 15.347a1 1 0 00-1.175 0l-3.352 2.429c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.99 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                          </svg>
                          {sellerRating.toFixed(1)} / 5
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowSellerDetails(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 px-3.5 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors"
                      >
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
                            d="M12 4.5l7.5 4.5v6l-7.5 4.5L4.5 15v-6L12 4.5z"
                          />
                        </svg>
                        Detalles del truequero
                      </button>
                    </div>
                  </div>

                  {sellerStatusMessage && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      {sellerStatusMessage}
                    </p>
                  )}
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
                            {showContactIntentSelector && (
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

                            {/* Campos de oferta para trueque / permuta */}
                            {shouldShowTradeFields && (
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  ¿Qué producto o servicio ofreces?
                                </label>
                                <textarea
                                  value={tradeOfferText}
                                  onChange={(e) => setTradeOfferText(e.target.value)}
                                  rows={2}
                                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="Ej: Laptop usada + clases de inglés"
                                />
                              </div>
                            )}

                            {isPermuta && (
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  Monto que quieres pagar (S/.)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={permutaCashOffer}
                                  onChange={(e) => setPermutaCashOffer(e.target.value)}
                                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="Ej: 150.00"
                                />
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  Tu oferta (producto/servicio) + el monto deben acercarse al precio referencial total.
                                </p>
                              </div>
                            )}

                            {formError && (
                              <p className="text-xs text-red-600 dark:text-red-400">
                                {formError}
                              </p>
                            )}

                            {/* Acciones Principales */}
                            <div className="flex flex-col gap-3">
                                {/* Botón Comprar (Solo si es Venta y hay precio) */}
                                {(acceptsMoney || isGiveaway) && contactIntent === 'buy' && !isPermuta && (
                                    <button
                                    onClick={() => setConfirmBuyOpen(true)}
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
                                    onClick={whatsappAction}
                                    disabled={whatsappDisabled}
                                    className={`w-full bg-white dark:bg-gray-800 border text-green-700 dark:text-green-400 py-3 px-4 rounded-lg font-semibold hover:bg-green-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${contactIntent === 'trade' ? 'border-indigo-600 text-indigo-700 dark:border-indigo-500 dark:text-indigo-400 hover:bg-indigo-50' : 'border-green-600'}`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.517 5.516l1.13-2.256a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    {contacting
                                    ? "Abriendo WhatsApp..."
                                    : whatsappLabel}
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
                          Clics en &quot;Contactar&quot; (WhatsApp)
                        </p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                          {contactClicks !== null ? contactClicks : "—"}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Se cuentan cada vez que un usuario abre el enlace de
                          WhatsApp.
                        </p>
                      </div>

                      {product.status === "sold" && (
                        <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            Detalle de la operación cerrada
                          </p>
                          <div className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                            <p>
                              <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
                                Tipo:{" "}
                              </span>
                              <span className="font-medium">
                                {acceptedTypes.includes("giveaway")
                                  ? "DONACIÓN"
                                  : acceptedTypes.includes("exchange_plus_cash") ||
                                    acceptedTypes.some((t) => t === "product" || t === "service")
                                  ? "TRUQUEADO"
                                  : "VENDIDO"}
                              </span>
                            </p>
                            <p>
                              <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
                                Usuario:{" "}
                              </span>
                              <span className="font-medium">
                                {product.finalBuyerContact ||
                                  product.reservedForContact ||
                                  "No registrado"}
                              </span>
                            </p>
                            {product.finalDealPrice != null && (
                              <p>
                                <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
                                  Monto:{" "}
                                </span>
                                <span className="font-medium">
                                  S/. {product.finalDealPrice.toLocaleString()}
                                </span>
                              </p>
                            )}
                            {product.finalDealItems && (
                              <p className="break-words">
                                <span className="text-xs uppercase text-gray-500 dark:text-gray-400">
                                  Productos/Servicios:{" "}
                                </span>
                                <span className="font-medium">{product.finalDealItems}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

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

        {showSellerDetails && (
          <div className="fixed inset-0 z-[65] flex items-end md:items-center justify-center px-4 py-6 bg-black/50">
            <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Detalles del truequero
                  </p>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {sellerDisplayName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSellerDetails(false)}
                  className="rounded-full border border-gray-200 dark:border-gray-700 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-3">
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Publicaciones</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {statsLoading ? "..." : sellerStats.publications ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-3">
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Operaciones concretadas</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {statsLoading ? "..." : sellerStats.completed ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-3 text-sm">
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Ubicaci¢n</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {sellerLocation || "No especificada"}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-3 text-sm">
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Sobre mi</p>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line">
                    {sellerProfile?.aboutMe?.trim() || "El truequero aún no ha compartido información."}
                  </p>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSellerDetails(false)}
                  className="rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
        <AlertModal
          open={!!alertModal}
          title={alertModal?.title ?? ""}
          description={alertModal?.description ?? ""}
          tone={alertModal?.tone}
          onClose={() => setAlertModal(null)}
        />
        <AlertModal
          open={confirmBuyOpen}
          title="Confirmar compra"
          description={
            product?.price != null
              ? `Vas a comprar "${product.title}" por S/. ${product.price.toLocaleString()}. ¿Deseas continuar?`
              : `Vas a reclamar "${product?.title ?? "este producto"}" sin costo. ¿Deseas continuar?`
          }
          tone="info"
          primaryLabel={buying ? "Procesando..." : "Confirmar"}
          onConfirm={confirmBuy}
          onClose={() => setConfirmBuyOpen(false)}
        />
      </div>
    </div>
  );
}
